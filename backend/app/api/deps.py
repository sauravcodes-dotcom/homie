from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ForbiddenError
from app.database.session import get_db
from app.models import User
from app.services.auth import AuthError, user_for_token


def bearer_token(authorization: str | None = Header(default=None)) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip() or None
    return None


def optional_user(
    token: str | None = Depends(bearer_token), db: Session = Depends(get_db)
) -> User | None:
    return user_for_token(db, token) if token else None


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise AuthError("Sign in with your USC email to do this")
    return user


def admin_user(
    user: User = Depends(current_user), settings: Settings = Depends(get_settings)
) -> User:
    if user.email.lower() not in settings.admin_email_set:
        raise ForbiddenError("Admins only")
    return user
