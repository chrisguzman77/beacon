"""Optional USB microphone on the Pi, so flash to bang works with no internet (the laptop's BANG needs the backend).
Reads 20 ms blocks from arecord and reports a bang when one is much louder than the running baseline."""
import array, asyncio, logging, math, re, shutil, time

import config

log = logging.getLogger('mic')
RATE, BLOCK = 16000, 320            # 20 ms of 16 bit mono
active = False                      # rules.py fails safe on a lone flash only when offline and this is False


class Detector:
    def __init__(self, ratio=config.MIC_RATIO, floor=config.MIC_FLOOR, refractory=1.5):
        self.ratio, self.floor, self.refractory = ratio, floor, refractory
        self.base = None
        self.quiet_until = 0.0

    def feed(self, block: bytes, now: float) -> bool:
        a = array.array('h', block)
        rms = math.sqrt(sum(x * x for x in a) / max(1, len(a)))
        if self.base is None:
            self.base = rms
            return False
        loud = rms > max(self.floor, self.ratio * self.base)
        if not loud:
            self.base = 0.98 * self.base + 0.02 * rms    # the baseline only learns from ordinary sound
        if loud and now >= self.quiet_until:
            self.quiet_until = now + self.refractory
            return True
        return False


def capture_device() -> str | None:
    if config.MIC == 'off' or not shutil.which('arecord'):
        return None
    if config.MIC != 'auto':
        return config.MIC
    import subprocess
    out = subprocess.run(['arecord', '-l'], capture_output=True, text=True).stdout
    m = re.search(r'card (\d+):.*?device (\d+):', out)
    return f'plughw:{m.group(1)},{m.group(2)}' if m else None


async def run(on_bang):
    global active
    dev = capture_device()
    if not dev:
        log.info('no USB microphone: offline, a lone flash fails safe to a stop work')
        return
    while True:
        proc = await asyncio.create_subprocess_exec('arecord', '-q', '-D', dev, '-f', 'S16_LE', '-r', str(RATE), '-c', '1',
                                                    '-t', 'raw', stdout=asyncio.subprocess.PIPE,
                                                    stderr=asyncio.subprocess.DEVNULL)
        det, active = Detector(), True
        log.info('listening for thunder on %s', dev)
        try:
            while True:
                block = await proc.stdout.readexactly(BLOCK * 2)
                if det.feed(block, time.monotonic()):
                    on_bang('mic')
        except asyncio.IncompleteReadError:
            log.warning('microphone stopped, restarting in 5 s')
        finally:
            active = False
            if proc.returncode is None:
                proc.kill()
        await asyncio.sleep(5)
