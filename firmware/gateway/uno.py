"""Commands to the UNO and the beacon LCD (contracts/serial.md)."""
import asyncio, logging, time

from state import S

log = logging.getLogger('uno')


class Uno:
    def __init__(self, port):
        self.port = port

    def send(self, cmd: str):
        log.info('-> %s', cmd)
        self.port.write(cmd)

    def lcd(self, l1: str, l2: str):
        l1, l2 = l1[:16], l2[:16]
        S.lcd = [l1, l2]
        self.send(f'LCD:{l1}|{l2}')


class Lcd:
    """The base screen comes from State.screen() by priority. hold() shows a screen for a few seconds, then the base
    returns. During a countdown the UNO rewrites the MM:SS itself, so the base is only resent when its words change."""

    def __init__(self, uno: Uno):
        self.uno = uno
        self.held_until = 0.0
        self._timer = None
        self._last = None

    def refresh(self, force: bool = False):
        if time.monotonic() < self.held_until:
            return
        l1, l2 = S.screen()
        key = (l1[:-5] if (S.stopwork or S.rest) and l1[-3:-2] == ':' else l1, l2)
        if force or key != self._last:
            self._last = key
            self.uno.lcd(l1, l2)
        else:
            S.lcd = [l1[:16], l2[:16]]   # keep the state message's copy in step with the UNO's own MM:SS

    def hold(self, l1: str, l2: str, seconds: float):
        self.held_until = time.monotonic() + seconds
        self._last = None
        self.uno.lcd(l1, l2)
        if self._timer:
            self._timer.cancel()
        self._timer = asyncio.get_running_loop().call_later(seconds, self._release)

    def _release(self):
        self.held_until = 0.0
        self.refresh(force=True)

    def interrupt(self):
        """An urgent screen (stop work, e-stop, lockout, PIN entry) ends whatever is being held."""
        if self._timer:
            self._timer.cancel()
            self._timer = None
        self._release()
