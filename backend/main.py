"""
main.py
-------
FastAPI application for the Nirbadha Pravaha traffic command center.
Flipkart Grid 7.0 Hackathon — Traffic Intelligence Layer.

Endpoints:
    POST /api/predict
    GET  /api/events
    GET  /api/events/hotspots
    GET  /api/model/metrics
    POST /api/events/{event_id}/feedback
    GET  /api/config
    GET  /api/health
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import urllib.parse
from pymongo import MongoClient
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
import pytz
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).parent.resolve()
MODELS_DIR = BACKEND_DIR / "models"
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

CONFIG_PATH = BACKEND_DIR / "config.json"
TARGET_ENC_PATH = BACKEND_DIR / "target_encodings.json"
LABEL_ENC_PATH = BACKEND_DIR / "label_encodings.json"
METRICS_PATH = MODELS_DIR / "metrics.json"
CORRIDOR_LOOKUP_PATH = BACKEND_DIR / "corridor_lookup.json"
EVENTS_SNAPSHOT_PATH = DATA_DIR / "events.json"

# ---------------------------------------------------------------------------
# MongoDB setup
# ---------------------------------------------------------------------------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
try:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client.nirbadha_pravaha
except Exception as e:
    print(f"Failed to connect to MongoDB: {e}")

# ---------------------------------------------------------------------------
# Haversine distance
# ---------------------------------------------------------------------------
def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# ---------------------------------------------------------------------------
# App state
# ---------------------------------------------------------------------------
class AppState:
    closure_model = None
    duration_model = None
    kmeans_model = None
    target_encodings: Dict = {}
    label_encodings: Dict = {}
    config: Dict = {}
    metrics: Dict = {}
    corridor_lookup: Dict = {}
    events_df: Optional[pd.DataFrame] = None
    models_loaded: bool = False


STATE = AppState()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class PredictRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude of the event")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude of the event")
    start_datetime: str = Field(..., description="ISO 8601 datetime of event start")
    event_cause: str = Field(..., description="One of EVENT_CAUSES")
    veh_type: str = Field(..., description="One of VEH_TYPES")
    event_type: str = Field(default="unplanned", description="'planned' or 'unplanned'")
    authenticated: str = Field(default="no", description="'yes' or 'no'")
    description: str = Field(default="", description="Free-text description of the event")
    has_junction: bool = Field(default=False, description="Whether the event is at a junction")


class FeatureExplanation(BaseModel):
    name: str
    importance: float
    value: float


class NearbyRoad(BaseModel):
    name: str
    latitude: float
    longitude: float
    distance_km: float
    risk_level: str


class PredictionResponse(BaseModel):
    requires_road_closure_probability: float
    requires_road_closure_prediction: bool
    predicted_duration_min: float
    severity_tier: str
    recommended_manpower: int
    barricade_units: int
    barricading: str
    diversion_plan: str
    top_features: List[FeatureExplanation]
    applied_rules: List[str]
    derived_corridor: str
    derived_zone: str
    derived_police_station: str
    nearby_roads: List[NearbyRoad] = []


class FeedbackRequest(BaseModel):
    actual_requires_closure: Optional[bool] = None
    actual_duration_min: Optional[float] = None
    notes: str = ""


class FeedbackResponse(BaseModel):
    status: str
    feedback_id: int


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
def _init_db() -> None:
    """Initialize MongoDB collections if necessary."""
    try:
        db.events.create_index([("start_datetime", -1)])
        db.events.create_index([("event_cause", 1)])
        db.events.create_index([("corridor", 1)])
        db.events.create_index([("event_id", 1)], unique=True)
    except Exception as e:
        print(f"Warning: could not create indexes: {e}")

def _populate_db_from_snapshot() -> None:
    """Seed the events collection from events.json if empty."""
    try:
        count = db.events.count_documents({})
        if count == 0 and EVENTS_SNAPSHOT_PATH.exists():
            df = pd.read_json(str(EVENTS_SNAPSHOT_PATH))
            df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
            df["has_junction"] = df["has_junction"].astype(int) if "has_junction" in df.columns else 0
            df["requires_road_closure"] = df["requires_road_closure"].astype(int) if "requires_road_closure" in df.columns else 0
            df["start_datetime"] = df["start_datetime"].astype(str)
            cols = [
                "latitude", "longitude", "start_datetime", "event_cause", "veh_type",
                "event_type", "authenticated", "description", "has_junction",
                "corridor", "zone", "police_station", "duration_min", "requires_road_closure",
            ]
            cols_present = [c for c in cols if c in df.columns]
            
            records = df[cols_present].to_dict(orient="records")
            for i, r in enumerate(records):
                r["event_id"] = i + 1
                r["created_at"] = datetime.utcnow().isoformat()
                
            if records:
                db.events.insert_many(records)
            print(f"[main] Seeded events collection with {len(records)} rows from snapshot.")
    except Exception as e:
        print(f"Failed to populate DB: {e}")


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------
def _run_training() -> None:
    """Invoke train.py as a subprocess."""
    print("[main] Running train.py …")
    result = subprocess.run(
        [sys.executable, str(BACKEND_DIR / "train.py")],
        capture_output=False,
        cwd=str(BACKEND_DIR),
    )
    if result.returncode != 0:
        raise RuntimeError("train.py failed. Check logs above.")
    print("[main] train.py completed successfully.")


def _load_models() -> None:
    """Load all model artefacts into STATE."""
    closure_path = MODELS_DIR / "closure_model.joblib"
    duration_path = MODELS_DIR / "duration_model.joblib"
    kmeans_path = MODELS_DIR / "kmeans.joblib"

    # If any model is missing, retrain
    if not (closure_path.exists() and duration_path.exists() and kmeans_path.exists()):
        print("[main] Model files not found — triggering training …")
        _run_training()

    STATE.closure_model = joblib.load(str(closure_path))
    STATE.duration_model = joblib.load(str(duration_path))
    STATE.kmeans_model = joblib.load(str(kmeans_path))

    with open(TARGET_ENC_PATH, "r") as fh:
        STATE.target_encodings = json.load(fh)
    with open(LABEL_ENC_PATH, "r") as fh:
        STATE.label_encodings = json.load(fh)

    if METRICS_PATH.exists():
        with open(METRICS_PATH, "r") as fh:
            STATE.metrics = json.load(fh)

    if CORRIDOR_LOOKUP_PATH.exists():
        with open(CORRIDOR_LOOKUP_PATH, "r") as fh:
            STATE.corridor_lookup = json.load(fh)

    STATE.models_loaded = True
    print("[main] All models loaded successfully.")


# ---------------------------------------------------------------------------
# Geo-derivation helpers
# ---------------------------------------------------------------------------
def _derive_corridor_zone_ps(lat: float, lon: float) -> tuple[str, str, str]:
    """
    Nearest-neighbour lookup in corridor_lookup.json.
    Falls back to sensible defaults if lookup is empty.
    """
    if not STATE.corridor_lookup:
        return "unknown", "unknown", "unknown"

    best_corridor = "unknown"
    best_dist = float("inf")
    for corridor, info in STATE.corridor_lookup.items():
        d = haversine(lat, lon, info["lat"], info["lon"])
        if d < best_dist:
            best_dist = d
            best_corridor = corridor

    info = STATE.corridor_lookup.get(best_corridor, {})
    zone = info.get("zone", "unknown")
    ps = info.get("police_station", "unknown")
    return best_corridor, zone, ps

def _calculate_nearby_roads(lat: float, lon: float, limit: int = 5) -> List[NearbyRoad]:
    roads = []
    try:
        with open(BACKEND_DIR / "corridor_lookup.json", "r") as f:
            corridor_data = json.load(f)
            
        for name, data in corridor_data.items():
            if name == "unknown": continue
            road_lat = data.get("lat")
            road_lon = data.get("lon")
            if road_lat and road_lon:
                dist = haversine(lat, lon, road_lat, road_lon)
                if dist < 2.0:
                    risk = "red"
                elif dist < 5.0:
                    risk = "yellow"
                else:
                    risk = "green"
                roads.append(NearbyRoad(
                    name=name,
                    latitude=road_lat,
                    longitude=road_lon,
                    distance_km=round(dist, 2),
                    risk_level=risk
                ))
    except Exception as e:
        print(f"Error loading corridor data: {e}")
        
    roads.sort(key=lambda x: x.distance_km)
    return roads[:limit]


# ---------------------------------------------------------------------------
# Prediction helper
# ---------------------------------------------------------------------------
def _build_applied_rules(
    event_cause: str,
    closure_proba: float,
    predicted_duration: float,
    is_peak_hour: bool,
    severity_tier: str,
    config: Dict,
) -> List[str]:
    rules: List[str] = []
    crowd_causes = [c.lower() for c in config.get("CROWD_CAUSES", [])]

    # Severity rules
    high_proba = config["SEVERITY_TIERS"]["HIGH"]["closure_proba_min"]
    high_dur = config["SEVERITY_TIERS"]["HIGH"]["duration_min_threshold"]
    med_proba = config["SEVERITY_TIERS"]["MEDIUM"]["closure_proba_min"]
    med_dur = config["SEVERITY_TIERS"]["MEDIUM"]["duration_min_threshold"]

    if closure_proba >= high_proba:
        rules.append(f"Closure probability {closure_proba:.1%} ≥ HIGH threshold ({high_proba:.0%}) → HIGH severity")
    elif predicted_duration >= high_dur:
        rules.append(f"Predicted duration {predicted_duration:.0f} min ≥ HIGH threshold ({high_dur} min) → HIGH severity")
    elif closure_proba >= med_proba:
        rules.append(f"Closure probability {closure_proba:.1%} ≥ MEDIUM threshold ({med_proba:.0%}) → MEDIUM severity")
    elif predicted_duration >= med_dur:
        rules.append(f"Predicted duration {predicted_duration:.0f} min ≥ MEDIUM threshold ({med_dur} min) → MEDIUM severity")
    else:
        rules.append(f"Low closure probability ({closure_proba:.1%}) and short predicted duration ({predicted_duration:.0f} min) → LOW severity")

    if is_peak_hour:
        bonus = config.get("PEAK_HOUR_BONUS", 1)
        rules.append(f"Event during peak hours → +{bonus} officer(s) dispatched")

    if event_cause.lower() in crowd_causes:
        bonus = config.get("CROWD_EVENT_BONUS", 2)
        rules.append(f"'{event_cause}' is a crowd-generating cause → +{bonus} officer(s) for crowd management")

    rules.append(f"Final severity tier: {severity_tier}")
    return rules


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown logic."""
    # Load config first
    with open(CONFIG_PATH, "r") as fh:
        STATE.config = json.load(fh)

    _init_db()
    _load_models()
    _populate_db_from_snapshot()

    yield
    # Shutdown — nothing special needed
    print("[main] Shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Nirbadha Pravaha — Traffic Command Center API",
    description=(
        "AI-powered traffic event management backend for Bengaluru. "
        "Flipkart Grid 7.0 Hackathon submission."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

# ── Health ─────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
def health_check() -> Dict[str, Any]:
    """Return service health status."""
    return {
        "status": "ok",
        "models_loaded": STATE.models_loaded,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "service": "Nirbadha Pravaha Traffic Command Center",
        "version": "1.0.0",
    }


# ── Config ─────────────────────────────────────────────────────────────────
@app.get("/api/config", tags=["System"])
def get_config() -> Dict[str, Any]:
    """Return the active configuration."""
    return STATE.config


# ── Geospatial ─────────────────────────────────────────────────────────────
@app.get("/api/nearby-roads", response_model=List[NearbyRoad], tags=["Geospatial"])
def get_nearby_roads_api(lat: float, lon: float, limit: int = 5):
    return _calculate_nearby_roads(lat, lon, limit)


# ── Predict ────────────────────────────────────────────────────────────────
@app.post("/api/predict", response_model=PredictionResponse, tags=["Prediction"])
def predict(req: PredictRequest) -> PredictionResponse:
    """
    Predict road closure probability, event duration, severity tier,
    and recommended resources for a traffic event.
    """
    if not STATE.models_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet. Retry in a moment.")

    from features import engineer_features, FEATURE_COLS, REG_FEATURES
    from recommend import recommend_resources

    # Derive corridor / zone / police_station
    corridor, zone, ps = _derive_corridor_zone_ps(req.latitude, req.longitude)

    raw = {
        "latitude": req.latitude,
        "longitude": req.longitude,
        "start_datetime": req.start_datetime,
        "event_cause": req.event_cause,
        "veh_type": req.veh_type,
        "event_type": req.event_type,
        "authenticated": req.authenticated,
        "description": req.description,
        "has_junction": req.has_junction,
        "corridor": corridor,
        "zone": zone,
        "police_station": ps,
    }

    try:
        clf_feats, reg_feats = engineer_features(
            raw,
            STATE.target_encodings,
            STATE.label_encodings,
            STATE.kmeans_model,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Feature engineering error: {exc}")

    # Build arrays
    X_clf = np.array([[clf_feats[k] for k in FEATURE_COLS]], dtype=float)
    X_reg = np.array([[reg_feats[k] for k in REG_FEATURES]], dtype=float)

    # Closure prediction
    closure_proba = float(STATE.closure_model.predict_proba(X_clf)[0, 1])
    best_threshold = float(STATE.config.get("BEST_THRESHOLD", 0.65))
    closure_pred = closure_proba >= best_threshold

    # Duration prediction
    log_duration = float(STATE.duration_model.predict(X_reg)[0])
    predicted_duration = float(np.expm1(log_duration))

    # Peak hour check
    try:
        ist = pytz.timezone("Asia/Kolkata")
        dt = pd.to_datetime(req.start_datetime)
        if dt.tzinfo is None:
            dt = ist.localize(dt)
        else:
            dt = dt.astimezone(ist)
        hour = dt.hour
        is_peak_hour = (8 <= hour <= 11) or (17 <= hour <= 20)
    except Exception:
        is_peak_hour = False

    # Recommendations
    rec = recommend_resources(
        event_cause=req.event_cause,
        closure_risk_proba=closure_proba,
        predicted_duration_min=predicted_duration,
        is_peak_hour=is_peak_hour,
        requires_closure_pred=closure_pred,
        config=STATE.config,
    )

    # Feature explanation (top 8 by closure model importance)
    closure_importances = STATE.closure_model.feature_importances_
    fi_pairs = sorted(
        zip(FEATURE_COLS, closure_importances, [clf_feats[k] for k in FEATURE_COLS]),
        key=lambda x: x[1],
        reverse=True,
    )[:8]
    top_features = [
        FeatureExplanation(name=name, importance=float(imp), value=float(val))
        for name, imp, val in fi_pairs
    ]

    # Applied rules
    applied_rules = _build_applied_rules(
        event_cause=req.event_cause,
        closure_proba=closure_proba,
        predicted_duration=predicted_duration,
        is_peak_hour=is_peak_hour,
        severity_tier=rec["severity_tier"],
        config=STATE.config,
    )

    # Persist this event to DB
    _persist_event(req, corridor, zone, ps, predicted_duration, int(closure_pred))

    return PredictionResponse(
        requires_road_closure_probability=round(closure_proba, 4),
        requires_road_closure_prediction=bool(closure_pred),
        predicted_duration_min=round(predicted_duration, 1),
        severity_tier=rec["severity_tier"],
        recommended_manpower=rec["recommended_manpower"],
        barricade_units=rec["barricade_units"],
        barricading=rec["barricading"],
        diversion_plan=rec["diversion_plan"],
        top_features=top_features,
        applied_rules=applied_rules,
        derived_corridor=corridor,
        derived_zone=zone,
        derived_police_station=ps,
        nearby_roads=_calculate_nearby_roads(req.latitude, req.longitude)
    )


def _persist_event(
    req: PredictRequest,
    corridor: str,
    zone: str,
    ps: str,
    duration: float,
    closure: int,
) -> None:
    """Store a prediction request in the events collection."""
    try:
        last_event = db.events.find_one({}, sort=[("event_id", -1)])
        next_id = (last_event["event_id"] + 1) if last_event and "event_id" in last_event else 1

        db.events.insert_one({
            "event_id": next_id,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "start_datetime": req.start_datetime,
            "event_cause": req.event_cause,
            "veh_type": req.veh_type,
            "event_type": req.event_type,
            "authenticated": req.authenticated,
            "description": req.description,
            "has_junction": int(req.has_junction),
            "corridor": corridor,
            "zone": zone,
            "police_station": ps,
            "duration_min": round(duration, 1),
            "requires_road_closure": closure,
            "created_at": datetime.utcnow().isoformat()
        })
    except Exception as exc:
        print(f"[main] Warning: could not persist event: {exc}")


# ── Events ─────────────────────────────────────────────────────────────────
@app.get("/api/events", tags=["Events"])
def get_events(
    date_from: Optional[str] = Query(None, description="ISO date filter start (inclusive)"),
    date_to: Optional[str] = Query(None, description="ISO date filter end (inclusive)"),
    cause: Optional[str] = Query(None, description="Filter by event_cause"),
    corridor: Optional[str] = Query(None, description="Filter by corridor name"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=1000, description="Results per page"),
) -> Dict[str, Any]:
    """
    Return paginated historical events from MongoDB.
    Supports filtering by date range, event cause, and corridor.
    """
    query = {}

    if date_from or date_to:
        query["start_datetime"] = {}
        if date_from:
            query["start_datetime"]["$gte"] = date_from
        if date_to:
            query["start_datetime"]["$lte"] = date_to + "T23:59:59"
            
    if cause:
        query["event_cause"] = cause
        
    if corridor:
        query["corridor"] = {"$regex": corridor, "$options": "i"}

    total = db.events.count_documents(query)
    
    offset = (page - 1) * page_size
    cursor = db.events.find(query, {"_id": 0}).sort("event_id", -1).skip(offset).limit(page_size)
    events = list(cursor)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 1,
        "events": events,
    }


# ── Hotspots ───────────────────────────────────────────────────────────────
@app.get("/api/events/hotspots", tags=["Events"])
def get_hotspots() -> Dict[str, Any]:
    """
    Return geo-cluster statistics: centroid lat/lon, event count,
    closure rate, and median duration per cluster.
    """
    if not STATE.models_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet.")

    cursor = db.events.find(
        {"latitude": {"$ne": None}, "longitude": {"$ne": None}},
        {"latitude": 1, "longitude": 1, "requires_road_closure": 1, "duration_min": 1, "_id": 0}
    )
    rows = list(cursor)

    if not rows:
        # Return KMeans centroids with zero stats
        centroids = STATE.kmeans_model.cluster_centers_
        hotspots = []
        for i, (lat, lon) in enumerate(centroids):
            hotspots.append({
                "cluster_id": i,
                "centroid_lat": round(float(lat), 5),
                "centroid_lon": round(float(lon), 5),
                "event_count": 0,
                "closure_rate": 0.0,
                "median_duration_min": 0.0,
            })
        return {"hotspots": hotspots}

    lats = np.array([r.get("latitude") for r in rows])
    lons = np.array([r.get("longitude") for r in rows])
    closures = np.array([r.get("requires_road_closure", 0) for r in rows])
    durations = np.array([r.get("duration_min", 30.0) if r.get("duration_min") is not None else 30.0 for r in rows])

    try:
        cluster_ids = STATE.kmeans_model.predict(np.column_stack([lats, lons]))
    except Exception:
        # fallback
        cluster_ids = np.zeros(len(lats), dtype=int)

    centroids = STATE.kmeans_model.cluster_centers_
    n_clusters = len(centroids)
    hotspots = []

    for cid in range(n_clusters):
        mask = cluster_ids == cid
        count = int(mask.sum())
        if count == 0:
            closure_rate = 0.0
            median_dur = 0.0
        else:
            closure_rate = float(closures[mask].mean())
            median_dur = float(np.median(durations[mask]))

        hotspots.append({
            "cluster_id": cid,
            "centroid_lat": round(float(centroids[cid, 0]), 5),
            "centroid_lon": round(float(centroids[cid, 1]), 5),
            "event_count": count,
            "closure_rate": round(closure_rate, 4),
            "median_duration_min": round(median_dur, 1),
        })

    # Sort by event count desc
    hotspots.sort(key=lambda x: x["event_count"], reverse=True)
    return {"hotspots": hotspots, "n_clusters": n_clusters}


# ── Metrics ────────────────────────────────────────────────────────────────
@app.get("/api/model/metrics", tags=["Model"])
def get_metrics() -> Dict[str, Any]:
    """Return pre-computed model performance metrics."""
    if not STATE.metrics:
        raise HTTPException(status_code=404, detail="Metrics not available. Run training first.")
    return STATE.metrics


# ── Feedback ───────────────────────────────────────────────────────────────
@app.post("/api/events/{event_id}/feedback", response_model=FeedbackResponse, tags=["Events"])
def submit_feedback(event_id: int, body: FeedbackRequest) -> FeedbackResponse:
    """
    Store ground-truth feedback for a previously predicted event.
    Accepts actual_requires_closure and/or actual_duration_min.
    """
    existing = db.events.find_one({"event_id": event_id})
    if not existing:
        raise HTTPException(
            status_code=404,
            detail=f"Event with id={event_id} not found.",
        )

    last_fb = db.feedback.find_one({}, sort=[("feedback_id", -1)])
    next_id = (last_fb["feedback_id"] + 1) if last_fb and "feedback_id" in last_fb else 1

    db.feedback.insert_one({
        "feedback_id": next_id,
        "event_id": event_id,
        "actual_requires_closure": int(body.actual_requires_closure) if body.actual_requires_closure is not None else None,
        "actual_duration_min": body.actual_duration_min,
        "notes": body.notes,
        "created_at": datetime.utcnow().isoformat()
    })

    return FeedbackResponse(status="ok", feedback_id=next_id)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
