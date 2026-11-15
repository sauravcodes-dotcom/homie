import smtplib

import pytest

from app.core.config import get_settings


class FakeSMTP:
    sent: list = []
    fail_login = False

    def __init__(self, host, port, context=None, timeout=None):
        self.host, self.port = host, port

    def ehlo(self):
        pass

    def starttls(self, context=None):
        self.tls = True

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def login(self, user, password):
        if FakeSMTP.fail_login:
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")
        self.user, self.password = user, password

    def send_message(self, msg):
        FakeSMTP.sent.append((self, msg))


@pytest.fixture
def smtp(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_username", "homie.sender@gmail.com")
    monkeypatch.setattr(settings, "smtp_password", type(settings.secret_key)("abcd efgh ijkl mnop"))
    monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    FakeSMTP.sent = []
    FakeSMTP.fail_login = False
    return FakeSMTP


def test_code_is_emailed_and_not_returned(client, smtp):
    resp = client.post("/api/auth/request-code", json={"email": "mail.test@usc.edu"})
    body = resp.json()
    assert resp.status_code == 200
    assert body["delivered_by_email"] is True
    assert body["demo_code"] is None

    conn, msg = smtp.sent[0]
    assert (conn.host, conn.port) == ("smtp.gmail.com", 465)
    assert conn.user == "homie.sender@gmail.com"
    assert conn.password == "abcdefghijklmnop"  # spaces in Gmail app passwords are stripped
    assert msg["To"] == "mail.test@usc.edu"
    assert "homie.sender@gmail.com" in msg["From"]
    code = msg["Subject"].split()[0]
    assert len(code) == 6 and code.isdigit()
    assert code in msg.get_body(("plain",)).get_content()
    assert code in msg.get_body(("html",)).get_content()

    # The emailed code signs the user in.
    verify = client.post("/api/auth/verify", json={"email": "mail.test@usc.edu", "code": code})
    assert verify.status_code == 200


def test_health_reports_email_mode(client, smtp):
    assert client.get("/api/health").json()["auth_mode"] == "email"


def test_rejected_gmail_login_gives_clear_error(client, smtp):
    smtp.fail_login = True
    resp = client.post("/api/auth/request-code", json={"email": "badlogin@usc.edu"})
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "email_delivery_failed"


def test_resend_cooldown(client, smtp, monkeypatch):
    monkeypatch.setattr(get_settings(), "login_code_cooldown_seconds", 30)
    first = client.post("/api/auth/request-code", json={"email": "cooldown@usc.edu"})
    second = client.post("/api/auth/request-code", json={"email": "cooldown@usc.edu"})
    assert first.status_code == 200
    assert second.status_code == 429
    assert "Wait" in second.json()["error"]["message"]
    assert len(smtp.sent) == 1


def test_non_usc_address_never_triggers_an_email(client, smtp):
    resp = client.post("/api/auth/request-code", json={"email": "someone@gmail.com"})
    assert resp.status_code == 403
    assert smtp.sent == []


def test_falls_back_to_starttls_when_465_drops(client, smtp, monkeypatch):
    class DroppingSSL(FakeSMTP):
        def login(self, user, password):
            raise smtplib.SMTPServerDisconnected("Connection unexpectedly closed")

    monkeypatch.setattr(smtplib, "SMTP_SSL", DroppingSSL)
    resp = client.post("/api/auth/request-code", json={"email": "fallback@usc.edu"})
    assert resp.status_code == 200
    conn, msg = smtp.sent[0]
    assert conn.port == 587 and conn.tls is True


def test_relay_is_used_when_configured(client, smtp, monkeypatch):
    import json as _json

    import httpx

    from app.services import email as email_service

    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            seen.append(_json.loads(request.content))
            # Apps Script replies to POST with a redirect to the result.
            return httpx.Response(302, headers={"location": "https://relay.example/result"})
        return httpx.Response(200, json={"ok": True, "remaining_today": 99})

    real_post = httpx.post

    def fake_post(url, **kwargs):
        with httpx.Client(transport=httpx.MockTransport(handler)) as c:
            return c.post(
                url, json=kwargs["json"], follow_redirects=kwargs.get("follow_redirects", False)
            )

    settings = get_settings()
    monkeypatch.setattr(settings, "email_relay_url", "https://script.google.com/macros/s/x/exec")
    monkeypatch.setattr(settings, "email_relay_secret", type(settings.secret_key)("s3cret"))
    monkeypatch.setattr(email_service.httpx, "post", fake_post)

    resp = client.post("/api/auth/request-code", json={"email": "relay.test@usc.edu"})
    assert resp.status_code == 200
    assert resp.json()["demo_code"] is None
    assert seen[0]["secret"] == "s3cret"
    assert seen[0]["to"] == "relay.test@usc.edu"
    code = seen[0]["subject"].split()[0]
    assert code in seen[0]["text"] and code in seen[0]["html"]
    assert smtp.sent == []  # relay takes priority over SMTP
    assert real_post is not fake_post


def test_relay_refusal_is_reported(client, monkeypatch):
    import httpx

    from app.services import email as email_service

    def fake_post(url, **kwargs):
        return httpx.Response(
            200, json={"ok": False, "error": "unauthorized"}, request=httpx.Request("POST", url)
        )

    settings = get_settings()
    monkeypatch.setattr(settings, "email_relay_url", "https://script.google.com/macros/s/x/exec")
    monkeypatch.setattr(settings, "email_relay_secret", type(settings.secret_key)("wrong"))
    monkeypatch.setattr(email_service.httpx, "post", fake_post)
    resp = client.post("/api/auth/request-code", json={"email": "relay.refused@usc.edu"})
    assert resp.status_code == 502
