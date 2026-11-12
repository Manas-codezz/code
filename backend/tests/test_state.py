"""Explicit content state machine + finding supersession (not deletion)."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.state import LOCKED, can_transition

client = TestClient(app)

CREDS = {"creator": ("creator@brandguard.demo", "creator123"),
         "reviewer": ("reviewer@brandguard.demo", "reviewer123"),
         "manager": ("manager@brandguard.demo", "manager123")}


@pytest.fixture(autouse=True)
def _startup():
    with client:
        yield


def hdr(role: str) -> dict:
    email, pw = CREDS[role]
    r = client.post("/auth/login", json={"email": email, "password": pw})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _reviewed(text: str = "Guaranteed returns! Act now!") -> int:
    cid = client.post("/content", headers=hdr("creator"), json={
        "type": "email", "title": "sm", "text": text,
        "channel": "email"}).json()["id"]
    body = client.post(f"/content/{cid}/review?force_mock=true",
                       headers=hdr("creator")).json()
    for f in body["findings"]:                 # clear criticals so approve passes
        client.patch(f"/findings/{f['id']}", json={"accepted": 1},
                     headers=hdr("reviewer"))
    return cid


def test_transition_graph():
    assert can_transition("draft", "review", "creator")
    assert can_transition("review", "approved", "manager")
    assert can_transition("approved", "published", "manager")
    assert not can_transition("draft", "approved", "manager")
    assert not can_transition("published", "published", "admin")
    assert not can_transition("approved", "changes", "manager")
    assert LOCKED == frozenset({"approved", "published"})


def test_cannot_request_changes_after_approval():
    cid = _reviewed()
    assert client.post(f"/content/{cid}/approve",
                       headers=hdr("manager")).status_code == 200
    # approved is locked — the old unguarded request-changes would flip it back
    assert client.post(f"/content/{cid}/request-changes",
                       headers=hdr("manager")).status_code == 409


def test_cannot_review_locked_content():
    cid = _reviewed()
    client.post(f"/content/{cid}/approve", headers=hdr("manager"))
    assert client.post(f"/content/{cid}/review?force_mock=true",
                       headers=hdr("creator")).status_code == 409


def test_rereview_supersedes_old_findings():
    cid = _reviewed()
    first = {f["id"] for f in client.get(f"/content/{cid}",
             headers=hdr("creator")).json()["findings"]}
    client.post(f"/content/{cid}/review?force_mock=true", headers=hdr("creator"))
    second = {f["id"] for f in client.get(f"/content/{cid}",
              headers=hdr("creator")).json()["findings"]}
    assert second, "re-review must produce findings"
    assert not (first & second), "old findings are superseded, not re-served"
