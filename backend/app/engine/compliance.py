"""Deterministic regulatory checks — no LLM, always fire.

Covers: mandatory disclaimer presence and competitor-name mentions
(glossary-driven, so brand managers can extend without code changes)."""
import re
from .. import db

DISCLAIMER = ("NovaPay is a financial technology company, not a bank")
FDIC = "Members FDIC"

# content types that are promotional surfaces requiring the disclaimer
PROMO_TYPES = {"email", "social", "text"}
_PRICE_SIGNAL = re.compile(
    r"USD\s?\d|\$\d|\d%|fee|price|plan|trial|subscribe|guarantee|invest",
    re.IGNORECASE)


def check(text: str, content_type: str = "text") -> list[dict]:
    if not text.strip():
        return []
    out = []

    # 1. regulatory disclaimer on promotional copy carrying a price/claim
    if content_type in PROMO_TYPES and _PRICE_SIGNAL.search(text):
        low = text.lower()
        if DISCLAIMER.lower() not in low or FDIC.lower() not in low:
            out.append({
                "category": "claim",
                "severity": "critical",
                "rule": "Missing required regulatory disclaimer "
                        "('not a bank' + Members FDIC)",
                "excerpt": "",
                "suggestion": f"Append: \"{DISCLAIMER}. Banking services "
                              f"provided by partner institutions, {FDIC}.\"",
            })

    # 2. competitor mentions (prohibited terms flagged as kind='competitor')
    with db.get() as conn:
        comps = db.rows(conn, "SELECT term, note FROM glossary "
                              "WHERE kind='competitor'")
    for row in comps:
        m = re.search(r"(?<!\w)" + re.escape(row["term"]) + r"(?!\w)",
                      text, re.IGNORECASE)
        if m:
            out.append({
                "category": "term",
                "severity": "critical",
                "rule": f"Competitor mention banned: \"{row['term']}\"",
                "excerpt": m.group(0),
                "suggestion": row["note"] or
                              "Never name competitors in marketing copy — "
                              "use 'other providers'.",
            })
    return out
