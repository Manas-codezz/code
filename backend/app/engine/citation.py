"""Source citation for findings: map a finding's excerpt/suggestion to the
most relevant kb_chunk passage, and surface guideline-gap analytics."""

from __future__ import annotations

import logging

from .. import db
from .retrieval import relevant_kb_chunks, tokenize, _cosine_sim
from .embed import embed_texts

log = logging.getLogger("brandguard.citation")


def cite_findings(content_id: int, content_text: str) -> list[dict]:
    """Attach the most relevant kb_chunk passage as evidence for each finding.

    For every existing finding on content_id, look up the most relevant
    kb_chunk (semantic retrieval) and add its source as evidence text.
    Returns a list of {finding_id, citation, citation_source} dicts.
    """
    with db.get() as conn:
        findings = db.rows(
            conn, "SELECT id, excerpt, suggestion, evidence FROM finding WHERE content_id=?",
            (content_id,))

    if not findings:
        return []

    chunks = relevant_kb_chunks(content_text, top_k=3)

    results = []
    for f in findings:
        best_chunk = chunks[0] if chunks else None
        citation_parts = []
        if best_chunk:
            citation_parts.append(f'Source: "{best_chunk["text"][:120]}"')
            citation_parts.append(f'From: {best_chunk["source"]}')
            citation_parts.append(f'Chunk index: {best_chunk["chunk_index"]}')
        new_evidence = best_chunk["text"] if best_chunk else ""
        if new_evidence and not new_evidence.endswith(("—", ".", "!", "?")):
            new_evidence += "."
        results.append({
            "finding_id": f["id"],
            "citation": " ".join(citation_parts) if citation_parts else "",
            "citation_source": new_evidence or f["evidence"] or "",
        })
    return results


def guideline_gaps(content_id: int) -> list[dict]:
    """Surface guideline-gap analytics: finding categories that recur without
    a matching kb_chunk citation, indicating a gap in the knowledge base.

    Returns list of {category, count, missing_passages}.
    """
    with db.get() as conn:
        findings = db.rows(
            conn, (
                "SELECT category, COUNT(*) AS cnt "
                "FROM finding WHERE content_id=? AND accepted=0 "
                "GROUP BY category"), (content_id,))

    if not findings:
        return []

    # Get the full content text for KB retrieval
    row = db.one(conn, "SELECT text FROM content WHERE id=?", (content_id,))
    content_text = row["text"] if row else ""

    chunks = relevant_kb_chunks(content_text, top_k=5)
    chunk_keys = {chunk["text"][:80] for chunk in chunks}

    gaps = []
    for f in findings:
        cat = f["category"]
        cnt = f["cnt"]
        # check if any chunk relates to this category's typical concerns
        related = [c for c in chunks if cat.lower() in c["text"].lower()]
        missing = cnt > 0 and len(related) == 0
        gaps.append({
            "category": cat,
            "count": cnt,
            "missing_passages": missing,
        })
    return gaps