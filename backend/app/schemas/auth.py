from pydantic import BaseModel, Field


class CodeRequest(BaseModel):
    email: str = Field(max_length=320)


class CodeRequestResponse(BaseModel):
    email: str
    delivered_by_email: bool
    # Only present in demo mode (no email provider configured).
    demo_code: str | None = None


class VerifyRequest(BaseModel):
    email: str = Field(max_length=320)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_usc_verified: bool
    is_admin: bool = False
    # True once the lifestyle quiz has been completed.
    has_profile: bool = False


class PublicUser(BaseModel):
    """What other students see. Never includes the email address."""

    id: int
    display_name: str
    is_usc_verified: bool


class UserUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)


class SessionOut(BaseModel):
    token: str
    user: UserOut
