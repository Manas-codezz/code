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
    status      TEXT NOT NULL DEFAULT 'draft', -- draft|review|changes|approved
    created_by  TEXT NOT NULL DEFAULT 'creator',
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
    at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finding_content ON finding(content_id);
CREATE INDEX IF NOT EXISTS idx_content_status  ON content(status);
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
