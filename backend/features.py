"""
features.py

Feature engineering for the Nirbadha Pravaha traffic command center.
Provides:
  - FEATURE_COLS  : 26 features used by the closure LightGBM classifier
  - REG_FEATURES  : 21 features used by the duration RandomForest regressor
  - engineer_features()      : single-record inference
  - prepare_training_features(): whole-DataFrame training transformations
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import pytz

# Feature lists

# 26 features for the closure classifier
FEATURE_COLS: List[str] = [
    "hour",
    "dow",
    "month",
    "is_weekend",
    "is_morning_peak",
    "is_evening_peak",
    "is_night",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    "authenticated_flag",
    "event_type_flag",
    "has_junction",
    "description_len",
    "geo_cluster",
    "corridor_te",
    "police_station_te",
    "event_cause_te",
    "geo_cluster_te",
    "zone_te",
    "veh_type_te",
    "event_cause_le",
    "veh_type_le",
    "corridor_le",
    "zone_le",
]

# 21 features for the duration regressor (subset — drop some sparse encodings)
REG_FEATURES: List[str] = [
    "hour",
    "dow",
    "month",
    "is_weekend",
    "is_morning_peak",
    "is_evening_peak",
    "is_night",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    "authenticated_flag",
    "event_type_flag",
    "has_junction",
    "description_len",
    "geo_cluster",
    "corridor_te",
    "event_cause_te",
    "zone_te",
    "event_cause_le",
    "veh_type_le",
]

# Internal helpers

_IST = pytz.timezone("Asia/Kolkata")

def _parse_ist(dt_str: str) -> datetime:
    """Parse an ISO datetime string and return IST-localised datetime."""
    dt = pd.to_datetime(dt_str)
    if dt.tzinfo is None:
        dt = _IST.localize(dt)
    else:
        dt = dt.astimezone(_IST)
    return dt

def _cyclic(value: float, period: float) -> Tuple[float, float]:
    """Return (sin, cos) cyclic encoding for *value* with given *period*."""
    angle = 2.0 * math.pi * value / period
    return math.sin(angle), math.cos(angle)

# Single-record inference feature engineering

def engineer_features(
    raw_input_dict: Dict[str, Any],
    target_encodings: Dict[str, Any],
    label_encodings: Dict[str, Any],
    kmeans_model,  # sklearn KMeans fitted instance
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    Build feature dicts for a single inference request.

    Parameters
    ----------
    raw_input_dict : dict
        Keys expected (all strings unless noted):
          latitude, longitude, start_datetime, event_cause, veh_type,
          event_type, authenticated, description, has_junction (bool),
          corridor, zone, police_station
    target_encodings : dict
        JSON loaded from target_encodings.json. Structure::
            {
              "global_mean": 0.xx,
              "corridor": {"MG Road": 0.xx, ...},
              "police_station": {...},
              "event_cause": {...},
              "geo_cluster": {...},
              "zone": {...},
              "veh_type": {...}
            }
    label_encodings : dict
        JSON loaded from label_encodings.json. Structure::
            {
              "event_cause": {"accident": 0, "construction": 1, ...},
              "veh_type": {...},
              "corridor": {...},
              "zone": {...}
            }
    kmeans_model : sklearn KMeans
        Fitted KMeans with 25 clusters on (lat, lon).

    Returns
    -------
    clf_features : dict  — keys == FEATURE_COLS (26 items)
    reg_features : dict  — keys == REG_FEATURES (21 items)
    """
    r = raw_input_dict

    # temporal
    dt = _parse_ist(str(r["start_datetime"]))
    hour = dt.hour
    dow = dt.weekday()        # Monday=0
    month = dt.month

    is_weekend = int(dow >= 5)
    is_morning_peak = int(8 <= hour <= 11)
    is_evening_peak = int(17 <= hour <= 20)
    is_night = int(not (6 <= hour <= 22))

    hour_sin, hour_cos = _cyclic(hour, 24)
    dow_sin, dow_cos = _cyclic(dow, 7)

    # categorical flags
    authenticated_flag = 1 if str(r.get("authenticated", "no")).lower() == "yes" else 0
    event_type_flag = 1 if str(r.get("event_type", "unplanned")).lower() == "planned" else 0
    has_junction = int(bool(r.get("has_junction", False)))
    description_len = len(str(r.get("description", "")))

    # geo cluster
    lat = float(r.get("latitude", 12.9716))
    lon = float(r.get("longitude", 77.5946))
    try:
        geo_cluster = int(kmeans_model.predict([[lat, lon]])[0])
    except Exception:
        geo_cluster = -1

    # raw categorical values
    corridor = str(r.get("corridor", "unknown"))
    police_station = str(r.get("police_station", "unknown"))
    event_cause = str(r.get("event_cause", "others"))
    zone = str(r.get("zone", "unknown"))
    veh_type = str(r.get("veh_type", "unknown"))
    geo_cluster_str = str(geo_cluster)

    # target encodings (with global_mean fallback)
    global_mean: float = target_encodings.get("global_mean", 0.5)

    def _te(col: str, key: str) -> float:
        return float(target_encodings.get(col, {}).get(key, global_mean))

    corridor_te = _te("corridor", corridor)
    police_station_te = _te("police_station", police_station)
    event_cause_te = _te("event_cause", event_cause)
    geo_cluster_te = _te("geo_cluster", geo_cluster_str)
    zone_te = _te("zone", zone)
    veh_type_te = _te("veh_type", veh_type)

    # label encodings (with max+1 fallback for unseen)
    def _le(col: str, key: str) -> int:
        mapping: dict = label_encodings.get(col, {})
        if key in mapping:
            return int(mapping[key])
        # fallback: max value + 1
        return int(max(mapping.values(), default=-1) + 1) if mapping else 0

    event_cause_le = _le("event_cause", event_cause)
    veh_type_le = _le("veh_type", veh_type)
    corridor_le = _le("corridor", corridor)
    zone_le = _le("zone", zone)

    # assemble dicts
    all_feats: Dict[str, float] = {
        "hour": hour,
        "dow": dow,
        "month": month,
        "is_weekend": is_weekend,
        "is_morning_peak": is_morning_peak,
        "is_evening_peak": is_evening_peak,
        "is_night": is_night,
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "dow_sin": dow_sin,
        "dow_cos": dow_cos,
        "authenticated_flag": authenticated_flag,
        "event_type_flag": event_type_flag,
        "has_junction": has_junction,
        "description_len": description_len,
        "geo_cluster": geo_cluster,
        "corridor_te": corridor_te,
        "police_station_te": police_station_te,
        "event_cause_te": event_cause_te,
        "geo_cluster_te": geo_cluster_te,
        "zone_te": zone_te,
        "veh_type_te": veh_type_te,
        "event_cause_le": event_cause_le,
        "veh_type_le": veh_type_le,
        "corridor_le": corridor_le,
        "zone_le": zone_le,
    }

    clf_features = {k: all_feats[k] for k in FEATURE_COLS}
    reg_features = {k: all_feats[k] for k in REG_FEATURES}

    return clf_features, reg_features

# Whole-DataFrame training feature engineering

def prepare_training_features(
    df: pd.DataFrame,
    n_oof_splits: int = 5,
    random_state: int = 42,
    kmeans_model=None,
) -> Tuple[pd.DataFrame, Dict[str, Any], Dict[str, Any]]:
    """
    Engineer features for the entire training DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Raw training DataFrame with at minimum these columns:
        start_datetime, event_cause, veh_type, event_type, authenticated,
        description, has_junction, corridor, zone, police_station,
        latitude, longitude, requires_road_closure
    n_oof_splits : int
        Number of folds for OOF target encoding (prevents leakage).
    random_state : int
    kmeans_model : fitted KMeans or None
        If None, a new KMeans(n_clusters=25) is fitted on (lat, lon).

    Returns
    -------
    df_out : pd.DataFrame
        DataFrame with all FEATURE_COLS + REG_FEATURES columns appended.
    target_encodings : dict
        Per-category mean of requires_road_closure (for inference).
    label_encodings : dict
        Integer label maps for categorical columns.
    """
    from sklearn.cluster import KMeans
    from sklearn.model_selection import KFold

    df = df.copy()

    # parse datetime
    df["start_datetime"] = pd.to_datetime(df["start_datetime"])
    if df["start_datetime"].dt.tz is None:
        df["start_datetime"] = df["start_datetime"].dt.tz_localize("Asia/Kolkata")
    else:
        df["start_datetime"] = df["start_datetime"].dt.tz_convert("Asia/Kolkata")

    df["hour"] = df["start_datetime"].dt.hour
    df["dow"] = df["start_datetime"].dt.weekday
    df["month"] = df["start_datetime"].dt.month

    df["is_weekend"] = (df["dow"] >= 5).astype(int)
    df["is_morning_peak"] = ((df["hour"] >= 8) & (df["hour"] <= 11)).astype(int)
    df["is_evening_peak"] = ((df["hour"] >= 17) & (df["hour"] <= 20)).astype(int)
    df["is_night"] = (~df["hour"].between(6, 22)).astype(int)

    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"] = np.sin(2 * np.pi * df["dow"] / 7)
    df["dow_cos"] = np.cos(2 * np.pi * df["dow"] / 7)

    df["authenticated_flag"] = (df["authenticated"].str.lower() == "yes").astype(int)
    df["event_type_flag"] = (df["event_type"].str.lower() == "planned").astype(int)
    df["has_junction"] = df["has_junction"].astype(int)
    df["description_len"] = df["description"].fillna("").str.len()

    # geo cluster
    lat_lon = df[["latitude", "longitude"]].fillna(0).values
    if kmeans_model is None:
        kmeans_model = KMeans(n_clusters=25, random_state=random_state, n_init=10)
        kmeans_model.fit(lat_lon)
    df["geo_cluster"] = kmeans_model.predict(lat_lon)

    # fill missing categoricals
    for col in ["corridor", "zone", "police_station", "event_cause", "veh_type"]:
        df[col] = df[col].fillna("unknown").astype(str)

    # label encodings (fit on full data)
    label_encodings: Dict[str, Any] = {}
    for col in ["event_cause", "veh_type", "corridor", "zone"]:
        unique_vals = sorted(df[col].unique().tolist())
        label_encodings[col] = {v: i for i, v in enumerate(unique_vals)}
        df[f"{col}_le"] = df[col].map(label_encodings[col]).fillna(len(unique_vals)).astype(int)

    # OOF target encoding (requires_road_closure must exist)
    target_col = "requires_road_closure"
    global_mean = float(df[target_col].mean())

    te_cols = ["corridor", "police_station", "event_cause", "geo_cluster", "zone", "veh_type"]
    for col in te_cols:
        df[f"{col}_te"] = global_mean  # init with global mean

    kf = KFold(n_splits=n_oof_splits, shuffle=True, random_state=random_state)
    for train_idx, val_idx in kf.split(df):
        train_fold = df.iloc[train_idx]
        for col in te_cols:
            col_key = df[col].iloc[val_idx]
            means = train_fold.groupby(col)[target_col].mean()
            df.loc[df.index[val_idx], f"{col}_te"] = col_key.map(means).fillna(global_mean).values

    # final global target encodings for inference
    target_encodings: Dict[str, Any] = {"global_mean": global_mean}
    for col in te_cols:
        target_encodings[col] = df.groupby(col)[target_col].mean().to_dict()
    # convert geo_cluster keys to string (for JSON serialisation)
    target_encodings["geo_cluster"] = {
        str(k): v for k, v in target_encodings["geo_cluster"].items()
    }

    return df, target_encodings, label_encodings, kmeans_model
