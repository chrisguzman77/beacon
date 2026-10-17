"""Websocket to the backend (contracts/gateway-ws.md): reconnect, the offline queue, replay with original timestamps.

Events (local_stopwork, checkin, estop, pin) are queued to a JSON lines file while offline and replayed in order on
reconnect. Readings (pod, state, count, flash) are only worth anything live, so they are dropped while offline.
"""
import asyncio, json, logging
from datetime import datetime, timezone

import websockets

import config
from state import S

log = logging.getLogger('cloud')


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Cloud:
    def __init__(self, on_cmd, on_online_change):
        self.on_cmd, self.on_online_change = on_cmd, on_online_change
        self.ws = None
        self.replaying = False   # new messages wait until the queue file has been replayed, so order is kept
        self.out: asyncio.Queue = asyncio.Queue()

    def send(self, msg: dict, queue: bool = False):
        """queue=True for events that must reach the dashboard even if they happened offline."""
        self.out.put_nowait((msg, queue))

    def _save(self, msg: dict):
        with open(config.QUEUE_FILE, 'a') as f:
            f.write(json.dumps(msg) + '\n')
        log.info('offline, queued %s', msg.get('kind'))

    async def sender(self):
        while True:
            msg, queue = await self.out.get()
            while self.ws is not None and self.replaying:
                await asyncio.sleep(0.05)
            ws = self.ws
            if ws is None:
                if queue:
                    self._save(msg)
                continue
            try:
                await ws.send(json.dumps(msg))
            except Exception:
                if queue:
                    self._save(msg)

    async def _replay(self, ws):
        if not config.QUEUE_FILE.exists():
            return
        lines = [l for l in config.QUEUE_FILE.read_text().splitlines() if l.strip()]
        sent = 0
        try:
            for line in lines:
                await ws.send(line)
                sent += 1
        finally:   # drop only what was sent; anything appended meanwhile stays
            now = [l for l in config.QUEUE_FILE.read_text().splitlines() if l.strip()]
            config.QUEUE_FILE.write_text(''.join(l + '\n' for l in now[sent:]))
            if sent:
                log.info('replayed %d queued event(s)', sent)

    def _set_online(self, online: bool):
        if S.online != online:
            S.online = online
            log.info('backend %s', 'connected' if online else 'offline')
            self.on_online_change()

    async def run(self):
        if not config.BACKEND_URL:
            log.warning('no BACKEND_URL, running offline only')
            return
        url = f'{config.BACKEND_URL}?token={config.GATEWAY_TOKEN}'
        backoff = 1
        while True:
            try:
                # 5 s pings notice a dropped hotspot in ~10 s, so an offline flash fails safe quickly (demo step 7)
                async with websockets.connect(url, ping_interval=5, ping_timeout=5, open_timeout=10) as ws:
                    self.ws, self.replaying, backoff = ws, True, 1
                    try:
                        await self._replay(ws)
                    finally:
                        self.replaying = False
                    self._set_online(True)
                    async for raw in ws:
                        try:
                            self.on_cmd(json.loads(raw))
                        except Exception:
                            log.exception('bad command %s', raw)
            except Exception as e:
                log.debug('connect failed: %s', e)
            self.ws = None
            self._set_online(False)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 15)
