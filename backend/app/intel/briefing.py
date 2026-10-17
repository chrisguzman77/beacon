"""run_briefing(site_id), ai-ml-guide 7.3. Builds the payload from core's tables and the Open-Meteo forecast."""
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx

from . import gemini

FORECAST = 'https://api.open-meteo.com/v1/forecast'


def heat_index_f(t_c: float, rh: float) -> float:
    """NWS Rothfusz regression, same as ai-ml-guide section 4."""
    T = t_c * 9 / 5 + 32
    if T < 80:
        return T
    return (-42.379 + 2.04901523*T + 10.14333127*rh - 0.22475541*T*rh - 6.83783e-3*T*T
            - 5.481717e-2*rh*rh + 1.22874e-3*T*T*rh + 8.5282e-4*T*rh*rh - 1.99e-6*T*T*rh*rh)


async def forecast(lat: float, lon: float, day: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as http:
        f = (await http.get(FORECAST, params=dict(
            latitude=lat, longitude=lon, timezone='auto', forecast_days=3,
            hourly='temperature_2m,relative_humidity_2m,precipitation_probability',
            daily='precipitation_sum,precipitation_probability_max,wind_gusts_10m_max'))).json()
    d = f['daily']; i = d['time'].index(day)
    hours = [(t, temp, rh, pp) for t, temp, rh, pp in zip(f['hourly']['time'], f['hourly']['temperature_2m'],
             f['hourly']['relative_humidity_2m'], f['hourly']['precipitation_probability']) if t.startswith(day)]
    storm = next((t[11:16] for t, _, _, pp in hours if pp is not None and pp > 50), None)
    # Whole numbers only: the guard compares the briefing's numbers against these, and the model rounds.
    return {'heat_index_max_f': round(max(heat_index_f(temp, rh) for _, temp, rh, _ in hours)),
            'rain_chance_pct': round(d['precipitation_probability_max'][i] or 0),
            'rain_mm': round(d['precipitation_sum'][i] or 0),
            'gust_max_kmh': round(d['wind_gusts_10m_max'][i] or 0),
            'storm_start': storm}


async def build_payload(db, site_id: int) -> tuple[dict, date]:
    site = await db.fetchrow('SELECT name, lat, lon, tz FROM sites WHERE site_id = $1', site_id)
    for_date = (datetime.now(ZoneInfo(site['tz'])) + timedelta(days=1)).date()
    since = datetime.now(timezone.utc)
    alerts = {r['type'] for r in await db.fetch(
        'SELECT type FROM alerts WHERE site_id = $1 AND cleared IS NULL', site_id)}
    flood = 'flood_confirmed' if 'flood_confirmed' in alerts else 'flood_warning' if 'flood_warning' in alerts else 'none'
    nws = sorted({r['payload'].get('event') for r in await db.fetch(
        "SELECT payload FROM events WHERE site_id = $1 AND type = 'nws_alert' AND ts > $2", site_id, since - timedelta(hours=1))
        if r['payload'] and r['payload'].get('event')})
    idx = await db.fetchrow('SELECT index, top_features FROM hazard_index WHERE site_id = $1 AND for_date = $2', site_id, for_date)
    reports = [{'tag': r['tag'], 'description': r['description']} for r in await db.fetch(
        'SELECT tag, description FROM reports WHERE site_id = $1 AND ts > $2 AND tag IS NOT NULL ORDER BY ts DESC LIMIT 5',
        site_id, since - timedelta(days=3))]
    crew = await db.fetchval('SELECT count(*) FROM crew WHERE site_id = $1', site_id)
    payload = {'site': site['name'], 'date': for_date.isoformat(),
               **await forecast(site['lat'], site['lon'], for_date.isoformat()),
               'flood_status': flood, 'nws_alerts': nws,
               'hazard_index': idx['index'] if idx else None, 'hazard_index_scale': '0 to 10',
               'top_features': [f['feature'] for f in idx['top_features']] if idx else [],
               'open_reports': reports, 'crew_count': crew}
    return payload, for_date


async def run_briefing(site_id: int) -> dict:
    from app.core.db import get_pool   # core lands on dev separately; import here so intel imports without it
    # Pool methods, not one held connection: 6 PM fires ~30 briefings at once and each Gemini call takes seconds.
    pool = get_pool()
    payload, for_date = await build_payload(pool, site_id)
    out, source = await gemini.briefing(payload)
    await pool.execute(
        'INSERT INTO briefings (site_id, for_date, generated, english, spanish, payload, source) '
        'VALUES ($1, $2, now(), $3, $4, $5, $6) ON CONFLICT (site_id, for_date) DO UPDATE SET '
        'generated = now(), english = $3, spanish = $4, payload = $5, source = $6',
        site_id, for_date, out['english'], out['spanish'], payload, source)
    return {**out, 'source': source}
