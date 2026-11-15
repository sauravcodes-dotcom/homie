from app.api.routes import health as health_module


def test_health_reports_degraded_without_database(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["database"] == "unavailable"
    assert body["llm_provider"] == "mock"


def test_health_ok_when_database_up(client, monkeypatch):
    monkeypatch.setattr(health_module, "check_database", lambda: True)
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
