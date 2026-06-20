"""
generate_lookups.py
-------------------
Standalone script to (re-)generate corridor_lookup.json from the training CSV.
Run after acquiring new data to refresh nearest-neighbour lookup used by main.py.

Usage:
    python generate_lookups.py
    python generate_lookups.py --csv path/to/Astram_event_data_anonymized.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict

import numpy as np
import pandas as pd

BACKEND_DIR = Path(__file__).parent.resolve()

CANDIDATE_PATHS = [
    # ── Primary: dataset/ folder the user placed their CSV in ──────────────
    BACKEND_DIR.parent / "dataset" / "Astram_event_data_anonymized.csv",
    # ── Legacy / fallback paths ─────────────────────────────────────────────
    BACKEND_DIR.parent / "Astram_event_data_anonymized.csv",
    BACKEND_DIR.parent / "flipkartevent" / "Astram_event_data_anonymized.csv",
    BACKEND_DIR / "Astram_event_data_anonymized.csv",
]


def load_csv(csv_path: str | None) -> pd.DataFrame:
    """Load CSV from the given path or auto-discover it."""
    if csv_path:
        p = Path(csv_path)
        if not p.exists():
            print(f"[ERROR] File not found: {p}", file=sys.stderr)
            sys.exit(1)
        print(f"[generate_lookups] Loading: {p}")
        return pd.read_csv(p)

    for p in CANDIDATE_PATHS:
        if p.exists():
            print(f"[generate_lookups] Loading: {p}")
            return pd.read_csv(p)

    print(
        "[generate_lookups] CSV not found. Generating a minimal synthetic lookup.",
        file=sys.stderr,
    )
    return _synthetic_df()


def _synthetic_df() -> pd.DataFrame:
    """Minimal synthetic fallback so the script always produces output."""
    rng = np.random.default_rng(42)
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
    n = 500
    return pd.DataFrame({
        "corridor": rng.choice(corridors, n),
        "zone": rng.choice(zones, n),
        "police_station": rng.choice(police_stations, n),
        "latitude": rng.uniform(12.82, 13.08, n),
        "longitude": rng.uniform(77.47, 77.73, n),
    })


def build_corridor_lookup(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Compute per-corridor statistics.

    For each unique corridor:
        lat         — median latitude
        lon         — median longitude
        zone        — most frequent zone
        police_station — most frequent police_station
        event_count — number of events in this corridor
    """
    df = df.copy()
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    required = {"corridor", "latitude", "longitude"}
    if not required.issubset(df.columns):
        missing = required - set(df.columns)
        print(f"[ERROR] Missing columns: {missing}", file=sys.stderr)
        sys.exit(1)

    df["corridor"] = df["corridor"].fillna("unknown").astype(str)
    df["zone"] = df.get("zone", pd.Series(["unknown"] * len(df))).fillna("unknown").astype(str)
    df["police_station"] = df.get("police_station", pd.Series(["unknown"] * len(df))).fillna("unknown").astype(str)
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

    lookup: Dict[str, Any] = {}
    for corridor, sub in df.groupby("corridor"):
        sub_clean = sub.dropna(subset=["latitude", "longitude"])
        if sub_clean.empty:
            lat, lon = 12.9716, 77.5946
        else:
            lat = float(sub_clean["latitude"].median())
            lon = float(sub_clean["longitude"].median())

        zone_mode = sub["zone"].mode()
        zone = str(zone_mode.iloc[0]) if len(zone_mode) else "unknown"

        ps_mode = sub["police_station"].mode()
        ps = str(ps_mode.iloc[0]) if len(ps_mode) else "unknown"

        lookup[str(corridor)] = {
            "lat": lat,
            "lon": lon,
            "zone": zone,
            "police_station": ps,
            "event_count": int(len(sub)),
        }

    return lookup


def build_zone_lookup(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Compute per-zone statistics: centroid lat/lon, top corridors, event count.
    """
    df = df.copy()
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    if "zone" not in df.columns:
        return {}

    df["zone"] = df["zone"].fillna("unknown").astype(str)
    df["latitude"] = pd.to_numeric(df.get("latitude", 12.9716), errors="coerce")
    df["longitude"] = pd.to_numeric(df.get("longitude", 77.5946), errors="coerce")

    lookup: Dict[str, Any] = {}
    for zone, sub in df.groupby("zone"):
        sub_clean = sub.dropna(subset=["latitude", "longitude"])
        lat = float(sub_clean["latitude"].median()) if not sub_clean.empty else 12.9716
        lon = float(sub_clean["longitude"].median()) if not sub_clean.empty else 77.5946

        top_corridors: list = []
        if "corridor" in sub.columns:
            top_corridors = (
                sub["corridor"]
                .value_counts()
                .head(5)
                .index.tolist()
            )

        lookup[str(zone)] = {
            "lat": lat,
            "lon": lon,
            "event_count": int(len(sub)),
            "top_corridors": top_corridors,
        }

    return lookup


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate corridor/zone lookup JSON files.")
    parser.add_argument("--csv", type=str, default=None, help="Path to the training CSV.")
    args = parser.parse_args()

    df = load_csv(args.csv)
    print(f"[generate_lookups] Loaded {len(df)} rows.")

    corridor_lookup = build_corridor_lookup(df)
    zone_lookup = build_zone_lookup(df)

    # Save corridor_lookup.json
    corridor_out = BACKEND_DIR / "corridor_lookup.json"
    with open(corridor_out, "w") as fh:
        json.dump(corridor_lookup, fh, indent=2)
    print(f"[generate_lookups] Saved {len(corridor_lookup)} corridors -> {corridor_out}")

    # Save zone_lookup.json
    zone_out = BACKEND_DIR / "zone_lookup.json"
    with open(zone_out, "w") as fh:
        json.dump(zone_lookup, fh, indent=2)
    print(f"[generate_lookups] Saved {len(zone_lookup)} zones -> {zone_out}")

    # Print summary
    print("\nCorridor lookup sample (first 5):")
    for i, (k, v) in enumerate(corridor_lookup.items()):
        if i >= 5:
            break
        print(f"  {k:30s} lat={v['lat']:.4f}  lon={v['lon']:.4f}  zone={v['zone']}")

    print("\n[generate_lookups] Done.")


if __name__ == "__main__":
    main()
