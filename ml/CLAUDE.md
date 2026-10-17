# ml

Owner: Chris. The hazard index training pipeline. Output is model.joblib, calibrator.joblib, schema.json, and report/metrics.md, consumed by backend/app/intel/scoring.py.

Guide: docs/ai-ml-guide.md when it lands. Sections 2 to 5 are this folder.

Fixed: time based split (train to 2022, validate 2023, test 2024), a rule baseline every metric is compared against, calibrated probabilities, a 0 to 10 mapping by validation deciles, SHAP top three features, and an honesty paragraph about county and day resolution. These are what the AI judges read.

Suggested: LightGBM. Alternative: sklearn HistGradientBoosting if LightGBM will not install, same interface. Open-Meteo archive for historical weather. NOAA Storm Events plus OSHA severe injuries for labels.

Never commit data/raw, data/processed, or model files. Commit the scripts and report/metrics.md.

## Decisions
