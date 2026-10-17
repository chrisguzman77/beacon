# firmware

Owner: Slavik. Three programs.
- pod/ MicroPython on the Waveshare RP2040-Zero. Reads the LD2410B radar on UART1, the photoresistor at 5 kHz on core 1 for lightning flashes, the water sensor, the DHT11, the tilt switch, and the IR receiver. Streams one line every 100 ms plus immediate FLASH and IR lines. See contracts/serial.md.
- controlbox/ Arduino sketch on the UNO R3. Drives the 4 digit countdown and the 1 digit crew count display through the 74HC595 (shared segment lines, 1 digit select on A0), the RGB status LED, the servo gauge needle, and the LCD1602 on the beacon head as the beacon's text display. Parses commands from the Pi. See contracts/serial.md.
- gateway/ Python on the Raspberry Pi. Opens both serial ports, runs the local rules (flash to bang distance, heat, water, tilt), holds the equipment interlock on GPIO 18 and the e-stop on GPIO 23, handles the IR remote (crew check in by digit, supervisor PIN with OK digits OK, briefing UP English and DOWN Spanish), plays voice clips, connects to the backend websocket (contracts/gateway-ws.md), and queues events while offline.

Fixed: the pin maps and protocols in docs/hardware-guide.md and contracts/serial.md. The interlock fails safe (GPIO 18 low stops the motor). The Pi is headless (no desktop, no Chromium, no kiosk). The countdown on the 4 digit display, the beacon LCD, and the state sent to the backend all come from the UNO's COUNT echo so they never disagree. The equipment unit is only the fan and the e-stop; lockout shows as the fan stopping and STOP WORK on the beacon LCD.

You cannot run hardware tests from here. For every step, tell the human exactly what to flash, what to wire, what to run, and what they should see, using the TEST lines in the guide.

Suggested: pyserial, websockets, gpiozero, pygame or aplay for audio. Pre rendered WAV clips for the fixed voice lines.

Guide: docs/hardware-guide.md. Appendix D is the gateway program map and its local rules. The beacon LCD lines and the IR key meanings are in contracts/serial.md.

## Decisions
- Gateway BACKEND_URL is the full websocket URL including the site: wss://api.omnirisking-it-all-at-swamphacks.us/ws/gateway/12, with SITE_ID=12 (Seminole) and GATEWAY_TOKEN from Chris by DM. The token is appended as ?token=GATEWAY_TOKEN. These live only in firmware/gateway/.env on the Pi. (Slavik)
