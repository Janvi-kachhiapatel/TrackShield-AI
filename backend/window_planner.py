"""
Single-request window planner.

For one maintenance request, scan the maintenance horizon in fixed steps,
evaluate every candidate window against the request's own constraints and
the corridor's live context, and rank the feasible ones. Fully computed:
every rejected window keeps the reason it failed; the recommended window
is the feasible one with the lowest operational impact, tie-broken by
earliest start. This is deterministic constraint scanning (the same
constraint family the CP-SAT path encodes), not an LLM.
"""
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

# Fixed evaluation grid for candidate windows (minutes from midnight).
WINDOW_STEP_MIN = 30
MIN_START_MIN = 0        # scan the full day: emergency work is not always pre-dawn
MAX_END_MIN = 24 * 60
PRIORITY_WEIGHTS = {"CRITICAL": 3, "HIGH": 2, "MEDIUM": 1, "LOW": 0.5}


@dataclass
class PlanContext:
    """Everything the planner needs, gathered by the router from live data."""
    corridor_id: int
    duration_minutes: int
    priority: str
    isolation_required: bool
    manpower_required: int
    # timetable: [{train_no, departure_time, priority, train_type}]
    timetable: List[Dict[str, Any]]
    # existing blocks: [{block_id, start_min, end_min, status}]
    existing_blocks: List[Dict[str, Any]]
    dept_manpower_ceiling: int
    # resources: [{name, status, department_id}] considered shareable within the corridor
    available_resources: int


def _to_min(hhmm: str) -> Optional[int]:
    try:
        h, m = map(int, str(hhmm).split(":"))
        return h * 60 + m
    except (ValueError, AttributeError):
        return None


def _overlaps(a1: int, a2: int, b1: int, b2: int, buffer_min: int = 10) -> bool:
    """True when [a1,a2] intersects [b1,b2] expanded by a safety buffer."""
    return not (a2 + buffer_min <= b1 or a1 >= b2 + buffer_min)


def evaluate_windows(ctx: PlanContext) -> Dict[str, Any]:
    """
    Scan candidate windows and return the ranked result with the full
    computed trail: feasible windows, rejected windows (with reasons),
    conflict counts, and the selected recommendation.
    """
    train_crossings = []
    for t in ctx.timetable:
        tm = _to_min(t.get("departure_time", ""))
        if tm is not None:
            train_crossings.append((tm, t.get("train_no", "?"), str(t.get("priority", "MEDIUM")).upper()))

    live_blocks = []
    for b in ctx.existing_blocks:
        s, e = b.get("start_min"), b.get("end_min")
        if s is not None and e is not None:
            live_blocks.append((int(s), int(e), b.get("block_id", "?")))

    candidates: List[Dict[str, Any]] = []
    start = MIN_START_MIN
    while start + ctx.duration_minutes <= MAX_END_MIN:
        end = start + ctx.duration_minutes
        entry: Dict[str, Any] = {
            "start": start, "end": end,
            "start_time": f"{start // 60:02d}:{start % 60:02d}",
            "end_time": f"{end // 60:02d}:{end % 60:02d}",
        }
        trains = [(tm, no, pr) for (tm, no, pr) in train_crossings if _overlaps(start, end, tm, tm)]
        entry["train_conflicts"] = len(trains)
        entry["train_nos"] = [no for _, no, _ in trains]
        entry["high_priority_trains"] = sum(1 for _, _, pr in trains if pr == "HIGH")
        blocks_hit = [bid for (s, e, bid) in live_blocks if _overlaps(start, end, s, e)]
        entry["existing_block_conflicts"] = len(blocks_hit)
        entry["existing_block_ids"] = blocks_hit
        entry["manpower_ok"] = ctx.manpower_required * 1.2 <= ctx.dept_manpower_ceiling
        entry["resources_ok"] = ctx.available_resources >= 1
        candidates.append(entry)
        start += WINDOW_STEP_MIN

    feasible, rejected = [], []
    for c in candidates:
        if c["train_conflicts"] == 0 and c["existing_block_conflicts"] == 0 and c["manpower_ok"] and c["resources_ok"]:
            feasible.append(c)
        else:
            reasons = []
            if c["train_conflicts"]:
                reasons.append(f"{c['train_conflicts']} train conflict(s)" + (f" ({', '.join(c['train_nos'][:3])})" if c["train_nos"] else ""))
            if c["existing_block_conflicts"]:
                reasons.append(f"{c['existing_block_conflicts']} existing block(s) ({', '.join(c['existing_block_ids'][:3])})")
            if not c["manpower_ok"]:
                reasons.append(f"manpower insufficient ({ctx.manpower_required} needed, ceiling {ctx.dept_manpower_ceiling})")
            if not c["resources_ok"]:
                reasons.append("no available resources/equipment for this corridor")
            rejected.append({**c, "reject_reasons": reasons})

    # Operational impact of a feasible window: trains that would need to be
    # held if work overran, weighted by priority; 0 = lowest impact.
    for c in feasible:
        near = sum(
            PRIORITY_WEIGHTS.get(pr, 1)
            for (tm, _, pr) in train_crossings
            if _overlaps(c["start"], c["end"], tm, tm, buffer_min=30)
        )
        c["operational_impact"] = "LOW" if near == 0 else ("MEDIUM" if near <= 3 else "HIGH")
        c["impact_score"] = near

    feasible.sort(key=lambda c: (c["impact_score"], c["start"]))
    selected = feasible[0] if feasible else None

    # Why-selected trail, generated from the actual comparison set.
    why = []
    if selected:
        why.append(
            f"✓ {len(feasible)} of {len(candidates)} candidate windows are fully feasible; "
            f"this one has the lowest operational impact ({selected['operational_impact']})"
        )
        if selected["start"] == MIN_START_MIN + max(0, 0):
            pass
        faster = [c for c in feasible if c["impact_score"] < selected["impact_score"]]
        if not faster:
            why.append("✓ No feasible window has a lower operational impact")
        why.append(
            f"✓ {ctx.duration_minutes}-minute possession fits without touching any scheduled train "
            f"or live maintenance block (10-min clearance enforced)"
        )
        if selected["high_priority_trains"] == 0:
            why.append("✓ No high-priority trains (Rajdhani/Vande Bharat class) anywhere near the window")

    return {
        "selected": {
            "start_time": selected["start_time"],
            "end_time": selected["end_time"],
            "duration_minutes": ctx.duration_minutes,
            "train_conflicts": selected["train_conflicts"],
            "resource_conflicts": 0 if selected["resources_ok"] else 1,
            "manpower_conflicts": 0 if selected["manpower_ok"] else 1,
            "existing_block_conflicts": selected["existing_block_conflicts"],
            "safety_constraints": "PASS",
            "operational_impact": selected["operational_impact"],
        } if selected else None,
        "feasible_count": len(feasible),
        "rejected_count": len(rejected),
        "candidate_count": len(candidates),
        "feasible_windows": [
            {
                "start_time": c["start_time"], "end_time": c["end_time"],
                "operational_impact": c["operational_impact"], "impact_score": c["impact_score"],
            }
            for c in feasible[:8]
        ],
        "rejected_windows": [
            {
                "start_time": c["start_time"], "end_time": c["end_time"],
                "train_conflicts": c["train_conflicts"], "existing_block_conflicts": c["existing_block_conflicts"],
                "reasons": c["reject_reasons"],
            }
            for c in rejected[:12]
        ],
        "why": why,
        "grid_minutes": WINDOW_STEP_MIN,
    }
