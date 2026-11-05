"""Deterministic terminology check — regex over the glossary.

Free, instant, and guaranteed to fire in the demo even if the LLM is slow
or down. The LLM does tone/claims; this catches exact banned strings."""
import re
from .. import db


def _load() -> tuple[list[dict], list[dict]]:
    with db.get() as conn:
        prohibited = db.rows(
            conn, "SELECT term, note FROM glossary WHERE kind='prohibited'")
        preferred = db.rows(
            conn, "SELECT term, note FROM glossary WHERE kind='preferred'")
    return prohibited, preferred


_MAX_FINDINGS_PER_KIND = 15

# Approved contexts where a prohibited substring is actually correct
# (e.g. the mandated disclaimer contains "not a bank"). Matched spans are
# erased from a scratch copy before the term search.
_EXCEPTIONS: dict[str, list[str]] = {
    "bank": [r"not a bank", r"banking services"],
}


def _find_term(text: str, term: str) -> str | None:
    scratch = text
    for exc in _EXCEPTIONS.get(term.lower(), []):
        scratch = re.sub(exc, lambda m: " " * len(m.group(0)), scratch,
                         flags=re.IGNORECASE)
    # word-boundary match; allow $ variants like $4.99
    pat = r"(?<![\w])" + re.escape(term) + r"(?![\w])"
    m = re.search(pat, scratch, flags=re.IGNORECASE)
    if not m:
        return None
    # report the real (un-erased) surface form at the same offsets
    return text[m.start():m.end()]


def check(text: str) -> list[dict]:
    if not text.strip():
        return []
    prohibited, preferred = _load()
    out: list[dict] = []

    for row in prohibited:
        hit = _find_term(text, row["term"])
        if hit:
            out.append({
                "category": "term",
                "severity": "critical",
                "rule": f"Prohibited term: \"{row['term']}\"",
                "excerpt": hit,
                "suggestion": row["note"] or
                              f"Remove or rephrase \"{row['term']}\".",
            })

    # preferred-term suggestions: only when the formal/plainer synonym is
    # actually present in a way that matters (skip if already absent)
    for row in preferred:
        hit = _find_term(text, row["term"])
        if hit:
            out.append({
                "category": "term",
                "severity": "suggestion",
                "rule": f"Preferred alternative available: \"{row['term']}\"",
                "excerpt": hit,
                "suggestion": row["note"] or
                              f"Consider \"{row['term']}\".",
            })
    return out
