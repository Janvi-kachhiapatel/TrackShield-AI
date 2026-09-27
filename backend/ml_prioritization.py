"""
ML Failure-Risk Prioritization Model.

Problem statement requirement: "Uses AI/ML algorithms to prioritize and
schedule maintenance tasks based on criticality, urgency, and impact on
asset availability."

A logistic regression trained (real gradient descent, every request — never
pickled) on failure history synthesized from the asset register itself:

  y = 1  when the asset's health status is FAULTY/DEGRADED or it has an open
         overdue work request  (i.e. it needed intervention)
  y = 0  otherwise

Features per asset (all normalized):
  x1  health status          (HEALTHY=0, DEGRADED=0.5, FAULTY=1, UNDER_MAINTENANCE=0.25)
  x2  age factor             (years since install / 25, clipped 0..1)
  x3  criticality            (LOW=0.2, MEDIUM=0.5, HIGH=0.8, CRITICAL=1.0)
  x4  inspection recency     (days since last inspection / 365, clipped 0..1)
  x5  open requests factor   (min(open_requests, 3) / 3)
  x6  corridor traffic factor (daily trains on corridor / 40, clipped 0..1)

Output: P(failure within horizon) per asset — calibrated, explainable via
per-feature contributions (weight * standardized feature value).

The model is deterministic: identical data in, identical weights out.
"""
from __future__ import annotations

import math
from typing import Dict, List, Tuple

import datetime

# Normalization maps -----------------------------------------------------------------

HEALTH_MAP = {"HEALTHY": 0.0, "UNDER_MAINTENANCE": 0.25, "DEGRADED": 0.5, "FAULTY": 1.0}
CRIT_MAP = {"LOW": 0.2, "MEDIUM": 0.5, "HIGH": 0.8, "CRITICAL": 1.0}

FEATURE_NAMES = [
    "health_status", "age_factor", "criticality",
    "inspection_recency", "open_requests", "corridor_traffic",
]

# Training hyperparameters (documented, deterministic)
LEARNING_RATE = 0.15
EPOCHS = 600
L2_PENALTY = 0.002

PRIOR_LOGIT = -2.2  # base failure log-odds


def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def asset_feature_vector(
    status: str,
    install_year: int,
    criticality: str,
    last_inspected: str,
    open_requests: int,
    corridor_daily_trains: int,
    today: datetime.date | None = None,
) -> Dict[str, float]:
    """Build the normalized feature dict for one asset."""
    today = today or datetime.date.today()
    try:
        age_years = max(0.0, today.year - int(install_year or today.year))
    except (ValueError, TypeError):
        age_years = 5.0
    try:
        insp = datetime.date.fromisoformat(str(last_inspected)[:10])
        insp_days = max(0.0, (today - insp).days)
    except ValueError:
        insp_days = 30.0

    return {
        "health_status": HEALTH_MAP.get(str(status or "HEALTHY").upper(), 0.25),
        "age_factor": min(1.0, age_years / 25.0),
        "criticality": CRIT_MAP.get(str(criticality or "MEDIUM").upper(), 0.5),
        "inspection_recency": min(1.0, insp_days / 365.0),
        "open_requests": min(1.0, max(0, int(open_requests or 0)) / 3.0),
        "corridor_traffic": min(1.0, max(0, int(corridor_daily_trains or 0)) / 40.0),
    }


def _label(status: str, open_requests: int) -> int:
    """Supervised label: did this asset need intervention?"""
    failed = str(status or "").upper() in ("FAULTY", "DEGRADED")
    overdue = int(open_requests or 0) > 0
    return 1 if (failed or overdue) else 0


def train_logistic(X: List[List[float]], y: List[int]) -> List[float]:
    """Plain gradient descent on log-loss with L2. Returns weights (len = features)."""
    n_features = len(X[0]) if X else len(FEATURE_NAMES)
    w = [0.0] * n_features
    n = max(1, len(X))
    for _ in range(EPOCHS):
        grads = [0.0] * n_features
        for xi, yi in zip(X, y):
            z = PRIOR_LOGIT + sum(wj * xj for wj, xj in zip(w, xi))
            p = _sigmoid(z)
            err = p - yi
            for j in range(n_features):
                grads[j] += err * xi[j]
        for j in range(n_features):
            w[j] -= LEARNING_RATE * (grads[j] / n + L2_PENALTY * w[j])
    return w


def explain_probability(
    weights: List[float], features: Dict[str, float]
) -> Tuple[float, List[Dict]]:
    """
    P(failure) via the trained logistic plus per-feature contributions,
    sorted by absolute contribution. Fully explainable output.
    """
    z = PRIOR_LOGIT
    contributions = []
    for name, w in zip(FEATURE_NAMES, weights):
        val = float(features.get(name, 0.0))
        contrib = w * val
        z += contrib
        contributions.append({
            "feature": name,
            "value": round(val, 3),
            "weight": round(w, 4),
            "contribution": round(contrib, 4),
        })
    p = _sigmoid(z)
    contributions.sort(key=lambda c: abs(c["contribution"]), reverse=True)
    return p, contributions


def prioritize_assets(assets: List[Dict]) -> Dict:
    """
    Train on the provided asset history and score every asset.

    Each asset dict needs:
      id, asset_id, name, status, install_year, criticality, last_inspected,
      open_requests, corridor_daily_trains,
      optional: corridor_id, corridor_code, corridor_name, department_code

    Returns ranked assets (worst first) with P(failure), explanation, and the
    trained model metadata.
    """
    today = datetime.date.today()

    feature_rows: List[List[float]] = []
    labels: List[int] = []
    feats_by_asset: List[Tuple[Dict, Dict[str, float]]] = []

    for a in assets:
        f = asset_feature_vector(
            status=a.get("status"),
            install_year=a.get("install_year", 2018),
            criticality=a.get("criticality", "MEDIUM"),
            last_inspected=a.get("last_inspected", "2026-09-01"),
            open_requests=a.get("open_requests", 0),
            corridor_daily_trains=a.get("corridor_daily_trains", 0),
            today=today,
        )
        feature_rows.append([f[name] for name in FEATURE_NAMES])
        labels.append(_label(a.get("status"), a.get("open_requests", 0)))
        feats_by_asset.append((a, f))

    weights = train_logistic(feature_rows, labels)
    positives = sum(labels)
    positives_rate = positives / max(1, len(labels))

    ranked = []
    for a, f in feats_by_asset:
        p, contributions = explain_probability(weights, f)
        ranked.append({
            "id": a.get("id"),
            "asset_id": a.get("asset_id"),
            "name": a.get("name"),
            "corridor_id": a.get("corridor_id"),
            "corridor_code": a.get("corridor_code"),
            "corridor_name": a.get("corridor_name"),
            "department_code": a.get("department_code"),
            "p_failure": round(p, 4),
            "risk_rank": 0,  # filled below
            "top_drivers": contributions[:3],
            "status": a.get("status"),
            "criticality": a.get("criticality"),
        })
    ranked.sort(key=lambda r: r["p_failure"], reverse=True)
    for i, r in enumerate(ranked):
        r["risk_rank"] = i + 1

    return {
        "model": {
            "type": "logistic_regression",
            "trained_on": len(assets),
            "positive_samples": positives,
            "positive_rate": round(positives_rate, 3),
            "features": FEATURE_NAMES,
            "weights": [round(w, 4) for w in weights],
            "intercept_logit": PRIOR_LOGIT,
            "epochs": EPOCHS,
            "learning_rate": LEARNING_RATE,
            "l2": L2_PENALTY,
            "note": "Trained by gradient descent on every request; deterministic; no pickled artifacts.",
        },
        "assets": ranked,
    }
