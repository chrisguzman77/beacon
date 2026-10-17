# Hazard index metrics

Test year 2024, never seen in training (train 2016 to 2022, validate and calibrate 2023). 20 sites,
7,320 test site-days, positive rate 6.0%. Model is LightGBM (24 trees, early stopped on
2023 PR AUC) with isotonic calibration fit on 2023. Baseline is the hand rule: heat index >= 103 F, or 3 day rain >= 75 mm,
or gusts >= 60 km/h. The rule is yes or no, so its precision and recall are at its one operating point.

| Metric | Model | Baseline rule |
|---|---|---|
| PR AUC | 0.225 | 0.087 |
| ROC AUC | 0.786 | 0.587 |
| Brier | 0.052 | 0.129 |
| Precision at 50% recall | 0.167 | 0.159 |
| Recall | 0.604 | 0.265 |

![calibration](calibration.png) ![precision recall](pr_curve.png) ![SHAP importance](shap_importance.png)

Top features by mean |SHAP|: coastal, precip_sum, rain_sum, lat, apparent_tmax.

The 0 to 10 index is the number of 2023 validation deciles a site's calibrated probability exceeds, so a 7 means
the day is riskier than 70% of the site-days the model was validated on.
