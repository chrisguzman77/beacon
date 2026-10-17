# Beacon gateway (Raspberry Pi)

One Python process (hardware guide Appendix C) that sits between the sensor pod, the UNO control box, the motor
interlock, the speaker, and the backend. It runs the local rules itself, so the beacon keeps stopping work with no
internet. Files: `main.py` starts everything; `rules.py` is the local rules; `remote.py` the IR keys; `cloud.py` the
backend websocket and offline queue; `uno.py` the UNO commands and LCD screens; `serial_io.py`, `interlock.py`,
`voice.py`, `mic.py`, `state.py`, `config.py` do one job each. `devsim.py` fakes the pod, UNO, and backend for testing
on a laptop.

## Set up the Pi (once)

Raspberry Pi 5, Raspberry Pi OS Lite 64 bit, user `beacon` (hardware guide 4.2). A Pi 5 has no 3.5 mm jack, so the
speaker is USB.

```
sudo usermod -aG dialout,gpio,audio $USER        # serial ports, GPIO, sound; log out and back in
sudo apt install -y git espeak-ng alsa-utils python3-lgpio
curl -LsSf https://astral.sh/uv/install.sh | sh   # then open a new shell
git clone https://github.com/chrisguzman77/beacon.git ~/beacon && cd ~/beacon && git checkout dev
cd firmware/gateway
uv venv --python /usr/bin/python3 --system-site-packages   # system python, so gpiozero finds the Pi 5's lgpio
uv sync --extra voice                                       # pyserial, websockets, gpiozero, piper
mkdir -p voices && cd voices
for v in en/en_US/lessac/medium/en_US-lessac-medium es/es_MX/ald/medium/es_MX-ald-medium; do
  curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/$v.onnx
  curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/$v.onnx.json
done
cd ..
```

Create `firmware/gateway/.env` (gitignored; get the token from Chris by DM):

```
BACKEND_URL=wss://api.omnirisking-it-all-at-swamphacks.us/ws/gateway/12
GATEWAY_TOKEN=<from Chris>
SITE_ID=12
SUPERVISOR_PIN=<the same PIN as the server's SUPERVISOR_PIN>
DEMO_COUNTDOWN_SCALE=1
```

Optional keys: `POD_PORT` and `UNO_PORT` (empty finds them under /dev/serial/by-id), `MIC` (`auto`, `off`, or a device
like `plughw:2,0`), `AUDIO_DEVICE` (an `aplay -D` device if the USB speaker is not the default), `VOICE` (`piper`,
`espeak`, `log`). `DEMO_COUNTDOWN_SCALE=60` turns the 30 minute countdown into 30 seconds for rehearsals.

Run it by hand first: `.venv/bin/python -u main.py`. The first lines say which serial ports opened, which voice
engine loaded, whether a microphone was found, and `backend connected`.

Start on boot:

```
sudo cp beacon-gateway.service /etc/systemd/system/     # edit User and paths first if the user is not "beacon"
sudo systemctl daemon-reload && sudo systemctl enable --now beacon-gateway
journalctl -u beacon-gateway -f                          # the live log
```

## TEST on the device (hardware guide Step 6)

Watch `journalctl -u beacon-gateway -f` while doing each one. Every motor change is logged as `GPIO 18 low: motor
STOPPED` or `GPIO 18 high: motor running`.

1. Flash to bang: phone light at the photoresistor, then a BANG 3 s later (the laptop mic page, or a clap if a USB mic
   is on the Pi). Log: `flash to bang 3.0 s = ~1030 m`, motor STOPPED, `STOPWORK:1800` to the UNO, LCD `STOP WORK
   30:00 | LIGHTNING 1 MI`, the speaker says the alert.
2. Again while it counts: `Countdown reset. New strike.` and the countdown starts over.
3. Zone clear: during a stop work, nobody in front of the radar for 10 s. LCD `ZONE CLEAR` for 5 s and the line spoken.
4. Remote 3: `Crew 3 checked in`, LCD `CREW 3 IN | ON SITE n`, the crew digit goes up, the dashboard muster changes.
   3 again checks out.
5. After expiry the LCD says `LOCKED OUT | NEEDS SUPERVISOR`. OK, a wrong PIN, OK: `WRONG PIN`. OK, the PIN, OK: motor
   running, `RELEASED BY | SUPERVISOR hh:mm`. The PIN also works while the countdown is still running (demo step 5).
6. Heat: breathe on the DHT11. Heat index 103 F turns the state yellow; 115 F starts a rest break (`REST:900`).
7. Water sensor in a cup: `STANDING WATER`. 8. Tip the pod: `BEACON TIPPED`.
9. E-stop: the fan stops at once, LCD `E-STOP PRESSED | PIN TO RESET`; the PIN resets it.
10. After a briefing arrives (LCD `BRIEFING READY`): UP reads it in English, DOWN in Spanish. RIGHT speaks the status.
11. Offline: turn the hotspot off and **wait for the LCD to say `BEACON OFFLINE`** (about 10 s). Then flash. With a USB
    mic, flash and clap pair locally; without one, a flash alone stops work ("distance unknown", the fail-safe). Turn
    the hotspot back on: the log says `replayed N queued event(s)` and the stop work shows on the dashboard with its
    original time.

A stop work or e-stop survives a restart or power cut: the beacon comes back `LOCKED OUT` with the motor off until
the PIN.

## Test on a laptop with no hardware

```
uv venv && uv sync
uv run devsim.py            # prints POD_PORT, UNO_PORT, BACKEND_URL; type commands like: flash, bang, ir OK, t 40 60
POD_PORT=... UNO_PORT=... BACKEND_URL=ws://127.0.0.1:8765/ws/gateway/12 GATEWAY_TOKEN=dev \
  GPIOZERO_PIN_FACTORY=mock VOICE=log MIC=off DEMO_COUNTDOWN_SCALE=60 uv run main.py
kill -USR1 <gateway pid>    # presses the e-stop when GPIO is mocked
```

## Calibration (hardware guide 7.2)

Measured flash to bang for a 3 mile Roblox strike (expect about 14 s): _not measured yet_.
