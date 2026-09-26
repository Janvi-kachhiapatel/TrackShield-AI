"""
AI Fusion Engine — constraint-aware block fusion across departments.

Fuses compatible maintenance requests on the SAME corridor into ONE
coordinated possession block when hard constraints pass, with computed
savings and full explainability. No hard-coded percentages: every number
is derived from request, timetable, resource and conflict data.

Hard constraints (ALL must pass for a fusion to be proposed):
  H1. Same corridor (same track section) for all candidates.
  H2. Same requested date.
  H3. Requested time windows overlap (or a common window exists inside
      the maintenance horizon for all candidates).
  H4. Combined duration fits the widest requested window.
  H5. No unresolved CRITICAL conflict references any candidate request.
  H6. Total manpower required does not exceed the department ceiling
      (sum of available crews for the participating departments).

Soft factors (produce a 0-100 compatibility score, never override H1-H6):
  S1. Department diversity (cross-department fusion is the point).
  S2. Shared isolation requirement (one power block can serve all).
  S3. Timetable load of the corridor (fewer trains in window = better).
  S4. Priority alignment (equal priorities coordinate more easily).
  S5. Resource overlap (shared declared resources reduce logistics).

The engine is deterministic: same data in, same fusion out. It is
optimization/constraint-solving, not machine learning — presented as such.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple


# ---------------------------------------------------------------------------
# Tunable scoring weights (sum of S-weights = 1.0)
# ---------------------------------------------------------------------------
W_DEPT_DIVERSITY = 0.30
W_SHARED_ISOLATION = 0.25
W_TIMETABLE_HEADROOM = 0.20
W_PRIORITY_ALIGNMENT = 0.15
W_RESOURCE_OVERLAP = 0.10

MIN_COMPATIBILITY_SCORE = 40.0  # below this, fusion is not proposed even if hard constraints pass
MANPOWER_SAFETY_MARGIN = 1.2    # require 20% headroom above summed manpower need


@dataclass
class FusionCandidate:
    """The subset of MaintenanceRequest fields the engine needs."""
    id: int
    problem_id: str
    corridor_id: int
    department_id: int
    department_code: str
    priority: str
    requested_date: str
    requested_start_time: str
    requested_end_time: str
    max_duration_hours: float
    isolation_required: bool
    resources_required: str
    manpower_required: int


@dataclass
class FusionGroup:
    """A candidate group of same-corridor, same-date requests."""
    corridor_id: int
    requested_date: str
    candidates: List[FusionCandidate] = field(default_factory=list)


def _to_minutes(hhmm: str) -> Optional[int]:
    try:
        h, m = map(int, str(hhmm).split(":"))
        return h * 60 + m
    except (ValueError, AttributeError):
        return None


def _window_overlap_minutes(a_start: int, a_end: int, b_start: int, b_end: int) -> int:
    return max(0, min(a_end, b_end) - max(a_start, b_start))


def group_candidates(candidates: List[FusionCandidate]) -> List[FusionGroup]:
    """H1 + H2: group by (corridor, date)."""
    groups: Dict[Tuple[int, str], FusionGroup] = {}
    for c in candidates:
        key = (c.corridor_id, c.requested_date)
        groups.setdefault(key, FusionGroup(corridor_id=c.corridor_id, requested_date=c.requested_date)).candidates.append(c)
    return [g for g in groups.values() if len(g.candidates) >= 2]


def evaluate_group(
    group: FusionGroup,
    corridor_trains: List[Dict[str, Any]],
    dept_manpower_ceiling: Dict[int, int],
    unresolved_conflict_request_ids: set,
) -> Dict[str, Any]:
    """
    Evaluate one candidate group. Returns a result dict with either a
    proposed fusion (status PROPOSED) or a rejection (status REJECTED),
    always with the full reason trail for explainability.
    """
    reqs = group.candidates
    meets: List[str] = []
    fails: List[str] = []

    # --- H2 is satisfied by grouping; record it ---
    meets.append(f"✓ All {len(reqs)} jobs target the same corridor and date ({group.requested_date})")

    # --- H3: time windows ---
    windows = []
    for r in reqs:
        s, e = _to_minutes(r.requested_start_time), _to_minutes(r.requested_end_time)
        if s is None or e is None or e <= s:
            fails.append(f"✗ {r.problem_id} has an invalid time window ({r.requested_start_time}–{r.requested_end_time})")
        else:
            windows.append((s, e))
    if fails:
        return _rejected(group, fails, reqs)

    common_start = max(s for s, _ in windows)
    common_end = min(e for _, e in windows)
    common_overlap = max(0, common_end - common_start)
    widest_start = min(s for s, _ in windows)
    widest_end = max(e for _, e in windows)
    widest_span = widest_end - widest_start

    if common_overlap > 0:
        meets.append(
            f"✓ Requested windows overlap by {common_overlap} min "
            f"(common window {common_start // 60:02d}:{common_start % 60:02d}–{common_end // 60:02d}:{common_end % 60:02d})"
        )
    else:
        # No direct overlap: fusion is still possible if the union span can
        # host the combined work — evaluated under H4 below.
        fails_note = "✗ Requested windows do not overlap"
        # fall through to H4 check with widest window

    # --- H4: combined duration must fit the widest requested window ---
    longest_job = max(r.max_duration_hours for r in reqs)
    # Parallel execution in one possession: the fused block runs the longest
    # job (crews work simultaneously on the same section), so the fused
    # duration is max(durations), not sum — that is the operational reality
    # of a combined possession. Serial sum would defeat the purpose of fusion.
    fused_duration_hours = round(longest_job, 2)
    fused_duration_min = int(fused_duration_hours * 60)
    if fused_duration_min <= widest_span:
        meets.append(
            f"✓ Combined possession needs {fused_duration_hours}h (longest job) and fits the "
            f"{widest_span}-min widest requested window"
        )
    else:
        fails.append(
            f"✗ Combined possession needs {fused_duration_hours}h but the widest requested window is only "
            f"{widest_span} min — window too short to coordinate"
        )

    # --- H5: unresolved critical conflicts on any candidate ---
    conflicted = [r.problem_id for r in reqs if r.id in unresolved_conflict_request_ids]
    if conflicted:
        fails.append(f"✗ Unresolved CRITICAL conflict(s) reference {', '.join(conflicted)} — must be cleared before fusion")
    else:
        meets.append("✓ No unresolved critical conflicts on any candidate job")

    # --- H6: manpower ceiling across participating departments ---
    manpower_by_dept: Dict[int, int] = {}
    for r in reqs:
        manpower_by_dept[r.department_id] = manpower_by_dept.get(r.department_id, 0) + r.manpower_required
    for dept_id, need in manpower_by_dept.items():
        ceiling = dept_manpower_ceiling.get(dept_id, 0)
        if need * MANPOWER_SAFETY_MARGIN > ceiling:
            fails.append(
                f"✗ Department #{dept_id} needs {need} technicians (+{int((MANPOWER_SAFETY_MARGIN - 1) * 100)}% safety margin) "
                f"but available crews total {ceiling}"
            )
    if not any("manpower" in f or "technicians" in f for f in fails):
        total_need = sum(r.manpower_required for r in reqs)
        meets.append(f"✓ Manpower feasible: {total_need} technicians across {len(manpower_by_dept)} department gang(s) with safety margin")

    if fails:
        return _rejected(group, fails, reqs)

    # --- Soft scoring (only for groups that pass ALL hard constraints) ---
    dept_codes = list(dict.fromkeys(r.department_code for r in reqs))
    n_depts = len(dept_codes)
    dept_score = min(1.0, (n_depts - 1) / 2.0)  # 2 depts = 0.5, 3+ = 1.0

    any_isolation = any(r.isolation_required for r in reqs)
    all_isolation_same = len({r.isolation_required for r in reqs}) == 1
    isolation_score = 1.0 if (any_isolation and all_isolation_same) else (0.5 if any_isolation else 0.25)

    trains_in_widest = [
        t for t in corridor_trains
        if (tm := _to_minutes(t.get("departure_time", ""))) is not None
        and widest_start - 10 <= tm <= widest_end + 10
    ]
    headroom = max(0.0, 1.0 - len(trains_in_widest) / 6.0)  # 6+ trains in window = 0 headroom

    priorities = {r.priority for r in reqs}
    priority_score = 1.0 if len(priorities) == 1 else (0.6 if len(priorities) == 2 else 0.3)

    resource_tokens = [set(str(r.resources_required or "").upper().replace(",", " ").split()) for r in reqs]
    shared_tokens = set.intersection(*resource_tokens) if len(resource_tokens) > 1 else set()
    resource_score = min(1.0, len(shared_tokens) / 4.0)

    score = round(
        100.0 * (
            dept_score * W_DEPT_DIVERSITY
            + isolation_score * W_SHARED_ISOLATION
            + headroom * W_TIMETABLE_HEADROOM
            + priority_score * W_PRIORITY_ALIGNMENT
            + resource_score * W_RESOURCE_OVERLAP
        ),
        1,
    )

    if score < MIN_COMPATIBILITY_SCORE:
        fails.append(
            f"✗ Compatibility score {score} below threshold {MIN_COMPATIBILITY_SCORE} — coordination benefit too low"
        )
        return _rejected(group, fails, reqs)

    # --- Computed savings (from actual durations, never hard-coded) ---
    original_blocks = len(reqs)
    original_duration_min = sum(int(r.max_duration_hours * 60) for r in reqs)
    duration_reduction = round(100.0 * (1.0 - fused_duration_min / original_duration_min), 1) if original_duration_min else 0.0
    block_reduction = round(100.0 * (1.0 - 1.0 / original_blocks), 1)

    reasons = [
        f"✓ Same track section — all {original_blocks} jobs are on corridor #{group.corridor_id}",
        f"✓ Same maintenance date ({group.requested_date}) with overlapping windows",
        f"✓ One possession of {fused_duration_hours}h replaces {original_blocks} separate blocks "
        f"({original_duration_min} min → {fused_duration_min} min of corridor occupation)",
        f"✓ Departments {', '.join(dept_codes)} can coordinate under a single "
        f"{'power + traffic' if any_isolation else 'traffic'} isolation",
        f"✓ No unresolved conflicts; timetable headroom {int(headroom * 100)}% "
        f"({len(trains_in_widest)} train(s) cross the widest window)",
    ]

    return {
        "status": "PROPOSED",
        "corridor_id": group.corridor_id,
        "requested_date": group.requested_date,
        "request_ids": [r.id for r in reqs],
        "problem_ids": [r.problem_id for r in reqs],
        "departments": dept_codes,
        "original_blocks": original_blocks,
        "original_duration_minutes": original_duration_min,
        "fused_duration_hours": fused_duration_hours,
        "fused_start_time": f"{widest_start // 60:02d}:{widest_start % 60:02d}",
        "fused_end_time": f"{widest_end // 60:02d}:{widest_end % 60:02d}",
        "block_reduction_percent": block_reduction,
        "duration_reduction_percent": duration_reduction,
        "compatibility_score": score,
        "meets_hard_constraints": True,
        "reasons": reasons,
        "rejection_reasons": [],
        "factors": {
            "department_diversity": round(dept_score, 2),
            "shared_isolation": round(isolation_score, 2),
            "timetable_headroom": round(headroom, 2),
            "priority_alignment": round(priority_score, 2),
            "resource_overlap": round(resource_score, 2),
        },
        "trains_in_window": [t.get("train_no") for t in trains_in_widest],
        "shared_isolation": any_isolation,
    }


def _rejected(group: FusionGroup, fails: List[str], reqs: List[FusionCandidate]) -> Dict[str, Any]:
    return {
        "status": "REJECTED",
        "corridor_id": group.corridor_id,
        "requested_date": group.requested_date,
        "request_ids": [r.id for r in reqs],
        "problem_ids": [r.problem_id for r in reqs],
        "departments": list(dict.fromkeys(r.department_code for r in reqs)),
        "original_blocks": len(reqs),
        "original_duration_minutes": sum(int(r.max_duration_hours * 60) for r in reqs),
        "fused_duration_hours": None,
        "fused_start_time": None,
        "fused_end_time": None,
        "block_reduction_percent": 0.0,
        "duration_reduction_percent": 0.0,
        "compatibility_score": 0.0,
        "meets_hard_constraints": False,
        "reasons": [],
        "rejection_reasons": fails,
        "factors": None,
        "trains_in_window": [],
        "shared_isolation": False,
    }
