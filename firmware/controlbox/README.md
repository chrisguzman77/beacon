# controlbox, the UNO R3 sketch

`controlbox.ino` drives the beacon head: the 4 digit countdown, the WS2812B LED strip status light (D6),
the servo gauge, and the LCD1602. This build has no crew digit. It takes the Pi's commands in contracts/serial.md and answers `OK` to each, plus
`COUNT:<n>` once a second while a STOPWORK or REST countdown runs. Wiring is hardware guide Step 3.

## Constants to check on the real parts (top of the sketch)

- `COMMON_ANODE`: false for a 3461AS display, true for 3461BS (read the part number on the side).
- The LED strip: WS2812B on D6, 8 LEDs, brightness 40 (Adafruit NeoPixel). Set the LED count to your strip's.
- `NEEDLE_MIN`, `NEEDLE_MAX`: servo angles for index 0 and 10 (hardware guide 7.5). Swap them if the needle runs backwards.

## Upload from the Pi

The gateway holds the UNO's port, so stop it first. One time: `~/.local/bin/arduino-cli core install arduino:avr && ~/.local/bin/arduino-cli lib install LiquidCrystal Servo "Adafruit NeoPixel"`.

```
sudo systemctl stop beacon-gateway
UNO=$(ls /dev/serial/by-id/* | grep -i -E 'arduino|1a86|ch340|wch' | head -1); echo $UNO
~/.local/bin/arduino-cli compile --fqbn arduino:avr:uno ~/beacon/firmware/controlbox && ~/.local/bin/arduino-cli upload -p $UNO --fqbn arduino:avr:uno ~/beacon/firmware/controlbox
```

## TEST at the serial port

`~/beacon/firmware/gateway/.venv/bin/python -m serial.tools.miniterm --echo --eol LF $UNO 9600`. Opening the port
resets the UNO, so wait 2 s. Type each line, Enter. Every command answers `OK`.

| Type | You should see |
|---|---|
| (on open) | LCD `BEACON STARTING` / `WAITING FOR PI`, LED strip blue, countdown blank |
| `INDEX:2`, `INDEX:5`, `INDEX:8` | Needle left, center, right of center; LED green, yellow, red |
| `LCD:STOP WORK  01:30\|LIGHTNING 8 MI` then `STOPWORK:90` | Display `01.30` counting down, LED strobing red, LCD line 1 time counting with the display, `COUNT:89`, `COUNT:88`... |
| `LCD:ENTER PIN\|**` | LCD shows ENTER PIN with no time written over it; the display keeps counting |
| `MUSTER:3` | `OK` only, no crew digit on this build |
| `STOPWORK:5` | Counts down to `COUNT:0`, then LED solid red and display blank |
| `CLEAR` | LED back to the index color (red for INDEX:8) |
| `LCD:HEAT REST  00:10\|HEAT INDEX 116F` then `REST:10` | LED yellow, counts down, at 0 back to the index color |
| `LCD:RELEASED BY\|SMITH 14:32` | Both lines, nothing cut |

Exit miniterm with Ctrl+]. Then `sudo systemctl start beacon-gateway`; the gateway resends the index, crew count,
countdown, and LCD when it opens the port.
