"""Shared review runner — the one place that runs a full review.

Called by POST /content/{cid}/review (main.py) and by the auto
re-review inside workflow remediation (Round 3 improvement #2).
Kept out of main.py so workflow.py can import it without a cycle.
"""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from . import db
from .settings import settings
from .engine.citation import cite_findings
from .models import Finding, ReviewResult
from .engine import review as engine, a11y, compliance, visual, vision


def _stamp(items: list[dict], source: str) -> list[Finding]:
    for d in items:
        d.setdefault("evidence", source)
    return [Finding(**d) for d in items]


def run_review_on(conn, row: dict, user: dict,
                  force_mock: bool = False) -> ReviewResult:
    """Run engine + deterministic checks + vision, persist findings,
    stamp SLA, audit. Caller owns the connection lifecycle."""
    cid = row["id"]
    findings, llm_used, latency, provider, tokens = engine.review(
        row["text"], use_mock=force_mock)

    findings += _stamp(a11y.check(row["text"]),
                       "Brand accessibility guideline (WCAG 2.1 AA)")
    findings += _stamp(compliance.check(row["text"], row["type"]),
                       "Guideline: Claims & Compliance")
    if row["image_path"]:
        findings += _stamp(visual.check(row["image_path"]),
                           "Guideline: Visual Identity (palette)")
        vision_findings, vision_tokens = vision.check(row["image_path"])
        findings += _stamp(vision_findings,
                           "Vision OCR + pixel WCAG (Gemini)")
        tokens += vision_tokens
        # Citations: map findings to most relevant kb_chunk passages
        citations = cite_findings(cid, row["text"])
        for c in citations:
            # Append KB citation source to finding evidence
            for f in findings:
                if f.evidence and c["citation_source"]:
                    f.evidence = f"{f.evidence} | KB: {c['citation_source']}"
                elif c["citation_source"]:
                    f.evidence = c["citation_source"]

    conn.execute("DELETE FROM finding WHERE content_id=?", (cid,))
    # Attach KB source citations to findings
    for c in cite_findings(cid, row["text"]):
        for f in findings:
            if f.id == c["finding_id"]:
                f.evidence = c["citation_source"] or f.evidence
    for f in findings:
        conn.execute(
            "INSERT INTO finding (content_id, category, severity, rule,"
            " excerpt, suggestion, confidence, evidence)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (cid, f.category, f.severity, f.rule, f.excerpt,
             f.suggestion, f.confidence, f.evidence))
    # SLA timer: review window starts at submission
    due = (datetime.now(timezone.utc)
           + timedelta(hours=settings.sla_hours)
           ).strftime("%Y-%m-%d %H:%M:%S")
    conn.execute(
        "UPDATE content SET status='review', sla_due_at=?"
        " WHERE id=? AND status='draft'",
        (due, cid))
    db.log_audit(conn, cid, user["email"], "review",
                 f"{len(findings)} findings ({provider}), {latency}ms",
                 tokens)
    conn.commit()
    stored = db.rows(conn, "SELECT * FROM finding WHERE content_id=? "
                     "ORDER BY id", (cid,))

    return ReviewResult(content_id=cid,
                        findings=[Finding(**f) for f in stored],
                        provider=provider, llm_used=llm_used,
                        latency_ms=latency, tokens=tokens)
