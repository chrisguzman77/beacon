"""Storm Events (2.2), OSHA (2.3), and the site-day label (3). Writes storm_events, osha, and labels parquet."""
from pathlib import Path
import re
import numpy as np, pandas as pd, pgeocode

ML = Path(__file__).parent
RAW, OUT = ML / 'data/raw', ML / 'data/processed'
STATES = {'FL': 'FLORIDA', 'GA': 'GEORGIA', 'AL': 'ALABAMA', 'MS': 'MISSISSIPPI', 'LA': 'LOUISIANA', 'TX': 'TEXAS'}
TYPES = ['Heat', 'Excessive Heat', 'Lightning', 'Flood', 'Flash Flood', 'Coastal Flood', 'Thunderstorm Wind', 'High Wind',
         'Strong Wind', 'Tornado', 'Hail', 'Tropical Storm', 'Hurricane', 'Hurricane (Typhoon)']
# Zone names carry qualifiers ("COASTAL MIAMI-DADE COUNTY", "INLAND PALM BEACH"); strip them to compare with the EIA county.
QUALIFIERS = r'\b(county|parish|zone|coastal|inland|interior|mainland|metro|metropolitan|barrier islands|' \
             r'north|south|east|west|central|northern|southern|eastern|western|northwest|northeast|southwest|southeast|' \
             r'upper|lower|far|extreme)\b'


def norm(name: str) -> str:
    s = re.sub(r'[-.]', ' ', str(name).lower())
    return ' '.join(re.sub(QUALIFIERS, ' ', s).split())


def hav(lat1, lon1, lat2, lon2):
    p = np.pi/180; a = 0.5 - np.cos((lat2-lat1)*p)/2 + np.cos(lat1*p)*np.cos(lat2*p)*(1-np.cos((lon2-lon1)*p))/2
    return 12742 * np.arcsin(np.sqrt(a))


def storm_events() -> pd.DataFrame:
    files = sorted(RAW.glob('StormEvents_details-ftp_v1.0_d20*.csv.gz'))
    se = pd.concat(pd.read_csv(f, compression='gzip', low_memory=False) for f in files)
    se = se[se.STATE.isin(STATES.values()) & se.EVENT_TYPE.isin(TYPES)].copy()
    se['event_date'] = pd.to_datetime(se.BEGIN_YEARMONTH.astype(str) + se.BEGIN_DAY.astype(str).str.zfill(2), format='%Y%m%d').dt.date.astype(str)
    se = se[['event_date', 'STATE', 'CZ_TYPE', 'CZ_NAME', 'BEGIN_LAT', 'BEGIN_LON', 'EVENT_TYPE',
             'INJURIES_DIRECT', 'DEATHS_DIRECT', 'DAMAGE_PROPERTY']]
    se.to_parquet(OUT / 'storm_events.parquet')
    return se


def osha() -> pd.DataFrame:
    o = pd.read_csv(RAW / 'severeinjury.csv', low_memory=False, encoding_errors='replace')
    o = o[o.State.str.upper().isin(STATES.values()) | o.State.isin(STATES)].copy()
    o['zip'] = o.Zip.astype(str).str.extract(r'(\d{5})')[0]
    geo = pgeocode.Nominatim('us').query_postal_code(o.zip.dropna().unique().tolist())
    o = o.join(geo.set_index('postal_code')[['latitude', 'longitude']], on='zip').dropna(subset=['latitude', 'longitude'])
    kw = 'heat|lightning|storm|flood|water|mud|trench|pole|line|bucket'
    naics = o['Primary NAICS'].astype(str)
    o['outdoor'] = naics.str.startswith('23') | naics.str.startswith('2211') | o['Final Narrative'].str.contains(kw, case=False, na=False)
    o['event_date'] = pd.to_datetime(o.EventDate, format='mixed').dt.date.astype(str)
    o = o[['event_date', 'latitude', 'longitude', 'outdoor']].rename(columns={'latitude': 'lat', 'longitude': 'lon'})
    o.to_parquet(OUT / 'osha.parquet')
    return o


def labels(sites, se, o) -> pd.DataFrame:
    se = se.assign(zone=se.CZ_NAME.map(norm))
    pos = []
    for s in sites.itertuples():
        near = se[se.BEGIN_LAT.notna()]; near = near[hav(s.lat, s.lon, near.BEGIN_LAT, near.BEGIN_LON) <= 40]
        zone = se[se.BEGIN_LAT.isna() & (se.STATE == STATES[s.state]) & (se.zone == norm(s.county))]
        oo = o[o.outdoor]; oo = oo[hav(s.lat, s.lon, oo.lat, oo.lon) <= 25]
        pos += [(s.site_id, d, 'storm') for d in set(near.event_date)]
        pos += [(s.site_id, d, 'heat') for d in set(zone.event_date)]
        pos += [(s.site_id, d, 'osha') for d in set(oo.event_date)]
    lab = pd.DataFrame(pos, columns=['site_id', 'date', 'kind']).drop_duplicates()
    lab = lab[(lab.date >= '2016-01-01') & (lab.date <= '2024-12-31')]
    wide = lab.assign(v=1).pivot_table(index=['site_id', 'date'], columns='kind', values='v', fill_value=0).reset_index()
    wide = wide.rename(columns={'storm': 'label_storm', 'heat': 'label_heat', 'osha': 'label_osha'})
    wide['label'] = 1
    wide.to_parquet(OUT / 'labels.parquet')
    return wide


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    sites = pd.read_parquet(OUT / 'sites.parquet')
    se = storm_events()
    fl = se[se.STATE == 'FLORIDA']
    print('2.2 TEST, FL events per year:', fl.event_date.str[:4].value_counts().sort_index().to_dict())
    o = osha()
    flo = o[o.outdoor & o.lat.between(24.4, 31.1) & o.lon.between(-87.7, -79.9)]
    m = flo.event_date.str[5:7]
    print(f'2.3 TEST, FL outdoor injuries in July: {(m == "07").sum()}, January: {(m == "01").sum()}')
    lab = labels(sites, se, o)
    total = len(sites) * len(pd.date_range('2016-01-01', '2024-12-31'))
    print(f'3 TEST, positive site-days: {len(lab)} of {total} = {len(lab) / total:.1%} (target 2 to 8%)')
    print('  by source:', {c: int(lab[c].sum()) for c in ['label_storm', 'label_heat', 'label_osha'] if c in lab})
    matched = {s.site_id for s in sites.itertuples() if (se.BEGIN_LAT.isna() & (se.STATE == STATES[s.state]) & (se.CZ_NAME.map(norm) == norm(s.county))).any()}
    print(f'  sites with at least one zone match: {len(matched)} of {len(sites)}')
