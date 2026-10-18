# Sensor pod (RP2040-Zero, MicroPython)

`main.py` is the whole program. The board needs the Raspberry Pi Pico MicroPython UF2 first (hardware guide Step 1).
Lines and keys follow contracts/serial.md.

## Flash it from the Pi

```
sudo systemctl stop beacon-gateway            # if it runs, it holds the pod's port
cd ~/beacon/firmware/pod && POD=$(ls /dev/serial/by-id/*MicroPython* | head -1)
~/.local/bin/mpremote connect $POD cp main.py :main.py + reset
~/beacon/firmware/gateway/.venv/bin/python -m serial.tools.miniterm $POD 115200    # watch it, Ctrl-] leaves
```

mpremote stops the running program (Ctrl-C), copies, and resets; the program starts by itself on every power up.
`~/.local/bin/mpremote connect $POD repl` also works for watching, but Ctrl-C there stops main.py until the next reset.

## What it prints

```
INFO:flash mean 1830 sd 41 threshold 3330, remote elegoo21    once, half a second after boot (the resting light level)
P:1,D:182,S:41,M:12,T:24.0,H:55,W:0,TILT:0                    every 100 ms; T and H appear after the first DHT11 read (2 s)
FLASH:123456789                                               a light spike, at once (the Pi times it on arrival)
IR:7   IR:OK   IR:UP                                          a remote key, at once
IRCODE:0x45                                                   a key the selected remote map does not know
```

The gateway ignores INFO and IRCODE lines.

## The remote

`REMOTE` at the top of main.py picks the key map.
- `elegoo21` (the default) is the kit's 21-key remote:
  - ▶❚❚ is OK
  - ▲ and ▼ are UP and DOWN
  - ◀◀ and ▶▶ are LEFT and RIGHT
  - 0 to 9 are the digits
- `car17` is the 17-key remote with an arrow pad and an OK key.

If the digits print `IRCODE:0x..` instead of `IR:<digit>`, it is the other remote: switch `REMOTE` and copy again.

## Calibration (hardware guide Step 7)

| Constant | Default | Measured |
|---|---|---|
| `FLASH_SIGMA` (7.1) | 6 standard deviations over the resting mean; 4 if flashes are missed, higher if FLASH fires on nothing | _not yet_ |
| `FLASH_MIN_DELTA` | 1500 counts over the mean at least | _not yet_ |
| `WATER_DRY`, `WATER_FULL` (7.4) | 3000 and 40000 raw (`read_u16`), mapped to W 0..100; set them from the dry and fully submerged readings | _not yet_ |

The resting level is measured at every boot, so start the pod with the photoresistor already in its hood in front of
the laptop screen. The mean then follows slow light changes (a darkening Roblox sky) and freezes during a flash.

## What Slavik should see, part by part

| Part | Do | Line shows |
|---|---|---|
| Board | power up | onboard LED dim green (red means the board's LED has R and G swapped, harmless), INFO line |
| Radar (GP0, GP1, GP5) | stand in front, step away | P 1 with D in cm that changes as you move, P 0 within about 3 s of leaving |
| Photoresistor (GP26) | flick a phone flashlight at it | one FLASH per flick, LED blinks blue |
| Water (GP27) | dip the probe | W climbs from 0 |
| DHT11 (GP2) | breathe on it | H climbs (T and H missing means no reading yet, check the wire) |
| Tilt (GP3) | tip the pod over | TILT 1 after about 0.3 s, back to 0 upright |
| IR receiver (GP4) | press 1, OK, ▲ | IR:1, IR:OK, IR:UP |

If the radar shows D, S, and M stuck at 0 while P still follows people, frames are not parsing and P comes from the
OUT pin fallback: swap the GP0 and GP1 wires (hardware guide 2.2).
