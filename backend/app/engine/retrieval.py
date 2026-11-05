"""RAG-lite: BM25 retrieval over brand-guideline chunks (stdlib only — no
vector DB needed at this scale; swap for pgvector when the KB outgrows
prompt budget).

Glossary + facts stay pinned in every prompt (exact-match data retrieval
can't miss); only the long guideline bodies are ranked/retrieved."""
import re
from .. import db

_TOKEN = re.compile(r"[a-z0-9']+")
K1, B = 1.5, 0.75


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def bm25_rank(query_tokens: list[str],
              docs_tokens: list[list[str]]) -> list[float]:
    """Standard BM25 scores for each doc against the query."""
    n = len(docs_tokens)
    if not n or not query_tokens:
        return [0.0] * n
    df: dict[str, int] = {}
    for d in docs_tokens:
        for t in set(d):
            df[t] = df.get(t, 0) + 1
    avgdl = sum(len(d) for d in docs_tokens) / n or 1.0
    scores = []
    for d in docs_tokens:
        tf: dict[str, int] = {}
        for t in d:
            tf[t] = tf.get(t, 0) + 1
        s = 0.0
        for t in query_tokens:
            if t not in tf:
                continue
            idf = __import__("math").log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
            freq = tf[t]
            s += idf * freq * (K1 + 1) / (
                freq + K1 * (1 - B + B * len(d) / avgdl))
        scores.append(s)
    return scores


def relevant_guidelines(content: str, top_k: int = 3) -> list[dict]:
    """Guideline chunks most relevant to this content (always ≥1, ordered)."""
    with db.get() as conn:
        guides = db.rows(conn, "SELECT * FROM guideline ORDER BY id")
    if not guides:
        return []
    docs = [tokenize(f"{g['title']} {g['body']}") for g in guides]
    scores = bm25_rank(tokenize(content), docs)
    ranked = sorted(zip(guides, scores), key=lambda x: -x[1])
    # keep everything if the KB is tiny or nothing matches at all
    total = sum(scores)
    if total == 0 or len(guides) <= top_k:
        return guides
    hits = [g for g, s in ranked[:top_k] if s > 0]
    return hits or ranked[:1]
