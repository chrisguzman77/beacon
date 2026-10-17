# PlanIT Beacon

## Hardware Build Guide

*Site safety beacon for the PlanIT Control challenge, SwampHacks XII*

Version 4, October 2026. Markdown edition for the repo. The kiosk screens moved to docs/web-guide.md, the simulator is now the Roblox experience in docs/simulator-guide.md, and Appendix D maps the gateway program.

**Where the code lives.** This guide is for Slavik, who owns firmware/. firmware/pod is the MicroPython on the RP2040-Zero. firmware/controlbox is the Arduino sketch on the UNO. firmware/gateway is the Python on the Pi. The serial protocols in Appendix B are also in contracts/serial.md, the Pi to backend messages are in contracts/gateway-ws.md, and the Pi to kiosk messages are in contracts/kiosk-ws.md. Where this guide and a contract disagree, the contract wins. Claude Code cannot run any of these tests, so for every step it tells you what to flash, wire, and run, and what you should see.

This guide covers every physical part of the beacon, how to wire it, how to test each piece as you go, how to calibrate it, how to enclose it in cardboard, and, in Appendix A, how to build it onto a wooden plank instead. Follow it in order. Every step ends with a test so a mistake is caught before the next step hides it. The build is four physical objects. The sensor pod on a mast, the beacon head (the touchscreen with the Pi on its back, the countdown, the status light, and the gauge), the control electronics behind it, and the equipment unit (the fan motor, the emergency stop, and the lockout display).

# 1. Read this first

The beacon is four physical pieces, and three of them have a computer in them that talk to each other over USB cables.

- **The sensor pod.** A Waveshare RP2040-Zero microcontroller with the radar, the lightning flash sensor, the water sensor, the temperature and humidity sensor, the tilt switch, and the infrared receiver for the remote. It senses, it does not decide.

- **The beacon head.** The official Raspberry Pi 7 inch touchscreen with the Pi mounted on its back. It is the face of the beacon. Crew tap their name to check in, supervisors enter the PIN on it, and during a stop work it turns red with the countdown. Beside it sit the four digit countdown display, the color status light, and the servo gauge needle, all driven by an Arduino UNO R3 behind the panel. Those three keep working even if the Pi desktop hangs, which is why they stay.

- **The equipment unit.** A DC motor with a fan blade standing in for a drill rig or winch, an emergency stop button, and the kit's LCD1602 mounted on the unit as its lockout tag. The LCD says RUNNING, or LOCKED OUT with the reason and the countdown, or who released it and when.

- **The brain.** The Raspberry Pi on the back of the touchscreen. It reads the pod and the UNO, runs the safety rules, holds the equipment interlock on its own GPIO pin, plays voice alerts through the speaker, serves the touchscreen kiosk page, and talks to the cloud platform. If the internet dies, the Pi keeps the beacon working alone.

The equipment interlock works like this. The motor is driven by the L293D motor driver chip from the kit, and the chip's enable pin is held high by the Pi. When the Pi pulls that pin low, the motor stops, and it stays stopped until the Pi raises it again. If the Pi crashes or reboots, the pin falls low on its own, which is the safe direction. The LCD on the equipment unit shows why it is locked out, the way a lockout tag on a real machine does.

## 1.1 Conventions used in this guide

- Pin names like GP9 are RP2040-Zero pins, printed on the board. Pin names like D12 or A1 are UNO pins. Pin names like GPIO 18 are Raspberry Pi pins, and the physical header pin number is given in parentheses the first time.

- Every wire is described as FROM a part TO a pin. Color suggestions follow the common convention, red for 5V, orange or yellow for 3.3V, black for ground, anything else for signals.

- Each build step ends with a test labeled TEST. Do not move on until the test passes.

- Code blocks are minimal test programs, not the final firmware. They exist so you can prove each wire works.

## 1.2 Safety and things that break boards

> **Caution.** Never connect 5V to an RP2040-Zero signal pin or a Raspberry Pi GPIO pin. Both are 3.3V devices. The radar's signal lines are already 3.3V, which is why the radar lives on the RP2040 and not the UNO.

> **Caution.** Unplug USB and switch off the power module before adding or moving any wire. Wiring live is how chips die.

> **Caution.** The servo and the motor must be powered from the breadboard power supply module, never from the UNO's 5V pin. The UNO will reset or its USB fuse will trip.

> **Caution.** Every ground must be connected together. The UNO, the RP2040-Zero, the Pi, and the power module share one ground rail. A missing common ground produces readings that look random.

> **Caution.** Keep the fan blade clear of fingers and wires. Mount the motor so the blade spins in open air.

# 2. Parts inventory

Lay everything out on the table and tick each line. Everything in section 2.1 comes from the ELEGOO UNO R3 Project Super Starter Kit. Nothing on this list needs to be bought for the cardboard build. The wooden plank option in Appendix A has its own short shopping list.

## 2.1 From the Elegoo Super Starter Kit

| **Part** | **Quantity** | **Used for** | **Have it** |
|---|---|---|---|
| UNO R3 board with USB cable | 1 | Control box |  |
| 830 point breadboard | 1 | Control box wiring and the power rails |  |
| Prototype expansion shield with mini breadboard | 1 | Optional, can carry the pod wiring |  |
| Breadboard power supply module | 1 | 5V for the servo and motor |  |
| 9V battery and barrel jack snap | 1 | Feeds the power supply module |  |
| LCD1602 text display, 16 pin header | 1 | Equipment unit lockout tag |  |
| 4 digit 7 segment display | 1 | Countdown |  |
| 74HC595 shift register | 1 | Drives the display segments with 3 pins |  |
| RGB LED | 1 | Status light |  |
| SG90 servo | 1 | Gauge needle |  |
| DC motor and fan blade | 1 | The equipment the interlock controls |  |
| L293D motor driver chip | 1 | Switches motor power under the Pi's control |  |
| DHT11 temperature and humidity module | 1 | Pod, heat index |  |
| Water level sensor | 1 | Pod, standing water |  |
| Photoresistor | 1 of 2 | Pod, lightning flash |  |
| Tilt switch | 1 | Pod, knocked over |  |
| IR receiver and remote | 1 each | Optional backup for check in and PIN, the touchscreen is primary |  |
| Push button | 1 of 5 | Emergency stop on the equipment unit |  |
| 10K potentiometer | 1 | LCD contrast |  |
| Resistors 220 ohm | 4 | RGB LED legs and the LCD backlight |  |
| Resistors 1K ohm | 8 | 7 segment display segments |  |
| Resistor 10K ohm | 1 | Photoresistor voltage divider |  |
| Male to male jumper wires | about 40 | Breadboard wiring |  |
| Female to male jumper wires | about 20 | Modules and the Pi header |  |
| Stepper motor, joystick, 1 digit display, thermistor, diodes, transistors |  | Not used, leave in the box |  |

## 2.2 Other hardware you already own

| **Part** | **Used for** | **Have it** |
|---|---|---|
| Raspberry Pi with a 3 amp power supply and microSD card | The brain, mounted on the back of the touchscreen |  |
| Official Raspberry Pi 7 inch touchscreen with its driver board, ribbon cable, standoffs, and two jumper wires | The beacon face, kiosk display |  |
| Waveshare RP2040-Zero | Sensor pod |  |
| USB-C cable, data capable, for the RP2040-Zero | Pod to Pi |  |
| HLK-LD2410B-P radar module, 5 pin header | Pod, work zone presence |  |
| Powered speaker, 3.5 mm or USB | Beacon voice |  |
| Phone with hotspot | Pi internet, crew page, flashlight and clap for tests |  |
| Laptop with microphone and speakers | Dashboard, simulation, thunder |  |

> **Note.** If the speaker is a bare 8 ohm speaker with no amplifier, it cannot be the Pi's voice. See section 4.6 for the alternative where it plays tones from the UNO.

> **Note.** If the Pi is a Pi 5, it has no 3.5 mm jack, so use a USB speaker, and its DSI connector is the small 22 pin type, so the touchscreen needs a 22 pin to 15 pin adapter cable that is not in the screen's box. A Pi 4 or earlier uses the cable supplied with the screen and has the audio jack.

## 2.3 Tools and consumables

| **Item** | **Why** |
|---|---|
| Small flat screwdriver | Pushing stubborn jumper wires, adjusting the potentiometer |
| Scissors or hobby knife | Cardboard cutouts |
| Hot glue gun and sticks, or double sided tape | Holding boards and modules in the boxes |
| Electrical tape | Insulating the photoresistor leads, securing the hood |
| Three cardboard boxes, one shoebox size, one small (phone box size), one about the size of a tissue box | Beacon head and electronics, sensor pod, equipment unit |
| A stick, ruler, or paint stirrer about 40 cm long | Pod mast |
| Printer access, or a marker and paper | Gauge face and labels |
| Multimeter if anyone has one | Checking 5V and 3.3V rails and continuity |

# 3. System map

Before touching a wire, understand what plugs into what.

| **Device** | **Powered by** | **Connected to** | **Carries** |
|---|---|---|---|
| RP2040-Zero pod | USB-C from the Pi | Pi USB port | Sensor lines up, nothing down |
| UNO control electronics | USB A-B from the Pi | Pi USB port | Countdown, status light, gauge, and lockout LCD commands down, countdown echo up |
| 7 inch touchscreen | 5V and GND jumpers from the Pi header | Pi DSI port by ribbon cable | Kiosk page, touch input |
| Raspberry Pi | Its own 3 amp 5V supply | Phone hotspot, speaker, touchscreen, L293D enable, e-stop button | Everything |
| Power supply module | 9V battery | Breadboard rails | 5V for servo and motor only |
| L293D chip | 5V logic from the rail, 5V motor from the rail | Pi GPIO 18, motor | Interlock |
| Speaker | Its own battery or USB | Pi audio out | Voice alerts |

The signal path for a lightning strike, which is the demo that matters most, is this. The photoresistor sees the flash and the RP2040 timestamps it. The laptop microphone hears the thunder and timestamps it. The Pi pairs the two, computes distance as the time gap multiplied by 343 meters per second, and if that is under 16,093 meters (10 miles) it pulls GPIO 18 low so the motor stops, tells the UNO to run the countdown, strobe red, and write LOCKED OUT on the equipment LCD, turns the touchscreen red, and speaks the alert.

## 3.1 Pin map, sensor pod on the RP2040-Zero

| **Part and its pin** | **RP2040-Zero pin** | **Notes** |
|---|---|---|
| Radar TX | GP9 (UART1 RX) | 256000 baud, 3.3V, no divider |
| Radar RX | GP8 (UART1 TX) | Only needed to send config commands |
| Radar OUT | GP5 | Simple presence high or low, fallback if parsing fails |
| Radar VCC | 5V pin | The radar needs 5V power even though its signals are 3.3V |
| Radar GND | GND |  |
| Photoresistor divider node | GP26 (ADC0) | LDR between 3V3 and node, 10K between node and GND |
| Water sensor S | GP27 (ADC1) | Water sensor + to 3V3, - to GND |
| DHT11 S (data) | GP2 | DHT11 + to 3V3, - to GND |
| Tilt switch leg 1 | GP3 | Leg 2 to GND, internal pull up in code |
| IR receiver OUT | GP4 | VCC to 3V3, GND to GND |
| Onboard RGB LED | GP16 | Already on the board, no wiring |

## 3.2 Pin map, control electronics on the UNO R3

| **Part and its pin** | **UNO pin** | **Notes** |
|---|---|---|
| Equipment LCD RS | D12 | The LCD lives on the equipment unit, wired back to the UNO |
| LCD E | D11 |  |
| LCD D4, D5, D6, D7 | D5, D4, D3, D2 | 4 bit mode, LCD D0 to D3 left unconnected |
| LCD RW | GND | Write only |
| LCD VSS, VDD | GND, 5V |  |
| LCD V0 (contrast) | Potentiometer wiper | Pot ends to 5V and GND |
| LCD A (backlight +) | 5V through 220 ohm |  |
| LCD K (backlight -) | GND |  |
| 74HC595 DS (pin 14) | D8 | Serial data |
| 74HC595 STCP (pin 12) | D9 | Latch |
| 74HC595 SHCP (pin 11) | D10 | Clock |
| 74HC595 OE (pin 13) | GND | Output always enabled |
| 74HC595 MR (pin 10) | 5V | Never reset |
| 74HC595 VCC (16), GND (8) | 5V, GND |  |
| Display digit pins D1 to D4 | A1, A2, A3, A4 | Analog pins used as digital outputs |
| Display segments a to g and dp | 74HC595 Q0 to Q7 through 1K each | See Step 3.3 for the chip's output pin numbers |
| RGB LED R, G, B | D6, D7, D13 through 220 ohm each | Common leg to GND (common cathode) or 5V (common anode) |
| Servo signal (orange) | A5 | Servo red and brown to the power module rail, not the UNO |
| Spare | A0 | Bare speaker tones if needed |

## 3.3 Pin map, Raspberry Pi

| **Function** | **Pi pin** | **Notes** |
|---|---|---|
| Touchscreen driver board 5V | 5V (physical pin 2) | Red jumper supplied with the screen |
| Touchscreen driver board GND | GND (physical pin 6) | Black jumper supplied with the screen |
| Touchscreen data | DSI port, DISPLAY connector | Ribbon cable, blue side away from the board at both ends |
| L293D enable EN1 | GPIO 18 (physical pin 12) | High runs the motor, low is the interlock |
| Emergency stop button | GPIO 23 (physical pin 16) | Other leg to GND (physical pin 14), internal pull up in code |
| Ground to the breadboard rail | GND (physical pin 9) | Mandatory |
| Speaker | 3.5 mm jack or USB |  |
| Pod and UNO | Any two USB ports |  |

# 4. Software to install before wiring

Do this on the laptop and the Pi while the parts are being laid out. It takes about 30 minutes and removes the most common reason a test fails, which is a missing driver.

## 4.1 Laptop

1. **Arduino IDE.** Install the Arduino IDE 2.x. Open it once, go to Tools, Board, and select Arduino Uno. The LiquidCrystal and Servo libraries are built in.

2. **Thonny.** Install Thonny, the simplest MicroPython editor. It talks to the RP2040-Zero over USB and can flash MicroPython for you.

3. **MicroPython firmware.** Download the latest Raspberry Pi Pico MicroPython UF2 file from micropython.org. The RP2040-Zero uses the same chip as the Pico, so the Pico firmware works.

4. **Raspberry Pi Imager.** Install it if the Pi's SD card is not already set up.

## 4.2 Raspberry Pi

1. Flash Raspberry Pi OS (64 bit, with desktop, the desktop is required for the touchscreen kiosk) with Raspberry Pi Imager. In the imager's settings, set the hostname to beacon, enable SSH, set a username and password, and enter the phone hotspot's Wi-Fi name and password so the Pi joins it on first boot.

2. Boot the Pi on the hotspot. From the laptop on the same hotspot, connect with ssh username@beacon.local.

3. Add your user to the dialout group so it can open serial ports, then reboot. Command: `sudo usermod -aG dialout $USER`

4. Install the Python packages and the kiosk helpers. Command: `sudo apt install -y python3-pip python3-pygame alsa-utils chromium-browser unclutter && pip3 install --break-system-packages pyserial websockets gpiozero fastapi uvicorn`

5. Plug in the speaker and test it. Command: `speaker-test -t wav -c 2 -l 1`. If nothing plays, run `sudo raspi-config` and choose the audio output under System Options.

> **Note.** When both the pod and the UNO are plugged in, they appear as /dev/ttyACM0 and /dev/ttyACM1, and which is which can swap after a reboot. Use the stable names under /dev/serial/by-id/ in the gateway code. A UNO clone with a CH340 chip appears as /dev/ttyUSB0 instead.

# 5. Build steps

## Step 1. Prepare the RP2040-Zero

The RP2040-Zero is the size of a stick of gum. It has 20 pins along its edges plus 9 pads on the back you will not use. Pins are labeled on the board. The USB-C port is at the top, the 5V, GND, and 3V3 pins are the three nearest the USB port.

1. Check whether the board shipped with header pins soldered. If yes, push it into the breadboard so each row of pins lands in its own column of holes, straddling the center channel. If it did not ship with pins and nobody has a soldering iron, skip the breadboard for the pod. Instead, push a male to male jumper wire through each hole you need and bend the wire tip over flat on the back so it holds, then tape the bundle. It is ugly and it works for a weekend.

2. Hold the BOOT button on the board, plug the USB-C cable into the laptop, then release BOOT. A drive named RPI-RP2 appears on the laptop.

3. Drag the MicroPython UF2 file onto the RPI-RP2 drive. The drive disappears by itself when the flash finishes.

4. Open Thonny. In the bottom right corner, click the interpreter name and choose MicroPython (Raspberry Pi Pico) and the board's port. The shell at the bottom shows a >>> prompt.

5. TEST. Paste the program below into Thonny and press Run. The onboard LED should cycle red, green, blue. If it does, the board, the cable, and the firmware all work.

```
from machine import Pin
import neopixel, time
np = neopixel.NeoPixel(Pin(16), 1)
for color in [(20,0,0), (0,20,0), (0,0,20), (0,0,0)]:
    np[0] = color
    np.write()
    time.sleep(0.5)
print('RP2040-Zero OK')
```

> **Note.** If the laptop uses a USB-C cable that only charges, no drive will appear. Use a cable you know carries data.

## Step 2. Wire the sensor pod

Work on the prototype shield's mini breadboard or on one end of the big breadboard. Keep the pod wiring separate from the UNO wiring so the pod can be lifted out into its own box later. Power everything in this step from the RP2040-Zero's own 3V3 and 5V pins. Unplug the USB cable before every sub step.

### 2.1 Ground and power rails

1. Run a jumper from the RP2040-Zero GND pin to the breadboard's blue (minus) rail. This is the pod's ground.

2. Run a jumper from the 3V3 pin to the red (plus) rail. Label this rail 3.3V with tape. Nothing on this rail is allowed to see 5V.

3. Leave the 5V pin free for now. Only the radar uses it.

### 2.2 Radar, HLK-LD2410B-P

The module has a five pin header. The labels are printed on the board next to the pins. Read them, because the order differs between revisions. You are looking for VCC, GND, TX, RX, and OUT.

1. Female to male jumper from radar VCC to the RP2040-Zero 5V pin. The radar is powered at 5V but its signal pins are 3.3V, which is why it is safe on this board.

2. Radar GND to the ground rail.

3. Radar TX to GP9. This is the line that carries presence data.

4. Radar RX to GP8. Only used if you send configuration commands. Wire it anyway.

5. Radar OUT to GP5. This pin goes high when the radar sees someone. It is the fallback if frame parsing is not working by the deadline.

6. Point the radar's flat antenna face away from the table and away from people for the test, then plug in USB.

7. TEST. Run the program below in Thonny. Wave a hand in front of the antenna. You should see frames beginning with f4 f3 f2 f1 scrolling, and the parsed line should show presence 1 with a distance in centimeters that changes as your hand moves. If GP5 reads 1 when a hand is near and 0 when not, the OUT fallback also works.

```
from machine import UART, Pin
import time
u = UART(1, baudrate=256000, tx=Pin(8), rx=Pin(9))
out = Pin(5, Pin.IN)
buf = b''
while True:
    if u.any():
        buf += u.read()
        i = buf.find(b'\xf4\xf3\xf2\xf1')
        if i >= 0 and len(buf) >= i + 23:
            f = buf[i:i+23]
            state = f[8]
            moving = f[9] | (f[10] << 8)
            still = f[12] | (f[13] << 8)
            detect = f[15] | (f[16] << 8)
            print('presence', 1 if state else 0, 'dist_cm', detect,
                  'moving', moving, f[11], 'still', still, f[14], 'OUT', out.value())
            buf = buf[i+23:]
    time.sleep(0.05)
```

> **Note.** If you only see garbage, the baud rate is wrong or TX and RX are swapped. Swap GP8 and GP9 first, that fixes it nine times out of ten. The radar also has a Bluetooth app, HLKRadarTool, that shows live readings on a phone, but Bluetooth and the wired UART cannot run at the same time on most firmware, so close the app before the wired test.

### 2.3 Photoresistor, the lightning flash sensor

A photoresistor's resistance drops when light hits it. On its own it cannot produce a voltage, so it is paired with a fixed resistor to make a voltage divider. The RP2040 reads the voltage at the middle of the divider.

1. Put the photoresistor's two legs in two different breadboard rows. It has no polarity.

2. Jumper from one leg's row to the 3.3V rail.

3. Put the 10K resistor from the other leg's row to a new empty row.

4. Jumper from that new row to the ground rail.

5. Jumper from the junction row (the photoresistor leg that meets the 10K resistor) to GP26. This is the divider's midpoint.

6. Use female to male jumpers to extend the photoresistor on a 15 cm lead so it can be aimed at the laptop screen later. Wrap the exposed legs in electrical tape so they cannot touch.

7. TEST. Run the program below. Cover the photoresistor with a finger and the number should fall. Shine the phone flashlight at it and the number should jump above 50000. Flick the flashlight on for a fraction of a second and the program should print FLASH with a timestamp.

```
from machine import ADC, Pin
import time
ldr = ADC(Pin(26))
base = sum(ldr.read_u16() for _ in range(200)) // 200
print('resting level', base)
thresh = base + 8000
while True:
    v = ldr.read_u16()
    if v > thresh:
        print('FLASH', time.ticks_us(), v)
        time.sleep(0.3)
```

> **Note.** The resting level depends on room light. The final firmware re-measures it at startup and sets the threshold at the resting mean plus six standard deviations, then requires two consecutive samples above it so electrical noise does not fire the alarm.

### 2.4 Water level sensor

1. The module has three pins, S, +, and -. Jumper S to GP27, + to the 3.3V rail, - to the ground rail.

2. Extend it on female to male jumpers so the probe can sit in a cup later.

3. TEST. Read ADC(Pin(27)).read_u16() in a loop the same way as the photoresistor. Dry, it reads near zero. Dip the probe traces into a cup of water and the number climbs with depth.

### 2.5 DHT11 temperature and humidity

1. The kit's DHT11 is a three pin module, S, +, and -. Jumper S to GP2, + to the 3.3V rail, - to the ground rail. The DHT11 is happy at 3.3V.

2. TEST. Run the program below. It prints temperature in Celsius and relative humidity every two seconds. Breathe on the sensor and humidity climbs.

```
import dht, time
from machine import Pin
d = dht.DHT11(Pin(2))
while True:
    d.measure()
    print('temp C', d.temperature(), 'humidity', d.humidity())
    time.sleep(2)
```

### 2.6 Tilt switch

1. The tilt switch is a small metal can with two legs. Inside is a ball that bridges the legs when the can is upright.

2. Jumper one leg to GP3, the other leg to the ground rail.

3. In code, configure GP3 as an input with the internal pull up. Upright reads 0 (the ball connects the pin to ground). Tipped reads 1.

4. TEST. Print Pin(3, Pin.IN, Pin.PULL_UP).value() in a loop while tilting the can.

### 2.7 IR receiver

The kit's receiver is a small black part with a dome and three legs. Facing the dome with the legs pointing down, the legs are OUT, GND, VCC from left to right. Confirm against the kit's PDF before powering it.

1. OUT to GP4, GND to the ground rail, VCC to the 3.3V rail.

2. TEST. Run the program below, point the remote at the dome, and press keys. Each key prints a different code. Write down the codes for 0 to 9, OK, and the arrows. The final firmware maps 0 to 9 to crew numbers and the supervisor PIN.

```
from machine import Pin
import time
ir = Pin(4, Pin.IN)
last = time.ticks_us()
pulses = []
while True:
    v = ir.value()
    now = time.ticks_us()
    if pulses and time.ticks_diff(now, last) > 20000 and len(pulses) > 10:
        bits = ''.join('1' if p > 1200 else '0' for p in pulses[2::2][:32])
        print('code', hex(int(bits, 2)) if bits else '?')
        pulses = []
    if v != getattr(ir, '_p', 1):
        pulses.append(time.ticks_diff(now, last)); last = now; ir._p = v
```

> **Note.** If the decode above is unreliable, install the micropython-ir library (ir_rx) with Thonny's package manager and use its NEC decoder, which is what the Elegoo remote speaks.

### 2.8 Put the pod on its own cable

1. Unplug from the laptop and plug the RP2040-Zero's USB-C cable into the Raspberry Pi. The pod is now a Pi device.

2. TEST on the Pi. Run `ls /dev/serial/by-id/` and note the name containing the words MicroPython or Pico. Then `python3 -m serial.tools.miniterm /dev/serial/by-id/<that name> 115200` shows whatever the pod prints.

## Step 3. Wire the UNO control electronics

Use the big breadboard. The UNO's 5V and GND feed the breadboard's rails for the shift register, the display, the RGB LED, and the equipment LCD. The servo and motor get their power from the power module in Step 4, not from these rails. The LCD is wired here for testing, then in Step 4.7 it moves out to the equipment unit on a bundle of female to male jumpers, keeping the same UNO pins.

### 3.1 Rails

1. Jumper UNO GND to the blue rail. Jumper UNO 5V to the red rail. Label the red rail 5V.

2. If the breadboard's rails are split in the middle (a gap in the painted line), bridge each half with a short jumper so the rail runs the full length.

### 3.2 LCD1602, the equipment lockout tag

The LCD has 16 pins in a row, numbered 1 to 16 from the end nearest the pin marked VSS. Push its header into the breadboard so each pin gets its own column. It will show the equipment's state, RUNNING, LOCKED OUT with the reason and countdown, or who released it. Wire and test it on the breadboard first.

1. Pin 1 VSS to GND rail. Pin 2 VDD to 5V rail.

2. Potentiometer. Put it in the breadboard. Outer legs to 5V and GND. Middle leg (wiper) to LCD pin 3 V0. This sets contrast.

3. Pin 4 RS to D12. Pin 5 RW to GND rail. Pin 6 E to D11.

4. Pins 7 to 10 (D0 to D3) stay empty.

5. Pin 11 D4 to UNO D5. Pin 12 D5 to UNO D4. Pin 13 D6 to UNO D3. Pin 14 D7 to UNO D2.

6. Pin 15 A to 5V rail through a 220 ohm resistor. Pin 16 K to GND rail. This is the backlight.

7. TEST. Upload the sketch below. Turn the potentiometer until text is crisp. If you see a row of boxes, contrast is wrong, keep turning. If you see nothing, check pin 1 and 2.

```
#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
void setup() { lcd.begin(16, 2); lcd.print("RIG 1  RUNNING"); lcd.setCursor(0,1); lcd.print("BEACON LINK OK"); }
void loop() {}
```

### 3.3 74HC595 and the 4 digit display

The display has 12 pins, six on top and six on the bottom. Four of them select which digit is lit, eight select which segments are lit. The 74HC595 turns three UNO pins into eight outputs for the segments. The four digit pins go straight to the UNO. The UNO lights one digit at a time very fast, which the eye blends into four.

First identify the display. Look for a part number on its side. 3461AS means common cathode, 3461BS means common anode. The wiring is identical, only the code's polarity flag changes. The display's pin numbering starts at the bottom left with pin 1 and goes counter clockwise, so the top row is pins 12 down to 7 from left to right. On this family, pins 12, 9, 8, and 6 are the four digit commons, and pins 11, 7, 4, 2, 1, 10, 5, 3 are segments a, b, c, d, e, f, g, dp. Confirm against the kit PDF lesson for the four digit display.

1. Push the 74HC595 into the breadboard straddling the center channel, with its notch (the little half moon) facing left. Pin 1 is bottom left of the notch, pins run counter clockwise, so pin 16 is top left.

2. Chip pin 16 VCC to 5V rail. Chip pin 8 GND to GND rail. Chip pin 10 MR to 5V rail. Chip pin 13 OE to GND rail.

3. Chip pin 14 DS to UNO D8. Chip pin 12 STCP to UNO D9. Chip pin 11 SHCP to UNO D10.

4. Push the display into the breadboard straddling the channel.

5. Segment wiring, each through a 1K resistor. Chip Q0 (pin 15) to display a. Q1 (pin 1) to b. Q2 (pin 2) to c. Q3 (pin 3) to d. Q4 (pin 4) to e. Q5 (pin 5) to f. Q6 (pin 6) to g. Q7 (pin 7) to dp. The 1K resistors keep the current through each UNO digit pin safely under its limit.

6. Digit wiring. Display digit 1 to A1, digit 2 to A2, digit 3 to A3, digit 4 to A4.

7. TEST. Upload the sketch below. It should show 1234. If every digit shows the same wrong pattern, a segment wire is on the wrong chip output. If only some digits light, a digit wire is loose. If the display shows the inverse of what you expect (lit background, dark digits), flip the COMMON_ANODE flag.

```
const int DS = 8, STCP = 9, SHCP = 10;
const int digitPins[4] = {A1, A2, A3, A4};
const bool COMMON_ANODE = false;   // set true for 3461BS
const byte seg[10] = {0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F};
void showDigit(int d, int value) {
  byte pattern = seg[value]; if (COMMON_ANODE) pattern = ~pattern;
  for (int i = 0; i < 4; i++) digitalWrite(digitPins[i], COMMON_ANODE ? LOW : HIGH);
  digitalWrite(STCP, LOW); shiftOut(DS, SHCP, MSBFIRST, pattern); digitalWrite(STCP, HIGH);
  digitalWrite(digitPins[d], COMMON_ANODE ? HIGH : LOW);
  delay(2);
}
void setup() { pinMode(DS,OUTPUT); pinMode(STCP,OUTPUT); pinMode(SHCP,OUTPUT);
  for (int i=0;i<4;i++) pinMode(digitPins[i],OUTPUT); }
void loop() { int n[4]={1,2,3,4}; for (int i=0;i<4;i++) showDigit(i, n[i]); }
```

> **Note.** For a common cathode display the digit pin is pulled LOW to light that digit and HIGH to turn it off, which is what the sketch does when COMMON_ANODE is false.

### 3.4 RGB LED

The RGB LED has four legs. The longest leg is the common. In the Elegoo kit it is common cathode, so the long leg goes to ground and each color leg is driven high to light it. If the long leg is marked as common anode in your kit PDF, wire the long leg to 5V and the code drives each color low to light it.

1. Push the LED into four breadboard rows.

2. Long leg to the GND rail.

3. Red leg to UNO D6 through 220 ohm. Green leg to D7 through 220 ohm. Blue leg to D13 through 220 ohm. The leg order around the long leg is usually R, common, G, B. Confirm with the kit PDF.

4. TEST. A sketch that sets D6, D7, D13 as outputs and writes HIGH to each in turn should show red, green, blue. Mix red and green for yellow.

### 3.5 Servo signal

1. The SG90 has three wires. Brown is ground, red is 5V, orange is signal.

2. Orange to UNO A5. Leave brown and red loose for now, they go to the power module rail in Step 4.

3. Temporarily, for this test only, connect brown to the GND rail and red to the 5V rail so the servo can be checked before the power module exists. Expect the UNO to be fine for a single unloaded servo.

4. TEST. The Arduino Servo library's Sweep example, with the servo attached on A5, should move the horn back and forth. Then move brown and red off the UNO rails again.

> **Note.** The servo's horn, the small white arm, becomes the gauge needle. Fit the single arm horn and note which angle points to the left end of your printed gauge. The final firmware maps index 0 to that angle and index 10 to the other end.

### 3.6 Upload the command test sketch

Before the final firmware exists, this sketch lets the Pi drive the screen, the countdown, the LED, and the needle with text commands over USB. It is also the shape of the final control box firmware.

```
#include <LiquidCrystal.h>
#include <Servo.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
Servo needle;
const int DS=8, STCP=9, SHCP=10; const int digitPins[4]={A1,A2,A3,A4};
const bool COMMON_ANODE=false;
const byte seg[10]={0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F};
long countdown=-1; unsigned long lastTick=0; bool strobe=false; unsigned long lastStrobe=0; bool strobeOn=false;
void showDigit(int d,int v){ byte p=seg[v]; if(COMMON_ANODE)p=~p;
  for(int i=0;i<4;i++)digitalWrite(digitPins[i],COMMON_ANODE?LOW:HIGH);
  digitalWrite(STCP,LOW); shiftOut(DS,SHCP,MSBFIRST,p); digitalWrite(STCP,HIGH);
  digitalWrite(digitPins[d],COMMON_ANODE?HIGH:LOW); delay(2); }
void color(int r,int g,int b){ digitalWrite(6,r); digitalWrite(7,g); digitalWrite(13,b); }
void setup(){ Serial.begin(115200); lcd.begin(16,2); needle.attach(A5);
  pinMode(DS,OUTPUT);pinMode(STCP,OUTPUT);pinMode(SHCP,OUTPUT);
  for(int i=0;i<4;i++)pinMode(digitPins[i],OUTPUT);
  pinMode(6,OUTPUT);pinMode(7,OUTPUT);pinMode(13,OUTPUT); color(0,1,0); lcd.print("RIG 1  RUNNING"); lcd.setCursor(0,1); lcd.print("BEACON LINK OK"); }
void loop(){
  if(Serial.available()){ String s=Serial.readStringUntil('\n'); s.trim();
    if(s.startsWith("STOPWORK:")){ countdown=s.substring(9).toInt(); strobe=true; lcd.clear(); lcd.print("LOCKED OUT"); }
    else if(s=="CLEAR"){ countdown=-1; strobe=false; color(0,1,0); lcd.clear(); lcd.print("RIG 1  RUNNING"); lcd.setCursor(0,1); lcd.print("BEACON LINK OK"); }
    else if(s.startsWith("INDEX:")){ int ix=s.substring(6).toInt(); needle.write(map(ix,0,10,10,170));
      if(ix<4)color(0,1,0); else if(ix<7)color(1,1,0); else color(1,0,0); }
    else if(s.startsWith("LCD:")){ int bar=s.indexOf('|'); lcd.clear(); lcd.print(s.substring(4,bar));
      lcd.setCursor(0,1); lcd.print(s.substring(bar+1)); }
  }
  if(countdown>=0 && millis()-lastTick>=1000){ lastTick=millis(); countdown--; Serial.print("COUNT:"); Serial.println(countdown); if(countdown<0){strobe=false; color(0,1,0);} }
  if(strobe && millis()-lastStrobe>250){ lastStrobe=millis(); strobeOn=!strobeOn; color(strobeOn,0,0); }
  if(countdown>=0){ int m=countdown/60, sc=countdown%60; int n[4]={m/10,m%10,sc/10,sc%10}; for(int i=0;i<4;i++)showDigit(i,n[i]);
    if(countdown%5==0){ lcd.setCursor(0,1); lcd.print("LIGHTNING "); if(m<10)lcd.print('0'); lcd.print(m); lcd.print(':'); if(sc<10)lcd.print('0'); lcd.print(sc); } }
}
```

1. Upload it, open the Serial Monitor at 115200 baud with newline line endings.

2. TEST. Type STOPWORK:90 and press enter. The display counts down from 01:30, the LED strobes red, the LCD says LOCKED OUT with the countdown on its second line, and the monitor prints COUNT lines. Type INDEX:7, the needle swings and the LED goes red. Type LCD:RELEASED BY SMITH|14:32 OCT 17 and the LCD shows both lines. Type CLEAR and everything returns to RUNNING and green.

## Step 4. Power module, motor driver, interlock, e-stop

This step gives the servo and motor their own power and puts the interlock on the Pi. Everything here shares one ground with the UNO and the Pi.

### 4.1 Breadboard power supply module

1. The module has two rows of pins on its underside that plug into the breadboard's power rails at one end. Push it on so its pins land in the red and blue rails. On the big breadboard the UNO already feeds the rails at the other end, so plug the module onto the opposite end of the SAME pair of rails only if you want a single 5V rail. Preferred for safety is to use the breadboard's second pair of rails (the ones on the other long edge) for the module, so the UNO's 5V and the module's 5V never fight each other.

2. Set both of the module's jumpers to 5V. The jumpers are the small caps near each output; each covers two of three pins and the silkscreen shows 5V and 3.3V positions.

3. Connect the 9V battery snap to the module's barrel jack. Leave the module's switch OFF.

4. Run a jumper from the module's GND rail to the UNO's GND rail. This is the common ground. Do not connect the two 5V rails to each other.

5. TEST. Switch the module on. Its LED lights. If you have a multimeter, the module rail reads about 5V. Switch it off again.

> **Note.** A 9V alkaline battery through this module will run the servo and motor for roughly an hour or two of demo use. Bring a spare battery, or power the module from a 9V wall adapter if one is around.

### 4.2 L293D motor driver

The L293D is a 16 pin chip. Notch to the left, pin 1 at bottom left, pins counter clockwise. You only use one of its two channels.

1. Push the chip into the breadboard straddling the center channel, notch left.

2. Pin 16 VCC1 (logic power) to the module's 5V rail. Pin 8 VCC2 (motor power) also to the module's 5V rail. Pins 4, 5, 12, 13 GND to the common ground rail.

3. Pin 2 IN1 to the 5V rail. Pin 7 IN2 to ground. This fixes the motor direction so no pins are needed for direction.

4. Pin 3 OUT1 and pin 6 OUT2 to the two motor leads. Which way round does not matter, it only changes spin direction.

5. Pin 1 EN1 is the interlock. Run a female to male jumper from pin 1 to Raspberry Pi GPIO 18, physical pin 12. The L293D treats 3.3V as a valid high, so the Pi can drive it directly.

6. Run a jumper from the common ground rail to a Raspberry Pi GND pin, physical pin 6. Now the Pi, the UNO, the pod, and the module all share ground.

7. Push the fan blade onto the motor shaft. Mount the motor so the blade spins free. A loop of tape around the motor and the box edge is enough for now.

### 4.3 Servo power

1. Servo brown to the common ground rail. Servo red to the module's 5V rail. Orange stays on UNO A5.

### 4.4 Emergency stop button

1. The kit's push button has four legs. Legs on the same side are connected. Use two diagonally opposite legs.

2. One leg to Raspberry Pi GPIO 23, physical pin 16. The other leg to Pi GND, physical pin 14.

3. In code the pin uses the Pi's internal pull up. Idle reads high, pressed reads low.

### 4.5 TEST the interlock from the Pi

1. Switch the power module ON. Nothing should move yet, because GPIO 18 idles low.

2. On the Pi run the program below. The fan spins for three seconds and stops. Press the button while it runs and it stops at once.

```
from gpiozero import DigitalOutputDevice, Button
import time
motor = DigitalOutputDevice(18)
estop = Button(23)
estop.when_pressed = motor.off
motor.on(); print('fan ON')
time.sleep(3)
motor.off(); print('fan OFF')
```

> **Caution.** If the UNO's LCD flickers or the UNO resets when the motor starts, the motor is drawing from the UNO rail. Check that L293D pin 8 is on the module rail and that the two 5V rails are not joined.

### 4.6 Assemble the equipment unit

The equipment unit is the motor, the e-stop, and the LCD in one small box so a judge sees the beacon and the machine as two separate objects. The beacon decides, the machine obeys and explains.

1. Take the tissue box sized carton. Cut a hole on one side for the motor shaft and tape the motor inside so the fan blade spins in open air outside the box.

2. Cut a window on the front for the LCD. Move the LCD from the breadboard to the box, keeping the same UNO pins, by running a bundle of female to male jumpers from the breadboard rows to the LCD header. Keep the potentiometer on the breadboard, only its wiper wire travels. Tape the LCD behind the window.

3. Cut a hole on top for the push button. Push the button through from inside and hot glue it, with its two wires running to Pi GPIO 23 and Pi GND.

4. Bundle all wires leaving the box with tape and leave 40 cm of slack so the unit can sit apart from the beacon head on the table.

5. Label the box RIG 1 on the front and draw a red circle around the e-stop. Write LOCKOUT TAG above the LCD window.

6. TEST. Send STOPWORK:30 from the UNO serial monitor. The fan stops (once GPIO 18 is wired and the Pi drops it), the LCD reads LOCKED OUT with the countdown, and the beacon head strobes red. Press the e-stop and the Pi drops the fan and the LCD should read E-STOP PRESSED once the gateway sends that line.

### 4.7 If the speaker is a bare 8 ohm speaker

1. Put one of the kit's NPN transistors (PN2222) in the breadboard, flat face toward you, legs E, B, C from left to right.

2. Emitter to ground. Collector to one speaker wire. Other speaker wire to the UNO 5V rail. Base to UNO A0 through a 1K resistor.

3. In the UNO sketch, tone(A0, 880, 200) chirps. The beacon then alarms with tones instead of speech, and the Pi plays nothing.

## Step 5. Mount the touchscreen, connect everything to the Pi, run the gateway test

### 5.1 Touchscreen

The official 7 inch screen comes as the display with a driver board already attached to its back, a ribbon cable, four standoffs with screws, and two jumper wires. The Pi mounts onto the driver board.

1. Power the Pi off and unplug it.

2. Screw the four standoffs into the driver board's threaded holes if they are not already fitted.

3. Connect the ribbon cable. One end goes into the driver board's connector, the other into the Pi's connector labeled DISPLAY (not CAMERA, they look alike). On both connectors, pull the plastic clip out a millimeter, slide the cable in with the blue stiffener facing away from the board, push the clip back in.

4. Set the Pi onto the standoffs and screw it down. Its USB and power ports should face outward on one edge.

5. Run the red jumper from the driver board pin marked 5V to Pi header physical pin 2. Run the black jumper from the driver board pin marked GND to Pi header physical pin 6. This powers the screen from the Pi.

6. Power the Pi with its 3 amp supply. The screen lights and shows the desktop. Touch moves the cursor.

7. If the image is upside down for the way you will mount it, add the line `lcd_rotate=2` to /boot/firmware/config.txt and reboot.

8. In raspi-config under Display Options, turn screen blanking off so the kiosk never goes dark during judging.

9. TEST. Open a terminal on the screen by touch and type a command. If touch is offset, the rotation setting and the mounting orientation disagree.

### 5.2 Kiosk page

1. The gateway serves the beacon kiosk page at `http://localhost:8080/beacon/`. It is Cam's web app built in beacon mode (web guide section 9.3 produces a dist-beacon folder), copied to the Pi at firmware/gateway/kiosk/, and it talks to the gateway's own websocket at ws://localhost:8080/ws (contracts/kiosk-ws.md), so it works with no internet. Until Cam's build arrives, a placeholder HTML file that shows the words BEACON READY in large text is enough for this step.

2. Create the file ~/.config/autostart/kiosk.desktop with these lines. `[Desktop Entry]  Type=Application  Name=Kiosk  Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito http://localhost:8080/beacon`, one per line.

3. Create ~/.config/autostart/unclutter.desktop the same way with `Exec=unclutter -idle 0` so the cursor hides.

4. TEST. Reboot. The kiosk page fills the screen with no browser frame and no cursor. Pressing and holding on the screen for two seconds should not reveal the desktop. If the page shows an error, the gateway is not serving yet, start it first.

### 5.3 Connect the pod and the UNO

1. Plug the UNO's USB cable and the pod's USB-C cable into the Pi. Plug in the speaker. Switch the power module on.

2. On the Pi, list the serial devices. Command: `ls -l /dev/serial/by-id/`. You should see two entries, one for the pod and one for the UNO.

3. Run the gateway test program below. It opens both ports, prints what the pod says, and lets you type UNO commands.

4. TEST. Wave at the radar and see presence change. Flash the phone light at the photoresistor and see FLASH. Type STOPWORK:60 and watch the display count. Speak a voice clip with aplay to confirm the speaker.

```
import serial, glob, threading, sys
ports = glob.glob('/dev/serial/by-id/*')
pod = serial.Serial([p for p in ports if 'Pico' in p or 'MicroPython' in p][0], 115200, timeout=0.1)
uno = serial.Serial([p for p in ports if 'Arduino' in p or 'USB' in p][0], 115200, timeout=0.1)
def reader():
    while True:
        line = pod.readline().decode(errors='ignore').strip()
        if line: print('POD', line)
        line = uno.readline().decode(errors='ignore').strip()
        if line: print('UNO', line)
threading.Thread(target=reader, daemon=True).start()
for cmd in sys.stdin:
    uno.write((cmd.strip() + '\n').encode())
```

> **Note.** The UNO resets when a program opens its serial port. That is normal. Wait two seconds after opening before sending the first command.

## Step 6. Integration tests

1. **Flash to bang.** Stand two meters from the pod. Flash the phone light at the photoresistor and clap three seconds later. The Pi should report a flash, a bang, a gap near 3.0 seconds, and a distance near 1,030 meters (3.0 multiplied by 343). Because that is under 16,093 meters, the fan stops, the countdown starts on the four digit display, the touchscreen turns red with the same countdown, the equipment LCD says LOCKED OUT, and the speaker says the alert.

2. **Reset on new strike.** While the countdown runs, flash and clap again. The countdown returns to its starting value.

3. **Zone clear.** With a stop-work active, stand in front of the radar, then step away. The Pi should report the zone occupied, then clear after ten seconds of no presence.

4. **Check in on the screen.** Tap a crew name tile on the touchscreen. The dashboard's muster list and the beacon's count change.

5. **PIN release.** After the countdown ends, tap SUPERVISOR on the touchscreen and enter the PIN on the keypad. The fan restarts, the LED goes green, and the equipment LCD shows who released it and the time. The remote does the same as a backup.

6. **Heat.** Cup your hands around the DHT11 and breathe on it. Heat index climbs on the LCD.

7. **Water.** Dip the water sensor in a cup. The LCD shows standing water.

8. **Tilt.** Tip the pod. The LCD shows TILTED and the Pi reports the beacon unreliable.

9. **E-stop.** Press the button during normal operation. The fan stops immediately.

10. **Offline.** Turn off the phone hotspot. Flash and clap. The beacon still stops the fan and speaks. Turn the hotspot back on and confirm the queued event reaches the dashboard.

## Step 7. Calibration

### 7.1 Photoresistor against the laptop screen

1. Place the pod so the photoresistor is 10 centimeters from the laptop screen, facing it, with a cardboard hood (a cut down toilet paper tube works) shading it from room light.

2. With the screen showing the Roblox experience at full brightness (auto brightness off), let the firmware measure the resting level for five seconds.

3. Fire the Roblox free play strike ten times (simulator guide section 3.7), or use the kiosk Health screen's TEST FLASH button. Count ten FLASH lines. If you get fewer, lower the threshold multiplier from six standard deviations to four. If you get FLASH lines when nothing happened, raise it.

4. Record the final threshold in firmware/pod/README.md.

### 7.2 Thunder on the laptop microphone

1. The listener is the page in sim/listener, served on the demo laptop with `python3 -m http.server 8090` and opened at http://localhost:8090 in a browser tab with the microphone allowed. It posts BANG to the backend, which relays it to the Pi. Play Roblox's thunder at the volume you will use at the demo.

2. The listener uses a band pass centered at 120 Hz and a sustained rise over a slow baseline, so speech and claps near the laptop do not trigger it. Confirm the thunder triggers and a sentence spoken at the laptop does not.

3. Fire a 3 mile strike in Roblox and record the measured flash to bang on the Pi. Expect about 14 seconds. Write the number in firmware/gateway/README.md.

### 7.3 Radar zone

1. Place the pod where it will sit at the demo, antenna facing the open floor where judges stand.

2. Walk toward it from four meters and note the distance readings at one meter steps. They should fall steadily.

3. Stand still at two meters for ten seconds. Presence should stay 1 (the radar sees still people). Step out of the cone and it should fall to 0 within three seconds.

### 7.4 Water sensor

1. Note the dry reading and the reading with the probe fully submerged. The firmware maps that range to 0 to 100 percent and reports depth in millimeters using the probe's known length of about 40 mm.

### 7.5 Servo gauge

1. Send INDEX:0 and INDEX:10 and adjust the two angles in the sketch until the needle points at the gauge ends. Then send INDEX:5 and confirm it is centered.

## Step 8. Cardboard enclosure

### 8.1 The sensor pod box

1. Take the small box. Cut a rectangular window on the front the size of the radar module's antenna face. The radar must see out through open air, not through cardboard, for best range, although it does work through thin cardboard.

2. Tape the radar inside the box with its antenna in the window, facing out.

3. Cut a small hole in the top and push the photoresistor on its lead through it, pointing forward. Tape the cardboard hood over it so it sees only what is in front.

4. Cut a slot for the DHT11 so its blue grille is exposed to the air on the side of the box.

5. Cut a hole for the IR receiver's dome on the front, below the radar.

6. Tape the RP2040-Zero and its wiring inside. Leave the USB-C port reachable through a notch in the back.

7. Tape the box to the top of the stick. The stick is the mast. The water sensor hangs down on its lead so it can reach a cup on the table.

### 8.2 The beacon head and the control electronics

1. Take the shoebox. Stand it on its long side so the lid faces forward. The lid is the beacon face.

2. Cut a window in the lid the size of the touchscreen's visible area, about 155 by 87 mm. Tape the screen behind the window with the Pi hanging inside the box on its standoffs. Angle the whole box back by propping the bottom rear edge on a folded piece of cardboard so a standing person can tap it.

3. Beside the screen on the lid, cut a window for the four digit display, a hole for the RGB LED, and a hole the size of the servo shaft.

4. Print or draw the gauge face, a half circle with 0 on the left, 5 at the top, and 10 on the right, colored green, yellow, and red. Glue it so the servo shaft comes through its center. Fit the horn as the needle.

5. Hot glue or tape the breadboard, the UNO, and the power module inside the box behind the panel. The breadboard has an adhesive back, peel it.

6. Cut notches in the back for the Pi power cable, the speaker cable, the two USB cables, the pod mast's wires, and the equipment unit's wire bundle.

7. Put the speaker on top of the box.

8. Label the lid, SITE SAFETY BEACON above the screen, STOP WORK COUNTDOWN under the display, HAZARD INDEX under the gauge, SITE STATUS under the LED, TAP TO CHECK IN beside the screen.

### 8.3 The equipment unit

1. The unit built in Step 4.6 sits 30 to 50 cm from the beacon head, connected by its wire bundle. Run the bundle under a strip of tape on the table so nobody catches it.

2. Place it so the fan blade faces the judges and the LCD is readable from standing height.

### 8.4 Table layout

From the judge's view, left to right. The laptop showing the twin, with the pod on its mast beside it and the photoresistor aimed at the laptop screen. The beacon head in the center, angled back. The equipment unit on the right with the fan facing out. The cup of water for the water sensor at the pod's base. The remote next to the beacon head as the backup.

## Step 9. Pre-demo checklist

- Fresh 9V battery in, spare in the bag.

- Phone hotspot on, Pi joined, laptop joined.

- Both USB cables seated, power module switch on, Pi booted, kiosk page up on the touchscreen, gateway running, speaker volume up.

- Equipment LCD says RIG 1 RUNNING and the fan is spinning.

- Crew name tiles on the touchscreen match the names the judges will see on the dashboard.

- Pod aimed at the laptop screen, hood on, threshold measured in the venue light.

- Thunder volume set, mic listener confirmed in the venue noise.

- Radar aimed at where judges will stand, not at a wall or the laptop.

- Cup of water and the water sensor ready.

- Supervisor PIN known, remote in hand as the backup.

- Demo countdown scale set, LCD shows the real 30:00 value beside it.

- One full run of the storm scenario completed at the table before the first judge arrives.

# 6. Troubleshooting

| **Symptom** | **Likely cause** | **Fix** |
|---|---|---|
| RPI-RP2 drive never appears | Charge only cable, or BOOT not held | Use a data cable, hold BOOT before plugging in |
| Thonny cannot find the board | Another program has the port open | Close the Arduino Serial Monitor and any miniterm |
| Radar prints garbage | Baud wrong or TX and RX swapped | Set 256000, swap GP8 and GP9 |
| Radar prints nothing | Not powered at 5V, or Bluetooth app open | VCC to the 5V pin, close HLKRadarTool |
| Photoresistor never fires | Threshold too high or hood too dark | Lower the multiplier, aim at the screen |
| Photoresistor fires randomly | Room light flicker, loose wire | Raise the multiplier, require two samples, re-seat the 10K |
| DHT11 read fails | Wrong pin or reading faster than every 2 s | Check S pin, sleep 2 s between reads |
| LCD shows boxes | Contrast | Turn the potentiometer |
| LCD blank | No power or backlight | Pins 1, 2, 15, 16 |
| Display digits wrong | Segment wire on the wrong Q output | Follow the Q0 to a, Q1 to b order |
| Display inverted | Common anode | Flip COMMON_ANODE |
| Only one digit lights | Digit pins not toggling | Check A1 to A4 wires |
| Servo twitches, UNO resets | Servo on the UNO 5V | Move red to the module rail |
| Fan never spins | GPIO 18 not high, EN1 wire loose, module off | Run the interlock test, check pin 1, switch on |
| Fan spins when it should not | IN1 and IN2 reversed with EN tied high | EN1 must be on GPIO 18, not 5V |
| Pi reads random values | Missing common ground | Ground rail to a Pi GND pin |
| Two serial devices swap names | ttyACM numbering | Use /dev/serial/by-id names |
| No speaker sound | Wrong audio output selected | raspi-config audio, or use USB speaker |
| Touchscreen dark | Ribbon in the CAMERA port, or cable reversed, or 5V jumper missing | Move to DISPLAY, blue side away from the board, check pin 2 and pin 6 |
| Touch offset or inverted | Rotation and mounting disagree | Set or remove lcd_rotate=2 and reboot |
| Kiosk shows the desktop | Autostart file wrong | Check the Exec line, the file must end in .desktop |
| Kiosk page says cannot connect | Gateway not serving | Start the gateway, it serves port 8080 |
| Equipment LCD blank after moving it | A jumper in the bundle came loose | Re-seat all 10 wires, check pins 1, 2, 15, 16 first |
| IR codes inconsistent | Bare decoder timing | Install micropython-ir and use the NEC decoder |

# Appendix A. Building the beacon on a wooden plank

A plank build looks like a product instead of a prototype, survives being carried across a venue, and lets judges see every part. The idea is one board that carries everything, with a mast for the pod, a front panel for the displays, and the fan on a block at the side. It takes about three extra hours and a short trip to a hardware store.

## A.1 Hardware to buy

| **Item** | **Size or type** | **Why** | **Approx. cost** |
|---|---|---|---|
| Pine board or plywood | 1 by 8 inch pine, 24 inches long, or half inch plywood 12 by 24 inches | The base everything mounts to | $8 to $12 |
| Mast | 3/4 inch square dowel or a 1 by 2 strip, 18 to 24 inches | Holds the pod up at antenna height | $3 |
| Small corner bracket | 1 inch L bracket with screws, 2 pieces | Holds the mast upright on the base | $3 |
| Wood screws | #6 by 3/4 inch, box of 25 | Mounting brackets and blocks | $4 |
| Small machine screws or standoffs for the Pi | M2.5 by 10 mm screws with nuts, or M2.5 nylon standoffs, 4 | Pi mounting holes | $4 |
| Small pan head screws for the UNO | #4 by 1/2 inch, 3 | UNO mounting holes | included above or $3 |
| Adhesive cable clips or zip tie mounts | Pack of 20, with zip ties | Cable routing | $5 |
| Double sided foam tape | One roll | Breadboard, power module, speaker | $4 |
| Thin front panel | A sheet of 1/8 inch hardboard or stiff cardboard, 10 by 8 inches | The touchscreen, the countdown display, the LED, and the gauge mount in it | $3 or free |
| Second small block or two more L brackets | 2 by 4 offcut or 1 inch brackets | Holds the front panel at a 30 degree lean | free or $3 |
| Scrap block | 2 by 4 offcut, 4 inches long | Motor mount at the side | free |
| Rubber feet | 4 adhesive | Stops the plank sliding | $3 |
| Sandpaper | 120 grit sheet | Edges | $2 |
| Optional paint or marker | Safety yellow or black | Looks the part | $5 |

Tools needed beyond the cardboard build: a drill with 1/16 inch and 1/8 inch bits (a hand drill or a borrowed cordless drill is fine), a Phillips screwdriver, a pencil, a ruler, and a saw if the board needs trimming. If no drill is available, everything except the Pi standoffs can be done with foam tape and hot glue, and the Pi can sit in its own case taped down.

## A.2 Layout

Looking down at the board, long side toward you.

| **Zone** | **Position** | **Contents** |
|---|---|---|
| Back left | Rear edge, left 5 inches | Mast with the pod box on top |
| Back center | Rear edge, center | Front panel leaning back 30 degrees with the touchscreen, countdown, LED, and gauge facing forward, the Pi on the screen's back |
| Back right | Rear edge, right 4 inches | Equipment unit block with the fan facing outward, the LCD and e-stop on its front |
| Front left | Front half, left | Breadboard and the UNO |
| Front center | Front half, center | Power module and the 9V battery |
| Front right | Front half, right | Speaker |
| Front edge | Right, near the edge | Emergency stop on the front of the equipment block, easy to slap |

## A.3 Step by step

1. Sand the board's edges and corners so nobody gets a splinter at the table. Wipe it clean.

2. With everything unplugged, set the parts on the board in the layout above and shuffle until cables reach. Mark the outline of each part with a pencil. Mark the Pi's four holes and the UNO's three holes by setting the boards down and marking through the holes.

3. Drill 1/16 inch pilot holes at every mark for a screw. Drill 1/8 inch through holes for the Pi's M2.5 screws if using nuts underneath.

4. The Pi does not mount to the board. It rides on the back of the touchscreen's driver board on the screen's own standoffs, so the front panel carries both.

5. Mount the UNO with three #4 screws through its holes, finger tight only. Put a square of electrical tape on the wood under the UNO so the solder points cannot touch any stray screw head.

6. Peel the breadboard's adhesive and press it down beside the UNO. Foam tape the power module and the speaker where marked. Tape the 9V battery down with a strip of foam tape so it can be swapped.

7. Build the mast. Screw the two L brackets to the bottom end of the dowel, then screw the brackets to the board at the back left. Check it stands straight. The pod box goes on top, held with a wrap of tape or two small screws through the box into the dowel. Run the pod's USB-C cable and the water sensor lead down the mast, held with two zip ties.

8. Build the front panel. Cut the hardboard to about 10 by 8 inches. Cut a window for the touchscreen's visible area (about 155 by 87 mm) on the left two thirds, and on the right third cut the countdown display window, the RGB LED hole, and the servo shaft hole. Glue the printed gauge face on. The screen has four M3 holes on its back corners, pass M3 screws through the panel into them, or hot glue the screen's bezel to the back of the panel. The Pi is already on the screen's back. Hot glue the four digit display from behind, push the RGB LED through its hole, and screw or glue the servo to the back of the panel so its shaft comes through the gauge center. Fit the horn as the needle. Screw a block to the board at the back center and screw the panel to it so it leans back about 30 degrees.

9. Build the equipment unit. Screw the 2 by 4 block to the back right corner. Zip tie or hot glue the motor to the outer face of the block so the fan blade spins outward over the edge of the board with nothing in its path. Hot glue the LCD to the front face of the block, in a cutout if the block is a small box, with its jumper bundle running back to the breadboard along the right edge. Glue the e-stop button to the front of the block below the LCD. Write RIG 1 on the block and LOCKOUT TAG above the LCD.

10. Paint or draw a red circle around the e-stop and run its two wires to the Pi header along the right edge with the rest.

11. Route cables. Everything from the front half runs to the back half along the right edge, held with cable clips. The two USB cables go from the Pi to the UNO and up the mast. Keep the L293D enable wire and the e-stop wires short and clipped so a judge brushing the board cannot pull them.

12. Re-run the Step 6 integration tests on the finished board before anything is painted or labeled, because mounting can loosen breadboard wires.

13. Label with a marker or printed labels, SITE SAFETY BEACON, TAP TO CHECK IN, STOP WORK COUNTDOWN, HAZARD INDEX, SITE STATUS, RIG 1, LOCKOUT TAG, EMERGENCY STOP. Stick the rubber feet on the bottom.

## A.4 Things to keep in mind on wood

- Wood does not conduct, but screw heads do. Any board on screws must be on standoffs or on tape, never flat on a screw head.

- Hot glue holds modules well on wood and peels off cleanly afterward, so glue what you might want back.

- Keep the breadboard's adhesive, it is stronger than tape and survives the trip.

- Leave the pod's USB-C cable a little slack at the mast top so a knock does not tear the port.

- If the venue lights are bright, the pod box on the mast can still be aimed at the laptop screen by turning the whole board, so plan the table layout with the mast nearest the laptop.

# Appendix B. Serial protocol reference

## B.1 Pod to Pi, one line every 100 ms

```
P:1,D:182,S:41,M:12,T:33.1,H:78,W:0,TILT:0
   P presence 0 or 1    D detection distance cm    S still energy 0 to 100
   M moving energy 0 to 100    T temperature C    H humidity percent
   W water level 0 to 100    TILT 0 upright 1 tipped
FLASH:1729170131045123     immediate, microsecond timestamp of a light spike
IR:7                       remote key pressed
```

## B.2 Pi to UNO commands

```
STOPWORK:1800     start or restart the countdown in seconds, strobe red
CLEAR             end stop work, green
INDEX:7           needle to 7 of 10, color by band
LCD:line one|line two
MUSTER:3          crew count, mirrored to the touchscreen
REST:900          rest break countdown
```

## B.3 Equipment LCD messages the gateway sends

```
LCD:RIG 1  RUNNING|BEACON LINK OK          normal
LCD:LOCKED OUT|LIGHTNING 8MI 27:41       stop work, the UNO keeps the time updated
LCD:LOCKED OUT|NEEDS SUPERVISOR          countdown finished
LCD:RELEASED BY SMITH|14:32 OCT 17       after the PIN, held 10 s
LCD:E-STOP PRESSED|RESET AT BEACON
LCD:LOCKED OUT|HEAT REST BREAK 12:00
LCD:BEACON OFFLINE|LOCAL RULES ACTIVE
```

## B.4 UNO to Pi

```
COUNT:1793        once a second while a countdown runs
OK                after any command
```

## B.5 Voice lines the Pi plays

- Lightning detected, [N] miles. Stop work. Clear the zone.

- Countdown reset. New strike.

- All clear in five minutes.

- Zone clear. [N] crew checked in, [N] not checked out.

- Heat index [N]. Rest break in effect.

- Standing water detected at the low point.

- Beacon tipped. Sensors unreliable.

- Supervisor cleared. Equipment power restored.

- Emergency stop pressed.

- Tomorrow's briefing. (followed by the generated text)

# Appendix C. The touchscreen kiosk, the gateway's side

The kiosk is Cam's web page, served by the gateway on the Pi and shown full screen in Chromium. Its seven screens and design rules are in docs/web-guide.md section 9. The messages between the gateway and the page are in contracts/kiosk-ws.md. This appendix is what the gateway has to do for it.

## C.1 Serving

1. The gateway's FastAPI (the same process as everything else) mounts firmware/gateway/kiosk/ as static files at /beacon/ on port 8080 and exposes the websocket at /ws.

2. Until Cam's build exists, serve a one line placeholder page so the Chromium autostart can be tested.

## C.2 The snapshot

1. Keep one dict in memory with every field in the snapshot message. Update fields as pod lines, UNO COUNT lines, backend commands, and local rule results arrive.

2. Send the whole snapshot to every connected kiosk client on connect, on every change, and at least every 250 ms while a countdown runs. Do not send deltas, the page is simpler if every message is complete.

3. The countdown field is the UNO's latest COUNT value. The gateway never runs its own countdown clock, and neither does the page, so the touchscreen, the four digit display, and the equipment LCD always show the same number.

4. The crew list comes from the backend's CREW command, cached to a JSON file on the Pi so it survives a reboot with no internet.

## C.3 Handling the page's messages

1. checkin. Update the crew entry's in flag, send up `{"kind":"checkin","crew_id":...,"action":...,"via":"kiosk"}` (queued if offline), speak nothing, send a snapshot.

2. pin. Compare to SUPERVISOR_PIN. On a match, run the local clear (raise GPIO 18, send CLEAR to the UNO, send the RELEASED BY line to the equipment LCD, play the voice clip, send `{"kind":"pin","value":...,"ok":true}` up). On a mismatch, send one snapshot with pin_error true.

3. play_briefing. Speak the cached briefing in the requested language with the local TTS or the pre rendered WAV.

4. test_flash. Log the next FLASH line from the pod with a TEST tag so calibration can count it. The page draws the white overlay itself.

5. demo_scale. Store it, apply it to the next STOPWORK and REST, forward it up so the dashboard knows.

## C.4 How the kiosk and the hardware stay in sync

The gateway is the single source of truth. When a stop work begins, the gateway drops GPIO 18, sends STOPWORK to the UNO, sends the LOCKED OUT line to the equipment LCD, updates the snapshot so the kiosk takes over the screen, plays the voice clip, and reports the event upstream, in that order. Nothing waits on the network.

# Appendix D. Gateway program map

firmware/gateway is one Python process, started by a systemd service so it comes up before Chromium. Suggested files, one job each.

```
firmware/gateway/
  main.py        starts everything below on one asyncio loop
  config.py      reads .env (BACKEND_URL, GATEWAY_TOKEN, SITE_ID, POD_PORT, UNO_PORT, SUPERVISOR_PIN, DEMO_COUNTDOWN_SCALE)
  serial_io.py   opens the pod and UNO ports by /dev/serial/by-id, parses pod lines into a dict, parses FLASH, IR, COUNT, OK
  rules.py       the local rules below
  interlock.py   gpiozero OutputDevice on GPIO 18 (initial_value False, so the motor is off until the gateway says otherwise) and Button on GPIO 23 for the e-stop
  uno.py         sends STOPWORK, CLEAR, INDEX, LCD, MUSTER, REST and formats the equipment LCD lines from Appendix B.3
  voice.py       plays the WAV clips from Appendix B.5 with aplay or pygame, and speaks briefings with the local TTS
  cloud.py       websocket client to the backend with reconnect, the offline queue (a JSON lines file), and the command handlers
  kiosk.py       FastAPI on 8080, static files at /beacon/, the /ws snapshot endpoint, the page's up messages
  state.py       the one snapshot dict everything writes into
```

## D.1 Local rules, the ones the Pi runs with no internet

1. Flash to bang. On a FLASH line, record the Pi's own monotonic clock at arrival (not the pod's timestamp, and not the laptop's). On a BANG command from the backend, record the arrival clock too. If a bang arrives between 0.3 and 60 seconds after a flash, distance_m = gap × 343. Under 16093, start a stop work: drop GPIO 18, send STOPWORK:1800 (scaled by demo_scale) to the UNO, send the LOCKED OUT line to the LCD, play the lightning clip with the miles, send local_stopwork up. A second pairing while the countdown runs restarts it and plays the reset clip. Clocks on the pod, the Pi, and the laptop all differ, which is why arrival times are used; network delay costs about 100 meters of accuracy, which does not matter at a 16 kilometer threshold.

2. Backend STOPWORK does the same as a local pairing, so the sim path and the physical path end in one code path.

3. Expiry. When the UNO's COUNT reaches 0, set awaiting_clear, send the NEEDS SUPERVISOR line, keep GPIO 18 low. Only a PIN (kiosk, remote, or backend CLEAR) raises it.

4. Heat. Compute heat index from the pod's T and H with the Rothfusz regression (ML guide section 4). At 103 set led yellow and the heat warning reason. At 115 send REST:900 to the UNO, play the heat clip, and send the HEAT REST BREAK line. Hysteresis of 2 degrees so it does not flap.

5. Water. W above 20 percent sets the standing water flag and plays the water clip once per ten minutes.

6. Tilt. TILT 1 sets led red, the beacon unsafe reason, and the tipped clip. TILT 0 clears it.

7. Zone clear. During a stop work, P has been 0 for 10 seconds sets zone_clear true and plays the zone clear clip with the muster counts.

8. E-stop. The GPIO 23 button drops GPIO 18 immediately in the button's callback, before anything else, then sends the E-STOP line and the estop message up. Reset is a PIN.

9. Offline. When the backend socket is down, set online false, send the BEACON OFFLINE line, and append every up message to the queue file. On reconnect, replay the file in order with original timestamps, then truncate it.

10. State. After any change, and at least once a second, send `{"kind":"state",...}` up and a snapshot to the kiosk.

TEST. Run main.py with the backend URL pointed at nothing. Flash and clap. The fan stops, the display counts, the LCD says LOCKED OUT, the voice plays, and the queue file grows by one line. Point it at the real backend and restart. The queued line appears on the dashboard with its original time.
