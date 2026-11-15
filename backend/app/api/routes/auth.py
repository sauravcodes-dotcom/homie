from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import bearer_token, current_user
from app.core.config import get_settings
from app.database.session import get_db
from app.models import SeekerProfile, User
from app.schemas.auth import (
    CodeRequest,
    CodeRequestResponse,
    SessionOut,
    UserOut,
    UserUpdate,
    VerifyRequest,
)
from app.services import auth

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(db: Session, user: User) -> UserOut:
    has_profile = (
        db.scalar(select(SeekerProfile.id).where(SeekerProfile.user_id == user.id)) is not None
    )
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_usc_verified=user.is_usc_verified,
        is_admin=user.email.lower() in get_settings().admin_email_set,
        has_profile=has_profile,
    )


@router.post("/request-code", response_model=CodeRequestResponse)
def request_code(req: CodeRequest, db: Session = Depends(get_db)) -> CodeRequestResponse:
    """Start sign-in. Only @usc.edu addresses are accepted."""
    result = auth.request_code(db, req.email, get_settings())
    return CodeRequestResponse(
        email=result.email,
        delivered_by_email=result.delivered_by_email,
        demo_code=result.demo_code,
    )


@router.post("/verify", response_model=SessionOut)
def verify(req: VerifyRequest, db: Session = Depends(get_db)) -> SessionOut:
    user, token = auth.verify_code(db, req.email, req.code, get_settings())
    return SessionOut(token=token, user=_user_out(db, user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user), db: Session = Depends(get_db)) -> UserOut:
    return _user_out(db, user)


@router.patch("/me", response_model=UserOut)
def update_me(
    req: UserUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> UserOut:
    """Set the name other students see (first name and last initial)."""
    user.full_name = req.full_name.strip()
    db.commit()
    return _user_out(db, user)


@router.post("/logout", status_code=204)
def logout(token: str | None = Depends(bearer_token), db: Session = Depends(get_db)) -> None:
    if token:
        auth.revoke_token(db, token)
