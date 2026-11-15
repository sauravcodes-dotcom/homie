"""Idempotent demo data so a fresh deployment has something to show."""

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.demo_data import DEMO_EMAIL_DOMAIN, generate, owner_email, owner_name
from app.models import Apartment, Listing, ListingType, RoommateFeedback, User

logger = logging.getLogger("homie")

LORENZO_OWNER_EMAIL = f"lorenzo.subleaser@{DEMO_EMAIL_DOMAIN}"


def seed_demo_data(db: Session) -> None:
    _seed_lorenzo(db)
    target = get_settings().demo_listing_count
    if target <= 0:
        return
    existing = db.scalar(select(func.count()).select_from(Listing).where(Listing.is_demo.is_(True)))
    if existing and existing > 1:
        return
    started = datetime.now(UTC)
    _seed_bulk(db, target)
    logger.info("Seeded %d demo listings in %s", target, datetime.now(UTC) - started)


def _seed_lorenzo(db: Session) -> None:
    if db.scalars(select(Listing).where(Listing.is_demo.is_(True), Listing.unit == "3157")).first():
        return

    owner = db.scalars(select(User).where(User.email == LORENZO_OWNER_EMAIL)).first()
    if owner is None:
        owner = User(email=LORENZO_OWNER_EMAIL, full_name="Demo subleaser", is_usc_verified=True)
        db.add(owner)
        db.flush()

    lorenzo = db.scalars(
        select(Apartment).where(Apartment.name == "The Residences at Lorenzo")
    ).first()
    if lorenzo is None:
        lorenzo = Apartment(
            name="The Residences at Lorenzo",
            address="325 W Adams Blvd, Los Angeles, CA 90007",
            neighborhood="North University Park",
            latitude=34.0322,
            longitude=-118.2727,
        )
        db.add(lorenzo)
        db.flush()

    listing = Listing(
        owner_id=owner.id,
        apartment_id=lorenzo.id,
        listing_type=ListingType.SUBLEASE,
        title="Private room in unit 3157 at Lorenzo",
        unit="3157",
        description=(
            "Subleasing my private room in a shared unit at Lorenzo for spring. "
            "Furnished, close to campus and the Expo line. Demo posting."
        ),
        monthly_rent=1350,
        available_from=date(2027, 1, 5),
        available_to=date(2027, 7, 31),
        neighborhood="North University Park",
        latitude=34.0322,
        longitude=-118.2727,
        lifestyle={
            "sleep_schedule": "flexible",
            "cleanliness": 4,
            "smoking": False,
            "drinking": True,
            "pets": False,
        },
        is_demo=True,
        created_at=datetime.now(UTC),
    )
    db.add(listing)
    db.flush()
    db.add(
        RoommateFeedback(
            listing_id=listing.id,
            author_id=owner.id,
            rating=5,
            tags=["friendly", "social", "respectful"],
            comment="The roommates are very cool.",
        )
    )
    db.commit()


def _seed_bulk(db: Session, count: int) -> None:
    rows = generate(count)
    now = datetime.now(UTC)

    owner_indexes = sorted({r.owner_index for r in rows})
    users = {
        i: User(email=owner_email(i), full_name=owner_name(i), is_usc_verified=True)
        for i in owner_indexes
    }
    db.add_all(users.values())

    apartments: dict[str, Apartment] = {}
    for r in rows:
        if r.address not in apartments:
            apartments[r.address] = Apartment(
                name=r.address.split(",")[0],
                address=r.address,
                neighborhood=r.neighborhood,
                latitude=r.latitude,
                longitude=r.longitude,
            )
    db.add_all(apartments.values())
    db.flush()

    listings = []
    for r in rows:
        listing = Listing(
            owner_id=users[r.owner_index].id,
            apartment_id=apartments[r.address].id,
            listing_type=ListingType(r.listing_type),
            title=r.title,
            description=r.description,
            unit=r.unit,
            monthly_rent=r.monthly_rent,
            available_from=r.available_from,
            available_to=r.available_to,
            neighborhood=r.neighborhood,
            latitude=r.latitude,
            longitude=r.longitude,
            lifestyle=r.lifestyle,
            is_demo=True,
            created_at=now - timedelta(days=r.days_ago, minutes=len(listings)),
        )
        listings.append(listing)
    db.add_all(listings)
    db.flush()

    feedback = [
        RoommateFeedback(
            listing_id=listing.id,
            author_id=listing.owner_id,
            rating=n["rating"],
            tags=n["tags"],
            comment=n["comment"],
            created_at=listing.created_at + timedelta(hours=2 + k),
        )
        for listing, r in zip(listings, rows, strict=True)
        for k, n in enumerate(r.notes)
    ]
    db.add_all(feedback)
    db.commit()
