"""Idempotent demo data so a fresh deployment has something to show."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Apartment, Listing, ListingType, RoommateFeedback, User

DEMO_EMAIL = "demo.subleaser@usc.edu"


def seed_demo_data(db: Session) -> None:
    if db.scalars(select(Listing).where(Listing.is_demo.is_(True))).first():
        return

    owner = db.scalars(select(User).where(User.email == DEMO_EMAIL)).first()
    if owner is None:
        owner = User(email=DEMO_EMAIL, full_name="Demo subleaser", is_usc_verified=True)
        db.add(owner)
        db.flush()

    lorenzo = db.scalars(
        select(Apartment).where(Apartment.name == "The Residences at Lorenzo")
    ).first()
    if lorenzo is None:
        lorenzo = Apartment(
            name="The Residences at Lorenzo",
            address="325 W Adams Blvd, Los Angeles, CA 90007",
            neighborhood="University Park",
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
        neighborhood="University Park",
        lifestyle={
            "sleep_schedule": "flexible",
            "cleanliness": 4,
            "smoking": False,
            "drinking": True,
            "pets": False,
        },
        is_demo=True,
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
