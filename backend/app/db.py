"""SQLite access — stdlib only, no ORM. Path comes from settings (deploy-safe)."""
import sqlite3
from .settings import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS content (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,                -- text | image | email | social
    title       TEXT NOT NULL DEFAULT '',
    text        TEXT NOT NULL DEFAULT '',
    image_path  TEXT,
    channel     TEXT NOT NULL DEFAULT 'web',
    status      TEXT NOT NULL DEFAULT 'draft', -- draft|review|peer_review|changes|approved|published
    created_by  TEXT NOT NULL DEFAULT 'creator',
    team        TEXT NOT NULL DEFAULT 'marketing',
    sla_due_at  TEXT,                          -- review deadline (SLA timer)
    published_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finding (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id  INTEGER NOT NULL REFERENCES content(id),
    category    TEXT NOT NULL,                -- tone|term|claim|a11y|visual
    severity    TEXT NOT NULL,                -- critical|warning|suggestion
    rule        TEXT NOT NULL,
    excerpt     TEXT NOT NULL DEFAULT '',
    suggestion  TEXT NOT NULL DEFAULT '',
    accepted    INTEGER NOT NULL DEFAULT 0,   -- 0=pending 1=accepted 2=dismissed
    confidence  REAL NOT NULL DEFAULT 0.6,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guideline (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS glossary (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    kind TEXT NOT NULL,                       -- approved|prohibited|preferred
    note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS fact (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    claim  TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS brand_color (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    hex  TEXT NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER REFERENCES content(id),
    actor      TEXT NOT NULL,
    action     TEXT NOT NULL,
    detail     TEXT NOT NULL DEFAULT '',
    tokens     INTEGER NOT NULL DEFAULT 0,
    prev_hash  TEXT NOT NULL DEFAULT '',
    hash       TEXT NOT NULL DEFAULT '',
    at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comment (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER NOT NULL REFERENCES content(id),
    parent_id  INTEGER REFERENCES comment(id),
    author     TEXT NOT NULL,
    body       TEXT NOT NULL,
    resolved   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_version (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER NOT NULL REFERENCES content(id),
    version    INTEGER NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    text       TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT '',
    author     TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'creator', -- creator|reviewer|manager|admin
    team          TEXT NOT NULL DEFAULT 'marketing',
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_token (
    jti        TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES user(id),
    expires_at TEXT NOT NULL,
    revoked    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finding_content ON finding(content_id);
CREATE INDEX IF NOT EXISTS idx_content_status  ON content(status);
CREATE INDEX IF NOT EXISTS idx_user_email      ON user(email);
CREATE INDEX IF NOT EXISTS idx_version_content ON content_version(content_id);
CREATE INDEX IF NOT EXISTS idx_comment_content ON comment(content_id);
"""


def get() -> sqlite3.Connection:
    from pathlib import Path
    Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns introduced after the file was first created (dev DBs)."""
    for table, col, ddl in (
        ("finding", "confidence", "ALTER TABLE finding ADD COLUMN "
                                  "confidence REAL NOT NULL DEFAULT 0.6"),
        ("audit", "tokens", "ALTER TABLE audit ADD COLUMN "
                            "tokens INTEGER NOT NULL DEFAULT 0"),
        ("audit", "prev_hash", "ALTER TABLE audit ADD COLUMN "
                               "prev_hash TEXT NOT NULL DEFAULT ''"),
        ("audit", "hash", "ALTER TABLE audit ADD COLUMN "
                          "hash TEXT NOT NULL DEFAULT ''"),
        ("content", "team", "ALTER TABLE content ADD COLUMN "
                            "team TEXT NOT NULL DEFAULT 'marketing'"),
        ("content", "sla_due_at", "ALTER TABLE content ADD COLUMN "
                                  "sla_due_at TEXT"),
        ("content", "published_at", "ALTER TABLE content ADD COLUMN "
                                    "published_at TEXT"),
    ):
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        if col not in cols:
            conn.execute(ddl)


def init() -> None:
    with get() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)


def rows(conn: sqlite3.Connection, sql: str, args: tuple = ()) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def one(conn: sqlite3.Connection, sql: str, args: tuple = ()) -> dict | None:
    r = conn.execute(sql, args).fetchone()
    return dict(r) if r else None


# --- tamper-evident audit trail (hash chain) -------------------------------
def _chain_hash(prev: str, content_id, actor: str, action: str,
                detail: str, tokens: int, at: str) -> str:
    import hashlib
    payload = f"{prev}|{content_id}|{actor}|{action}|{detail}|{tokens}|{at}"
    return hashlib.sha256(payload.encode()).hexdigest()


def log_audit(conn: sqlite3.Connection, content_id, actor: str,
              action: str, detail: str = "", tokens: int = 0) -> None:
    """Append to the audit hash chain — every row commits to its
    predecessor, so any retroactive edit breaks verification."""
    prev = one(conn, "SELECT hash FROM audit ORDER BY id DESC LIMIT 1")
    prev_hash = (prev["hash"] or "genesis") if prev else "genesis"
    import datetime as _dt
    at = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    h = _chain_hash(prev_hash, content_id, actor, action, detail, tokens, at)
    conn.execute(
        "INSERT INTO audit (content_id, actor, action, detail, tokens,"
        " prev_hash, hash, at) VALUES (?,?,?,?,?,?,?,?)",
        (content_id, actor, action, detail, tokens, prev_hash, h, at))


def verify_chain() -> dict:
    """Walk the chain; return {'ok': bool, 'checked': n, 'broken_at': id}."""
    with get() as conn:
        rows_ = rows(conn, "SELECT * FROM audit ORDER BY id")
    prev = "genesis"
    for r in rows_:
        expect = _chain_hash(prev, r["content_id"], r["actor"],
                             r["action"], r["detail"], r["tokens"], r["at"])
        if r["hash"] != expect:
            return {"ok": False, "checked": len(rows_),
                    "broken_at": r["id"]}
        prev = r["hash"]
    return {"ok": True, "checked": len(rows_), "broken_at": None}
