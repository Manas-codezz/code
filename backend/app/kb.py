"""Living brand knowledge base: CRUD for guidelines/glossary/facts/colors,
plus bulk import (onboarding wizard) and export (backup/versioning).

Read = any authenticated role (creators must be able to consult the KB);
write/delete = manager+. Dict bodies keep /docs honest without Pydantic
boilerplate for four near-identical tables.

Also: ingest guideline PDFs/DOCX, auto-chunk+embed into kb_chunk, and
       persist 256-d vectors (Gemini API or local zlib.crc32 fallback).
"""
import io
import json
import re
import zlib
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from . import db
from .auth import current_user, require_role
from .settings import settings

router = APIRouter(prefix="/kb", tags=["knowledge base"])

GLOSSARY_KINDS = {"approved", "prohibited", "preferred", "competitor"}

SPEC: dict[str, dict] = {
    "guidelines": {"table": "guideline", "fields": ("title", "body"),
                   "label": "title"},
    "glossary": {"table": "glossary", "fields": ("term", "kind", "note"),
                 "label": "term", "validate": "glossary"},
    "facts": {"table": "fact", "fields": ("claim", "source"),
              "label": "claim"},
    "colors": {"table": "brand_color", "fields": ("hex", "name"),
               "label": "hex", "validate": "hex"},
}


def _check(kind: str, body: dict) -> dict:
    spec = SPEC[kind]
    if not isinstance(body, dict):
        raise HTTPException(422, "body must be a JSON object")
    out = {}
    for f in spec["fields"]:
        val = str(body.get(f, "")).strip()
        if f in ("title", "body", "term", "claim") and not val:
            raise HTTPException(422, f"'{f}' is required")
        out[f] = val
    if spec.get("validate") == "glossary" and out["kind"] not in GLOSSARY_KINDS:
        raise HTTPException(422, f"kind must be one of "
                                 f"{sorted(GLOSSARY_KINDS)}")
    if spec.get("validate") == "hex" and not re.fullmatch(
            r"#[0-9A-Fa-f]{6}", out["hex"]):
        raise HTTPException(422, "hex must look like #1B4DFF")
    return out


@router.get("/export")
def export(_: dict = Depends(current_user)):
    with db.get() as conn:
        return {k: db.rows(conn, f"SELECT * FROM {s['table']} ORDER BY id")
                for k, s in SPEC.items()}


@router.post("/import")
def bulk_import(body: dict, user: dict = Depends(require_role("manager"))):
    """Onboarding: paste a whole brand book at once."""
    added, skipped = {}, []
    with db.get() as conn:
        for kind, items in (body or {}).items():
            if kind not in SPEC or not isinstance(items, list):
                skipped.append(kind)
                continue
            n = 0
            for item in items:
                data = _check(kind, item)          # validates + rejects bad
                cols = ", ".join(data)
                ph = ", ".join("?" * len(data))
                conn.execute(f"INSERT INTO {SPEC[kind]['table']} "
                             f"({cols}) VALUES ({ph})", tuple(data.values()))
                n += 1
            added[kind] = n
        db.log_audit(conn, None, user["email"], "kb_import",
                     f"added={added} skipped={skipped}")
    conn.commit()
    return {"added": added, "skipped": skipped}


async def _read_file_text(upload: UploadFile) -> str:
    """Read uploaded file as text, supporting PDF and DOCX."""
    data = await upload.read()
    if not data:
        return ""
    # PDF via pypdf
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        return " ".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        pass
    # DOCX via python-docx
    try:
        import docx
        doc = docx.Document(io.BytesIO(data))
        return " ".join(paragraph.text or "" for paragraph in doc.paragraphs)
    except Exception:
        pass
    # Fallback: treat as plain text
    return data.decode("utf-8", errors="ignore")


@router.post("/ingest", name="kb_ingest")
async def kb_ingest(
    upload: UploadFile = File(...),
    user: dict = Depends(require_role("manager")),
):
    """Ingest a brand guideline PDF or DOCX.

    - Extracts text
    - Chunks into ~1000 character segments with 150 overlap
    - Embeds each chunk (Gemini API or local zlib.crc32 fallback)
    - Inserts kb_chunk rows (JSON embedding + optional pgvector HNSW index)
    Returns {"chunks": N, "status": "ok"} on success.
    """
    text = await _read_file_text(upload)
    if not text.strip():
        return {"chunks": 0, "status": "no text found"}
    # Chunk: ~1000 chars, 150 overlap
    chunk_size = 1000
    chunk_overlap = 150
    chunks_texts = []
    for i in range(0, len(text), chunk_size - chunk_overlap):
        chunk = text[i : i + chunk_size]
        if chunk.strip():
            chunks_texts.append(chunk)
    if not chunks_texts:
        return {"chunks": 0, "status": "no usable chunks"}
    # Embed chunks (Gemini if key available, else deterministic local)
    from .engine.embed import embed_texts
    embeddings = embed_texts(chunks_texts)  # list[list[float]]
    # Insert kb_chunk rows
    added = 0
    with db.get() as conn:
        for i, (chunk, vec) in enumerate(zip(chunks_texts, embeddings)):
            vec_json = json.dumps(vec)
            # portable JSON column always works; pgvector column added later if available
            conn.execute(
                """INSERT INTO kb_chunk (source, chunk_index, text, embedding)
                   VALUES (%s, %s, %s, %s)""",
                ("ingest", i, chunk, vec_json),
            )
            added += 1
        conn.commit()
    return {"chunks": added, "status": "ok"}


# --- per-table CRUD (generated from SPEC, one code path) -------------------
for _kind, _spec in SPEC.items():
    def _list(kind: str = _kind, user: dict = Depends(current_user)):
        with db.get() as conn:
            return db.rows(conn, f"SELECT * FROM {SPEC[kind]['table']} "
                                 "ORDER BY id")

    def _create(kind: str = _kind, body: dict | None = None,
                user: dict = Depends(require_role("manager"))):
        data = _check(kind, body or {})
        with db.get() as conn:
            cols = ", ".join(data)
            ph = ", ".join("?" * len(data))
            cur = conn.execute(
                f"INSERT INTO {SPEC[kind]['table']} ({cols}) VALUES ({ph})"
                " RETURNING id",
                tuple(data.values()))
            new_id = cur.fetchone()["id"]
            db.log_audit(conn, None, user["email"], f"kb_create_{kind}",
                         str(data)[:200])
            conn.commit()
            return db.one(conn, f"SELECT * FROM {SPEC[kind]['table']} "
                                "WHERE id=?", (new_id,))

    def _update(i: int, kind: str = _kind, body: dict | None = None,
                user: dict = Depends(require_role("manager"))):
        with db.get() as conn:
            if not db.one(conn, f"SELECT id FROM {SPEC[kind]['table']} "
                                "WHERE id=?", (i,)):
                raise HTTPException(404, f"{kind} not found")
            data = _check(kind, body or {})
            sets = ", ".join(f"{k}=?" for k in data)
            conn.execute(f"UPDATE {SPEC[kind]['table']} SET {sets} WHERE id=?",
                         (*data.values(), i))
            db.log_audit(conn, None, user["email"], f"kb_update_{kind}",
                         f"id={i}")
            conn.commit()
            return db.one(conn, f"SELECT * FROM {SPEC[kind]['table']} "
                                "WHERE id=?", (i,))

    def _delete(i: int, kind: str = _kind,
                user: dict = Depends(require_role("manager"))):
        with db.get() as conn:
            if not db.one(conn, f"SELECT id FROM {SPEC[kind]['table']} "
                                "WHERE id=?", (i,)):
                raise HTTPException(404, f"{kind} not found")
            conn.execute(f"DELETE FROM {SPEC[kind]['table']} WHERE id=?", (i,))
            db.log_audit(conn, None, user["email"], f"kb_delete_{kind}",
                         f"id={i}")
            conn.commit()
        return {"deleted": i}

    router.add_api_route(f"/{_kind}", _list, methods=["GET"],
                         name=f"list_{_kind}")
    router.add_api_route(f"/{_kind}", _create, methods=["POST"],
                         name=f"create_{_kind}", status_code=201)
    router.add_api_route(f"/{_kind}/{{i}}", _update, methods=["PATCH"],
                         name=f"update_{_kind}")
    router.add_api_route(f"/{_kind}/{{i}}", _delete, methods=["DELETE"],
                         name=f"delete_{_kind}")
