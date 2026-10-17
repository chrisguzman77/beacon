"""Pick the 50 sites from EIA-860M. Writes data/processed/sites.parquet and backend/app/core/data/sites.csv."""
from pathlib import Path
import numpy as np, pandas as pd, requests, time, timezonefinder

ML = Path(__file__).parent
CSV = ML.parent / 'backend' / 'app' / 'core' / 'data' / 'sites.csv'
STATES = ['FL', 'GA', 'AL', 'MS', 'LA', 'TX']
COASTAL_KM = 15      # within this distance of a NOAA water level station
RIVER_M3S = 50       # 90 day mean discharge from the Open-Meteo flood API


def hav(lat1, lon1, lat2, lon2):
    p = np.pi/180; a = 0.5 - np.cos((lat2-lat1)*p)/2 + np.cos(lat1*p)*np.cos(lat2*p)*(1-np.cos((lon2-lon1)*p))/2
    return 12742 * np.arcsin(np.sqrt(a))


# EIA-860M is one row per generator, so sum capacity per plant and keep the technology of its biggest generators.
gen = pd.read_excel(ML / 'data/raw/eia860m.xlsx', sheet_name='Operating', skiprows=2)
gen = gen[gen['Plant State'].isin(STATES)].dropna(subset=['Latitude', 'Longitude'])
tech = gen.groupby(['Plant ID', 'Technology'])['Nameplate Capacity (MW)'].sum().reset_index() \
          .sort_values('Nameplate Capacity (MW)').drop_duplicates('Plant ID', keep='last').set_index('Plant ID')['Technology']
df = gen.groupby('Plant ID').agg(name=('Plant Name', 'first'), state=('Plant State', 'first'), county=('County', 'first'),
                                 lat=('Latitude', 'first'), lon=('Longitude', 'first'),
                                 mw=('Nameplate Capacity (MW)', 'sum')).join(tech.rename('tech'))
fl = df[df.state == 'FL'].nlargest(25, 'mw'); rest = df[df.state != 'FL'].nlargest(25, 'mw')
sites = pd.concat([fl, rest]).reset_index(drop=True)
sites['site_id'] = sites.index + 1
sites['mw'] = sites.mw.round(1)

tf = timezonefinder.TimezoneFinder()
sites['tz'] = [tf.timezone_at(lat=a, lng=b) for a, b in zip(sites.lat, sites.lon)]

st = pd.DataFrame(requests.get('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json',
                               params={'type': 'waterlevels'}, timeout=60).json()['stations'])
sites['coastal'] = [bool(hav(a, b, st.lat, st.lng).min() <= COASTAL_KM) for a, b in zip(sites.lat, sites.lon)]

river = []
for s in sites.itertuples():
    q = requests.get('https://flood-api.open-meteo.com/v1/flood', params=dict(
        latitude=s.lat, longitude=s.lon, daily='river_discharge', past_days=90, forecast_days=1), timeout=60).json()
    mean = pd.Series(q.get('daily', {}).get('river_discharge', []), dtype=float).mean()
    river.append(bool(mean > RIVER_M3S)); time.sleep(0.2)
sites['river'] = river

cols = ['site_id', 'name', 'state', 'county', 'lat', 'lon', 'tz', 'tech', 'mw', 'coastal', 'river']
sites = sites[cols]
(ML / 'data/processed').mkdir(parents=True, exist_ok=True)
sites.to_parquet(ML / 'data/processed/sites.parquet')
CSV.parent.mkdir(parents=True, exist_ok=True)
sites.to_csv(CSV, index=False)
print(f'{len(sites)} sites, {sites.state.eq("FL").sum()} in FL, {sites.coastal.sum()} coastal, {sites.river.sum()} river -> {CSV}')
