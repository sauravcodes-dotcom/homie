"""The subleaser's roommate feedback channel on a listing."""

from collections import Counter, defaultdict
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError, NotFoundError
from app.models import Listing, RoommateFeedback, User
from app.models.base import as_utc
from app.schemas.listing import FeedbackCreate, FeedbackOut, FeedbackSummary
from app.services.people import display_name
from app.services.rating.apartments import summarize
from app.services.rating.engine import Rating, estimate

__all__ = [
    "ForbiddenError",
    "add_roommate_feedback",
    "feedback_for_listing",
    "feedback_summaries",
]


def add_roommate_feedback(
    db: Session, listing_id: int, author: User, data: FeedbackCreate
) -> FeedbackOut:
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise NotFoundError("Listing not found")
    # The channel belongs to the student subleasing the room: they live with
    # the roommates, so they are the one who can describe them.
    if listing.owner_id != author.id:
        raise ForbiddenError("Only the student subleasing this room can post roommate feedback")
    row = RoommateFeedback(
        listing_id=listing.id,
        author_id=author.id,
        rating=data.rating,
        tags=list(dict.fromkeys(data.tags)),
        comment=data.comment.strip(),
    )
    db.add(row)
    db.commit()
    return _feedback_out(db, row)


def feedback_for_listing(db: Session, listing_id: int) -> list[FeedbackOut]:
    rows = db.scalars(
        select(RoommateFeedback)
        .where(RoommateFeedback.listing_id == listing_id)
        .order_by(RoommateFeedback.created_at.desc(), RoommateFeedback.id.desc())
    ).all()
    return [_feedback_out(db, r) for r in rows]


def feedback_summaries(db: Session, listing_ids: list[int]) -> dict[int, FeedbackSummary]:
    """Count, average rating and most common tags per listing, in one query."""
    if not listing_ids:
        return {}
    grouped: dict[int, list[RoommateFeedback]] = defaultdict(list)
    for row in db.scalars(
        select(RoommateFeedback).where(RoommateFeedback.listing_id.in_(listing_ids))
    ).all():
        grouped[row.listing_id].append(row)
    out = {}
    today = datetime.now(UTC).date()
    for listing_id, rows in grouped.items():
        tags = Counter(t for r in rows for t in (r.tags or []))
        ratings = [
            Rating(
                stars=r.rating,
                source="subleaser",
                age_days=max(0, (today - as_utc(r.created_at).date()).days),
            )
            for r in rows
        ]
        out[listing_id] = FeedbackSummary(
            count=len(rows),
            average_rating=round(sum(r.rating for r in rows) / len(rows), 1),
            rating=summarize(estimate(ratings)),
            top_tags=[t for t, _ in tags.most_common(3)],
        )
    return out


def _feedback_out(db: Session, row: RoommateFeedback) -> FeedbackOut:
    author = db.get(User, row.author_id)
    return FeedbackOut(
        id=row.id,
        rating=row.rating,
        tags=row.tags or [],
        comment=row.comment,
        author_name=display_name(author),
        author_verified=bool(author and author.is_usc_verified),
        created_at=row.created_at,
    )
