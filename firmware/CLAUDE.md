# firmware

Owner: Slavik. Three programs.
- pod/ MicroPython on the Waveshare RP2040-Zero. Reads the LD2410B radar on UART1, the photoresistor at 5 kHz on core 1 for lightning flashes, the water sensor, the DHT11, the tilt switch, and the IR receiver. Streams one line every 100 ms plus immediate FLASH and IR lines. See contracts/serial.md.
- controlbox/ Arduino sketch on the UNO R3. Drives the 4 digit countdown through the 74HC595, the RGB status LED, the servo gauge needle, and the LCD1602 mounted on the equipment unit as the lockout tag. Parses commands from the Pi. See contracts/serial.md.
- gateway/ Python on the Raspberry Pi. Opens both serial ports, runs the local rules (flash to bang distance, heat, water, tilt), holds the equipment interlock on GPIO 18 and the e-stop on GPIO 23, plays voice clips, serves the kiosk build from web on port 8080 with a local websocket, connects to the backend websocket (contracts/gateway-ws.md), and queues events while offline.

Fixed: the pin maps and protocols in docs/hardware-guide.md and contracts/serial.md. The interlock fails safe (GPIO 18 low stops the motor). The countdown shown on the touchscreen, the 4 digit display, and the equipment LCD all come from the UNO's COUNT echo so they never disagree.

You cannot run hardware tests from here. For every step, tell the human exactly what to flash, what to wire, what to run, and what they should see, using the TEST lines in the guide.

Suggested: pyserial, websockets, gpiozero, FastAPI for the kiosk server, pygame or aplay for audio. Pre rendered WAV clips for the fixed voice lines.

Guide: docs/hardware-guide.md. Appendix D is the gateway program map and its local rules. The kiosk page's messages are contracts/kiosk-ws.md, and Cam's kiosk build is copied to firmware/gateway/kiosk/ (gitignored, see below).

## Decisions
