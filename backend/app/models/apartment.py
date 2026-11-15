"""Apartment complexes and resident reviews."""

from datetime import date

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import EmbeddingType, JSONType, TimestampMixin


class Apartment(TimestampMixin, Base):
    __tablename__ = "apartments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    address: Mapped[str] = mapped_column(String(300))
    neighborhood: Mapped[str | None] = mapped_column(String(120))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)


class Review(TimestampMixin, Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    apartment_id: Mapped[int] = mapped_column(
        ForeignKey("apartments.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # Verified = the author proved residency (e.g. lease document or USC housing record).
    is_verified_resident: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    body: Mapped[str] = mapped_column(Text)
    overall_rating: Mapped[int | None] = mapped_column(Integer)  # 1-5
    lived_from: Mapped[date | None] = mapped_column(Date)
    lived_to: Mapped[date | None] = mapped_column(Date)
    # Structured output of the AI extraction step (see schemas.review.ReviewExtraction).
    extraction: Mapped[dict | None] = mapped_column(JSONType)
    embedding: Mapped[list[float] | None] = mapped_column(EmbeddingType)
