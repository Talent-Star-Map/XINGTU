"""Snapshot-only evidence and deterministic temporal retrieval (no DB or LLM).

Dates without a time mean the start of that day in UTC. captured_at is an
observation time, not proof of the validity interval of a job advertisement.
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Any
from services.posting_evolution import posting_identity


def utc_instant(value: Any) -> datetime:
    if hasattr(value, "to_native"):
        value = value.to_native()
    dt = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def cutoff_iso(value: str | None = None) -> str:
    return (utc_instant(value) if value else datetime.now(timezone.utc)).isoformat()


def skills_of(snapshot: dict) -> list[str]:
    raw = snapshot.get("skills_required")
    if isinstance(raw, str):
        raw = re.split(r"[,，;；]", raw)
    return sorted({s.strip() for s in (raw or []) if isinstance(s, str) and s.strip()})


def latest_snapshots(snapshots: list[dict], as_of: str) -> list[dict]:
    """Select one observable version per advertisement, never per role title.

    A sourced URL can connect recrawls. A source SQL row id identifies only
    that one observation; it must not establish a longitudinal history. Old
    title-grouped snapshots without either identifier are excluded.
    """
    cutoff = utc_instant(as_of)
    selected = {}
    for snap in snapshots:
        if snap.get("job_id_ref") is None or not snap.get("captured_at"):
            continue
        identity = posting_identity(snap)
        row_id = snap.get("source_job_id")
        if identity is not None:
            group = (snap["job_id_ref"], "sourced_url", identity)
        elif row_id is not None and snap.get("source"):
            group = (snap["job_id_ref"], "source_row", str(snap["source"]), str(row_id))
        else:
            # Role and source alone cannot identify one advertisement.
            # Exclude ambiguous rows instead of merging unrelated postings.
            continue
        when = utc_instant(snap["captured_at"])
        if when > cutoff:
            continue
        key = (when, str(snap.get("snapshot_id") or ""))
        old = selected.get(group)
        if old is None or key > old[0]:
            selected[group] = (key, snap)
    return [v[1] for _, v in sorted(selected.items(), key=lambda item: str(item[0]))]


def snapshot_evidence(snap: dict, as_of: str) -> dict:
    return {
        "id": snap.get("job_id_ref"), "title": snap.get("title"),
        "source": snap.get("source"), "company": snap.get("company_name"),
        "snapshot_id": snap.get("snapshot_id"),
        "source_job_id": snap.get("source_job_id"),
        "evidence_scope": "identified_posting" if posting_identity(snap) else "single_source_row",
        "captured_at": str(snap.get("captured_at")) if snap.get("captured_at") else None,
        "as_of": as_of, "skills": skills_of(snap),
        "skills_known": snap.get("skills_required") is not None,
        "source_url": snap.get("source_url"),
        "salary_min": snap.get("salary_min"), "salary_max": snap.get("salary_max"),
    }


def snapshot_graph(snapshots: list[dict], as_of: str) -> dict:
    nodes, links, seen = [], [], set()
    for snap in snapshots:
        ev = snapshot_evidence(snap, as_of)
        jid = f"Posting:{ev['snapshot_id']}"
        nodes.append({**ev, "id": jid, "label": "Job", "name": ev["title"]})
        for skill in ev["skills"]:
            sid = f"Skill:{skill}"
            if sid not in seen:
                seen.add(sid)
                nodes.append({"id": sid, "label": "Skill", "name": skill})
            links.append({"source": jid, "target": sid, "type": "REQUIRES",
                          "snapshot_id": ev["snapshot_id"], "captured_at": ev["captured_at"]})
    return {"nodes": nodes, "links": links, "as_of": as_of}


def snapshot_delta(before: dict, after: dict) -> dict:
    """Observed differences, not causal attribution or labour-market forecasts."""
    if before.get("job_id_ref") != after.get("job_id_ref"):
        raise ValueError("cannot compare different job identities")
    identity = posting_identity(before)
    if identity is None or identity != posting_identity(after):
        raise ValueError("longitudinal comparison requires the same sourced advertisement")
    if utc_instant(before["captured_at"]) >= utc_instant(after["captured_at"]):
        raise ValueError("change requires strictly increasing observation times")
    known = before.get("skills_required") is not None and after.get("skills_required") is not None
    a, b = set(skills_of(before)), set(skills_of(after))
    return {
        "job_id": before["job_id_ref"],
        "before_snapshot_id": before.get("snapshot_id"), "after_snapshot_id": after.get("snapshot_id"),
        "before_time": str(before["captured_at"]), "after_time": str(after["captured_at"]),
        "comparison_scope": "same_posting_observations",
        "skills_added": sorted(b-a) if known else None,
        "skills_removed": sorted(a-b) if known else None,
        "skills_no_longer_mentioned": sorted(a-b) if known else None,
        "skill_distance": 1-len(a & b)/len(a | b) if known and a | b else (0.0 if known else None),
        "causal_reason": None,
    }


def cosine(a: list, b: list) -> float | None:
    if not a or not b or len(a) != len(b):
        return None
    try:
        a, b = [float(v) for v in a], [float(v) for v in b]
        if not all(math.isfinite(v) for v in a + b):
            return None
        denominator = math.sqrt(sum(v*v for v in a)) * math.sqrt(sum(v*v for v in b))
        return sum(x*y for x, y in zip(a, b)) / denominator if denominator else None
    except (TypeError, ValueError, OverflowError):
        return None


def rank_snapshots(snapshots: list[dict], query: str, top_k: int, as_of: str,
                   query_vector: list | None = None) -> list[dict]:
    """Exact cosine over eligible posting observations; lexical fallback.

    Selection precedes ranking: a very similar superseded snapshot cannot
    displace the observable state. No relevance threshold is claimed/calibrated.
    """
    k = max(1, min(int(top_k), 100))
    eligible = latest_snapshots(snapshots, as_of)
    scored = []
    if query_vector:
        for snap in eligible:
            score = cosine(query_vector, snap.get("embedding") or [])
            if score is not None:
                scored.append((score, snap))
    mode = "semantic_exact"
    if not scored:
        mode = "keyword_fallback"
        terms = set(re.findall(r"[a-z0-9_+#.]+|[\u4e00-\u9fff]+", query.lower()))
        for snap in eligible:
            text = " ".join([str(snap.get("title") or ""),
                             str(snap.get("job_description") or ""), *skills_of(snap)]).lower()
            score = sum(term in text for term in terms) / max(len(terms), 1)
            if score:
                scored.append((score, snap))
    scored.sort(key=lambda pair: (-pair[0], str(pair[1].get("job_id_ref"))))
    return [{**snapshot_evidence(s, as_of), "score": score, "retrieval_mode": mode}
            for score, s in scored[:k]]
