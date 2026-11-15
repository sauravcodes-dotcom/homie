"""Housing supply (listings) and demand (seeker profiles)."""

import enum
from datetime import date

from pgvector.sqlalchemy import Vector
from sqlalchemy import Date, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import EMBEDDING_DIM, TimestampMixin


class ListingType(enum.StrEnum):
    SUBLEASE = "sublease"
    LEASE_TAKEOVER = "lease_takeover"
    ROOM = "room"
    ROOMMATE_REPLACEMENT = "roommate_replacement"


class Listing(TimestampMixin, Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    apartment_id: Mapped[int | None] = mapped_column(
        ForeignKey("apartments.id", ondelete="SET NULL"), index=True
    )
    listing_type: Mapped[ListingType] = mapped_column(Enum(ListingType, name="listing_type"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    monthly_rent: Mapped[int] = mapped_column(Integer)  # whole USD
    available_from: Mapped[date] = mapped_column(Date)
    available_to: Mapped[date | None] = mapped_column(Date)
    neighborhood: Mapped[str | None] = mapped_column(String(120))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    # e.g. {"sleep_schedule": "early", "cleanliness": 4, "smoking": false, "pets": true}
    lifestyle: Mapped[dict] = mapped_column(JSONB, default=dict)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))


class SeekerProfile(TimestampMixin, Base):
    __tablename__ = "seeker_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    budget_min: Mapped[int | None] = mapped_column(Integer)
    budget_max: Mapped[int] = mapped_column(Integer)
    move_in: Mapped[date] = mapped_column(Date)
    move_out: Mapped[date | None] = mapped_column(Date)
    preferred_neighborhoods: Mapped[list[str]] = mapped_column(JSONB, default=list)
    max_distance_miles: Mapped[float | None] = mapped_column(Float)
    lifestyle: Mapped[dict] = mapped_column(JSONB, default=dict)
    bio: Mapped[str] = mapped_column(Text, default="")
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
