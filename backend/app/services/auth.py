"""Passwordless sign-in restricted to one email domain (usc.edu).

Flow: request_code(email) -> verify_code(email, code) -> session token.
Codes and tokens are stored as HMAC/SHA-256 hashes only.
"""

import hashlib
import hmac
import logging
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import HomieError
from app.models import LoginCode, User, UserSession

logger = logging.getLogger("homie")

_EMAIL = re.compile(r"^[a-z0-9._%+\-]+@([a-z0-9.\-]+)$")


class AuthError(HomieError):
    status_code = 401
    code = "unauthorized"


class EmailDomainError(HomieError):
    status_code = 403
    code = "email_domain_not_allowed"


@dataclass
class CodeRequestResult:
    email: str
    delivered_by_email: bool
    demo_code: str | None


def normalize_usc_email(raw: str, settings: Settings) -> str:
    email = raw.strip().lower()
    match = _EMAIL.match(email)
    if not match:
        raise HomieError("Enter a valid email address")
    # Exact domain match: rejects look-alikes such as x@notusc.edu or x@usc.edu.evil.com.
    if match.group(1) != settings.allowed_email_domain:
        raise EmailDomainError(f"HOMIE is only open to @{settings.allowed_email_domain} addresses")
    return email


def request_code(db: Session, raw_email: str, settings: Settings) -> CodeRequestResult:
    email = normalize_usc_email(raw_email, settings)
    code = f"{secrets.randbelow(1_000_000):06d}"

    # Only the newest code is valid.
    db.execute(update(LoginCode).where(LoginCode.email == email).values(used=True))
    db.add(
        LoginCode(
            email=email,
            code_hash=_hash(f"{email}:{code}", settings),
            expires_at=_now() + timedelta(minutes=settings.login_code_ttl_minutes),
        )
    )
    db.commit()

    if settings.email_delivery_enabled:
        _send_code_email(email, code, settings)
        return CodeRequestResult(email=email, delivered_by_email=True, demo_code=None)
    if settings.auth_demo_mode:
        return CodeRequestResult(email=email, delivered_by_email=False, demo_code=code)
    raise HomieError("Email delivery is not configured")


def verify_code(db: Session, raw_email: str, code: str, settings: Settings) -> tuple[User, str]:
    email = normalize_usc_email(raw_email, settings)
    row = db.scalars(
        select(LoginCode)
        .where(LoginCode.email == email, LoginCode.used.is_(False))
        .order_by(LoginCode.id.desc())
        .limit(1)
    ).first()
    if row is None or _aware(row.expires_at) < _now():
        raise AuthError("That code has expired. Request a new one.")
    if row.attempts >= settings.login_code_max_attempts:
        raise AuthError("Too many attempts. Request a new code.")

    row.attempts += 1
    if not hmac.compare_digest(row.code_hash, _hash(f"{email}:{code.strip()}", settings)):
        db.commit()
        raise AuthError("That code is not right. Check it and try again.")

    row.used = True
    user = db.scalars(select(User).where(User.email == email)).first()
    if user is None:
        user = User(email=email, full_name=email.split("@")[0], is_usc_verified=True)
        db.add(user)
    user.is_usc_verified = True
    db.flush()

    token = secrets.token_urlsafe(32)
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=_sha256(token),
            expires_at=_now() + timedelta(days=settings.session_days),
        )
    )
    db.commit()
    return user, token


def user_for_token(db: Session, token: str) -> User | None:
    session = db.scalars(
        select(UserSession).where(UserSession.token_hash == _sha256(token))
    ).first()
    if session is None or _aware(session.expires_at) < _now():
        return None
    return db.get(User, session.user_id)


def revoke_token(db: Session, token: str) -> None:
    session = db.scalars(
        select(UserSession).where(UserSession.token_hash == _sha256(token))
    ).first()
    if session:
        db.delete(session)
        db.commit()


def _send_code_email(email: str, code: str, settings: Settings) -> None:
    assert settings.resend_api_key is not None
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key.get_secret_value()}"},
            json={
                "from": settings.email_from,
                "to": [email],
                "subject": f"Your HOMIE sign-in code: {code}",
                "text": (
                    f"Your HOMIE sign-in code is {code}. It expires in "
                    f"{settings.login_code_ttl_minutes} minutes.\n\n"
                    "If you did not request this, you can ignore this email."
                ),
            },
            timeout=10,
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Sending login code failed: %s", exc)
        raise HomieError("Could not send the sign-in email. Try again in a minute.") from exc


def _hash(value: str, settings: Settings) -> str:
    key = settings.secret_key.get_secret_value().encode()
    return hmac.new(key, value.encode(), hashlib.sha256).hexdigest()


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(dt: datetime) -> datetime:
    # SQLite returns naive datetimes; everything is stored in UTC.
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
