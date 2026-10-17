"""The pod and UNO serial ports. Found by /dev/serial/by-id (ttyACM numbers swap after a reboot), read on a thread each,
lines handed to the asyncio loop, reopened if a cable is pulled."""
import glob, logging, threading, time

import serial

import config

log = logging.getLogger('serial')
NAMES = {'pod': ('micropython', 'pico', 'rp2040'), 'uno': ('arduino', '1a86', 'ch340', 'wch', 'usb_serial')}


def find(kind: str) -> str | None:
    explicit = config.POD_PORT if kind == 'pod' else config.UNO_PORT
    if explicit:
        return explicit
    for path in sorted(glob.glob('/dev/serial/by-id/*')):
        if any(k in path.lower() for k in NAMES[kind]):
            return path
    return None


class Port:
    def __init__(self, kind: str, loop, on_line, on_open=None):
        self.kind, self.loop, self.on_line, self.on_open = kind, loop, on_line, on_open
        self.ser = None
        self._warned = False

    def start(self):
        threading.Thread(target=self._run, name=f'serial-{self.kind}', daemon=True).start()

    def _run(self):
        while True:
            path = find(self.kind)
            if not path:
                if not self._warned:
                    log.warning('%s not found, retrying every 2 s', self.kind)
                    self._warned = True
                time.sleep(2)
                continue
            try:
                ser = serial.Serial(path, 115200, timeout=0.2)
                if self.kind == 'uno':
                    time.sleep(2)   # the UNO resets when its port opens
                self.ser, self._warned = ser, False
                log.info('%s open on %s', self.kind, path)
                if self.on_open:
                    self.loop.call_soon_threadsafe(self.on_open)
                buf = b''
                while True:
                    buf += ser.readline()
                    if buf.endswith(b'\n'):
                        text = buf.decode(errors='ignore').strip()
                        buf = b''
                        if text:
                            self.loop.call_soon_threadsafe(self.on_line, text)
            except (serial.SerialException, OSError) as e:
                log.warning('%s lost (%s), reopening', self.kind, e)
                self.ser = None
                time.sleep(2)

    def write(self, text: str) -> bool:
        ser = self.ser
        if not ser:
            log.debug('%s not open, dropped %s', self.kind, text)
            return False
        try:
            ser.write((text + '\n').encode())
            return True
        except (serial.SerialException, OSError) as e:
            log.warning('%s write failed (%s)', self.kind, e)
            return False


def parse_pod(line: str) -> dict | None:
    """P:1,D:182,S:41,M:12,T:33.1,H:78,W:0,TILT:0 -> dict of numbers, None if it is not a pod line."""
    try:
        out = {}
        for part in line.split(','):
            k, v = part.split(':', 1)
            out[k] = float(v) if '.' in v else int(v)
        return out if 'P' in out and 'TILT' in out else None
    except ValueError:
        return None
