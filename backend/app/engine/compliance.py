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


def _check_amounts(text: str) -> list[dict]:
    """Money amounts in copy must appear in the Fact Store — catches
    invented/typo'd prices even without the LLM (and is graded critical:
    an unsupported price is an unsubstantiated claim)."""
    with db.get() as conn:
        facts = " | ".join(r["claim"] for r in
                           db.rows(conn, "SELECT claim FROM fact"))
    out = []
    for m in re.finditer(r"(?:USD\s?\d+(?:\.\d+)?|\$\d+(?:\.\d+)?)", text):
        val = m.group(0)
        digits = re.sub(r"^[^\d]+", "", val)
        if digits in facts or val in facts:
            continue
        out.append({
            "category": "claim",
            "severity": "critical",
            "rule": f"Amount '{val}' not found in the Fact Store",
            "excerpt": val,
            "suggestion": f"Substantiate \"{val}\" with an approved fact or "
                          "use the approved figure.",
            "evidence": "Fact Store",
        })
    return out


def check(text: str, content_type: str = "text") -> list[dict]:
    if not text.strip():
        return []
    out = _check_amounts(text)

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
                "evidence": "Guideline: Claims & Compliance",
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
                "evidence": "Glossary: competitor list",
            })
    return out
