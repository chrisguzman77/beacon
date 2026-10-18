"""Beacon sensor pod, MicroPython on the Waveshare RP2040-Zero (hardware guide Step 2, contracts/serial.md).

Core 1 samples the photoresistor at about 5 kHz for lightning flashes and reads the water sensor too, so only one core
ever touches the ADC. Core 0 reads the radar, the DHT11, and the tilt switch, decodes the IR remote, and prints one
status line every 100 ms plus FLASH and IR lines the moment they happen. Copy it to the board as main.py (README.md)."""
import math, time
from array import array

import _thread, dht, micropython, neopixel
from machine import ADC, Pin, UART

# Calibration (hardware guide Step 7). Record the final values in README.md.
REMOTE = 'elegoo21'          # 'elegoo21' (the kit's remote) or 'car17' (arrow pad remote); unknown keys print IRCODE:0x..
FLASH_SIGMA = 6              # flash threshold = resting mean + FLASH_SIGMA standard deviations (7.1: 4 if flashes are missed)
FLASH_MIN_DELTA = 1500       # and at least this far above the mean, so a very steady room does not fire on ADC noise
WATER_DRY, WATER_FULL = 3000, 40000   # read_u16 dry and with the probe fully under (7.4), mapped to W 0..100

KEYS = {
    'elegoo21': {0x16: '0', 0x0C: '1', 0x18: '2', 0x5E: '3', 0x08: '4', 0x1C: '5', 0x5A: '6', 0x42: '7', 0x52: '8',
                 0x4A: '9', 0x40: 'OK', 0x09: 'UP', 0x07: 'DOWN', 0x44: 'LEFT', 0x43: 'RIGHT'},
    'car17': {0x19: '0', 0x45: '1', 0x46: '2', 0x47: '3', 0x44: '4', 0x40: '5', 0x43: '6', 0x07: '7', 0x15: '8',
              0x09: '9', 0x1C: 'OK', 0x18: 'UP', 0x52: 'DOWN', 0x08: 'LEFT', 0x5A: 'RIGHT'},
}
HEAD, TAIL = b'\xf4\xf3\xf2\xf1', b'\xf8\xf7\xf6\xf5'
GREEN, BLUE, OFF = (0, 8, 0), (0, 0, 40), (0, 0, 0)

micropython.alloc_emergency_exception_buf(100)

# Shared between the cores: core 1 writes, core 0 reads. Small ints only, so nothing allocates on core 1.
running = True
flash_count = 0              # bumped by core 1 on every flash
flash_us = 0                 # ticks_us of the latest flash
water_raw = 0
flash_info = None            # (mean, sd, threshold) once core 1 has measured the resting level


def sampler():
    """Core 1. Two samples in a row above the threshold is a flash, then 300 ms of refractory. The resting mean follows
    slow changes in room and screen light (about 1.6 s time constant) and freezes while the light is above threshold."""
    global flash_count, flash_us, water_raw, flash_info
    ldr, water = ADC(Pin(26)), ADC(Pin(27))
    rest = []
    for _ in range(2000):                         # 0.4 s of resting level at startup
        rest.append(ldr.read_u16())
        time.sleep_us(200)
    mean = sum(rest) / len(rest)
    sd = math.sqrt(sum((v - mean) ** 2 for v in rest) / len(rest))
    delta = max(int(FLASH_SIGMA * sd), FLASH_MIN_DELTA)
    mean_q = int(mean) << 8                       # the mean in 1/256 counts, so the slow average stays a small int
    thresh = int(mean) + delta
    flash_info = (int(mean), int(sd), thresh)
    rest = None
    above, k = 0, 0
    last = time.ticks_add(time.ticks_us(), -1000000)
    nxt = time.ticks_us()
    while running:
        v = ldr.read_u16()
        if v > thresh:
            above += 1
            if above == 2:
                t = time.ticks_us()
                if time.ticks_diff(t, last) > 300000:
                    flash_us, last = t, t
                    flash_count += 1
        else:
            above = 0
            mean_q += ((v << 8) - mean_q) >> 13
            thresh = (mean_q >> 8) + delta
        k += 1
        if k >= 500:                              # the water sensor every 100 ms
            k, water_raw = 0, water.read_u16()
        nxt = time.ticks_add(nxt, 200)
        wait = time.ticks_diff(nxt, time.ticks_us())
        if wait > 0:
            time.sleep_us(wait)
        else:
            nxt = time.ticks_us()                 # fell behind, do not try to catch up


# IR: a hard interrupt on every edge stores the time since the previous one; core 0 decodes once the line goes quiet.
_ir_edges = array('l', [0] * 80)
_ir_n = 0
_ir_last = 0


def _ir_edge(pin):
    """Hard IRQ, so no allocation. A gap over 12 ms means this edge starts a new frame."""
    global _ir_n, _ir_last
    t = time.ticks_us()
    dt = time.ticks_diff(t, _ir_last)
    _ir_last = t
    if dt > 12000:
        _ir_n = 0
    elif _ir_n < 80:
        _ir_edges[_ir_n] = dt
        _ir_n += 1


def nec(edges, n):
    """edges[0] is the 9 ms leading burst, edges[1] the 4.5 ms space, then 32 mark and space pairs, LSB first, a long
    space is a 1. Returns the command byte, or None for a repeat frame (2.25 ms space) or a garbled one."""
    if n < 66 or not 7000 < edges[0] < 11000 or not 3500 < edges[1] < 5500:
        return None
    b = [0, 0, 0, 0]
    for i in range(32):
        if edges[3 + 2 * i] > 1120:
            b[i >> 3] |= 1 << (i & 7)
    return b[2] if b[2] ^ b[3] == 0xFF else None


def radar_frames(buf):
    """Pull complete LD2410 frames out of buf. Returns (the newest reading or None, the bytes to keep). A reading is
    (presence, detection distance cm, still energy, moving energy), offsets as in hardware guide 2.2."""
    out = None
    while True:
        i = buf.find(HEAD)
        if i < 0:
            return out, buf[-3:]
        if len(buf) < i + 6:
            return out, buf[i:]
        n = buf[i + 4] | (buf[i + 5] << 8)
        if n < 13 or n > 64:                      # not a target frame, skip this header
            buf = buf[i + 4:]
            continue
        end = i + 6 + n + 4
        if len(buf) < end:
            return out, buf[i:]
        f, buf = buf[i:end], buf[end:]
        if f[-4:] == TAIL and f[7] == 0xAA:
            out = (1 if f[8] else 0, f[15] | (f[16] << 8), f[14], f[11])


def water_pct(raw):
    return max(0, min(100, (raw - WATER_DRY) * 100 // (WATER_FULL - WATER_DRY)))


def status(p, d, s, m, t, h, w, tilt):
    """The contract line. T and H are left out until the DHT11's first good read, never sent as zeros."""
    th = '' if t is None else ',T:%.1f,H:%d' % (float(t), h)
    return 'P:%d,D:%d,S:%d,M:%d%s,W:%d,TILT:%d' % (p, d, s, m, th, w, tilt)


def led(np, rgb):
    np[0] = rgb
    np.write()


def main():
    global running, _ir_n
    keys = KEYS[REMOTE]
    np = neopixel.NeoPixel(Pin(16), 1)
    led(np, GREEN)
    uart = UART(1, baudrate=256000, tx=Pin(8), rx=Pin(9), rxbuf=512)
    radar_out = Pin(5, Pin.IN)
    tilt_pin = Pin(3, Pin.IN, Pin.PULL_UP)
    sensor = dht.DHT11(Pin(2))
    ir = Pin(4, Pin.IN)
    ir.irq(_ir_edge, Pin.IRQ_FALLING | Pin.IRQ_RISING, hard=True)
    _thread.start_new_thread(sampler, ())

    buf, radar, radar_at = b'', (0, 0, 0, 0), time.ticks_add(time.ticks_ms(), -5000)
    temp = hum = None
    tilt = tilt_raw = tilt_same = 0
    seen, info_said, blue_until = 0, False, None
    next_line = next_dht = time.ticks_ms()
    try:
        while True:
            now = time.ticks_ms()
            if flash_count != seen:
                seen = flash_count
                print('FLASH:%d' % flash_us)
                led(np, BLUE)
                blue_until = time.ticks_add(now, 200)
            if blue_until is not None and time.ticks_diff(now, blue_until) >= 0:
                led(np, GREEN)
                blue_until = None
            if not info_said and flash_info:
                info_said = True
                print('INFO:flash mean %d sd %d threshold %d, remote %s' % (flash_info + (REMOTE,)))

            if _ir_n and time.ticks_diff(time.ticks_us(), _ir_last) > 15000:
                cmd = nec(_ir_edges, _ir_n)
                _ir_n = 0
                if cmd is not None:
                    print('IR:' + keys[cmd] if cmd in keys else 'IRCODE:0x%02X' % cmd)

            if uart.any():
                reading, buf = radar_frames(buf + uart.read())
                if reading:
                    radar, radar_at = reading, now

            if time.ticks_diff(now, next_dht) >= 0:
                next_dht = time.ticks_add(now, 2000)
                try:
                    sensor.measure()
                    temp, hum = sensor.temperature(), sensor.humidity()
                except OSError:
                    pass                          # a DHT11 misses a read now and then, keep the last good values

            if time.ticks_diff(now, next_line) >= 0:
                next_line = time.ticks_add(now, 100)
                r = tilt_pin.value()              # 1 is tipped; it must read the same 3 times in a row (300 ms)
                if r != tilt_raw:
                    tilt_raw, tilt_same = r, 0
                tilt_same += 1
                if tilt_same >= 3:
                    tilt = r
                if time.ticks_diff(now, radar_at) < 1000:
                    p, d, s, m = radar
                else:                             # no radar frame for 1 s: the OUT pin's simple presence
                    p, d, s, m = radar_out.value(), 0, 0, 0
                print(status(p, d, s, m, temp, hum, water_pct(water_raw), tilt))
            time.sleep_ms(2)
    finally:
        running = False                           # stops core 1 so Ctrl-C leaves a clean REPL for mpremote
        ir.irq(handler=None)
        led(np, OFF)


if __name__ == '__main__':
    main()
