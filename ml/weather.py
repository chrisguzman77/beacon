"""Historical daily weather per site from the Open-Meteo archive (ai-ml-guide 2.4). Writes data/processed/weather.parquet.

Asks for rh max and soil moisture as daily variables instead of aggregating hourly ones, same features, much lighter call.
Each site is cached in data/raw/weather/ so a rerun after a rate limit picks up where it stopped.
"""
from pathlib import Path
import time
import pandas as pd, requests

ML = Path(__file__).parent
CACHE = ML / 'data/raw/weather'
DAILY = ('temperature_2m_max,apparent_temperature_max,temperature_2m_min,precipitation_sum,rain_sum,'
         'wind_gusts_10m_max,wind_speed_10m_max,relative_humidity_2m_max,soil_moisture_0_to_7cm_mean')
NAMES = {'time': 'date', 'temperature_2m_max': 'tmax', 'apparent_temperature_max': 'apparent_tmax', 'temperature_2m_min': 'tmin',
         'precipitation_sum': 'precip_sum', 'rain_sum': 'rain_sum', 'wind_gusts_10m_max': 'gust_max',
         'wind_speed_10m_max': 'wind_max', 'relative_humidity_2m_max': 'rh_max', 'soil_moisture_0_to_7cm_mean': 'soil'}


def fetch(s) -> pd.DataFrame:
    # Free tier counts one 9 year call as ~235 calls (600/min, 5000/h, 10000/day), so ~42 sites fit in a day.
    while True:
        r = requests.get('https://archive-api.open-meteo.com/v1/archive', timeout=120, params=dict(
            latitude=s.lat, longitude=s.lon, start_date='2016-01-01', end_date='2024-12-31', daily=DAILY, timezone='auto'))
        if r.status_code != 429:
            r.raise_for_status()
            return pd.DataFrame(r.json()['daily']).rename(columns=NAMES)
        reason = r.json().get('reason', '')
        if 'Daily' in reason:
            print(f'{reason} Rerun after the reset (00:00 UTC) for the rest; finished sites are cached.', flush=True)
            return None
        wait = 65 if 'Minutely' in reason else 600
        print(f'  {reason} waiting {wait}s', flush=True)
        time.sleep(wait)


if __name__ == '__main__':
    CACHE.mkdir(parents=True, exist_ok=True)
    sites = pd.read_parquet(ML / 'data/processed/sites.parquet')
    for s in sites.itertuples():
        path = CACHE / f'{s.site_id}.parquet'
        if not path.exists():
            d = fetch(s)
            if d is None:
                break
            d['site_id'] = s.site_id; d.to_parquet(path)
            print(f'site {s.site_id} {s.name}: {len(d)} days', flush=True)
            time.sleep(1)
    have = [i for i in sites.site_id if (CACHE / f'{i}.parquet').exists()]
    if len(have) < len(sites):
        print(f'weather for {len(have)} of {len(sites)} sites, missing {sorted(set(sites.site_id) - set(have))}')
    df = pd.concat(pd.read_parquet(CACHE / f'{i}.parquet') for i in have)
    df.to_parquet(ML / 'data/processed/weather.parquet')
    fl = df[df.site_id.isin(sites[sites.state == 'FL'].site_id) & pd.to_datetime(df.date).dt.month.eq(7)]
    print(f'{len(df)} rows, {df.site_id.nunique()} sites, missing values: {int(df.isna().sum().sum())}; '
          f'FL July days with apparent tmax > 38 C: {(fl.apparent_tmax > 38).sum()} of {len(fl)}')
