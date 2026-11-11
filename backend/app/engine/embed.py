"""Text embedding engine: Gemini → local fallback (hashed bag-of-words).

Used to chunk+embed brand guideline documents into kb_chunk rows.
"""
from __future__ import annotations

import logging
import re

from app.settings import settings

log = logging.getLogger("brandguard.embed")

_TOKEN = re.compile(r"[a-z0-9']+")

EMBED_DIM = settings.embed_dim


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts.

    Calls Gemini if gemini_api_key is set; otherwise falls back to the
    deterministic local Hashtable‑based 256‑d encoder.
    """
    if not settings.gemini_api_key:
        return [_local(t) for t in texts]

    try:
        from openai import OpenAI  # Gemini's OpenAI‑compatible endpoint
        c = OpenAI(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=settings.gemini_api_key,
            timeout=30,
        )
        r = c.embeddings.create(
            model=settings.embed_model, input=texts, dimensions=settings.embed_dim,
        )
        return [d.embedding for d in r.data]
    except Exception as e:
        log.warning("gemini embed failed, local fallback: %s", e)
        return [_local(t) for t in texts]


import zlib

def _local(t: str) -> list[float]:
    """Deterministic 256-d crc32 bag-of-words, L2‑normalised."""
    v = [0.0] * EMBED_DIM
    for tok in tokenize(t):
        v[zlib.crc32(tok.encode()) % EMBED_DIM] += 1.0
    n = sum(x * x for x in v) ** 0.5 or 1.0
    return [x / n for x in v]