"""
train.py

Training pipeline for the Nirbadha Pravaha traffic command center.

Steps:
  1.  Load config.json
  2.  Load Astram_event_data_anonymized.csv (tries several paths; falls back to
      a synthetic 8 173-row dataset if the CSV is not found)
  3.  Run leakage-audit assertions
  4.  Engineer features via features.py
  5.  Train LightGBM closure classifier
  6.  Train RandomForest duration regressor on log1p(duration_min)
  7.  Run 5-fold CV on closure model
  8.  Fit KMeans(n_clusters=25) for geo-clustering
  9.  Save models/  artefacts
  10. Save target_encodings.json, label_encodings.json
  11. Compute and save metrics.json
"""

from __future__ import annotations

import json
import os
import sys
import warnings
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# Resolve paths

BACKEND_DIR = Path(__file__).parent.resolve()
MODELS_DIR = BACKEND_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

CONFIG_PATH = BACKEND_DIR / "config.json"

# 1. Load config

with open(CONFIG_PATH, "r") as fh:
    CFG: Dict[str, Any] = json.load(fh)

RANDOM_STATE: int = int(CFG["RANDOM_STATE"])
N_GEO_CLUSTERS: int = int(CFG["N_GEO_CLUSTERS"])

# 2. Load (or synthesise) data

CANDIDATE_PATHS: List[Path] = [
    BACKEND_DIR.parent / "dataset" / "Astram_event_data_anonymized.csv",  # confirmed location
    BACKEND_DIR.parent / "Astram_event_data_anonymized.csv",
    BACKEND_DIR.parent / "flipkartevent" / "Astram_event_data_anonymized.csv",
    BACKEND_DIR / "Astram_event_data_anonymized.csv",
    Path("Astram_event_data_anonymized.csv"),
]

def _synthesise_data(n: int = 8173, rng_seed: int = 42) -> pd.DataFrame:
    """Generate a realistic synthetic dataset for Bengaluru traffic events."""
    import pytz
    rng = np.random.default_rng(rng_seed)

    event_causes = CFG["EVENT_CAUSES"]
    veh_types = CFG["VEH_TYPES"]

    corridors = [
        "MG Road", "Outer Ring Road", "Hosur Road", "Bellary Road",
        "Bannerghatta Road", "Old Madras Road", "Mysore Road",
        "Tumkur Road", "Kanakapura Road", "NH 44",
        "NICE Road", "Sarjapur Road", "Whitefield Main Road",
        "Hebbal Flyover", "Silk Board Junction",
    ]
    zones = ["Central", "North", "South", "East", "West"]
    police_stations = [
        "Ulsoor PS", "Hennur PS", "Jayanagar PS", "Indiranagar PS",
        "Koramangala PS", "Whitefield PS", "Yeshwanthpur PS",
        "Rajajinagar PS", "Banashankari PS", "Marathahalli PS",
    ]

    # Bengaluru bounding box approx 12.8–13.1 N, 77.45–77.75 E
    lats = rng.uniform(12.82, 13.08, n)
    lons = rng.uniform(77.47, 77.73, n)

    # Generate datetimes spread across 2022–2024
    base_ts = pd.Timestamp("2022-01-01 00:00:00", tz="Asia/Kolkata")
    offsets = rng.integers(0, int(2 * 365.25 * 24 * 3600), n)
    start_datetimes = [base_ts + pd.Timedelta(seconds=int(s)) for s in offsets]

    cause_arr = rng.choice(event_causes, n)
    veh_arr = rng.choice(veh_types, n)
    corridor_arr = rng.choice(corridors, n)
    zone_arr = rng.choice(zones, n)
    ps_arr = rng.choice(police_stations, n)

    # Duration: log-normal, roughly 30–300 minutes
    duration_arr = np.clip(rng.lognormal(mean=4.2, sigma=0.8, size=n), 5, 720)

    # Closure: higher probability for certain causes and long durations
    closure_proba = (
        0.05
        + 0.35 * np.isin(cause_arr, ["accident", "vip_movement", "procession", "public_event"]).astype(float)
        + 0.25 * (duration_arr > 120).astype(float)
        + 0.10 * rng.random(n)
    )
    closure_proba = np.clip(closure_proba, 0.0, 1.0)
    closure_arr = (rng.random(n) < closure_proba).astype(int)

    auth_arr = rng.choice(["yes", "no"], n, p=[0.6, 0.4])
    etype_arr = rng.choice(["planned", "unplanned"], n, p=[0.4, 0.6])
    has_junc_arr = rng.choice([True, False], n, p=[0.35, 0.65])
    desc_arr = [
        rng.choice([
            "Traffic bottleneck near junction",
            "Vehicle obstructing lane",
            "Road blocked due to event",
            "Pothole reported by motorist",
            "Minor fender bender causing slowdown",
            "",
        ])
        for _ in range(n)
    ]

    df = pd.DataFrame({
        "latitude": lats,
        "longitude": lons,
        "start_datetime": start_datetimes,
        "event_cause": cause_arr,
        "veh_type": veh_arr,
        "event_type": etype_arr,
        "authenticated": auth_arr,
        "description": desc_arr,
        "has_junction": has_junc_arr,
        "corridor": corridor_arr,
        "zone": zone_arr,
        "police_station": ps_arr,
        "duration_min": duration_arr.round(1),
        "requires_road_closure": closure_arr,
    })
    return df

def load_data() -> pd.DataFrame:
    for path in CANDIDATE_PATHS:
        if path.exists():
            print(f"[train] Loading data from: {path}")
            df = pd.read_csv(path)
            return df
    print("[train] CSV not found at any candidate path — generating synthetic data (8 173 rows).")
    return _synthesise_data(8173, RANDOM_STATE)

# 3. Leakage audit

LEAKAGE_COLS = [
    "requires_road_closure",
    "closure_time",
    "resolved_at",
    "resolution_time",
    "actual_closure",
]

def leakage_audit(df: pd.DataFrame) -> None:
    print("\n[Leakage Audit] Checking for target-leaking columns …")
    found = [c for c in LEAKAGE_COLS if c in df.columns and c != "requires_road_closure"]
    if found:
        print(f"  [WARN] Potential leakage columns found: {found}")
    else:
        print("  [OK] No obvious leakage columns detected.")
    assert "requires_road_closure" in df.columns, "Target column missing!"
    assert "duration_min" in df.columns, "Duration column missing!"
    print("[Leakage Audit] Done.\n")

# 4–8. Feature engineering + training

def main() -> None:
    from sklearn.cluster import KMeans
    from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, HistGradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.metrics import (
        accuracy_score,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
        roc_curve,
        mean_absolute_error,
        r2_score,
    )
    from sklearn.model_selection import KFold, cross_val_score
    import lightgbm as lgb

    from features import prepare_training_features, FEATURE_COLS, REG_FEATURES

    # load
    df_raw = load_data()
    print(f"[train] Dataset shape: {df_raw.shape}")

    # normalise columns
    df_raw.columns = [c.strip().lower().replace(" ", "_") for c in df_raw.columns]

    # Ensure required columns exist with sensible defaults
    defaults = {
        "description": "",
        "has_junction": False,
        "authenticated": "no",
        "event_type": "unplanned",
        "corridor": "unknown",
        "zone": "unknown",
        "police_station": "unknown",
        "veh_type": "unknown",
    }
    for col, default in defaults.items():
        if col not in df_raw.columns:
            df_raw[col] = default

    # Cast types
    df_raw["has_junction"] = df_raw["has_junction"].fillna(False).astype(bool)
    df_raw["requires_road_closure"] = df_raw["requires_road_closure"].astype(int)
    df_raw['start_datetime'] = pd.to_datetime(df_raw['start_datetime'], errors='coerce', utc=True)
    df_raw['closed_datetime'] = pd.to_datetime(df_raw.get('closed_datetime', pd.Series(dtype=str)), errors='coerce', utc=True)
    df_raw['resolved_datetime'] = pd.to_datetime(df_raw.get('resolved_datetime', pd.Series(dtype=str)), errors='coerce', utc=True)
    df_raw['true_end'] = df_raw['closed_datetime'].fillna(df_raw['resolved_datetime'])
    df_raw['duration_min'] = (df_raw['true_end'] - df_raw['start_datetime']).dt.total_seconds() / 60.0
    sane_mask = (df_raw['duration_min'] > 0) & (df_raw['duration_min'] <= 24*60)
    df_raw.loc[~sane_mask, 'duration_min'] = np.nan
    df_raw["duration_min"] = df_raw["duration_min"].fillna(30.0)
    df_raw["latitude"] = pd.to_numeric(df_raw["latitude"], errors="coerce").fillna(12.9716)
    df_raw["longitude"] = pd.to_numeric(df_raw["longitude"], errors="coerce").fillna(77.5946)

    leakage_audit(df_raw)

    # KMeans geo-clustering
    print("[train] Fitting KMeans geo-clusters …")
    kmeans = KMeans(n_clusters=N_GEO_CLUSTERS, random_state=RANDOM_STATE, n_init=10)
    kmeans.fit(df_raw[["latitude", "longitude"]].values)

    # engineer features
    print("[train] Engineering features …")
    df_feat, target_encodings, label_encodings, kmeans = prepare_training_features(
        df_raw,
        n_oof_splits=int(CFG["N_SPLITS_OOF"]),
        random_state=RANDOM_STATE,
        kmeans_model=kmeans,
    )

    # prepare X / y
    X_clf = df_feat[FEATURE_COLS].values
    y_clf = df_feat["requires_road_closure"].values.astype(int)

    duration_mask = df_feat["duration_min"] > 0
    X_reg = df_feat.loc[duration_mask, REG_FEATURES].values
    y_reg = np.log1p(df_feat.loc[duration_mask, "duration_min"].values)

    # scale_pos_weight
    pos = y_clf.sum()
    neg = len(y_clf) - pos
    spw = float(neg / max(pos, 1))
    print(f"[train] Class distribution — positive: {pos}, negative: {neg}, scale_pos_weight: {spw:.3f}")

    # 5. Evaluate Multiple Models for Closure Classifier
    print("[train] Evaluating candidate models for closure classifier ...")
    lgb_params = {
        "n_estimators": int(CFG["N_ESTIMATORS_CLOSURE"]),
        "max_depth": int(CFG["MAX_DEPTH_CLOSURE"]),
        "learning_rate": float(CFG["LEARNING_RATE_CLOSURE"]),
        "subsample": float(CFG["SUBSAMPLE_CLOSURE"]),
        "colsample_bytree": float(CFG["COLSAMPLE_BYTREE_CLOSURE"]),
        "scale_pos_weight": spw,
        "random_state": RANDOM_STATE,
        "n_jobs": -1,
        "verbose": -1,
    }
    
    from sklearn.impute import SimpleImputer

    models = {
        "LightGBM": lgb.LGBMClassifier(**lgb_params),
        "RandomForest": RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1),
        "HistGradientBoost": HistGradientBoostingClassifier(random_state=RANDOM_STATE),
        "LogisticReg": make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE))
    }
    
    kf = KFold(n_splits=int(CFG["N_SPLITS_CV"]), shuffle=True, random_state=RANDOM_STATE)
    
    best_f1 = -1
    best_model_name = ""
    champion_model = None
    cv_scores = None
    
    print("\n--- Model Leaderboard (5-Fold CV) ---")
    for name, model in models.items():
        f1_scores = cross_val_score(model, X_clf, y_clf, cv=kf, scoring='f1', n_jobs=-1)
        acc_scores = cross_val_score(model, X_clf, y_clf, cv=kf, scoring='accuracy', n_jobs=-1)
        mean_f1 = np.mean(f1_scores)
        mean_acc = np.mean(acc_scores)
        print(f"{name:20s} | F1: {mean_f1:.4f} | Acc: {mean_acc:.4f}")
        
        if mean_f1 > best_f1:
            best_f1 = mean_f1
            best_model_name = name
            champion_model = model
            cv_scores = acc_scores
            
    print("-------------------------------------")
    print(f"[train] Champion Model Selected: {best_model_name} (F1: {best_f1:.4f})")
    
    # Train champion model on full dataset
    closure_model = champion_model
    closure_model.fit(X_clf, y_clf)
    print(f"[train] {best_model_name} trained on full dataset.")

    # 6. Train RandomForest duration regressor
    print("[train] Training RandomForest duration regressor ...")
    duration_model = RandomForestRegressor(
        n_estimators=int(CFG["N_ESTIMATORS_DURATION"]),
        max_depth=int(CFG["MAX_DEPTH_DURATION"]),
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    duration_model.fit(X_reg, y_reg)
    print("[train] Duration model trained.")

    # 9. Save model artefacts
    joblib.dump(closure_model, MODELS_DIR / "closure_model.joblib")
    joblib.dump(duration_model, MODELS_DIR / "duration_model.joblib")
    joblib.dump(kmeans, MODELS_DIR / "kmeans.joblib")
    print(f"[train] Models saved to {MODELS_DIR}/")

    # 10. Save encodings
    with open(BACKEND_DIR / "target_encodings.json", "w") as fh:
        json.dump(target_encodings, fh, indent=2)
    with open(BACKEND_DIR / "label_encodings.json", "w") as fh:
        json.dump(label_encodings, fh, indent=2)
    print("[train] Encodings saved.")

    # 11. Compute metrics
    print("[train] Computing metrics …")
    best_threshold = float(CFG["BEST_THRESHOLD"])

    clf_probas = closure_model.predict_proba(X_clf)[:, 1]
    clf_preds = (clf_probas >= best_threshold).astype(int)

    acc = float(accuracy_score(y_clf, clf_preds))
    prec = float(precision_score(y_clf, clf_preds, zero_division=0))
    rec = float(recall_score(y_clf, clf_preds, zero_division=0))
    f1 = float(f1_score(y_clf, clf_preds, zero_division=0))
    roc_auc = float(roc_auc_score(y_clf, clf_probas))
    cm = confusion_matrix(y_clf, clf_preds).tolist()
    pos_rate = float(y_clf.mean())

    # ROC curve (100 points)
    fpr_arr, tpr_arr, _ = roc_curve(y_clf, clf_probas)
    n_pts = min(100, len(fpr_arr))
    indices = np.linspace(0, len(fpr_arr) - 1, n_pts, dtype=int)
    roc_points = [
        {"fpr": float(fpr_arr[i]), "tpr": float(tpr_arr[i])}
        for i in indices
    ]

    # Duration metrics
    reg_preds_log = duration_model.predict(X_reg)
    reg_preds = np.expm1(reg_preds_log)
    reg_true = np.expm1(y_reg)

    r2_log = float(r2_score(y_reg, reg_preds_log))
    mae_min = float(mean_absolute_error(reg_true, reg_preds))
    rmse_min = float(np.sqrt(np.mean((reg_true - reg_preds) ** 2)))
    median_true = float(np.median(reg_true))
    median_pred = float(np.median(reg_preds))

    # Sample predictions (50 rows)
    sample_idx = np.linspace(0, len(reg_true) - 1, 50, dtype=int)
    predicted_vs_actual = [
        {"true": float(reg_true[i]), "pred": float(reg_preds[i])}
        for i in sample_idx
    ]

    # Feature importances — closure model (top 15)
    clf_importances = closure_model.feature_importances_
    clf_fi_pairs = sorted(
        zip(FEATURE_COLS, clf_importances), key=lambda x: x[1], reverse=True
    )[:15]
    feat_imp_clf = {name: float(val) for name, val in clf_fi_pairs}

    # Feature importances — duration model (top 15)
    reg_importances = duration_model.feature_importances_
    reg_fi_pairs = sorted(
        zip(REG_FEATURES, reg_importances), key=lambda x: x[1], reverse=True
    )[:15]
    feat_imp_reg = {name: float(val) for name, val in reg_fi_pairs}

    metrics = {
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "roc_auc": roc_auc,
        "cv_accuracies": cv_scores.tolist(),
        "cv_mean": float(cv_scores.mean()),
        "cv_std": float(cv_scores.std()),
        "confusion_matrix": cm,
        "feature_importances_closure": feat_imp_clf,
        "feature_importances_duration": feat_imp_reg,
        "r2_log": r2_log,
        "mae_min": mae_min,
        "rmse_min": rmse_min,
        "median_true": median_true,
        "median_pred": median_pred,
        "predicted_vs_actual_sample": predicted_vs_actual,
        "roc_points": roc_points,
        "positive_class_rate": pos_rate,
        "n_samples": int(len(df_feat)),
        "n_features_clf": len(FEATURE_COLS),
        "n_features_reg": len(REG_FEATURES),
    }

    with open(MODELS_DIR / "metrics.json", "w") as fh:
        json.dump(metrics, fh, indent=2)
    print("[train] Metrics saved.")

    # Generate corridor lookup
    _generate_corridor_lookup(df_raw)

    # Generate events snapshot
    _generate_events_snapshot(df_raw)

    print("\n[train] Training pipeline complete!")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  ROC AUC  : {roc_auc:.4f}")
    print(f"  F1       : {f1:.4f}")
    print(f"  MAE (min): {mae_min:.1f}")
    print(f"  R² (log) : {r2_log:.4f}")

# Corridor lookup generator

def _generate_corridor_lookup(df: pd.DataFrame) -> None:
    """Compute median lat/lon + zone + police_station per corridor."""
    if "corridor" not in df.columns:
        return
    lookup: Dict[str, Any] = {}
    grp = df.groupby("corridor")
    for corridor, sub in grp:
        lat = float(sub["latitude"].median()) if "latitude" in sub else 12.9716
        lon = float(sub["longitude"].median()) if "longitude" in sub else 77.5946
        zone = str(sub["zone"].mode()[0]) if "zone" in sub and len(sub) else "unknown"
        ps = str(sub["police_station"].mode()[0]) if "police_station" in sub and len(sub) else "unknown"
        lookup[str(corridor)] = {"lat": lat, "lon": lon, "zone": zone, "police_station": ps}

    out_path = BACKEND_DIR / "corridor_lookup.json"
    with open(out_path, "w") as fh:
        json.dump(lookup, fh, indent=2)
    print(f"[train] Corridor lookup saved -> {out_path}")

# Events snapshot for /api/events

def _generate_events_snapshot(df: pd.DataFrame) -> None:
    """Persist a serialisable JSON snapshot of the training events."""
    snapshot_cols = [
        c for c in [
            "latitude", "longitude", "start_datetime", "event_cause",
            "veh_type", "event_type", "authenticated", "description",
            "has_junction", "corridor", "zone", "police_station",
            "duration_min", "requires_road_closure",
        ]
        if c in df.columns
    ]
    out = df[snapshot_cols].copy()
    out["event_id"] = range(1, len(out) + 1)
    out["start_datetime"] = out["start_datetime"].astype(str)
    out["has_junction"] = out["has_junction"].astype(bool)

    out_path = BACKEND_DIR / "data" / "events.json"
    out_path.parent.mkdir(exist_ok=True)
    out.to_json(str(out_path), orient="records", date_format="iso")
    print(f"[train] Events snapshot saved → {out_path}  ({len(out)} rows)")

if __name__ == "__main__":
    main()
