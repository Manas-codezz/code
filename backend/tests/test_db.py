"""Postgres adapter translations — no server needed."""


def test_placeholder_translation():
    from app.db import _ph
    assert _ph("SELECT * FROM t WHERE a=? AND b=?") == \
        "SELECT * FROM t WHERE a=%s AND b=%s"


def test_pg_schema_translation():
    from app.db import pg_schema
    s = pg_schema()
    assert "SERIAL PRIMARY KEY" in s
    assert "AUTOINCREMENT" not in s
    assert "datetime('now')" not in s
    assert "to_char(now()" in s


def test_defaults_to_sqlite():
    from app.db import is_postgres
    from app.settings import settings
    assert settings.database_url == ""
    assert is_postgres() is False
