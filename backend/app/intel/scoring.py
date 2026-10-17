"""Daily hazard index, ai-ml-guide section 6. score_all() runs from core's scheduler at 05:00 UTC.

By hand: python -m app.intel.scoring [--site 12] [--dry-run]   (needs DATABASE_URL in the root .env)
"""
import argparse, asyncio, json, logging
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx, lightgbm as lgb, numpy as np, pandas as pd, shap

from .features import add_derived

log = logging.getLogger('intel.scoring')
MODEL = Path(__file__).parent / 'model'
FORECAST = 'https://api.open-meteo.com/v1/forecast'
DAILY = ('temperature_2m_max,apparent_temperature_max,temperature_2m_min,precipitation_sum,rain_sum,'
         'wind_gusts_10m_max,wind_speed_10m_max,relative_humidity_2m_max')
NAMES = {'temperature_2m_max': 'tmax', 'apparent_temperature_max': 'apparent_tmax', 'temperature_2m_min': 'tmin',
         'precipitation_sum': 'precip_sum', 'rain_sum': 'rain_sum', 'wind_gusts_10m_max': 'gust_max',
         'wind_speed_10m_max': 'wind_max', 'relative_humidity_2m_max': 'rh_max'}

# The three reasons are weather only (location stays in the model but means nothing to a crew lead), and features
# that carry the same thing are summed so the reasons do not repeat: label template and the feature its number comes from.
REASONS = {
    'heat': (['heat_index', 'apparent_tmax', 'tmax'], 'heat_index', 'Heat index {:.0f} F'),
    'rain': (['precip_sum', 'rain_sum'], 'precip_sum', 'Rain {:.0f} mm'),
    'rain_3d': (['precip_3d'], 'precip_3d', '3 day rain {:.0f} mm'),
    'rain_7d': (['precip_7d'], 'precip_7d', '7 day rain {:.0f} mm'),
    'wind': (['gust_max', 'wind_max'], 'gust_max', 'Gusts {:.0f} km/h'),
    'humidity': (['rh_max'], 'rh_max', 'Humidity {:.0f}%'),
    'soil': (['soil'], 'soil', 'Soil moisture {:.2f}'),
    'night': (['tmin'], 'tmin', 'Overnight low {:.0f} C'),
}


@lru_cache
def artifacts():
    """No pickles: LightGBM's text model plus the isotonic calibration curve stored as points in schema.json."""
    schema = json.loads((MODEL / 'schema.json').read_text())
    model = lgb.Booster(model_file=str(MODEL / 'model.txt'))
    static = json.loads((MODEL / 'site_static.json').read_text())
    return model, schema, shap.TreeExplainer(model), static


async def forecast_rows(http: httpx.AsyncClient, lat: float, lon: float) -> pd.DataFrame:
    """Last 7 days plus today and tomorrow, local dates, the same columns weather.py trained on."""
    f = (await http.get(FORECAST, params=dict(
        latitude=lat, longitude=lon, timezone='auto', past_days=7, forecast_days=2, daily=DAILY,
        hourly='soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm'))).json()
    d = pd.DataFrame(f['daily']).rename(columns={'time': 'date', **NAMES})
    # Training used the archive's daily 0-7 cm mean; the forecast only has thinner hourly layers (its daily
    # 0-7 cm field comes back null), so weight them by the depth each covers inside 0-7 cm: 1, 2, and 4 cm.
    h = pd.DataFrame(f['hourly'])
    h['soil'] = (h.soil_moisture_0_to_1cm + 2 * h.soil_moisture_1_to_3cm + 4 * h.soil_moisture_3_to_9cm) / 7
    h['date'] = h.time.str[:10]
    d = d.merge(h.groupby('date', as_index=False).soil.mean(), on='date', how='left')
    return d.ffill(limit=2)


def reasons(feats: list[str], sv: np.ndarray, row: pd.Series) -> list[dict]:
    contrib = dict(zip(feats, sv))
    out = []
    for key, (members, shown, label) in REASONS.items():
        s = float(sum(contrib[m] for m in members))
        if s > 0:
            out.append({'feature': key, 'shap': round(s, 4), 'value': round(float(row[shown]), 2),
                        'label': label.format(row[shown])})
    return sorted(out, key=lambda r: -r['shap'])[:3]


async def score_site(http: httpx.AsyncClient, site: dict) -> dict:
    model, schema, explainer, static = artifacts()
    feats = schema['features']
    for_date = (datetime.now(ZoneInfo(site['tz'])) + timedelta(days=1)).date()
    d = add_derived(await forecast_rows(http, site['lat'], site['lon']))
    row = d[d.date == for_date.isoformat()].copy()
    row = row.assign(sfha=int(static[str(site['site_id'])]['sfha']), coastal=int(bool(site['coastal'])),
                     river=int(bool(site['river'])), lat=site['lat'], lon=site['lon'])[feats].astype(float)
    cal = schema['calibration']
    p = float(np.interp(model.predict(row)[0], cal['x'], cal['y']))
    sv = explainer.shap_values(row)
    sv = (sv[1] if isinstance(sv, list) else sv)[0]
    return {'site_id': site['site_id'], 'for_date': for_date, 'probability': p,
            'index': int(sum(p > c for c in schema['cuts'])), 'top_features': reasons(feats, sv, row.iloc[0])}


async def score_all() -> None:
    """The contract entry point (intel-interface.md): every site, writes hazard_index, INDEX to the beacon."""
    await score()


async def score(only: int | None = None, dry_run: bool = False) -> list[dict]:
    from app.core import db, gateway   # imported here so intel loads without core (ml/ and tests)
    sites = [dict(r) for r in await db.get_pool().fetch(
        'SELECT site_id, name, lat, lon, tz, coastal, river, beacon FROM sites ORDER BY site_id')]
    results = []
    async with httpx.AsyncClient(timeout=30) as http:
        for s in sites:
            if only and s['site_id'] != only:
                continue
            try:
                r = await score_site(http, s)
            except Exception:
                log.exception('scoring site %s', s['site_id'])
                continue
            results.append({**r, 'name': s['name']})
            if dry_run:
                continue
            await db.get_pool().execute(
                'INSERT INTO hazard_index (site_id, for_date, probability, index, top_features) VALUES ($1, $2, $3, $4, $5) '
                'ON CONFLICT (site_id, for_date) DO UPDATE SET probability = $3, index = $4, top_features = $5',
                r['site_id'], r['for_date'], r['probability'], r['index'], r['top_features'])
            if s['beacon']:
                reason = r['top_features'][0]['label'] if r['top_features'] else 'No weather risk stands out'
                await gateway.send(s['site_id'], {'cmd': 'INDEX', 'value': r['index'], 'reason': reason})
    log.info('scored %d sites%s', len(results), ' (dry run)' if dry_run else '')
    return results


async def _main(site: int | None, dry_run: bool):
    from app.core import db
    await db.connect()
    try:
        for r in await score(site, dry_run):
            print(f"site {r['site_id']:>2} {r['name'][:28]:<28} {r['for_date']}  p={r['probability']:.3f}  index {r['index']:>2}  "
                  + ' | '.join(f['label'] for f in r['top_features']))
    finally:
        await db.close()


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', type=int)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    asyncio.run(_main(a.site, a.dry_run))
