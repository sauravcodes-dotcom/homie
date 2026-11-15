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
