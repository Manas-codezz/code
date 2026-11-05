"""Knowledge base CRUD: roles, validation, import/export round trip."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _startup():
    with client:
        yield


def hdr(role: str) -> dict:
    creds = {"creator": ("creator@brandguard.demo", "creator123"),
             "manager": ("manager@brandguard.demo", "manager123")}
    email, pw = creds[role]
    r = client.post("/auth/login", json={"email": email, "password": pw})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_kb_export_requires_auth_and_has_all_tables():
    assert client.get("/kb/export").status_code == 401
    data = client.get("/kb/export", headers=hdr("creator")).json()
    assert set(data) == {"guidelines", "glossary", "facts", "colors"}
    assert len(data["guidelines"]) >= 5        # seeded brand book


def test_creator_reads_manager_writes():
    assert client.post("/kb/guidelines", headers=hdr("creator"),
                       json={"title": "x", "body": "y"}).status_code == 403
    made = client.post("/kb/guidelines", headers=hdr("manager"),
                       json={"title": "New rule", "body": "Always be "
                             "explicit about fees."})
    assert made.status_code == 201
    gid = made.json()["id"]
    patched = client.patch(f"/kb/guidelines/{gid}", headers=hdr("manager"),
                           json={"title": "Newer rule",
                                 "body": "Always explicit."})
    assert patched.json()["title"] == "Newer rule"
    assert client.delete(f"/kb/guidelines/{gid}",
                         headers=hdr("manager")).status_code == 200


def test_validation_422s():
    # required field
    assert client.post("/kb/guidelines", headers=hdr("manager"),
                       json={"title": "", "body": "x"}).status_code == 422
    # glossary kind enum
    assert client.post("/kb/glossary", headers=hdr("manager"),
                       json={"term": "x", "kind": "bogus"}
                       ).status_code == 422
    # hex format
    assert client.post("/kb/colors", headers=hdr("manager"),
                       json={"hex": "blue", "name": "b"}).status_code == 422
    # unknown table in import
    r = client.post("/kb/import", headers=hdr("manager"),
                    json={"nope": [{"a": 1}]})
    assert r.json()["skipped"] == ["nope"]


def test_import_export_round_trip():
    payload = {
        "glossary": [{"term": "NovaVerse", "kind": "prohibited",
                      "note": "old campaign name"}],
        "facts": [{"claim": "Support is 24/7.", "source": "ops 2026-10"}],
        "colors": [{"hex": "#FF0055", "name": "Danger Rose"}],
        "guidelines": [{"title": "Crisis comms",
                        "body": "Never comment on incidents publicly "
                                "before Legal signs off."}],
    }
    r = client.post("/kb/import", headers=hdr("manager"), json=payload)
    assert r.status_code == 200
    assert r.json()["added"] == {k: 1 for k in payload}

    exported = client.get("/kb/export", headers=hdr("creator")).json()
    assert any(g["title"] == "Crisis comms" for g in exported["guidelines"])
    assert any(c["term"] == "NovaVerse" for c in exported["glossary"])
    assert any(f["claim"].startswith("Support") for f in exported["facts"])
    assert any(c["hex"] == "#FF0055" for c in exported["colors"])
