"""Living brand knowledge base: CRUD for guidelines/glossary/facts/colors,
plus bulk import (onboarding wizard) and export (backup/versioning).

Read = any authenticated role (creators must be able to consult the KB);
write/delete = manager+. Dict bodies keep /docs honest without Pydantic
boilerplate for four near-identical tables."""
import re
from fastapi import APIRouter, Depends, HTTPException

from . import db
from .auth import current_user, require_role

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
        conn.execute(
            "INSERT INTO audit (actor, action, detail) VALUES (?,?,?)",
            (user["email"], "kb_import", f"added={added} skipped={skipped}"))
        conn.commit()
    return {"added": added, "skipped": skipped}


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
                f"INSERT INTO {SPEC[kind]['table']} ({cols}) VALUES ({ph})",
                tuple(data.values()))
            conn.execute("INSERT INTO audit (actor, action, detail) "
                         "VALUES (?,?,?)",
                         (user["email"], f"kb_create_{kind}",
                          str(data)[:200]))
            conn.commit()
            return db.one(conn, f"SELECT * FROM {SPEC[kind]['table']} "
                                "WHERE id=?", (cur.lastrowid,))

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
            conn.execute("INSERT INTO audit (actor, action, detail) "
                         "VALUES (?,?,?)",
                         (user["email"], f"kb_update_{kind}", f"id={i}"))
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
            conn.execute("INSERT INTO audit (actor, action, detail) "
                         "VALUES (?,?,?)",
                         (user["email"], f"kb_delete_{kind}", f"id={i}"))
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
