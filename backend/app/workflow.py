"""Collaborative workflow: peer review, comment threads, version history
with side-by-side diff data, SLA publishing, signed webhooks, audit verify."""
import difflib
import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import db
from .auth import current_user, require_role
from .settings import settings

router = APIRouter(tags=["workflow"])


# --- helpers ---------------------------------------------------------------
def _content(conn, cid: int) -> dict:
    row = db.one(conn, "SELECT * FROM content WHERE id=?", (cid,))
    if not row:
        raise HTTPException(404, "content not found")
    return row


def _snapshot(conn, cid: int, author: str) -> int:
    """Record the current text as the next immutable version."""
    row = _content(conn, cid)
    n = db.one(conn, "SELECT COALESCE(MAX(version),0) v FROM content_version "
                     "WHERE content_id=?", (cid,))["v"] + 1
    conn.execute(
        "INSERT INTO content_version (content_id, version, title, text,"
        " status, author) VALUES (?,?,?,?,?,?)",
        (cid, n, row["title"], row["text"], row["status"], author))
    return n


def _dispatch_webhook(event: str, cid: int, extra: dict) -> dict:
    """HMAC-SHA256-signed POST to WEBHOOK_URL ("" = disabled)."""
    if not settings.webhook_url:
        return {"sent": False, "reason": "webhook_url not configured"}
    payload = {"event": event, "content_id": cid, "product": "BrandGuard AI",
               **extra}
    body = json.dumps(payload, sort_keys=True).encode()
    sig = hmac.new(settings.webhook_secret.encode(), body,
                   hashlib.sha256).hexdigest()
    try:
        import httpx
        r = httpx.post(settings.webhook_url, content=body,
                       headers={"X-BrandGuard-Signature": f"sha256={sig}",
                                "Content-Type": "application/json"},
                       timeout=3.0)
        return {"sent": r.ok, "status": r.status_code}
    except Exception as e:                       # webhook must never block publish
        return {"sent": False, "error": str(e)[:120]}


class PeerBody(BaseModel):
    action: str                          # approve | reject
    note: str = ""


class CommentBody(BaseModel):
    body: str
    parent_id: int | None = None


class CommentPatch(BaseModel):
    resolved: bool
    reply: str = ""


class ContentPatch(BaseModel):
    title: str | None = None
    text: str | None = None


# --- peer review stage -----------------------------------------------------
@router.post("/content/{cid}/peer-review")
def peer_review(cid: int, body: PeerBody,
                user: dict = Depends(require_role("reviewer"))):
    if body.action not in ("approve", "reject"):
        raise HTTPException(422, "action must be approve|reject")
    with db.get() as conn:
        row = _content(conn, cid)
        if row["status"] != "review":
            raise HTTPException(
                409, f"peer review only from 'review' (now "
                     f"'{row['status']}') — run the AI review first")
        new_status = "peer_review" if body.action == "approve" else "changes"
        conn.execute("UPDATE content SET status=? WHERE id=?",
                     (new_status, cid))
        _snapshot(conn, cid, user["email"])
        db.log_audit(conn, cid, user["email"], f"peer_{body.action}",
                     body.note[:200])
        conn.commit()
        return db.one(conn, "SELECT * FROM content WHERE id=?", (cid,))


# --- comment threads -------------------------------------------------------
@router.get("/content/{cid}/comments")
def list_comments(cid: int, user: dict = Depends(current_user)):
    with db.get() as conn:
        _content(conn, cid)
        return db.rows(conn, "SELECT * FROM comment WHERE content_id=? "
                             "ORDER BY id", (cid,))


@router.post("/content/{cid}/comments", status_code=201)
def add_comment(cid: int, body: CommentBody,
                user: dict = Depends(current_user)):
    if not body.body.strip():
        raise HTTPException(422, "comment body required")
    with db.get() as conn:
        _content(conn, cid)
        if body.parent_id:
            parent = db.one(conn, "SELECT id FROM comment WHERE id=? "
                                  "AND content_id=?", (body.parent_id, cid))
            if not parent:
                raise HTTPException(404, "parent comment not found")
        cur = conn.execute(
            "INSERT INTO comment (content_id, parent_id, author, body) "
            "VALUES (?,?,?,?) RETURNING id",
            (cid, body.parent_id, user["email"], body.body.strip()))
        new_id = cur.fetchone()["id"]
        db.log_audit(conn, cid, user["email"], "comment",
                     body.body.strip()[:200])
        conn.commit()
        return db.one(conn, "SELECT * FROM comment WHERE id=?",
                      (new_id,))


@router.patch("/comments/{iid}")
def resolve_comment(iid: int, body: CommentPatch,
                    user: dict = Depends(require_role("reviewer"))):
    with db.get() as conn:
        row = db.one(conn, "SELECT * FROM comment WHERE id=?", (iid,))
        if not row:
            raise HTTPException(404, "comment not found")
        conn.execute("UPDATE comment SET resolved=? WHERE id=?",
                     (1 if body.resolved else 0, iid))
        # If reply message provided, create a reply comment
        if body.reply and body.reply.strip():
            conn.execute(
                "INSERT INTO comment (content_id, parent_id, author, body) "
                "VALUES (?,?,?,?)",
                (row["content_id"], iid, user["email"], body.reply.strip()))
            db.log_audit(conn, row["content_id"], user["email"], "comment_reply",
                         body.reply.strip()[:200])
        db.log_audit(conn, row["content_id"], user["email"],
                     "comment_resolve", f"comment {iid} -> {body.resolved}")
        conn.commit()
        return db.one(conn, "SELECT * FROM comment WHERE id=?", (iid,))


# --- version history + diff ------------------------------------------------
@router.patch("/content/{cid}")
def edit_content(cid: int, body: ContentPatch,
                 user: dict = Depends(current_user)):
    with db.get() as conn:
        row = _content(conn, cid)
        if row["status"] in ("approved", "published"):
            raise HTTPException(403, "approved/published content is locked")
        if body.text is None and body.title is None:
            raise HTTPException(422, "nothing to change")
        text_changed = body.text is not None and body.text != row["text"]
        sets, args = [], []
        if body.title is not None:
            sets.append("title=?"), args.append(body.title)
        if body.text is not None:
            sets.append("text=?"), args.append(body.text)
        if text_changed:
            # prior findings belong to the old text — invalidate them
            sets.append("status='draft'")
            conn.execute("DELETE FROM finding WHERE content_id=?", (cid,))
        conn.execute(f"UPDATE content SET {', '.join(sets)} WHERE id=?",
                     (*args, cid))
        _snapshot(conn, cid, user["email"])     # record the NEW state
        db.log_audit(conn, cid, user["email"], "edit",
                     "text changed" if text_changed else "title changed")
        conn.commit()
        return db.one(conn, "SELECT * FROM content WHERE id=?", (cid,))


@router.get("/content/{cid}/versions")
def list_versions(cid: int, user: dict = Depends(current_user)):
    with db.get() as conn:
        _content(conn, cid)
        return db.rows(conn, "SELECT id, content_id, version, status,"
                             " author, created_at, length(text) AS chars"
                             " FROM content_version WHERE content_id=? "
                             "ORDER BY version", (cid,))


@router.get("/content/{cid}/diff")
def diff_versions(cid: int, frm: int, to: int,
                  user: dict = Depends(current_user)):
    """Side-by-side source for the UI: unified-diff line list."""
    with db.get() as conn:
        _content(conn, cid)
        a = db.one(conn, "SELECT * FROM content_version WHERE content_id=? "
                         "AND version=?", (cid, frm))
        b = db.one(conn, "SELECT * FROM content_version WHERE content_id=? "
                         "AND version=?", (cid, to))
    if not a or not b:
        raise HTTPException(404, "version not found")
    lines = list(difflib.unified_diff(
        a["text"].splitlines(), b["text"].splitlines(),
        fromfile=f"v{frm} ({a['status']})", tofile=f"v{to} ({b['status']})",
        lineterm=""))
    added = sum(1 for l in lines if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in lines if l.startswith("-") and not l.startswith("---"))
    return {"from": frm, "to": to, "lines": lines,
            "added": added, "removed": removed}


# --- publish (integration target) -----------------------------------------
@router.post("/content/{cid}/publish")
def publish(cid: int, user: dict = Depends(require_role("manager"))):
    with db.get() as conn:
        row = _content(conn, cid)
        if row["status"] != "approved":
            raise HTTPException(
                409, f"only approved content publishes (now "
                     f"'{row['status']}')")
        import datetime as _dt
        now = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        conn.execute("UPDATE content SET status='published', "
                     "published_at=? WHERE id=?", (now, cid))
        _snapshot(conn, cid, user["email"])
        result = _dispatch_webhook("content.published", cid, {
            "channel": row["channel"], "title": row["title"],
            "published_by": user["email"]})
        db.log_audit(conn, cid, user["email"], "publish",
                     json.dumps(result))
        conn.commit()
        row = db.one(conn, "SELECT * FROM content WHERE id=?", (cid,))
    return {"content": row, "webhook": result}


# --- audit integrity -------------------------------------------------------
@router.get("/audit/verify")
def audit_verify(user: dict = Depends(require_role("manager"))):
    return db.verify_chain()
