from app.api.routes import health as health_module


def test_health_ok_with_database(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["storage"] == "sqlite"
    assert body["auth_mode"] == "demo"
    assert body["llm_provider"] == "mock"


def test_health_degraded_when_database_down(client, monkeypatch):
    monkeypatch.setattr(health_module, "check_database", lambda: False)
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "degraded"
    assert resp.json()["database"] == "unavailable"
