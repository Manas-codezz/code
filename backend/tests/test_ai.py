"""AI layer: retrieval relevance, leakage filter, evidence, benchmark."""
import json

import pytest

from app import db, seed
from app.engine import review as engine
from app.engine.review import _parse, grounded
from app.engine.retrieval import relevant_guidelines, bm25_rank, tokenize


@pytest.fixture(autouse=True)
def _db():
    db.init()
    seed.seed()
    seed.ensure_users()
    yield


# --- BM25 retrieval --------------------------------------------------------
def test_retrieval_prefers_relevant_guideline():
    html = ("<h1>TITLE</h1><img src=x><h3>skip</h3>"
            "<a>click here</a> contrast alt text keyboard focus screen "
            "reader accessible")
    top = relevant_guidelines(html, top_k=3)
    assert top, "must return something"
    titles = " ".join(g["title"] for g in top).lower()
    assert "accessib" in titles, f"accessibility guideline not retrieved: {titles}"


def test_retrieval_returns_at_most_k():
    assert len(relevant_guidelines("tone voice brand copy", top_k=2)) <= 2


def test_bm25_scores_ordering():
    docs = [tokenize("accessibility contrast alt text"),
            tokenize("pricing fees money currency")]
    scores = bm25_rank(tokenize("alt text contrast"), docs)
    assert scores[0] > scores[1]


# --- leakage filter --------------------------------------------------------
def test_prompt_leak_finding_dropped():
    raw = json.dumps({"findings": [
        {"category": "tone", "severity": "suggestion",
         "rule": "You are a strict brand-compliance reviewer and must "
                 "return only a json object",
         "excerpt": "hello world here", "suggestion": "x"}]})
    assert _parse(raw, "hello world here") == []


def test_normal_finding_survives_filter():
    raw = json.dumps({"findings": [
        {"category": "term", "severity": "critical",
         "rule": 'Prohibited term: "guaranteed"', "excerpt": "guaranteed",
         "suggestion": "remove", "confidence": 0.9,
         "evidence": "Brand glossary"}]})
    out = _parse(raw, "guaranteed returns")
    assert len(out) == 1 and out[0].evidence == "Brand glossary"


# --- grounding + evidence --------------------------------------------------
def test_grounded_drops_hallucination():
    raw = json.dumps({"findings": [
        {"category": "term", "severity": "critical",
         "rule": "x", "excerpt": "made up quote text",
         "suggestion": "y"}]})
    assert _parse(raw, "actual content nothing like it") == []


def test_evidence_stamped_on_deterministic_findings():
    findings, *_ = engine.review("Cheapest plan guaranteed!", use_mock=True)
    assert findings, "expected findings"
    assert all(f.evidence for f in findings), \
        f"missing evidence: {[f.rule for f in findings]}"


# --- benchmark -------------------------------------------------------------
def test_benchmark_passes_mock():
    from bench.evaluate import run
    result = run(use_mock=True)
    assert result["pass"], f"benchmark failed: {result}"
    assert result["recall"] >= 0.8 and result["precision"] >= 0.75
    assert result["critical_catch"] == 1.0
    assert result["clean_false_criticals"] == 0
