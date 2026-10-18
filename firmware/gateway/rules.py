"""The local rules, the ones the Pi runs with no internet (hardware guide Appendix C.1), and the backend's commands."""
import asyncio, json, logging, time, urllib.request

import config, mic, voice
from cloud import now_iso
from state import S

log = logging.getLogger('rules')
FAR_M = 16093                 # 10 miles
SAME_STRIKE_S = 5             # the backend's STOPWORK and the local flash to bang of one Roblox bolt are one strike
uno = lcd = say = cloud = interlock = None

_flash_at = None              # monotonic time of the last unpaired FLASH, and its wall clock in microseconds
_flash_wall_us = None
_last_count_at = 0.0
_last_presence_at = 0.0
_stopwork_since = 0.0
_water_said_at = -1e9
_last_pod_up = 0.0
_from_backend = False         # the running stop work came from the backend's STOPWORK, not the Pi's own sensors
_offline_since = time.monotonic()   # the gateway starts offline; its first connect takes a moment
OFFLINE_ARM_S = 3             # the offline fail-safe arms only after this long without the backend


def setup(_uno, _lcd, _voice, _cloud, _interlock):
    global uno, lcd, say, cloud, interlock
    uno, lcd, say, cloud, interlock = _uno, _lcd, _voice, _cloud, _interlock


def wall_us() -> int:
    return time.time_ns() // 1000


def changed():
    """After any change: the interlock follows the lock, the LCD follows the state, the backend gets the state."""
    interlock.apply(S.locked)
    save_lock()
    lcd.refresh()
    publish()


_saved_lock = None


def save_lock():
    global _saved_lock
    lock = {'locked': S.locked, 'estop': S.estop, 'reason': S.reason, 'backend': _from_backend}
    if lock != _saved_lock:
        _saved_lock = lock
        config.LOCK_FILE.write_text(json.dumps(lock))


def restore_lock():
    """At boot: a stop work or e-stop that was running when the Pi went down comes back as locked, needing a PIN."""
    global _from_backend
    try:
        lock = json.loads(config.LOCK_FILE.read_text())
    except (OSError, ValueError):
        return
    if lock.get('locked'):
        S.estop = bool(lock.get('estop'))
        S.awaiting_clear = not S.estop
        S.reason = lock.get('reason', '')
        _from_backend = bool(lock.get('backend'))
        log.warning('restarted while locked (%s), needs a supervisor PIN', S.reason or 'e-stop')


def on_online_change():
    global _offline_since
    if not S.online:
        _offline_since = time.monotonic()
    changed()
    if S.online and _from_backend and S.locked and not S.estop:
        asyncio.get_running_loop().create_task(_released_while_offline())


async def _released_while_offline():
    """A dashboard release while the Pi was offline never reached it. For its own stop works the backend is the record:
    none open there means a supervisor released it. Local stop works and the e-stop still need the PIN."""
    base = config.BACKEND_URL.replace('wss://', 'https://').replace('ws://', 'http://').split('/ws/')[0]
    try:
        raw = await asyncio.to_thread(lambda: urllib.request.urlopen(f'{base}/sites/{config.SITE_ID}', timeout=10).read())
        open_types = {a.get('type') for a in json.loads(raw).get('alerts') or []}
    except Exception as e:
        log.warning('could not ask the backend whether the stop work was released (%s), staying locked', e)
        return
    if 'stopwork' not in open_types and _from_backend and S.locked and not S.estop:
        log.info('the backend has no open stop work: it was released while the Pi was offline')
        release('DASHBOARD')


def publish():
    cloud.send({'kind': 'state', **S.device()})


def heat_index_f(t_c: float, rh: float) -> float:
    """NWS Rothfusz regression, same as the ML guide section 4."""
    T = t_c * 9 / 5 + 32
    if T < 80:
        return T
    return (-42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 6.83783e-3 * T * T
            - 5.481717e-2 * rh * rh + 1.22874e-3 * T * T * rh + 8.5282e-4 * T * rh * rh - 1.99e-6 * T * T * rh * rh)


# --- stop work ----------------------------------------------------------------------------------------------------

def start_stopwork(distance_m, strike_at: float, seconds: int = config.STOPWORK_SECONDS, report: dict | None = None,
                   from_backend: bool = False):
    """Rule 1 and 2: a local flash to bang pairing and the backend's STOPWORK end here, so both paths act the same."""
    global _stopwork_since, _from_backend
    if (S.stopwork or S.awaiting_clear) and abs(strike_at - S.strike_at) <= SAME_STRIKE_S:
        log.info('same strike as the running stop work, no reset')
        if report:
            cloud.send(report, queue=True)
        return
    resetting = S.stopwork
    miles = max(1, round(distance_m / 1609.34)) if distance_m is not None else None
    secs = max(1, seconds // config.DEMO_COUNTDOWN_SCALE)
    S.stopwork, S.awaiting_clear, S.zone_clear = True, False, False
    S.strike_at, S.countdown, S.countdown_kind = strike_at, secs, 'stopwork'
    S.reason = f'LIGHTNING {miles} MI' if miles else 'LIGHTNING NEARBY'
    _stopwork_since, _from_backend = time.monotonic(), from_backend
    interlock.apply(True)                         # the motor first, then everything else
    uno.send(f'STOPWORK:{secs}')
    say.say(voice.RESET if resetting else voice.lightning(miles), urgent=True)
    if report:
        cloud.send(report, queue=True)
    log.info('stop work: %s, %s s%s', S.reason, secs, ' (reset)' if resetting else '')
    lcd.interrupt()
    changed()


def on_flash():
    global _flash_at, _flash_wall_us
    _flash_at, _flash_wall_us = time.monotonic(), wall_us()
    cloud.send({'kind': 'flash', 'ts_us': _flash_wall_us})
    if not S.online and not mic.active and time.monotonic() - _offline_since >= OFFLINE_ARM_S:
        # Offline the laptop's thunder cannot reach the Pi, and there is no microphone here: fail safe.
        log.info('flash while offline with no microphone: stop work, distance unknown')
        start_stopwork(None, _flash_at, report={'kind': 'local_stopwork', 'ts': now_iso(), 'distance_m': None,
                                                'flash_ts_us': _flash_wall_us, 'bang_ts_us': None})
        _flash_at = None


def on_bang(source: str):
    """Arrival time on the Pi's own clock, for the flash too, so the pod, Pi, and laptop clocks never matter."""
    global _flash_at
    if _flash_at is None:
        log.info('bang from %s with no flash to pair', source)
        return
    gap = time.monotonic() - _flash_at
    if not 0.3 <= gap <= 60:
        log.info('bang from %s %.1f s after the flash, outside 0.3 to 60 s', source, gap)
        return
    flash_at, distance = _flash_at, gap * 343
    _flash_at = None                              # one flash pairs once, so the mic and the backend's BANG cannot both fire
    log.info('flash to bang %.2f s (%s) = %.0f m', gap, source, distance)
    if distance < FAR_M:
        start_stopwork(distance, flash_at, report={'kind': 'local_stopwork', 'ts': now_iso(),
                                                   'distance_m': round(distance), 'flash_ts_us': _flash_wall_us,
                                                   'bang_ts_us': wall_us()})


def on_count(n: int):
    """The UNO's COUNT echo drives the countdown everywhere, so the displays and the state never disagree."""
    global _last_count_at
    _last_count_at = time.monotonic()
    tick(n)
    cloud.send({'kind': 'count', 'seconds': n})


def tick(n: int):
    S.countdown = n
    if S.countdown_kind == 'stopwork' and S.stopwork:
        if n == 300 and config.STOPWORK_SECONDS // config.DEMO_COUNTDOWN_SCALE > 300:
            say.say(voice.FIVE_MINUTES)
        if n <= 0:
            S.stopwork, S.awaiting_clear = False, True     # rule 3: stays locked until a PIN or a dashboard clear
            log.info('countdown done, awaiting supervisor')
            say.say(voice.COUNTDOWN_DONE)
            lcd.interrupt()
            changed()
            return
    elif S.countdown_kind == 'rest' and S.rest and n <= 0:
        S.rest = False
        changed()
        return
    lcd.refresh()


def every_second():
    """Fallback countdown if the UNO is not answering, rule 7 zone clear, and the state at least once a second."""
    now = time.monotonic()
    if S.countdown > 0 and now - _last_count_at > 2.5:
        tick(S.countdown - 1)
    if S.stopwork and not S.presence and not S.zone_clear:
        if now - max(_last_presence_at, _stopwork_since) >= 10:
            S.zone_clear = True
            not_out = S.crew_on_site
            say.say(voice.zone_clear(S.crew_checked_in_today, not_out))
            lcd.hold('ZONE CLEAR', f'{S.crew_checked_in_today} IN  {not_out} NOT OUT', 5)
    publish()


def release(by: str):
    """A right PIN at the beacon or CLEAR from the dashboard."""
    S.stopwork = S.awaiting_clear = S.estop = S.zone_clear = False
    S.countdown, S.countdown_kind, S.reason = 0, '', ''
    interlock.apply(S.locked)
    save_lock()
    uno.send('CLEAR')
    say.say(voice.CLEARED, urgent=True)
    lcd.hold('RELEASED BY', f'{by.upper()[:10]} {time.strftime("%H:%M")}', 10)
    log.info('released by %s', by)
    publish()


def on_estop():
    """Rule 8. The motor is already off (interlock.py cut it in the button callback)."""
    if S.estop:
        return
    S.estop = True
    say.say(voice.ESTOP, urgent=True)
    cloud.send({'kind': 'estop', 'ts': now_iso()}, queue=True)
    lcd.interrupt()
    changed()


def start_rest(seconds: int = config.REST_SECONDS):
    if S.rest:
        return
    S.rest = True
    if not S.stopwork:                            # the stop work countdown owns the display while it runs
        secs = max(1, seconds // config.DEMO_COUNTDOWN_SCALE)
        S.countdown, S.countdown_kind = secs, 'rest'
        uno.send(f'REST:{secs}')
    say.say(voice.heat(S.heat_f or 115))
    changed()


# --- sensors --------------------------------------------------------------------------------------------------------

def on_pod(d: dict):
    global _last_presence_at, _water_said_at, _last_pod_up
    now = time.monotonic()
    S.pod = d
    send_now = False
    presence = bool(d.get('P'))
    if presence:
        _last_presence_at = now
        S.zone_clear = False
    if presence != S.presence:
        S.presence, send_now = presence, True
    if 'T' in d and 'H' in d:                     # rule 4, 2 F of hysteresis so it does not flap
        S.heat_f = heat_index_f(d['T'], d['H'])
        level = S.heat_level
        while level < 2 and S.heat_f >= (103, 115)[level]:
            level += 1
        while level > 0 and S.heat_f < (103, 115)[level - 1] - 2:
            level -= 1
        if level != S.heat_level:
            rising = level > S.heat_level
            S.heat_level = level
            if level == 2 and rising:
                start_rest()
            elif level == 0:
                say.say(voice.HEAT_NORMAL)
            changed()
    water = d.get('W', 0)                         # rule 5
    S.water_pct = int(water)
    if water > 20 and not S.water:
        S.water = True
        if now - _water_said_at > 600:
            _water_said_at = now
            say.say(voice.WATER)
        changed()
    elif water <= 15 and S.water:
        S.water = False
        say.say(voice.WATER_CLEARED)
        changed()
    tilt = bool(d.get('TILT'))                    # rule 6
    if tilt != S.tilt:
        S.tilt, send_now = tilt, True
        say.say(voice.TIPPED if tilt else voice.UPRIGHT)
        changed()
    if send_now or now - _last_pod_up >= 1:      # the backend only acts on changes and every 5 s, no need for 10 Hz
        _last_pod_up = now
        cloud.send({'kind': 'pod', 'ts': now_iso(), **d})


# --- the backend's commands -------------------------------------------------------------------------------------

def on_cmd(m: dict):
    cmd = m.get('cmd')
    log.info('<- %s', cmd)
    if cmd == 'STOPWORK':
        start_stopwork(m.get('distance_m'), time.monotonic(), int(m.get('seconds') or config.STOPWORK_SECONDS),
                       from_backend=True)
    elif cmd == 'BANG':
        on_bang('backend')
    elif cmd == 'CLEAR':
        release(m.get('by') or 'DASHBOARD')
    elif cmd == 'INDEX':
        S.index, S.index_reason = int(m['value']), m.get('reason', '')
        uno.send(f'INDEX:{S.index}')
        changed()
    elif cmd == 'REST':
        start_rest(int(m.get('seconds') or config.REST_SECONDS))
    elif cmd == 'MUSTER':
        inn, out = m.get('in') or [], m.get('out') or []
        S.crew_on_site, S.crew_checked_in_today = len(inn), len(inn) + len(out)
        uno.send(f'MUSTER:{min(9, S.crew_on_site)}')
        changed()
    elif cmd == 'BRIEFING':
        S.briefing = {k: m.get(k) for k in ('english', 'spanish', 'for_date')}
        config.BRIEFING_FILE.write_text(json.dumps(S.briefing))
        if not S.locked and S.pin_entry is None:   # never cover a stop work, a lockout, or PIN entry
            lcd.hold('BRIEFING READY', 'UP EN  DOWN ES', 10)
    elif cmd == 'DEMO_SCALE':
        config.DEMO_COUNTDOWN_SCALE = max(1, int(m.get('value') or 1))
    else:
        log.info('unhandled command %s', m)
