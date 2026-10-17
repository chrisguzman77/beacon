"""Per site websocket channels for the dashboard and crew page. Every message is {"type": ..., ...}."""
import logging
from collections import defaultdict

from fastapi import WebSocket

log = logging.getLogger("core.hub")
_channels: dict[int, set[WebSocket]] = defaultdict(set)


def subscribe(site_id: int, ws: WebSocket):
    _channels[site_id].add(ws)


def unsubscribe(site_id: int, ws: WebSocket):
    _channels[site_id].discard(ws)


async def publish(site_id: int, msg: dict):
    for ws in list(_channels[site_id]):
        try:
            await ws.send_json(msg)
        except Exception:
            _channels[site_id].discard(ws)
