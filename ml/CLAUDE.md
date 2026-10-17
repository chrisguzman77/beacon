# ml

Owner: Chris. The hazard index training pipeline. Output is model.txt, schema.json (features, cuts, calibration curve), site_static.json, and report/metrics.md, consumed by backend/app/intel/scoring.py.

Guide: docs/ai-ml-guide.md when it lands. Sections 2 to 5 are this folder.

Fixed: time based split (train to 2022, validate 2023, test 2024), a rule baseline every metric is compared against, calibrated probabilities, a 0 to 10 mapping by validation deciles, SHAP top three features, and an honesty paragraph about county and day resolution. These are what the AI judges read.

Suggested: LightGBM. Alternative: sklearn HistGradientBoosting if LightGBM will not install, same interface. Open-Meteo archive for historical weather. NOAA Storm Events plus OSHA severe injuries for labels.

Never commit data/raw, data/processed, or model files. Commit the scripts and report/metrics.md.

## Decisions
- sites.py sums EIA-860M generator rows per Plant ID before picking the top 25 FL and top 25 other (the sheet is per generator). Source file: august_generator2026.xlsx.
- coastal = within 15 km of a NOAA CO-OPS water level station; river = Open-Meteo flood API 90 day mean discharge > 50 m3/s.
- openpyxl added to requirements.txt (pandas needs it to read the EIA xlsx).
- weather.py asks the archive for daily rh max and soil moisture mean instead of aggregating hourly (same features, lighter). The free tier's minute and hour limits slow it to ~20 sites an hour; all 50 fit in one day. Sites are cached in data/raw/weather/, so a rerun resumes.
- heat_index feature = apparent_temperature_max in F, not the guide's Rothfusz(tmax, rh_max): dawn humidity with afternoon heat read 15 to 20 F high and the 103 baseline rule fired on 84% of summer days (11% now). Shared transform in backend/app/intel/features.py.
- labels.py: Storm Events STATE is the full name (FLORIDA, not FL) and zone names carry qualifiers (COASTAL MIAMI-DADE COUNTY), both normalized; Hurricane (Typhoon) kept. Zone matching now hits all 50 sites. 2.2 check: Irma and Ian stand out in damage ($3.9B, $16.5B), not in raw counts.
- First labels.py run on python.org Python needs SSL_CERT_FILE=$(python -c "import certifi; print(certifi.where())") so pgeocode can download its zip table; cached after that.
- Model trained on all 50 sites (2016-2022 train, 2023 validate, 2024 test): PR AUC 0.246 vs baseline 0.084. Location features (lon, coastal, lat) rank 2 to 4 in SHAP, so the honesty paragraph says the model partly learns which sites are riskier.
- Model files are pickle free: LightGBM text format (model.txt) and the isotonic curve as points in schema.json, applied with numpy.interp. The joblib files broke across scikit-learn versions (trained 1.9.1, backend resolved 1.6.1) and unpickling is a code execution risk. train.py asserts both give identical probabilities.
- Scoring rebuilds soil moisture 0-7 cm from the forecast's hourly 0-1, 1-3, 3-9 cm layers weighted 1:2:4, because the forecast's daily 0-7 cm field is accepted but always null.
- The three reasons are weather features only (location stays in the model), with same-signal features summed (heat index + apparent tmax + tmax, rain + precip, gusts + wind) and neutral labels like "Gusts 50 km/h".
