"""Transactional email (sign-in codes).

Two transports, picked by configuration:
- SMTP (default host is Gmail): set SMTP_USERNAME and SMTP_PASSWORD (a Gmail
  app password). Free, about 500 messages a day, delivers to any inbox.
- Resend: set RESEND_API_KEY. Without a verified domain Resend only delivers
  to the account owner, so SMTP is the better free option for a campus app.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import httpx

from app.core.config import Settings
from app.core.errors import HomieError

logger = logging.getLogger("homie")


class EmailDeliveryError(HomieError):
    status_code = 502
    code = "email_delivery_failed"


def send_login_code(to: str, code: str, settings: Settings) -> None:
    minutes = settings.login_code_ttl_minutes
    subject = f"{code} is your HOMIE sign-in code"
    text = (
        f"Your HOMIE sign-in code is {code}\n\n"
        f"Enter it on the sign-in page within {minutes} minutes.\n\n"
        "If you did not try to sign in, you can ignore this email. "
        "Nobody from HOMIE will ever ask you for this code."
    )
    html = f"""\
<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f1f1;font-family:Arial,Helvetica,sans-serif;color:#1d0808">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0;font-size:20px;font-weight:800;color:#990000">HOMIE</p>
      <p style="margin:16px 0 8px;font-size:16px">Your sign-in code is</p>
      <p style="margin:0 0 16px;font-size:36px;font-weight:800;letter-spacing:8px">{code}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#5b4a4a">Enter it on the sign-in page within {minutes} minutes.</p>
    </td></tr>
    <tr><td style="padding:0 28px 28px;font-size:12px;color:#8a7777">
      If you did not try to sign in, you can ignore this email. Nobody from HOMIE will ever ask you for this code.
    </td></tr>
  </table>
</body></html>"""

    if settings.smtp_configured:
        _send_smtp(to, subject, text, html, settings)
    elif settings.resend_api_key is not None:
        _send_resend(to, subject, text, html, settings)
    else:
        raise EmailDeliveryError("Email delivery is not configured")


def _sender(settings: Settings) -> tuple[str, str]:
    """(display name, address). SMTP providers like Gmail require the login address."""
    address = settings.smtp_from_address or settings.smtp_username or ""
    return settings.email_from_name, address


def _send_smtp(to: str, subject: str, text: str, html: str, settings: Settings) -> None:
    assert settings.smtp_username and settings.smtp_password
    name, address = _sender(settings)
    msg = EmailMessage()
    msg["From"] = formataddr((name, address))
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain=address.split("@")[-1] or None)
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    password = settings.smtp_password.get_secret_value().replace(" ", "")
    # Gmail sometimes drops implicit-TLS connections (465) from cloud hosts, so
    # fall back to STARTTLS on 587 when the first attempt cannot connect.
    ports = [settings.smtp_port] + ([587] if settings.smtp_port == 465 else [])
    last_exc: Exception | None = None
    for port in ports:
        try:
            _deliver(settings.smtp_host, port, settings.smtp_username, password, msg)
            return
        except smtplib.SMTPAuthenticationError as exc:
            logger.error("SMTP login rejected for the configured sender (port %s)", port)
            raise EmailDeliveryError(
                "The sign-in email could not be sent: the email account login was rejected."
            ) from exc
        except (smtplib.SMTPException, OSError) as exc:
            logger.warning("SMTP via %s:%s failed: %r", settings.smtp_host, port, exc)
            last_exc = exc
    raise EmailDeliveryError(
        "Could not send the sign-in email. Try again in a minute."
    ) from last_exc


def _deliver(host: str, port: int, username: str, password: str, msg: EmailMessage) -> None:
    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as smtp:
            smtp.login(username, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            smtp.login(username, password)
            smtp.send_message(msg)


def _send_resend(to: str, subject: str, text: str, html: str, settings: Settings) -> None:
    assert settings.resend_api_key is not None
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key.get_secret_value()}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "text": text,
                "html": html,
            },
            timeout=10,
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Sending login code via Resend failed: %s", exc)
        raise EmailDeliveryError(
            "Could not send the sign-in email. Try again in a minute."
        ) from exc
