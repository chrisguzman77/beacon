"""The one end to end test (platform guide 6.3), run by hand against a running backend, from backend/:
    python -m app.core.e2e [base_url] [site_id]
Defaults: http://localhost:8000 and BEACON_SITE_ID (only the beacon site gets STOPWORK). The fake gateway client takes
over the site's gateway connection, so run it while the real Pi is offline. Tokens come from .env. With SUPERVISOR_TOKEN (an Auth0 access token with the supervisor role) set,
the clear goes through POST /alerts/{id}/clear with the PIN; without it, through the gateway's PIN ok message."""
import asyncio
import json
import os
import sys

import httpx
import websockets

from .config import settings

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
SITE = int(sys.argv[2]) if len(sys.argv) > 2 else settings.beacon_site_id


def stopwork(site):
    return next((a for a in site["alerts"] if a["type"] == "stopwork"), None)


async def next_cmd(gw, cmd):
    while True:
        m = json.loads(await asyncio.wait_for(gw.recv(), 5))
        if m.get("cmd") == cmd:
            return m


async def main():
    sim = {"X-Token": settings.sim_token}
    async with httpx.AsyncClient(base_url=BASE, timeout=15) as c, \
            websockets.connect(f"{BASE.replace('http', 'ws', 1)}/ws/gateway/{SITE}?token={settings.gateway_token}") as gw:
        (await c.post("/sim/strike", headers=sim, json={"site_id": SITE, "bearing": 270, "miles": 8})).raise_for_status()
        a1 = stopwork((await c.get(f"/sites/{SITE}")).json())
        assert a1, "no stopwork alert after an 8 mile strike"
        print("ok  strike at 8 mi opened stopwork", a1["alert_id"])
        m = await next_cmd(gw, "STOPWORK")
        print("ok  gateway got STOPWORK", m.get("distance_m"), "m")

        await asyncio.sleep(1.1)
        (await c.post("/sim/strike", headers=sim, json={"site_id": SITE, "bearing": 270, "miles": 6})).raise_for_status()
        a2 = stopwork((await c.get(f"/sites/{SITE}")).json())
        assert a2["alert_id"] == a1["alert_id"] and a2["expires"] > a1["expires"], "second strike did not move expires"
        print("ok  second strike moved expires", a1["expires"], "->", a2["expires"])
        await next_cmd(gw, "STOPWORK")

        token = os.environ.get("SUPERVISOR_TOKEN")
        if token:
            r = await c.post(f"/alerts/{a2['alert_id']}/clear", headers={"Authorization": f"Bearer {token}"},
                             json={"pin": settings.supervisor_pin, "by": "e2e test"})
            r.raise_for_status()
            by = r.json()["cleared_by"]
        else:
            await gw.send(json.dumps({"kind": "pin", "ok": True}))
            await asyncio.sleep(1)
            hist = (await c.get(f"/sites/{SITE}")).json()["alert_history"]
            by = next(a for a in hist if a["alert_id"] == a2["alert_id"])["cleared_by"]
        assert by, "alert not cleared"
        print("ok  cleared by", repr(by), "(dashboard PIN)" if token else "(beacon PIN)")
    print("PASS")


if __name__ == "__main__":
    asyncio.run(main())
