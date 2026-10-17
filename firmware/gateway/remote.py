"""The IR remote (contracts/serial.md): 1..9 toggle crew N, OK digits OK is the supervisor PIN (LEFT cancels, 10 s idle
cancels), UP and DOWN play the briefing in English and Spanish, RIGHT speaks the status."""
import asyncio, json, logging

import config, rules, voice
from cloud import now_iso
from state import S

log = logging.getLogger('remote')
_timeout = None


def _crew() -> set:
    try:
        return set(json.loads(config.CREW_FILE.read_text()))
    except (OSError, ValueError):
        return set()


def _cancel_pin(redraw: bool = True):
    global _timeout
    S.pin_entry = None
    if _timeout:
        _timeout.cancel()
        _timeout = None
    if redraw:
        rules.lcd.refresh(force=True)


def _bump_timeout():
    global _timeout
    if _timeout:
        _timeout.cancel()
    _timeout = asyncio.get_running_loop().call_later(10, _cancel_pin)


def on_ir(key: str):
    log.info('key %s', key)
    if S.pin_entry is not None:
        if key.isdigit() and len(S.pin_entry) < 8:
            S.pin_entry += key
            _bump_timeout()
            rules.lcd.interrupt()
        elif key == 'OK':
            _submit()
        elif key == 'LEFT':
            _cancel_pin()
        return
    if key == 'OK':
        S.pin_entry = ''
        _bump_timeout()
        rules.lcd.interrupt()
    elif key in '123456789' and len(key) == 1:
        _toggle_crew(int(key))
    elif key in ('UP', 'DOWN'):
        _briefing('en' if key == 'UP' else 'es')
    elif key == 'RIGHT':
        rules.say.say(status_sentence())


def _submit():
    entered = S.pin_entry
    _cancel_pin(redraw=False)   # the next screen is RELEASED BY or WRONG PIN
    ok = entered == config.SUPERVISOR_PIN
    rules.cloud.send({'kind': 'pin', 'value': entered, 'ok': ok}, queue=True)
    if ok:
        rules.release('SUPERVISOR')
    else:
        rules.say.say(voice.WRONG_PIN)
        rules.lcd.hold('WRONG PIN', 'TRY AGAIN', 3)


def _toggle_crew(n: int):
    crew = _crew()
    action = 'out' if n in crew else 'in'
    (crew.discard if action == 'out' else crew.add)(n)
    config.CREW_FILE.write_text(json.dumps(sorted(crew)))
    rules.cloud.send({'kind': 'checkin', 'ts': now_iso(), 'crew_number': n, 'action': action, 'via': 'remote'}, queue=True)
    # Local estimate until the backend's MUSTER (which also counts phone check ins) arrives
    S.crew_on_site = max(0, S.crew_on_site + (1 if action == 'in' else -1))
    if action == 'in':
        S.crew_checked_in_today += 1
    rules.uno.send(f'MUSTER:{min(9, S.crew_on_site)}')
    rules.say.say(voice.crew(n, action))
    rules.lcd.hold(f'CREW {n} {action.upper()}', f'ON SITE {S.crew_on_site}', 3)


def _briefing(lang: str):
    b = S.briefing or {}
    text = b.get('english' if lang == 'en' else 'spanish')
    if not text:
        rules.say.say('No briefing yet.' if lang == 'en' else 'Todavía no hay informe.', lang)
        return
    rules.say.say(("Tomorrow's briefing. " if lang == 'en' else 'Informe de mañana. ') + text, lang)


def status_sentence() -> str:
    m, s = divmod(S.countdown, 60)
    if S.estop:
        return 'Emergency stop pressed. Enter the supervisor PIN to reset.'
    if S.stopwork:
        return f'Stop work. {S.reason.title().replace(" Mi", " miles")}. {m} minutes {s} seconds remaining.'
    if S.awaiting_clear:
        return 'Locked out. Needs a supervisor.'
    if S.rest:
        return f'Heat rest break. {m} minutes remaining.'
    idx = 'not scored yet' if S.index is None else f'{S.index} out of 10'
    hi = '' if S.heat_f is None else f' Heat index {round(S.heat_f)}.'
    return f'All clear. Hazard index {idx}. {S.crew_on_site} crew on site.{hi}'
