# PlanIT Beacon

## AI and ML Build Guide

*PlanIT Beacon, SwampHacks XII*

Version 2, October 2026. Markdown edition for the repo. The training pipeline lives in ml/, the serving code in backend/app/intel/, and the boundary with Viet's core is contracts/intel-interface.md.

This guide covers the machine learning hazard index that scores every site 0 to 10, the daily scoring service, and the three Gemini features (hazard photo tagging, the bilingual 6 PM briefing, and the plain language index explanation). It is written for the person who owns the model, with every data source, every step, and a test at the end of each step. The model is honest about its resolution (county and day) and the write up says so, because the judges who read the code will respect that more than a number that looks too good.

# 1. Read this first

The hazard index answers one question for a supervisor. Given tomorrow's forecast at this site, how likely is a weather or environmental hazard that hurts a crew. It is a probability, calibrated and then mapped to 0 to 10, with the three features that pushed it up shown beside the number so a crew lead can argue with it.

What it is trained on. Nine years of NOAA Storm Events (every recorded heat, lightning, flood, wind, and tornado event by county and day) and OSHA severe injury reports (every hospitalization or amputation reported by employers, by address and day), joined to the historical weather at each of our 50 sites on each day.

What it is not. It is not a per-worker injury predictor and it is not a lightning forecaster. Its unit is a site-day. Its label is coarse. The write up and the dashboard's About page say exactly that.

## 1.1 Deliverables

- A training table, one row per site per day, saved as Parquet, with a documented feature list.

- A trained gradient boosted classifier with a time based split, evaluated against a rule baseline, with precision, recall, PR AUC, Brier score, and a calibration plot.

- A 0 to 10 mapping and a daily scoring service that writes each site's index and its top three SHAP features to the database.

- Three Gemini features behind one small module with structured outputs and a guard that rejects invented numbers.

- A README section with the metrics table, the calibration plot, and the honest limitations paragraph.

## 1.2 Folder layout

Two folders, both Chris's. ml/ is the offline pipeline that produces the model. backend/app/intel/ is the code the running backend imports. Core (Viet) calls exactly three functions and includes one router, listed in contracts/intel-interface.md, and nothing else crosses.

```
ml/                           training pipeline, run by hand
  data/raw/                   downloaded files, never edited, gitignored
  data/processed/             parquet tables the pipeline writes, gitignored
  download.py                 fetches Storm Events, OSHA, EIA sites
  sites.py                    builds sites.parquet and the committed backend/app/core/data/sites.csv
  weather.py                  pulls historical daily weather per site from Open-Meteo
  labels.py                   builds the site-day label from Storm Events and OSHA
  features.py                 joins weather and static site features, writes train.parquet
  train.py                    trains, evaluates, calibrates, writes the model files into backend/app/intel/model/
  report/                     metrics.md, calibration.png, pr_curve.png, committed

backend/app/intel/            served code, imported by core
  __init__.py                 exposes score_all, run_briefing, tag_photo, router
  model/                      model.joblib, calibrator.joblib, schema.json, committed (small), see section 6
  features.py                 build_feature_row, the same transforms as ml/features.py, imported by both
  scoring.py                  score_all() and score_site()
  gemini.py                   client, number guard, tag_photo, briefing, explain
  briefing.py                 run_briefing(site_id), builds the payload from core's tables
  router.py                   GET /sites/{id}/index/explain, POST /briefings/{site_id}/run
```

The .gitignore ignores *.joblib everywhere, so add `!backend/app/intel/model/*.joblib` and `!backend/app/intel/model/schema.json` to it in the same commit that first adds the model. A LightGBM model with 300 trees is under 2 MB.

## 1.3 Environment

1. Python 3.11 or 3.12 in a virtual environment. Install: `pip install pandas numpy pyarrow scikit-learn lightgbm shap requests pgeocode joblib matplotlib tqdm google-genai asyncpg python-dotenv timezonefinder`

2. Put GEMINI_API_KEY and DATABASE_URL in ml/.env. Never commit .env.

3. TEST. `python -c "import lightgbm, shap, pgeocode; print('ok')"` prints ok.

# 2. Data sources and download

| **Source** | **What it gives** | **Where** | **Size** |
|---|---|---|---|
| EIA-860M | Every US power plant with coordinates, county, state, technology | eia.gov/electricity/data/eia860m, the latest monthly XLSX, sheet named Operating | About 10 MB |
| NOAA Storm Events | Every recorded severe weather event by county or zone and day, 1950 to present | ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles, files named StormEvents_details-ftp_v1.0_dYYYY_c*.csv.gz | About 30 MB per year compressed |
| OSHA Severe Injury Reports | Employer reported hospitalizations and amputations since 2015 with address, city, state, zip, NAICS, and a narrative | osha.gov/severeinjury, the Download Data CSV link | About 40 MB |
| Open-Meteo Historical Weather | Daily and hourly reanalysis weather for any point from 1940 | archive-api.open-meteo.com/v1/archive, no key | Fetched per site |
| Open-Meteo Forecast | Today and tomorrow for scoring | api.open-meteo.com/v1/forecast, no key | Fetched per site |
| FEMA NFHL | Flood zone at each site | hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer, query the flood hazard areas layer at the site point | One query per site |

## 2.1 Sites

1. Download the EIA-860M XLSX. Open the Operating sheet with pandas, skipping the header rows until the column names appear (usually two).

2. Keep Plant Name, Plant State, County, Latitude, Longitude, Technology, Nameplate Capacity (MW).

3. Filter to Plant State in FL, GA, AL, MS, LA, TX. Sort by capacity and keep the top 50, making sure at least 25 are in Florida. Drop any row without coordinates.

4. Add site_id (1 to 50), tz from timezonefinder, and two flags, coastal (within 15 km of the coast, approximate with a hand list or a distance to the nearest NOAA tide station) and river (the Open-Meteo flood API returns a discharge for the point).

5. Save ml/data/processed/sites.parquet, and write the same rows as backend/app/core/data/sites.csv (columns site_id, name, state, county, lat, lon, tz, tech, mw, coastal, river). Commit the CSV on a feature/intel branch and merge to dev tonight, Viet's sites loader reads it.

6. TEST. The file has 50 rows, no missing coordinates, and plotting latitude against longitude shows the Gulf coast shape.

```
import pandas as pd, timezonefinder
df = pd.read_excel('data/raw/eia860m.xlsx', sheet_name='Operating', skiprows=2)
df = df.rename(columns={'Plant Name':'name','Plant State':'state','County':'county',
                        'Latitude':'lat','Longitude':'lon','Technology':'tech',
                        'Nameplate Capacity (MW)':'mw'})
df = df[df.state.isin(['FL','GA','AL','MS','LA','TX'])].dropna(subset=['lat','lon'])
fl = df[df.state=='FL'].nlargest(25,'mw'); rest = df[df.state!='FL'].nlargest(25,'mw')
sites = pd.concat([fl,rest]).reset_index(drop=True)
sites['site_id'] = sites.index + 1
tf = timezonefinder.TimezoneFinder()
sites['tz'] = [tf.timezone_at(lat=a, lng=b) for a,b in zip(sites.lat, sites.lon)]
sites.to_parquet('data/processed/sites.parquet'); sites.to_csv('data/processed/sites.csv', index=False)
```

## 2.2 Storm Events

1. Download the details files for 2016 through 2024 (nine files). Read them with pandas, compression gzip.

2. Keep EVENT_TYPE in this list. Heat, Excessive Heat, Lightning, Flood, Flash Flood, Coastal Flood, Thunderstorm Wind, High Wind, Strong Wind, Tornado, Hail, Tropical Storm, Hurricane.

3. Build an event date from BEGIN_YEARMONTH and BEGIN_DAY.

4. Keep STATE, CZ_TYPE, CZ_NAME, BEGIN_LAT, BEGIN_LON, EVENT_TYPE, INJURIES_DIRECT, DEATHS_DIRECT, DAMAGE_PROPERTY.

5. Save data/processed/storm_events.parquet.

6. TEST. Count events per year for Florida. 2017 (Irma) and 2022 (Ian) should stand out.

> **Note.** Heat events are recorded by forecast zone (CZ_TYPE Z) with no coordinates. Thunderstorm wind, flood, and lightning usually have BEGIN_LAT and BEGIN_LON. The matching rule in section 3 handles both.

## 2.3 OSHA severe injuries

1. Download the CSV. Columns include EventDate, Employer, Address1, City, State, Zip, Primary NAICS, Hospitalized, Amputation, Nature, Event, Source, Final Narrative.

2. Keep rows with State in the six states and a five digit Zip.

3. Geocode by zip with pgeocode, which is offline and instant. Rows whose zip is not found are dropped.

4. Keep an outdoor flag. Primary NAICS starting with 23 (construction) or 2211 (electric utilities), or Final Narrative containing any of heat, lightning, storm, flood, water, mud, trench, pole, line, bucket truck.

5. Save data/processed/osha.parquet with event_date, lat, lon, outdoor.

6. TEST. The outdoor rows for Florida in July should be visibly more than in January.

```
import pandas as pd, pgeocode
o = pd.read_csv('data/raw/severeinjury.csv', low_memory=False)
o = o[o.State.isin(['FL','GA','AL','MS','LA','TX'])].copy()
o['zip'] = o.Zip.astype(str).str.extract(r'(\d{5})')[0]
nomi = pgeocode.Nominatim('us')
geo = nomi.query_postal_code(o.zip.dropna().unique().tolist())
geo = geo.set_index('postal_code')[['latitude','longitude']]
o = o.join(geo, on='zip').dropna(subset=['latitude','longitude'])
kw = 'heat|lightning|storm|flood|water|mud|trench|pole|line|bucket'
naics = o['Primary NAICS'].astype(str)
o['outdoor'] = naics.str.startswith('23') | naics.str.startswith('2211') | o['Final Narrative'].str.contains(kw, case=False, na=False)
o['event_date'] = pd.to_datetime(o.EventDate).dt.date
o[['event_date','latitude','longitude','outdoor']].rename(columns={'latitude':'lat','longitude':'lon'}).to_parquet('data/processed/osha.parquet')
```

## 2.4 Historical weather per site

1. For each of the 50 sites, call the archive endpoint once for 2016-01-01 to 2024-12-31 with daily variables temperature_2m_max, apparent_temperature_max, temperature_2m_min, precipitation_sum, rain_sum, wind_gusts_10m_max, wind_speed_10m_max, and hourly soil_moisture_0_to_7cm and relative_humidity_2m, then aggregate the hourly ones to daily mean and max.

2. Pause one second between sites. Fifty calls is well inside the free limit.

3. Save data/processed/weather.parquet with site_id, date, and the variables.

4. TEST. 50 sites multiplied by about 3,288 days gives roughly 164,000 rows. Apparent temperature max in Florida in July should exceed 38 C on many days.

```
import requests, pandas as pd, time
sites = pd.read_parquet('data/processed/sites.parquet'); rows = []
for s in sites.itertuples():
    r = requests.get('https://archive-api.open-meteo.com/v1/archive', params=dict(
        latitude=s.lat, longitude=s.lon, start_date='2016-01-01', end_date='2024-12-31',
        daily='temperature_2m_max,apparent_temperature_max,temperature_2m_min,precipitation_sum,rain_sum,wind_gusts_10m_max,wind_speed_10m_max',
        hourly='soil_moisture_0_to_7cm,relative_humidity_2m', timezone='auto')).json()
    d = pd.DataFrame(r['daily']); d['site_id'] = s.site_id
    h = pd.DataFrame(r['hourly']); h['date'] = pd.to_datetime(h.time).dt.date.astype(str)
    hd = h.groupby('date').agg(soil=('soil_moisture_0_to_7cm','mean'), rh_max=('relative_humidity_2m','max')).reset_index()
    d = d.rename(columns={'time':'date'}).merge(hd, on='date'); rows.append(d); time.sleep(1)
pd.concat(rows).to_parquet('data/processed/weather.parquet')
```

## 2.5 Static site features

1. Flood zone. Query the FEMA NFHL flood hazard areas layer at each site point and record SFHA_TF (true if in a special flood hazard area) and FLD_ZONE. URL shape: `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=LON,LAT&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,SFHA_TF&returnGeometry=false&f=json`. Confirm the layer number against the service directory page, it is the layer named S_FLD_HAZ_AR.

2. Coastal flag and river flag from section 2.1.

3. Save data/processed/site_static.parquet with site_id, sfha, coastal, river.

# 3. Building the label

A site-day is positive if a hazard happened at or near the site on that day. Two sources feed it and the rule for each is written down so a judge can read it.

1. Storm Events with coordinates. Positive if the event's BEGIN_LAT and BEGIN_LON are within 40 km of the site on that date. Use the haversine formula.

2. Storm Events without coordinates (zone based, mostly heat). Positive if the event's STATE matches the site's state and CZ_NAME, lowercased and stripped of the words county and zone, matches the site's county name. Zone names do not always match county names, so this under counts, and the write up says so.

3. OSHA. Positive if an outdoor flagged injury occurred within 25 km of the site on that date.

4. Label equals 1 if any rule fires, otherwise 0. Also keep three sub labels, label_storm, label_heat, label_osha, for analysis.

5. Save data/processed/labels.parquet with site_id, date, label, and the three sub labels.

6. TEST. The positive rate should land between 2 and 8 percent. If it is above 15 percent, the 40 km radius is pulling in whole metro areas, tighten it. If it is below 1 percent, loosen the county name match.

```
import numpy as np, pandas as pd
def hav(lat1, lon1, lat2, lon2):
    p = np.pi/180; a = 0.5 - np.cos((lat2-lat1)*p)/2 + np.cos(lat1*p)*np.cos(lat2*p)*(1-np.cos((lon2-lon1)*p))/2
    return 12742 * np.arcsin(np.sqrt(a))
sites = pd.read_parquet('data/processed/sites.parquet')
se = pd.read_parquet('data/processed/storm_events.parquet'); osha = pd.read_parquet('data/processed/osha.parquet')
pos = []
for s in sites.itertuples():
    near = se[se.BEGIN_LAT.notna()]; near = near[hav(s.lat, s.lon, near.BEGIN_LAT, near.BEGIN_LON) <= 40]
    zone = se[se.BEGIN_LAT.isna() & (se.STATE.str.upper()==s.state) &
              (se.CZ_NAME.str.lower().str.replace(' county','').str.replace(' zone','').str.strip()==s.county.lower().strip())]
    o = osha[osha.outdoor]; o = o[hav(s.lat, s.lon, o.lat, o.lon) <= 25]
    for d in set(near.event_date): pos.append((s.site_id, d, 'storm'))
    for d in set(zone.event_date): pos.append((s.site_id, d, 'heat'))
    for d in set(o.event_date): pos.append((s.site_id, d, 'osha'))
lab = pd.DataFrame(pos, columns=['site_id','date','kind']).drop_duplicates()
lab['date'] = lab.date.astype(str)
wide = lab.assign(v=1).pivot_table(index=['site_id','date'], columns='kind', values='v', fill_value=0).reset_index()
wide['label'] = 1; wide.to_parquet('data/processed/labels.parquet')
```

# 4. Features and the training table

| **Feature** | **From** | **Why it matters** |
|---|---|---|
| tmax, apparent_tmax, tmin | weather | Heat stress |
| rh_max | weather | Humidity drives heat index |
| precip_sum, rain_sum | weather | Flooding, mud |
| precip_3d, precip_7d | rolling sum of precip_sum per site | Soil saturation and river response |
| soil | weather | Ground saturation |
| gust_max, wind_max | weather | Storms, falls from height |
| heat_index | computed from tmax and rh_max with the NWS formula | The number OSHA uses |
| month, doy_sin, doy_cos | date | Season |
| sfha, coastal, river | site_static | Exposure that does not change |
| lat, lon | sites | Lets the model learn regional climate |

1. Left join labels onto weather on site_id and date, fill label with 0.

2. Compute rolling 3 and 7 day precipitation per site, sorted by date.

3. Compute heat index from tmax (converted to F) and rh_max with the Rothfusz regression, in Fahrenheit, because that is what the thresholds use.

4. Join site_static and lat, lon.

5. Write data/processed/train.parquet. Write the feature list to ml/schema.json so scoring uses the same columns in the same order.

6. TEST. No NaN in feature columns after a forward fill of up to two days per site. Positive rate matches section 3.

```
def heat_index_f(t_c, rh):
    T = t_c*9/5+32
    hi = -42.379 + 2.04901523*T + 10.14333127*rh - 0.22475541*T*rh - 6.83783e-3*T*T \
         - 5.481717e-2*rh*rh + 1.22874e-3*T*T*rh + 8.5282e-4*T*rh*rh - 1.99e-6*T*T*rh*rh
    return np.where(T < 80, T, hi)
```

# 5. Training, evaluation, calibration

## 5.1 Split

Time based, never random. Train on 2016 to 2022, validate on 2023, test on 2024. A random split would leak the same storm into train and test through neighboring sites and days and the score would be a lie.

## 5.2 Baseline

The rule a supervisor would write by hand. Positive if heat_index is at or above 103, or precip_3d is at or above 75 mm, or gust_max is at or above 60 km/h. Every metric the model reports is reported for this rule too.

## 5.3 Model

1. LightGBM binary classifier. Start with num_leaves 31, learning_rate 0.05, n_estimators 600, min_child_samples 50, feature_fraction 0.8, scale_pos_weight set to negatives divided by positives. Early stop on validation PR AUC.

2. Fit on train, pick the iteration on validation, then calibrate with isotonic regression on validation predictions (sklearn CalibratedClassifierCV with cv='prefit' or IsotonicRegression on the validation set).

3. Report on test. PR AUC, ROC AUC, Brier score, precision and recall at the threshold that gives 50 percent recall, and the same for the baseline rule.

4. Reliability diagram. Ten bins of predicted probability against observed positive rate. Save report/calibration.png.

5. SHAP. TreeExplainer on the test set. Save the global importance bar chart and keep the explainer so scoring can produce per site top three features.

6. Map probability to 0 to 10. Take the deciles of calibrated validation probabilities and store the nine cut points in schema.json. A site's index is the number of cut points its probability exceeds, so a 7 means it is in the top 30 percent of risk days the model has seen.

7. Save model.joblib, calibrator.joblib, schema.json, and report/metrics.md.

8. TEST. The model's PR AUC on test beats the baseline rule's. If it does not, the features are not carrying signal, check the label join first (a date type mismatch is the usual cause).

```
import pandas as pd, numpy as np, lightgbm as lgb, joblib, json, shap
from sklearn.metrics import average_precision_score, roc_auc_score, brier_score_loss, precision_recall_curve
from sklearn.isotonic import IsotonicRegression
df = pd.read_parquet('data/processed/train.parquet'); df['date'] = pd.to_datetime(df.date)
feats = json.load(open('schema.json'))['features']
tr = df[df.date.dt.year <= 2022]; va = df[df.date.dt.year == 2023]; te = df[df.date.dt.year == 2024]
spw = (tr.label==0).sum() / max(1,(tr.label==1).sum())
m = lgb.LGBMClassifier(num_leaves=31, learning_rate=0.05, n_estimators=600, min_child_samples=50,
                       feature_fraction=0.8, scale_pos_weight=spw)
m.fit(tr[feats], tr.label, eval_set=[(va[feats], va.label)], eval_metric='average_precision',
      callbacks=[lgb.early_stopping(50)])
iso = IsotonicRegression(out_of_bounds='clip').fit(m.predict_proba(va[feats])[:,1], va.label)
p = iso.predict(m.predict_proba(te[feats])[:,1])
def baseline(x): return ((x.heat_index>=103)|(x.precip_3d>=75)|(x.gust_max>=60)).astype(float)
print('model PR-AUC', average_precision_score(te.label, p), 'baseline PR-AUC', average_precision_score(te.label, baseline(te)))
print('ROC', roc_auc_score(te.label, p), 'Brier', brier_score_loss(te.label, p))
cuts = np.quantile(iso.predict(m.predict_proba(va[feats])[:,1]), np.linspace(0.1,0.9,9)).tolist()
joblib.dump(m, 'model.joblib'); joblib.dump(iso, 'calibrator.joblib')
json.dump({'features': feats, 'cuts': cuts, 'trained_on': '2016-2022', 'validated': 2023, 'tested': 2024}, open('schema.json','w'))
```

## 5.4 The honesty paragraph

Put this, in your own words, in the README and on the About page. The label is at county and day resolution, so the model cannot know whether a particular crew was exposed. Zone based heat events are matched by name and under count. OSHA reports are geocoded by zip code, which can be several kilometers off. The index is a ranking tool for supervisors to decide where to look first, not a forecast of injury. The baseline rule is included so the reader can see how much the model adds.

# 6. Daily scoring service

1. The scoring service is backend/app/intel/scoring.py. `async def score_all()` loops every site, writes hazard_index, and sends INDEX to the beacon site through core's gateway module. Core's scheduler calls it daily at 05:00 UTC, and `python -m app.intel.scoring --site 1 --dry-run` runs it by hand.

2. For each site, call the Open-Meteo forecast endpoint for tomorrow with the same daily variables as training plus hourly soil moisture and humidity. Build one feature row in the schema.json order. Rolling precipitation uses the last seven days from the conditions table in the database, or from the forecast endpoint's past_days parameter.

3. Predict, calibrate, map to 0 to 10 with the stored cuts.

4. Compute SHAP values for the row and take the three largest positive contributions. Store feature name and value.

5. Write site_id, date, index, probability, top_features (JSON) to the hazard_index table through the shared pool from backend/app/core/db.py (get_pool()). For the beacon site, also call core's gateway.send with `{"cmd":"INDEX","value":index,"reason":<top feature in words>}` so the servo needle moves.

6. TEST. `python score.py --site 1 --dry-run` prints a probability, an index, and three features that make sense for the weather it fetched. A hot humid July forecast should score higher than a mild January one.

```
def score_site(site, model, iso, schema, explainer):
    f = requests.get('https://api.open-meteo.com/v1/forecast', params=dict(latitude=site.lat, longitude=site.lon,
        daily='temperature_2m_max,apparent_temperature_max,temperature_2m_min,precipitation_sum,rain_sum,wind_gusts_10m_max,wind_speed_10m_max',
        hourly='soil_moisture_0_to_1cm,relative_humidity_2m', past_days=7, forecast_days=2, timezone='auto')).json()
    row = build_feature_row(site, f, schema['features'])          # same transforms as features.py
    p = float(iso.predict(model.predict_proba(row)[:,1])[0])
    index = int(sum(p > c for c in schema['cuts']))
    sv = explainer.shap_values(row)[0]
    top = sorted(zip(schema['features'], sv, row.iloc[0]), key=lambda t: -t[1])[:3]
    return p, index, [{'feature': n, 'shap': float(s), 'value': float(v)} for n, s, v in top]
```

# 7. Gemini features

Three uses, each bounded, all in backend/app/intel/gemini.py and briefing.py. Every call uses a JSON response schema so the output is data, not prose to parse, and the briefing passes through a guard that rejects any number not present in the payload. The function names core calls are fixed by contracts/intel-interface.md: `tag_photo(image_bytes, mime, site_name)` returns {tag, description, confidence}, `run_briefing(site_id)` returns {english, spanish, source}.

## 7.1 Setup

1. Get an API key from Google AI Studio. Put it in .env as GEMINI_API_KEY.

2. Install the SDK: `pip install google-genai`. The model id for the fast tier is the current Flash model, check the model list in AI Studio and set GEMINI_MODEL in .env, for example gemini-2.5-flash.

3. TEST. `python -c "from google import genai,os; c=genai.Client(); print(c.models.generate_content(model=os.environ['GEMINI_MODEL'], contents='Say ready').text)"` prints a reply.

## 7.2 Hazard photo tagging

1. Input. The photo bytes from the crew page and the site name.

2. Prompt. Classify this jobsite photo into exactly one tag from the list and write one sentence describing the hazard for a crew briefing. Tags: alligator, snake, standing_water, downed_line, unstable_ground, equipment, heat, other.

3. Response schema. An object with tag (enum of the list), description (string, max 160 characters), confidence (number 0 to 1).

4. Store tag, description, and confidence with the report. Show the tag on the map pin. If confidence is under 0.5, show the tag as a suggestion the crew member can change.

5. TEST. A photo of a garden hose on wet ground returns standing_water or other, never downed_line.

```
from google import genai
from google.genai import types
import os, json
client = genai.Client()
TAGS = ['alligator','snake','standing_water','downed_line','unstable_ground','equipment','heat','other']
def tag_photo(image_bytes, mime, site_name):
    r = client.models.generate_content(
        model=os.environ['GEMINI_MODEL'],
        contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime),
                  f'Jobsite photo from {site_name}. Classify the hazard into exactly one tag and write one sentence for a crew briefing.'],
        config=types.GenerateContentConfig(response_mime_type='application/json',
            response_schema={'type':'object','properties':{'tag':{'type':'string','enum':TAGS},
                             'description':{'type':'string'},'confidence':{'type':'number'}},
                             'required':['tag','description','confidence']}))
    return json.loads(r.text)
```

## 7.3 The 6 PM briefing, English and Spanish

1. Input. A JSON payload that `run_briefing(site_id)` builds itself from core's tables (sites, conditions, alerts, reports, hazard_index) and the Open-Meteo forecast. site name, tomorrow's max heat index, chance of rain, expected rainfall mm, max gust km/h, storm timing from the hourly forecast (first hour with precipitation probability over 50 percent), flood status, active NWS alerts, hazard index and its top three features, open hazard reports with tags, and crew count.

2. Prompt. Write a next day safety briefing for a utility field crew in plain language, 120 words or fewer, in English and in Spanish. Use only the numbers in the payload. Do not add any number that is not in the payload. Lead with the single biggest risk.

3. Response schema. An object with english (string) and spanish (string).

4. Guard. Extract every number from each output with a regex and check that each one appears in the payload's numbers. If any number is new, retry once with the instruction repeated, then fall back to a template briefing built from the payload directly.

5. Store and return. `run_briefing` writes the briefings row (site_id, for_date, generated, english, spanish, payload, source) and returns {english, spanish, source}. Core pushes it to the dashboard and sends BRIEFING to the gateway, which speaks it. The dashboard shows the text with the payload numbers in a table beside it.

6. TEST. Feed a payload with heat index 108 and the output must contain 108 and must not contain 110 or any other invented number.

```
import re
def numbers(s): return set(re.findall(r'\d+(?:\.\d+)?', s))
def briefing(payload: dict):
    allowed = numbers(json.dumps(payload))
    prompt = ('Write a next day safety briefing for a utility field crew, plain language, 120 words or fewer, '
              'in English and in Spanish. Use only the numbers in this payload and add no others. '
              'Lead with the single biggest risk. Payload: ' + json.dumps(payload))
    schema = {'type':'object','properties':{'english':{'type':'string'},'spanish':{'type':'string'}},'required':['english','spanish']}
    for attempt in range(2):
        r = client.models.generate_content(model=os.environ['GEMINI_MODEL'], contents=prompt,
              config=types.GenerateContentConfig(response_mime_type='application/json', response_schema=schema))
        out = json.loads(r.text)
        if numbers(out['english']) <= allowed and numbers(out['spanish']) <= allowed: return out, 'gemini'
    return template_briefing(payload), 'template'
```

## 7.4 Index explanation

1. Input. The site name, the index, and the top three SHAP features with their values.

2. Prompt. In one sentence a crew lead would say, explain why this site scored this number, using only these three factors.

3. Response schema. An object with sentence (string). Same number guard.

4. TEST. Index 8 with heat_index 109, precip_3d 80, gust_max 55 yields a sentence that mentions heat and rain, nothing else.

# 8. What goes in the README and the About page

- A one paragraph description of the label and its sources with links.

- The metrics table, model against baseline, on the 2024 test year. PR AUC, ROC AUC, Brier, precision and recall at 50 percent recall.

- The calibration plot and one sentence on what it shows.

- The SHAP global importance chart.

- The 0 to 10 mapping explained in one sentence.

- The honesty paragraph from section 5.4.

- The Gemini guard, in one sentence, with the retry and template fallback.

# 9. Order of work and cut list

Everything done by 3 AM Sunday. Chris also handles Vultr with Viet (platform guide section 5) and owns contracts/, so the first block is short on purpose.

| **Block** | **What** | **Done when** |
|---|---|---|
| First | Environment, sites.py, sites.csv committed, three stub functions in backend/app/intel/__init__.py returning fixed values so Viet's core runs end to end, Storm Events and OSHA downloading in the background | Viet's GET /sites returns the 50 real sites |
| Second | Gemini setup, tag_photo for real, run_briefing with the guard and the template fallback | A phone photo gets a tag, POST /briefings/{id}/run returns English and Spanish with no invented number |
| Third | weather.py, labels.py, features.py | train.parquet exists with a 2 to 8 percent positive rate |
| Fourth | train.py with metrics, calibration, SHAP, cuts, model files committed | metrics.md shows the model beating the baseline |
| Fifth | scoring.py for real, score_all on the scheduler, INDEX to the servo, index explain route | A judge clicks a site and sees its index with three reasons, the needle moves |
| Sixth | README section, About page content handed to Cam, calibration plot | Reviewed by someone who did not write it |

Gemini comes before training because the briefing and the photo tag are on the judges' checklist and the index is one line of it. If training runs long, the stub scoring (a rule based index from heat index and rain, labeled as such) is still an index on every site.

Cut in this order if time runs short. The index sentence (keep the three features as a list). Isotonic calibration (keep raw probabilities and say so). The OSHA label source (Storm Events alone). The Spanish briefing (keep English). Never cut the time based split, the baseline comparison, or the number guard.
