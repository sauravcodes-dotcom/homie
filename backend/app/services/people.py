"""How students are shown to each other."""

from app.models import User
from app.schemas.auth import PublicUser


def display_name(user: User | None) -> str:
    """First name and last initial. Never the email address.

    New accounts start with the email's local part as their name; that would
    reveal the address, so it is treated as "no name set yet".
    """
    if user is None:
        return "A Trojan"
    name = user.full_name.strip()
    if not name or name.lower() == user.email.split("@")[0].lower():
        return "A Trojan"
    parts = name.split()
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


def public_user(user: User | None, user_id: int = 0) -> PublicUser:
    return PublicUser(
        id=user.id if user else user_id,
        display_name=display_name(user),
        is_usc_verified=bool(user and user.is_usc_verified),
    )
