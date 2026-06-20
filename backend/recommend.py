"""
recommend.py
------------
Resource recommendation engine for the Nirbadha Pravaha traffic command center.

Given model outputs and configuration, determines severity tier, recommended
manpower, barricade count, barricading strategy text, and diversion plan text.
"""

from __future__ import annotations

from typing import Any, Dict


# ---------------------------------------------------------------------------
# Main recommendation function
# ---------------------------------------------------------------------------

def recommend_resources(
    event_cause: str,
    closure_risk_proba: float,
    predicted_duration_min: float,
    is_peak_hour: bool,
    requires_closure_pred: bool,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Compute resource recommendations for a traffic event.

    Parameters
    ----------
    event_cause : str
        One of the EVENT_CAUSES strings (e.g. 'accident', 'pothole', …).
    closure_risk_proba : float
        Probability of road closure from the LightGBM classifier [0, 1].
    predicted_duration_min : float
        Predicted event duration in minutes from the RandomForest regressor.
    is_peak_hour : bool
        True if the event falls within morning (8-11) or evening (17-20) peak hours.
    requires_closure_pred : bool
        Binary prediction from the closure classifier at the best threshold.
    config : dict
        Loaded config.json as a Python dict.

    Returns
    -------
    dict with keys:
        severity_tier        : str  — "HIGH" | "MEDIUM" | "LOW"
        recommended_manpower : int
        barricade_units      : int
        barricading          : str  — human-readable barricading strategy
        diversion_plan       : str  — human-readable diversion guidance
    """

    # ---- unpack config ----
    severity_tiers: Dict = config["SEVERITY_TIERS"]
    manpower_map: Dict = config["MANPOWER"]
    barricade_map: Dict = config["BARRICADE_UNITS"]
    peak_bonus: int = int(config.get("PEAK_HOUR_BONUS", 1))
    crowd_bonus: int = int(config.get("CROWD_EVENT_BONUS", 2))
    crowd_causes = [c.lower() for c in config.get("CROWD_CAUSES", [])]

    high_proba_min: float = float(severity_tiers["HIGH"]["closure_proba_min"])
    high_dur_min: float = float(severity_tiers["HIGH"]["duration_min_threshold"])
    med_proba_min: float = float(severity_tiers["MEDIUM"]["closure_proba_min"])
    med_dur_min: float = float(severity_tiers["MEDIUM"]["duration_min_threshold"])

    # ---- determine severity tier ----
    if closure_risk_proba >= high_proba_min or predicted_duration_min >= high_dur_min:
        tier = "HIGH"
    elif closure_risk_proba >= med_proba_min or predicted_duration_min >= med_dur_min:
        tier = "MEDIUM"
    else:
        tier = "LOW"

    # ---- base manpower ----
    manpower: int = int(manpower_map.get(tier, 1))

    # ---- peak-hour bonus ----
    if is_peak_hour:
        manpower += peak_bonus

    # ---- crowd-event bonus ----
    if event_cause.lower() in crowd_causes:
        manpower += crowd_bonus

    # ---- barricade units ----
    if tier == "HIGH":
        if requires_closure_pred:
            # Full road closure: maximum barricades
            barricades: int = int(barricade_map.get("HIGH", 4))
        else:
            # High risk but no full closure predicted — use intermediate count
            barricades = int(barricade_map.get("HIGH_CLOSURE_MEDIUM", 2))
    elif tier == "MEDIUM":
        barricades = int(barricade_map.get("MEDIUM", 1))
    else:
        barricades = int(barricade_map.get("LOW", 0))

    # ---- barricading strategy text ----
    barricading = _barricading_text(tier, requires_closure_pred, barricades, event_cause)

    # ---- diversion plan text ----
    diversion_plan = _diversion_text(tier, requires_closure_pred, event_cause, predicted_duration_min)

    return {
        "severity_tier": tier,
        "recommended_manpower": manpower,
        "barricade_units": barricades,
        "barricading": barricading,
        "diversion_plan": diversion_plan,
    }


# ---------------------------------------------------------------------------
# Text generation helpers
# ---------------------------------------------------------------------------

def _barricading_text(
    tier: str,
    requires_closure_pred: bool,
    barricades: int,
    event_cause: str,
) -> str:
    if tier == "HIGH" and requires_closure_pred:
        return (
            f"Full road closure recommended. Deploy {barricades} barricade units "
            f"at both approach ends and all secondary entry points. "
            f"Activate road-closed signage and deploy personnel for 24/7 monitoring."
        )
    elif tier == "HIGH":
        return (
            f"High-risk event. Deploy {barricades} barricade units to narrow the "
            f"carriageway and enforce single-lane traffic management. "
            f"Keep closure equipment on standby."
        )
    elif tier == "MEDIUM":
        return (
            f"Partial barricading required. Place {barricades} barricade unit(s) "
            f"to protect the incident zone. Maintain advisory signage 200 m upstream."
        )
    else:
        return (
            "No barricades required at this time. Monitor situation; "
            "deploy cones if the event escalates."
        )


_DIVERSION_TEMPLATES: Dict[str, str] = {
    "accident": (
        "Activate pre-defined accident diversion route. "
        "Notify nearest police station immediately. "
        "Coordinate with BBMP for debris clearance if needed."
    ),
    "vehicle_breakdown": (
        "Guide traffic to the leftmost lane. "
        "Arrange towing vehicle from the nearest authorized centre. "
        "Clear the lane within 30 minutes to avoid cascade congestion."
    ),
    "pothole": (
        "Cone off the pothole area and force a lane shift. "
        "Issue BBMP urgent repair work order. "
        "Estimated repair: < 2 hours for cold-mix patching."
    ),
    "procession": (
        "Enforce one-way traffic flow opposite to procession direction. "
        "Coordinate with event organisers on route and timeline. "
        "Deploy beat constables at all crossing points."
    ),
    "water_logging": (
        "Close waterlogged stretch immediately. "
        "Divert traffic via elevated corridor. "
        "Alert BBMP stormwater drain team for emergency pumping."
    ),
    "public_event": (
        "Implement event-day traffic management plan. "
        "Activate park-and-walk zones and shuttle service if applicable. "
        "Coordinate with event security for crowd flow."
    ),
    "protest": (
        "Cordon off protest area; divert traffic to parallel roads. "
        "Maintain law-and-order personnel at frontline. "
        "Re-evaluate diversion every 30 minutes as situation evolves."
    ),
    "tree_fall": (
        "Emergency lane closure; dispatch BBMP tree-removal crew immediately. "
        "Allow single-file alternating traffic under officer supervision. "
        "Expected clearance: 60–120 minutes."
    ),
    "vip_movement": (
        "Implement rolling road block as per VIP movement protocol. "
        "Coordinate with SPG/PSO for timing window. "
        "Pre-position diversion signage on alternative routes."
    ),
    "construction": (
        "Enforce time-of-day construction window (non-peak hours only). "
        "Maintain at least one lane open at all times. "
        "Display construction-ahead advisory boards 500 m upstream."
    ),
}


def _diversion_text(
    tier: str,
    requires_closure_pred: bool,
    event_cause: str,
    predicted_duration_min: float,
) -> str:
    base = _DIVERSION_TEMPLATES.get(
        event_cause.lower(),
        (
            "Assess the incident on-ground and apply standard operating procedure. "
            "Notify control room for additional resources if required."
        ),
    )

    suffix = ""
    if tier == "HIGH":
        suffix = (
            f" [HIGH PRIORITY] Estimated duration: {predicted_duration_min:.0f} min. "
            "Escalate to senior officer if not resolved within 60 minutes."
        )
    elif tier == "MEDIUM":
        suffix = (
            f" Estimated duration: {predicted_duration_min:.0f} min. "
            "Monitor every 15 minutes and upgrade severity if situation worsens."
        )
    else:
        suffix = (
            f" Estimated duration: {predicted_duration_min:.0f} min. "
            "Standard monitoring applies."
        )

    return base + suffix
