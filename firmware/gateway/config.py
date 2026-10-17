"""Settings from firmware/gateway/.env (contracts/env.md, Gateway section). Environment variables win over the file."""
import os
from pathlib import Path

HERE = Path(__file__).parent


def _load(path: Path):
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())


_load(HERE / '.env')
env = os.environ.get

BACKEND_URL = env('BACKEND_URL', '')                  # wss://api.<domain>/ws/gateway/<site>, token is appended
GATEWAY_TOKEN = env('GATEWAY_TOKEN', '')
SITE_ID = int(env('SITE_ID', '12'))
POD_PORT = env('POD_PORT', '')                        # empty: find it under /dev/serial/by-id
UNO_PORT = env('UNO_PORT', '')
SUPERVISOR_PIN = env('SUPERVISOR_PIN', '1234')
DEMO_COUNTDOWN_SCALE = max(1, int(env('DEMO_COUNTDOWN_SCALE', '1')))
STOPWORK_SECONDS = 1800
REST_SECONDS = 900

QUEUE_FILE = HERE / 'queue.jsonl'                     # offline queue, gitignored
CREW_FILE = HERE / 'crew.json'                        # remote check ins by crew number, gitignored
BRIEFING_FILE = HERE / 'briefing.json'                # last briefing, so UP and DOWN work after a reboot offline
LOCK_FILE = HERE / 'lock.json'                        # a stop work survives a reboot: back up locked, needing a PIN

PIPER_VOICE_EN = env('PIPER_VOICE_EN', str(HERE / 'voices/en_US-lessac-medium.onnx'))
PIPER_VOICE_ES = env('PIPER_VOICE_ES', str(HERE / 'voices/es_MX-ald-medium.onnx'))
AUDIO_DEVICE = env('AUDIO_DEVICE', '')                # aplay -D device, empty for the default (the USB speaker)

MIC = env('MIC', 'auto')                              # auto | off | an ALSA capture device like plughw:2,0
MIC_RATIO = float(env('MIC_RATIO', '6'))              # a bang is a 20 ms window this many times louder than the baseline
MIC_FLOOR = int(env('MIC_FLOOR', '1500'))             # and at least this loud (16 bit RMS), so silence never triggers
