"""Train, evaluate against the rule baseline, calibrate, explain (ai-ml-guide 5).

Writes model.joblib, calibrator.joblib, schema.json into backend/app/intel/model/ and report/metrics.md plus plots.
"""
from pathlib import Path
import json
import joblib, lightgbm as lgb, numpy as np, pandas as pd, shap
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, brier_score_loss, precision_recall_curve, roc_auc_score

ML = Path(__file__).parent
MODEL, REPORT = ML.parent / 'backend/app/intel/model', ML / 'report'


def baseline(x):
    """The rule a supervisor would write by hand (5.2)."""
    return ((x.heat_index >= 103) | (x.precip_3d >= 75) | (x.gust_max >= 60)).astype(float)


def at_half_recall(y, p):
    """Precision and recall at the highest threshold that still reaches 50% recall."""
    prec, rec, _ = precision_recall_curve(y, p)
    i = np.where(rec >= 0.5)[0][-1]
    return prec[i], rec[i]


def scores(y, p):
    prec, rec = at_half_recall(y, p)
    return {'PR AUC': average_precision_score(y, p), 'ROC AUC': roc_auc_score(y, p), 'Brier': brier_score_loss(y, p),
            'Precision at 50% recall': prec, 'Recall': rec}


if __name__ == '__main__':
    MODEL.mkdir(parents=True, exist_ok=True); REPORT.mkdir(exist_ok=True)
    df = pd.read_parquet(ML / 'data/processed/train.parquet'); df['date'] = pd.to_datetime(df.date)
    feats = json.load(open(ML / 'schema.json'))['features']
    tr, va, te = df[df.date.dt.year <= 2022], df[df.date.dt.year == 2023], df[df.date.dt.year == 2024]

    spw = (tr.label == 0).sum() / max(1, (tr.label == 1).sum())
    m = lgb.LGBMClassifier(num_leaves=31, learning_rate=0.05, n_estimators=600, min_child_samples=50,
                           feature_fraction=0.8, scale_pos_weight=spw, verbose=-1,
                           metric='average_precision')   # only metric, else default logloss stops early stopping at tree 1
    m.fit(tr[feats], tr.label, eval_set=[(va[feats], va.label)], eval_metric='average_precision',
          callbacks=[lgb.early_stopping(50, verbose=False)])
    iso = IsotonicRegression(out_of_bounds='clip').fit(m.predict_proba(va[feats])[:, 1], va.label)
    p_va = iso.predict(m.predict_proba(va[feats])[:, 1])
    p = iso.predict(m.predict_proba(te[feats])[:, 1])

    model_s, base_s = scores(te.label, p), scores(te.label, baseline(te))
    # The rule is yes/no, so its 50% recall row is just its own operating point.
    base_s['Precision at 50% recall'], base_s['Recall'] = (te.label[baseline(te) == 1].mean(), baseline(te)[te.label == 1].mean())

    # 0 to 10: number of validation deciles a probability exceeds (5.3 step 6)
    cuts = np.quantile(p_va, np.linspace(0.1, 0.9, 9)).tolist()

    # SHAP on a sample of the test year, global importance
    sample = te[feats].sample(min(5000, len(te)), random_state=0)
    sv = shap.TreeExplainer(m).shap_values(sample)
    sv = sv[1] if isinstance(sv, list) else sv
    imp = pd.Series(np.abs(sv).mean(0), index=feats).sort_values()
    imp.plot.barh(figsize=(6, 6), title='Mean |SHAP|, 2024 test year'); plt.tight_layout(); plt.savefig(REPORT / 'shap_importance.png', dpi=120); plt.close()

    # reliability diagram, 10 bins
    bins = pd.cut(p, np.linspace(0, 1, 11), include_lowest=True)
    rel = pd.DataFrame({'p': p, 'y': te.label.values}).groupby(bins, observed=True).agg(pred=('p', 'mean'), obs=('y', 'mean'), n=('y', 'size'))
    plt.figure(figsize=(5, 5)); plt.plot([0, 1], [0, 1], '--', color='gray'); plt.plot(rel.pred, rel.obs, 'o-')
    plt.xlabel('predicted probability'); plt.ylabel('observed positive rate'); plt.title('Calibration, 2024 test year')
    plt.tight_layout(); plt.savefig(REPORT / 'calibration.png', dpi=120); plt.close()

    prec, rec, _ = precision_recall_curve(te.label, p)
    plt.figure(figsize=(5, 5)); plt.plot(rec, prec, label=f"model (PR AUC {model_s['PR AUC']:.3f})")
    plt.scatter([base_s['Recall']], [base_s['Precision at 50% recall']], color='red', zorder=3, label='baseline rule')
    plt.axhline(te.label.mean(), ls='--', color='gray', label='positive rate'); plt.xlabel('recall'); plt.ylabel('precision')
    plt.legend(); plt.tight_layout(); plt.savefig(REPORT / 'pr_curve.png', dpi=120); plt.close()

    joblib.dump(m, MODEL / 'model.joblib'); joblib.dump(iso, MODEL / 'calibrator.joblib')
    json.dump({'features': feats, 'cuts': cuts, 'best_iteration': int(m.best_iteration_ or m.n_estimators),
               'trained_on': '2016-2022', 'validated': 2023, 'tested': 2024, 'sites': int(df.site_id.nunique())},
              open(MODEL / 'schema.json', 'w'), indent=1)

    rows = '\n'.join(f'| {k} | {model_s[k]:.3f} | {base_s[k]:.3f} |' for k in model_s)
    (REPORT / 'metrics.md').write_text(f"""# Hazard index metrics

Test year 2024, never seen in training (train 2016 to 2022, validate and calibrate 2023). {df.site_id.nunique()} sites,
{len(te):,} test site-days, positive rate {te.label.mean():.1%}. Model is LightGBM ({m.best_iteration_} trees, early stopped on
2023 PR AUC) with isotonic calibration fit on 2023. Baseline is the hand rule: heat index >= 103 F, or 3 day rain >= 75 mm,
or gusts >= 60 km/h. The rule is yes or no, so its precision and recall are at its one operating point.

| Metric | Model | Baseline rule |
|---|---|---|
{rows}

![calibration](calibration.png) ![precision recall](pr_curve.png) ![SHAP importance](shap_importance.png)

Top features by mean |SHAP|: {', '.join(imp.index[::-1][:5])}.

The 0 to 10 index is the number of 2023 validation deciles a site's calibrated probability exceeds, so a 7 means
the day is riskier than 70% of the site-days the model was validated on.
""")
    print(f"5 TEST: model PR AUC {model_s['PR AUC']:.3f} vs baseline {base_s['PR AUC']:.3f} "
          f"({'beats' if model_s['PR AUC'] > base_s['PR AUC'] else 'DOES NOT beat'} baseline); "
          f"ROC AUC {model_s['ROC AUC']:.3f}, Brier {model_s['Brier']:.4f}; {m.best_iteration_} trees; "
          f"{df.site_id.nunique()} sites; cuts {np.round(cuts, 3).tolist()}")
