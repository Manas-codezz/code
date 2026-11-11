"""Tests for remediation endpoint, Slack publishing, and inbound webhook integrations."""
import hashlib
import hmac
import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.settings import settings

client = TestClient(app)

CREDS = {
    "creator": ("creator@brandguard.demo", "creator123"),
    "reviewer": ("reviewer@brandguard.demo", "reviewer123"),
    "manager": ("manager@brandguard.demo", "manager123"),
}


@pytest.fixture(autouse=True)
def _startup():
    settings.webhook_secret = "test-secret-key-12345"
    with client:
        yield


def hdr(role: str) -> dict:
    email, pw = CREDS[role]
    r = client.post("/auth/login", json={"email": email, "password": pw})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _make_reviewed(text: str = "Guaranteed returns! Act now! $5.00") -> int:
    cid = client.post("/content", headers=hdr("creator"), json={
        "type": "email", "title": "remediate-test", "text": text,
        "channel": "email"}).json()["id"]
    body = client.post(f"/content/{cid}/review?force_mock=true",
                       headers=hdr("creator")).json()
    for f in body["findings"]:
        client.patch(f"/findings/{f['id']}", json={"accepted": 1},
                     headers=hdr("reviewer"))
    return cid


def test_remediate_preview_does_not_mutate():
    text = "Guaranteed returns! Act now! $5.00"
    cid = _make_reviewed(text)

    r = client.post(f"/content/{cid}/remediate", headers=hdr("reviewer"),
                    json={"apply": False})
    assert r.status_code == 200
    data = r.json()
    assert "lines" in data
    assert "applied" in data
    assert "skipped" in data
    assert len(data["applied"]) > 0
    assert any(line.startswith("+") for line in data["lines"])
    assert any(line.startswith("-") for line in data["lines"])

    # Content in DB must be untouched
    row = client.get(f"/content/{cid}", headers=hdr("creator")).json()
    assert row["text"] == text
    assert row["status"] == "review"


def test_remediate_apply_mutates_and_rereviews():
    text = "Guaranteed returns! Act now! $5.00"
    cid = _make_reviewed(text)

    r = client.post(f"/content/{cid}/remediate", headers=hdr("reviewer"),
                    json={"apply": True})
    assert r.status_code == 200
    data = r.json()
    assert len(data["applied"]) > 0
    assert "review" in data
    assert "findings" in data["review"]

    # Text must be mutated in DB
    row = client.get(f"/content/{cid}", headers=hdr("creator")).json()
    assert row["text"] != text
    assert row["status"] == "review"

    # Version history snapshot was recorded
    versions = client.get(f"/content/{cid}/versions", headers=hdr("creator")).json()
    assert len(versions) >= 1
    assert versions[-1]["version"] >= 1

    # Audit log check
    audit = client.get("/audit", headers=hdr("manager")).json()
    assert any(a["action"] == "remediate" and a["content_id"] == cid for a in audit)


def test_remediate_selective_finding_ids():
    text = "Guaranteed returns! Act now! $5.00"
    cid = _make_reviewed(text)
    row = client.get(f"/content/{cid}", headers=hdr("creator")).json()
    accepted_ids = [f["id"] for f in row["findings"] if f["accepted"] == 1]
    assert len(accepted_ids) >= 2

    target_id = accepted_ids[0]
    r = client.post(f"/content/{cid}/remediate", headers=hdr("reviewer"),
                    json={"finding_ids": [target_id], "apply": False})
    assert r.status_code == 200
    data = r.json()
    assert target_id in data["applied"]
    assert len(data["applied"]) == 1


def test_remediate_locked_content_returns_409():
    cid = _make_reviewed("Guaranteed returns! Act now! $5.00")
    # Approve it
    assert client.post(f"/content/{cid}/approve", headers=hdr("manager")).status_code == 200

    r = client.post(f"/content/{cid}/remediate", headers=hdr("reviewer"),
                    json={"apply": False})
    assert r.status_code == 409
    assert "locked" in r.json()["detail"]


def test_remediate_no_applicable_suggestions_returns_422():
    cid = client.post("/content", headers=hdr("creator"), json={
        "type": "text", "title": "clean", "text": "Clean compliant copy with USD 4.99.",
        "channel": "web"}).json()["id"]
    client.post(f"/content/{cid}/review?force_mock=true", headers=hdr("creator"))

    r = client.post(f"/content/{cid}/remediate", headers=hdr("reviewer"),
                    json={"apply": False})
    assert r.status_code == 422
    assert "no applicable accepted suggestions" in r.json()["detail"]


def test_remediate_rbac_creator_forbidden():
    cid = _make_reviewed()
    r = client.post(f"/content/{cid}/remediate", headers=hdr("creator"),
                    json={"apply": False})
    assert r.status_code == 403


def test_publish_slack_not_configured():
    settings.slack_webhook_url = ""
    cid = _make_reviewed()
    client.post(f"/content/{cid}/approve", headers=hdr("manager"))

    r = client.post(f"/content/{cid}/publish", headers=hdr("manager"))
    assert r.status_code == 200
    body = r.json()
    assert body["content"]["status"] == "published"
    assert body["slack"]["sent"] is False
    assert body["slack"]["reason"] == "slack_webhook_url not configured"
    assert body["webhook"]["sent"] is False


def test_publish_slack_mocked(monkeypatch):
    settings.slack_webhook_url = "https://hooks.slack.com/services/test/mock/url"

    class MockResponse:
        is_success = True
        status_code = 200

    monkeypatch.setattr("httpx.post", lambda *a, **kw: MockResponse())

    cid = _make_reviewed()
    client.post(f"/content/{cid}/approve", headers=hdr("manager"))

    r = client.post(f"/content/{cid}/publish", headers=hdr("manager"))
    assert r.status_code == 200
    body = r.json()
    assert body["slack"]["sent"] is True
    assert body["slack"]["status"] == 200


def test_inbound_webhook_valid_signature():
    cid = client.post("/content", headers=hdr("creator"), json={
        "type": "email", "title": "inbound-test", "text": "Guaranteed returns! Act now! $5.00",
        "channel": "email"}).json()["id"]

    # 1. Action: review
    body = json.dumps({"action": "review", "content_id": cid}).encode()
    sig = "sha256=" + hmac.new(settings.webhook_secret.encode(), body, hashlib.sha256).hexdigest()

    r = client.post("/integrations/inbound", content=body,
                    headers={"X-BrandGuard-Signature": sig, "Content-Type": "application/json"})
    assert r.status_code == 200
    assert r.json()["action"] == "review"
    assert "review" in r.json()

    # Accept findings to permit approval
    findings = r.json()["review"]["findings"]
    for f in findings:
        client.patch(f"/findings/{f['id']}", json={"accepted": 1}, headers=hdr("reviewer"))

    # 2. Action: approve
    body = json.dumps({"action": "approve", "content_id": cid}).encode()
    sig = "sha256=" + hmac.new(settings.webhook_secret.encode(), body, hashlib.sha256).hexdigest()

    r = client.post("/integrations/inbound", content=body,
                    headers={"X-BrandGuard-Signature": sig, "Content-Type": "application/json"})
    assert r.status_code == 200
    assert r.json()["content"]["status"] == "approved"

    # 3. Action: publish
    body = json.dumps({"action": "publish", "content_id": cid}).encode()
    sig = "sha256=" + hmac.new(settings.webhook_secret.encode(), body, hashlib.sha256).hexdigest()

    r = client.post("/integrations/inbound", content=body,
                    headers={"X-BrandGuard-Signature": sig, "Content-Type": "application/json"})
    assert r.status_code == 200
    assert r.json()["content"]["status"] == "published"


def test_inbound_webhook_tampered_body():
    body = json.dumps({"action": "review", "content_id": 1}).encode()
    fake_body = json.dumps({"action": "review", "content_id": 2}).encode()
    sig = "sha256=" + hmac.new(settings.webhook_secret.encode(), body, hashlib.sha256).hexdigest()

    r = client.post("/integrations/inbound", content=fake_body,
                    headers={"X-BrandGuard-Signature": sig, "Content-Type": "application/json"})
    assert r.status_code == 401
    assert "invalid webhook signature" in r.json()["detail"]


def test_inbound_webhook_missing_header():
    body = json.dumps({"action": "review", "content_id": 1}).encode()
    r = client.post("/integrations/inbound", content=body,
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 401
    assert "missing X-BrandGuard-Signature header" in r.json()["detail"]


def test_inbound_webhook_unknown_action():
    body = json.dumps({"action": "destroy", "content_id": 1}).encode()
    sig = "sha256=" + hmac.new(settings.webhook_secret.encode(), body, hashlib.sha256).hexdigest()

    r = client.post("/integrations/inbound", content=body,
                    headers={"X-BrandGuard-Signature": sig, "Content-Type": "application/json"})
    assert r.status_code == 400
    assert "unknown action" in r.json()["detail"]
