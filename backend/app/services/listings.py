"""Listings and the subleaser's roommate feedback channel."""

from collections import Counter
from datetime import date

from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import HomieError, NotFoundError
from app.models import Apartment, Listing, ListingType, RoommateFeedback, User
from app.schemas.listing import (
    FeedbackCreate,
    FeedbackOut,
    FeedbackSummary,
    ListingCreate,
    ListingDetail,
    ListingOut,
    ListingPage,
)
from app.schemas.matching import Lifestyle, ListingCriteria, ListingMatchRequest, MatchResult
from app.services.matching import score_match


class ListingMatch(BaseModel):
    listing: ListingOut
    match: MatchResult


class ListingMatchResponse(BaseModel):
    scanned: int
    results: list[ListingMatch]


class ForbiddenError(HomieError):
    status_code = 403
    code = "forbidden"


SORTS = {
    "newest": (Listing.created_at.desc(), Listing.id.desc()),
    "price_asc": (Listing.monthly_rent.asc(), Listing.id.asc()),
    "price_desc": (Listing.monthly_rent.desc(), Listing.id.desc()),
    "soonest": (Listing.available_from.asc(), Listing.id.asc()),
}


def search_listings(
    db: Session,
    *,
    q: str | None = None,
    listing_type: str | None = None,
    neighborhood: str | None = None,
    min_rent: int | None = None,
    max_rent: int | None = None,
    available_by: date | None = None,
    sort: str = "newest",
    limit: int = 24,
    offset: int = 0,
) -> ListingPage:
    stmt = select(Listing).outerjoin(Apartment, Apartment.id == Listing.apartment_id)
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Listing.title).like(like),
                func.lower(Apartment.address).like(like),
                func.lower(Apartment.name).like(like),
                func.lower(func.coalesce(Listing.unit, "")).like(like),
            )
        )
    if listing_type:
        stmt = stmt.where(Listing.listing_type == ListingType(listing_type))
    if neighborhood:
        stmt = stmt.where(Listing.neighborhood == neighborhood)
    if min_rent is not None:
        stmt = stmt.where(Listing.monthly_rent >= min_rent)
    if max_rent is not None:
        stmt = stmt.where(Listing.monthly_rent <= max_rent)
    if available_by is not None:
        stmt = stmt.where(Listing.available_from <= available_by)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(*SORTS.get(sort, SORTS["newest"])).limit(limit).offset(offset))
    return ListingPage(total=total, items=[_to_out(db, listing) for listing in rows])


def match_listings(db: Session, req: ListingMatchRequest) -> ListingMatchResponse:
    """Score every listing for this seeker and return the best ones with reasons."""
    stmt = select(Listing)
    if req.listing_types:
        stmt = stmt.where(Listing.listing_type.in_([ListingType(t) for t in req.listing_types]))
    candidates = db.scalars(stmt).all()

    scored = []
    for listing in candidates:
        criteria = ListingCriteria(
            id=listing.id,
            monthly_rent=listing.monthly_rent,
            available_from=listing.available_from,
            available_to=listing.available_to,
            neighborhood=listing.neighborhood,
            latitude=listing.latitude,
            longitude=listing.longitude,
            lifestyle=Lifestyle(**(listing.lifestyle or {})),
        )
        scored.append((score_match(req.seeker, criteria), listing))

    scored.sort(key=lambda pair: (pair[0].score, -pair[1].monthly_rent), reverse=True)
    top = scored[: req.limit]
    return ListingMatchResponse(
        scanned=len(candidates),
        results=[ListingMatch(listing=_to_out(db, listing), match=match) for match, listing in top],
    )


def get_listing(db: Session, listing_id: int) -> ListingDetail:
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise NotFoundError("Listing not found")
    feedback = _feedback_rows(db, listing.id)
    return ListingDetail(
        **_to_out(db, listing, feedback).model_dump(),
        feedback=[_feedback_out(db, f) for f in feedback],
    )


def create_listing(db: Session, owner: User, data: ListingCreate) -> ListingDetail:
    apartment = db.scalars(
        select(Apartment).where(Apartment.name == data.building_name.strip())
    ).first()
    if apartment is None:
        apartment = Apartment(
            name=data.building_name.strip(),
            address=data.address.strip(),
            neighborhood=data.neighborhood,
        )
        db.add(apartment)
        db.flush()
    listing = Listing(
        owner_id=owner.id,
        apartment_id=apartment.id,
        listing_type=ListingType(data.listing_type),
        title=data.title.strip(),
        description=data.description.strip(),
        unit=data.unit,
        monthly_rent=data.monthly_rent,
        available_from=data.available_from,
        available_to=data.available_to,
        neighborhood=data.neighborhood,
        lifestyle=data.lifestyle.model_dump(exclude_none=True),
    )
    db.add(listing)
    db.commit()
    return get_listing(db, listing.id)


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


def _feedback_rows(db: Session, listing_id: int) -> list[RoommateFeedback]:
    return list(
        db.scalars(
            select(RoommateFeedback)
            .where(RoommateFeedback.listing_id == listing_id)
            .order_by(RoommateFeedback.created_at.desc(), RoommateFeedback.id.desc())
        )
    )


def _summary(rows: list[RoommateFeedback]) -> FeedbackSummary:
    if not rows:
        return FeedbackSummary(count=0, average_rating=None, top_tags=[])
    tags = Counter(t for r in rows for t in r.tags)
    return FeedbackSummary(
        count=len(rows),
        average_rating=round(sum(r.rating for r in rows) / len(rows), 1),
        top_tags=[t for t, _ in tags.most_common(3)],
    )


def _to_out(
    db: Session, listing: Listing, feedback: list[RoommateFeedback] | None = None
) -> ListingOut:
    apartment = db.get(Apartment, listing.apartment_id) if listing.apartment_id else None
    owner = db.get(User, listing.owner_id)
    rows = feedback if feedback is not None else _feedback_rows(db, listing.id)
    return ListingOut(
        id=listing.id,
        listing_type=listing.listing_type.value,
        title=listing.title,
        description=listing.description,
        building_name=apartment.name if apartment else None,
        address=apartment.address if apartment else None,
        unit=listing.unit,
        neighborhood=listing.neighborhood,
        monthly_rent=listing.monthly_rent,
        available_from=listing.available_from,
        available_to=listing.available_to,
        lifestyle=Lifestyle(**(listing.lifestyle or {})),
        owner_name=owner.full_name if owner else "Unknown",
        owner_id=listing.owner_id,
        is_demo=listing.is_demo,
        roommate_feedback=_summary(rows),
    )


def _feedback_out(db: Session, row: RoommateFeedback) -> FeedbackOut:
    author = db.get(User, row.author_id)
    return FeedbackOut(
        id=row.id,
        rating=row.rating,
        tags=row.tags or [],
        comment=row.comment,
        author_name=author.full_name if author else "Former resident",
        author_verified=bool(author and author.is_usc_verified),
        created_at=row.created_at,
    )
