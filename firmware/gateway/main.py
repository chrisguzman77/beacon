"""OmniRisk beacon gateway: one asyncio process (hardware guide Appendix C). Run with `uv run main.py`."""
import asyncio, atexit, json, logging, signal, sys

import config, mic, remote, rules
from cloud import Cloud
from interlock import Interlock
from serial_io import Port, parse_pod
from state import S
from uno import Lcd, Uno
from voice import Voice

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)-9s %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger('main')


def on_pod_line(line: str):
    if line.startswith('FLASH:'):
        rules.on_flash()
    elif line.startswith('IR:'):
        remote.on_ir(line[3:].strip().upper())
    else:
        d = parse_pod(line)
        if d:
            rules.on_pod(d)


def on_uno_line(line: str):
    if line.startswith('COUNT:'):
        rules.on_count(int(line[6:]))


async def ticker():
    while True:
        await asyncio.sleep(1)
        rules.every_second()


async def main():
    loop = asyncio.get_running_loop()
    try:
        S.briefing = json.loads(config.BRIEFING_FILE.read_text())
    except (OSError, ValueError):
        pass
    rules.restore_lock()

    def uno_opened():
        """The UNO resets when its port opens, so give it everything it should be showing."""
        if S.index is not None:
            uno.send(f'INDEX:{S.index}')
        uno.send(f'MUSTER:{min(9, S.crew_on_site)}')
        if S.stopwork and S.countdown > 0:
            uno.send(f'STOPWORK:{S.countdown}')
        elif S.rest and S.countdown > 0:
            uno.send(f'REST:{S.countdown}')
        lcd.refresh(force=True)

    uno = Uno(Port('uno', loop, on_uno_line, on_open=uno_opened))
    lcd = Lcd(uno)
    say = Voice()
    cloud = Cloud(rules.on_cmd, on_online_change=lambda: rules.changed())
    interlock = Interlock(loop, rules.on_estop)
    rules.setup(uno, lcd, say, cloud, interlock)
    rules.changed()                               # motor on only if nothing is locked

    uno.port.start()
    Port('pod', loop, on_pod_line).start()
    # systemctl stop, Ctrl-C, or a crash leaves GPIO 18 low: the motor never runs without the gateway
    atexit.register(interlock.apply, True)
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, sys.exit)
    if type(interlock.button.pin_factory).__name__ == 'MockFactory':
        loop.add_signal_handler(signal.SIGUSR1, interlock.press_estop_for_testing)
    log.info('site %s, backend %s, demo scale %s', config.SITE_ID, config.BACKEND_URL or 'none', config.DEMO_COUNTDOWN_SCALE)
    await asyncio.gather(cloud.run(), cloud.sender(), say.run(), mic.run(rules.on_bang), ticker())


if __name__ == '__main__':
    asyncio.run(main())
