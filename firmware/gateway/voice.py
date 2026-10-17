"""The beacon's voice. Piper (natural, offline) if installed with its voice files, else espeak-ng, else macOS say for
development, else the text goes to the log. Alerts interrupt whatever is playing; everything else waits its turn."""
import asyncio, io, logging, os, shutil, tempfile, wave

import config

log = logging.getLogger('voice')


class Voice:
    def __init__(self):
        self.engine, self.voices = self._pick()
        self.q: asyncio.Queue = asyncio.Queue()
        self.proc = None
        log.info('voice engine: %s', self.engine)

    def _pick(self):
        want = os.environ.get('VOICE', 'auto')   # auto | piper | espeak | say | log
        if want in ('auto', 'piper'):
            try:
                from piper import PiperVoice
                voices = {lang: PiperVoice.load(path) for lang, path in
                          (('en', config.PIPER_VOICE_EN), ('es', config.PIPER_VOICE_ES)) if os.path.exists(path)}
                if 'en' in voices:
                    with wave.open(io.BytesIO(), 'wb') as w:   # one short synthesis so a broken install falls back now
                        voices['en'].synthesize_wav('ready', w)
                    return 'piper', voices
                log.warning('piper is installed but %s is missing', config.PIPER_VOICE_EN)
            except Exception as e:
                if want == 'piper':
                    log.warning('piper unavailable: %s', e)
        if want in ('auto', 'espeak') and shutil.which('espeak-ng'):
            return 'espeak', {}
        if want in ('auto', 'say') and shutil.which('say'):
            return 'say', {}
        return 'log', {}

    def say(self, text: str, lang: str = 'en', urgent: bool = False):
        log.info('say [%s]%s %s', lang, ' (urgent)' if urgent else '', text)
        if urgent:
            while not self.q.empty():
                self.q.get_nowait()
            if self.proc and self.proc.returncode is None:
                self.proc.terminate()
        self.q.put_nowait((text, lang))

    async def run(self):
        while True:
            text, lang = await self.q.get()
            try:
                await self._speak(text, lang)
            except Exception:
                log.exception('speaking failed')

    async def _play(self, *cmd):
        self.proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.DEVNULL,
                                                         stderr=asyncio.subprocess.DEVNULL)
        await self.proc.wait()

    async def _speak(self, text: str, lang: str):
        if self.engine == 'log':
            return
        if self.engine == 'say':
            return await self._play('say', text)
        dev = ['-D', config.AUDIO_DEVICE] if config.AUDIO_DEVICE else []
        with tempfile.NamedTemporaryFile(suffix='.wav') as f:
            if self.engine == 'piper':
                voice = self.voices.get(lang) or self.voices['en']

                def synth():
                    with wave.open(f.name, 'wb') as w:
                        voice.synthesize_wav(text, w)
                await asyncio.to_thread(synth)
            else:
                await self._play('espeak-ng', '-v', 'es-419' if lang == 'es' else 'en-us', '-s', '155', '-w', f.name, text)
            await self._play('aplay', '-q', *dev, f.name)


# The voice lines from hardware guide Appendix B.5
def lightning(miles):
    return (f'Lightning detected, {miles} mile{"" if miles == 1 else "s"}. Stop work. Clear the zone.' if miles
            else 'Lightning detected. Distance unknown. Stop work. Clear the zone.')


RESET = 'Countdown reset. New strike.'
FIVE_MINUTES = 'All clear in five minutes.'
WATER = 'Standing water detected at the low point.'
TIPPED = 'Beacon tipped. Sensors unreliable.'
CLEARED = 'Supervisor cleared. Equipment power restored.'
WRONG_PIN = 'Wrong PIN.'
ESTOP = 'Emergency stop pressed.'


def zone_clear(checked_in, not_out):
    return f'Zone clear. {checked_in} crew checked in, {not_out} not checked out.'


def heat(hi):
    return f'Heat index {round(hi)}. Rest break in effect.'


def crew(n, action):
    return f'Crew {n} checked {action}.'
