"""Static site features (2.5) and the training table (4). Writes site_static.parquet, train.parquet, and schema.json."""
from pathlib import Path
import importlib.util, json, time
import pandas as pd, requests

ML = Path(__file__).parent
OUT = ML / 'data/processed'
# The transforms scoring also uses, loaded by path so ml/ does not need the backend's dependencies.
_spec = importlib.util.spec_from_file_location('intel_features', ML.parent / 'backend/app/intel/features.py')
shared = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(shared)

FEATURES = ['tmax', 'apparent_tmax', 'tmin', 'rh_max', 'precip_sum', 'rain_sum', 'precip_3d', 'precip_7d', 'soil',
            'gust_max', 'wind_max', 'heat_index', 'month', 'doy_sin', 'doy_cos', 'sfha', 'coastal', 'river', 'lat', 'lon']
FEMA = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query'   # 28 = S_FLD_HAZ_AR, checked


def site_static(sites: pd.DataFrame) -> pd.DataFrame:
    path = OUT / 'site_static.parquet'
    if path.exists():
        return pd.read_parquet(path)
    rows = []
    for s in sites.itertuples():
        for attempt in range(3):   # the FEMA server drops connections now and then
            try:
                f = requests.get(FEMA, timeout=60, params=dict(
                    geometry=f'{s.lon},{s.lat}', geometryType='esriGeometryPoint', inSR=4326, spatialRel='esriSpatialRelIntersects',
                    outFields='FLD_ZONE,SFHA_TF', returnGeometry='false', f='json')).json().get('features', [])
                break
            except requests.ConnectionError:
                time.sleep(5)
        else:
            raise SystemExit(f'FEMA unreachable for site {s.site_id}')
        attrs = [x['attributes'] for x in f]
        rows.append({'site_id': s.site_id, 'sfha': any(a['SFHA_TF'] == 'T' for a in attrs),
                     'fld_zone': attrs[0]['FLD_ZONE'] if attrs else None})
        time.sleep(0.3)
    st = pd.DataFrame(rows).merge(sites[['site_id', 'coastal', 'river']], on='site_id')
    st.to_parquet(path)
    return st


if __name__ == '__main__':
    sites = pd.read_parquet(OUT / 'sites.parquet')
    st = site_static(sites)
    w = pd.read_parquet(OUT / 'weather.parquet')
    lab = pd.read_parquet(OUT / 'labels.parquet')
    df = w.merge(lab, on=['site_id', 'date'], how='left')
    for c in ['label', 'label_storm', 'label_heat', 'label_osha']:
        df[c] = df[c].fillna(0).astype(int)
    df = df.sort_values(['site_id', 'date'])
    raw = ['tmax', 'apparent_tmax', 'tmin', 'rh_max', 'precip_sum', 'rain_sum', 'soil', 'gust_max', 'wind_max']
    df[raw] = df.groupby('site_id')[raw].ffill(limit=2)
    df = pd.concat(shared.add_derived(g) for _, g in df.groupby('site_id'))
    df = df.merge(st[['site_id', 'sfha', 'coastal', 'river']], on='site_id').merge(sites[['site_id', 'lat', 'lon']], on='site_id')
    df[['sfha', 'coastal', 'river']] = df[['sfha', 'coastal', 'river']].astype(int)
    df.to_parquet(OUT / 'train.parquet')
    json.dump({'features': FEATURES}, open(ML / 'schema.json', 'w'), indent=1)
    nan = int(df[FEATURES].isna().sum().sum())
    print(f'4 TEST: {len(df)} rows, {df.site_id.nunique()} sites, NaN in features: {nan}, positive rate {df.label.mean():.1%} '
          f'(labels.py said 5.8%); sfha sites: {int(st.sfha.sum())} of {len(st)}')
