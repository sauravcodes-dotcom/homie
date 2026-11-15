"""Turn database rows into API response models."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Apartment, Listing, SeekerProfile, Swipe, User
from app.schemas.listing import FeedbackSummary, ListingOut, RiskReport
from app.schemas.matching import Lifestyle, ListingCriteria, SeekerCriteria
from app.services.housing.fair_price import fair_prices
from app.services.housing.geo import travel_to_campus
from app.services.listings import feedback_summaries
from app.services.people import display_name, public_user

__all__ = [
    "display_name",
    "listing_criteria",
    "listings_out",
    "public_user",
    "seeker_criteria",
]


def listings_out(db: Session, rows: list[Listing], viewer: User | None) -> list[ListingOut]:
    if not rows:
        return []
    owners = {
        u.id: u
        for u in db.scalars(select(User).where(User.id.in_({r.owner_id for r in rows}))).all()
    }
    apt_ids = {r.apartment_id for r in rows if r.apartment_id}
    apartments = (
        {a.id: a for a in db.scalars(select(Apartment).where(Apartment.id.in_(apt_ids))).all()}
        if apt_ids
        else {}
    )
    feedback = feedback_summaries(db, [r.id for r in rows])
    prices = fair_prices(db, rows)

    def building(r: Listing) -> Apartment | None:
        return apartments.get(r.apartment_id) if r.apartment_id else None

    saved: set[int] = set()
    if viewer:
        saved = set(
            db.scalars(
                select(Swipe.target_id).where(
                    Swipe.user_id == viewer.id,
                    Swipe.target_type == "listing",
                    Swipe.action == "save",
                    Swipe.target_id.in_([r.id for r in rows]),
                )
            ).all()
        )
    return [
        ListingOut(
            id=r.id,
            listing_type=r.listing_type,
            title=r.title,
            description=r.description,
            monthly_rent=r.monthly_rent,
            available_from=r.available_from,
            available_to=r.available_to,
            neighborhood=r.neighborhood,
            latitude=r.latitude,
            longitude=r.longitude,
            apartment_id=r.apartment_id,
            building_name=b.name if (b := building(r)) else None,
            address=b.address if (b := building(r)) else None,
            unit=r.unit,
            lifestyle=Lifestyle.model_validate(r.lifestyle or {}),
            photos=list(r.photos or []),
            is_active=r.is_active,
            is_demo=r.is_demo,
            created_at=r.created_at,
            owner=public_user(owners.get(r.owner_id), r.owner_id),
            owner_id=r.owner_id,
            owner_name=display_name(owners.get(r.owner_id)),
            roommate_feedback=feedback.get(r.id) or FeedbackSummary(),
            is_mine=bool(viewer and viewer.id == r.owner_id),
            is_saved=r.id in saved,
            risk=RiskReport.model_validate(r.risk) if r.risk else None,
            travel=travel_to_campus(r.latitude, r.longitude),
            fair_price=prices.get(r.id),
        )
        for r in rows
    ]


def listing_criteria(row: Listing) -> ListingCriteria:
    return ListingCriteria(
        id=row.id,
        monthly_rent=row.monthly_rent,
        available_from=row.available_from,
        available_to=row.available_to,
        neighborhood=row.neighborhood,
        latitude=row.latitude,
        longitude=row.longitude,
        lifestyle=Lifestyle.model_validate(row.lifestyle or {}),
    )


def seeker_criteria(p: SeekerProfile) -> SeekerCriteria:
    return SeekerCriteria(
        budget_max=p.budget_max,
        budget_min=p.budget_min,
        move_in=p.move_in,
        move_out=p.move_out,
        preferred_neighborhoods=list(p.preferred_neighborhoods or []),
        max_distance_miles=p.max_distance_miles,
        lifestyle=Lifestyle.model_validate(p.lifestyle or {}),
    )
