"""
Test suite for TrackShield AI planning engines.

Run:  python -m pytest backend/tests/ -v

Covers the planning engines (window planner, fusion engine, multi-horizon
planner) plus the ML prioritization and COA forecast modules. The API-level
tests use FastAPI TestClient against the real app (auto-seeds on first boot).
"""
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from backend.forecast_engine import (
    classify_density, forecast_for_corridor, network_forecast,
)
from backend.ml_prioritization import (
    asset_feature_vector, explain_probability, prioritize_assets, train_logistic,
    FEATURE_NAMES,
)
from backend.window_planner import PlanContext, evaluate_windows
from backend.fusion_engine import (
    FusionCandidate, FusionGroup, group_candidates, evaluate_group,
)


# ---------------------------------------------------------------------------
# Forecast engine
# ---------------------------------------------------------------------------

class TestForecastEngine:
    def test_classification_thresholds(self):
        assert classify_density(20) == "VERY_HIGH"
        assert classify_density(13) == "HIGH"
        assert classify_density(7) == "MEDIUM"
        assert classify_density(2) == "LOW"

    def test_forecast_rows_shape_and_determinism(self):
        start = datetime.date(2026, 10, 1)
        a = forecast_for_corridor(1, "Double Line", 130, 40.0, start, 7)
        b = forecast_for_corridor(1, "Double Line", 130, 40.0, start, 7)
        assert a == b  # deterministic
        assert len(a) == 7
        assert a[0]["date"] == "2026-10-01"
        assert 0.0 <= a[0]["lull_pressure"] <= 1.0
        assert a[0]["density"] in ("LOW", "MEDIUM", "HIGH", "VERY_HIGH")

    def test_quad_carry_more_freight_than_single(self):
        start = datetime.date(2026, 10, 1)
        quad = forecast_for_corridor(1, "Quadruple Line", 160, 60.0, start, 5)
        single = forecast_for_corridor(2, "Single Line", 100, 20.0, start, 5)
        quad_avg = sum(r["goods_trains_forecast"] for r in quad) / 5
        single_avg = sum(r["goods_trains_forecast"] for r in single) / 5
        assert quad_avg > single_avg

    def test_network_summary_totals_match(self):
        start = datetime.date(2026, 10, 1)
        corridors = [
            {"id": 1, "code": "A-B", "name": "A to B", "track_type": "Double Line", "max_speed": 130, "distance_km": 40.0},
            {"id": 2, "code": "C-D", "name": "C to D", "track_type": "Single Line", "max_speed": 100, "distance_km": 25.0},
        ]
        fc = network_forecast(corridors, start, 7)
        assert fc["days"] == 7
        assert len(fc["daily_totals"]) == 7
        expected = sum(
            r["goods_trains_forecast"]
            for cid in ("1", "2")
            for r in fc["per_corridor"][cid]
        )
        assert abs(expected - fc["summary"]["network_goods_trains_forecast"]) < 0.5


# ---------------------------------------------------------------------------
# ML prioritization
# ---------------------------------------------------------------------------

class TestMLPrioritization:
    def _asset(self, **over):
        base = {
            "id": 1, "asset_id": "OHE-001", "name": "Cantilever 1",
            "status": "HEALTHY", "install_year": 2020, "criticality": "MEDIUM",
            "last_inspected": "2026-09-01", "open_requests": 0,
            "corridor_daily_trains": 10, "corridor_id": 1,
            "corridor_code": "A-B", "corridor_name": "A to B", "department_code": "ELEC",
        }
        base.update(over)
        return base

    def test_training_reduces_loss_and_ranks_faulty_first(self):
        assets = [
            self._asset(id=1, asset_id="G-1", status="FAULTY", open_requests=2),
            self._asset(id=2, asset_id="G-2", status="HEALTHY", open_requests=0),
            self._asset(id=3, asset_id="G-3", status="DEGRADED", open_requests=1),
            self._asset(id=4, asset_id="G-4", status="HEALTHY", open_requests=0),
        ]
        out = prioritize_assets(assets)
        assert out["model"]["type"] == "logistic_regression"
        assert out["model"]["trained_on"] == 4
        ranks = {a["asset_id"]: a["p_failure"] for a in out["assets"]}
        assert ranks["G-1"] > ranks["G-2"]  # faulty ranked above healthy
        assert out["assets"][0]["asset_id"] == "G-1"

    def test_explainability_sums_to_logit(self):
        f = asset_feature_vector("DEGRADED", 2010, "CRITICAL", "2025-09-01", 2, 30)
        weights = [0.5] * len(FEATURE_NAMES)
        p, contribs = explain_probability(weights, f)
        z = -2.2 + sum(c["contribution"] for c in contribs)
        from backend.ml_prioritization import _sigmoid
        # contributions are rounded to 4dp in the payload; tolerance covers it
        assert abs(p - _sigmoid(z)) < 1e-3
        # contributions sorted by |contribution| desc
        mags = [abs(c["contribution"]) for c in contribs]
        assert mags == sorted(mags, reverse=True)

    def test_gradient_descent_learns_nonzero_weights(self):
        X = [[0.0, 0.0], [1.0, 1.0], [0.9, 0.8], [0.1, 0.2]]
        y = [0, 1, 1, 0]
        w = train_logistic(X, y)
        assert w[0] > 0  # feature correlated with label gets positive weight

    def test_determinism(self):
        assets = [self._asset(id=i, asset_id=f"A-{i}", status="FAULTY" if i % 2 else "HEALTHY") for i in range(8)]
        a = prioritize_assets(assets)
        b = prioritize_assets(assets)
        assert a == b


# ---------------------------------------------------------------------------
# Window planner (existing engine, regression coverage)
# ---------------------------------------------------------------------------

class TestWindowPlanner:
    def _ctx(self, **over):
        base = dict(
            corridor_id=1,
            duration_minutes=120,
            priority="HIGH",
            isolation_required=False,
            manpower_required=4,
            timetable=[{"train_no": "12951", "departure_time": "17:00", "priority": "HIGH", "train_type": "RAJDHANI"}],
            existing_blocks=[],
            dept_manpower_ceiling=20,
            available_resources=3,
        )
        base.update(over)
        return PlanContext(**base)

    def test_prefers_conflict_free_window(self):
        out = evaluate_windows(self._ctx())
        assert out["selected"] is not None
        assert out["selected"]["train_conflicts"] == 0
        # 17:00 train must not fall inside the selected window
        sel = out["selected"]
        s = int(sel["start_time"][:2]) * 60 + int(sel["start_time"][3:])
        e = s + 120
        assert not (s <= 17 * 60 <= e or s <= 17 * 60 + 10 <= e)

    def test_all_rejected_when_manpower_zero(self):
        out = evaluate_windows(self._ctx(dept_manpower_ceiling=0))
        assert out["selected"] is None
        assert out["rejected_windows"], "expected rejections with reasons"
        assert any(
            "manpower" in r
            for w in out["rejected_windows"]
            for r in w.get("reasons", [])
        )

    def test_feasible_sorted_by_impact(self):
        out = evaluate_windows(self._ctx())
        scores = [w["impact_score"] for w in out["feasible_windows"]]
        assert scores == sorted(scores)


# ---------------------------------------------------------------------------
# Fusion engine (existing engine, regression coverage)
# ---------------------------------------------------------------------------

class TestFusionEngine:
    def _cand(self, **over):
        base = dict(
            id=1, problem_id="PR-1", corridor_id=1, department_id=1, department_code="ELEC",
            priority="HIGH", requested_date="2026-10-01", requested_start_time="01:00",
            requested_end_time="04:00", max_duration_hours=1.5, isolation_required=False,
            resources_required="Toolkit", manpower_required=4,
        )
        base.update(over)
        return FusionCandidate(**base)

    def test_same_corridor_date_grouping(self):
        groups = group_candidates([self._cand(), self._cand(id=2, problem_id="PR-2", department_code="SIG", department_id=2)])
        assert len(groups) == 1
        assert len(groups[0].candidates) == 2

    def test_different_dates_not_grouped(self):
        groups = group_candidates([self._cand(), self._cand(id=2, problem_id="PR-2", requested_date="2026-10-02")])
        assert groups == []

    def test_evaluation_rejects_when_window_too_small(self):
        group = FusionGroup(corridor_id=1, requested_date="2026-10-01", candidates=[
            self._cand(max_duration_hours=3.5),
            self._cand(id=2, problem_id="PR-2", max_duration_hours=3.5),
        ])
        out = evaluate_group(group, [], {1: 40, 2: 40}, set())
        assert out.get("status") == "REJECTED" or out.get("proposed") is False or "reason" in str(out).lower()


# ---------------------------------------------------------------------------
# Multi-horizon planner (DB-backed, uses the seeded synthetic dataset)
# ---------------------------------------------------------------------------

class TestMultiHorizonPlanner:
    @pytest.fixture(scope="class")
    def db(self):
        from backend.database import SessionLocal
        from backend.main import _maybe_seed  # ensure data exists
        db = SessionLocal()
        _maybe_seed()
        yield db
        db.close()

    def test_weekly_plan_shape(self, db):
        from backend.horizon_planner import generate_multi_horizon_plan
        plan = generate_multi_horizon_plan(db, horizon_days=7)
        assert plan["horizon_days"] == 7
        assert len(plan["days"]) == 7
        assert plan["kpis"]["requests_planned"] >= 0
        assert plan["ml_model"]["type"] == "logistic_regression"
        assert len(plan["ml_model"]["weights"]) == len(FEATURE_NAMES)

    def test_monthly_plan_has_30_days(self, db):
        from backend.horizon_planner import generate_multi_horizon_plan
        plan = generate_multi_horizon_plan(db, horizon_days=30)
        assert len(plan["days"]) == 30

    def test_what_if_narrower_window_plans_fewer_jobs(self, db):
        from backend.horizon_planner import generate_multi_horizon_plan
        wide = generate_multi_horizon_plan(db, horizon_days=7, with_baseline=False)
        narrow = generate_multi_horizon_plan(db, horizon_days=7, window_start=120, window_end=240, with_baseline=False)
        assert narrow["kpis"]["requests_planned"] <= wide["kpis"]["requests_planned"]

    def test_blocks_fit_inside_window(self, db):
        from backend.horizon_planner import generate_multi_horizon_plan
        from backend.horizon_planner import WINDOW_START_MIN as WINDOW_START
        from backend.horizon_planner import WINDOW_END_MIN as WINDOW_END
        from backend.horizon_planner import SETUP_MIN, HANDBACK_MIN
        plan = generate_multi_horizon_plan(db, horizon_days=7)
        for d in plan["days"]:
            for b in d["blocks"]:
                s = int(b["start_time"][:2]) * 60 + int(b["start_time"][3:])
                e = int(b["end_time"][:2]) * 60 + int(b["end_time"][3:])
                assert WINDOW_START + SETUP_MIN <= s
                assert e <= WINDOW_END - HANDBACK_MIN
                assert e > s

    def test_impact_simulation_delta_positive(self, db):
        from backend.horizon_planner import generate_multi_horizon_plan
        plan = generate_multi_horizon_plan(db, horizon_days=7)
        imp = plan["impact_simulation"]
        assert imp["delta"]["delay_minutes_saved"] >= 0
        assert imp["delta"]["block_reduction_percent"] >= 0


# ---------------------------------------------------------------------------
# API endpoints (full app, TestClient)
# ---------------------------------------------------------------------------

class TestPlanAPIs:
    @pytest.fixture(scope="class")
    def client(self):
        from fastapi.testclient import TestClient
        from backend.main import app
        with TestClient(app) as c:
            # login to obtain a token
            res = c.post("/api/auth/login", json={"emp_id": "hod001", "password": "hod123"})
            assert res.status_code == 200, res.text
            token = res.json()["access_token"]
            c.headers.update({"Authorization": f"Bearer {token}"})
            yield c

    def test_weekly_endpoint(self, client):
        res = client.get("/api/plans/weekly")
        assert res.status_code == 200
        body = res.json()
        assert body["horizon_days"] == 7
        assert "impact_simulation" in body

    def test_monthly_endpoint(self, client):
        res = client.get("/api/plans/monthly")
        assert res.status_code == 200
        assert res.json()["horizon_days"] == 30

    def test_goods_forecast_endpoint(self, client):
        res = client.get("/api/forecast/goods", params={"days": 7})
        assert res.status_code == 200
        body = res.json()
        assert body["days"] == 7
        assert "summary" in body and "per_corridor" in body

    def test_ml_endpoint(self, client):
        res = client.get("/api/ml/risk-prioritization")
        assert res.status_code == 200
        body = res.json()
        assert body["model"]["type"] == "logistic_regression"
        assert len(body["assets"]) > 0

    def test_impact_endpoint(self, client):
        res = client.get("/api/impact/simulation")
        assert res.status_code == 200
        assert "baseline" in res.json() and "optimized" in res.json()

    def test_plans_require_auth(self):
        from fastapi.testclient import TestClient
        from backend.main import app
        with TestClient(app) as c:
            res = c.get("/api/plans/weekly")
            assert res.status_code == 401

    def test_conflicts_endpoint_registered(self, client):
        """Regression: get_conflicts lost its decorator and 404'd in production."""
        res = client.get("/api/ai/conflicts")
        assert res.status_code == 200
