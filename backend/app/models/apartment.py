"""Apartment complexes and resident reviews."""

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
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
    # Lets the public-review fallback skip the place lookup once it has been resolved.
    google_place_id: Mapped[str | None] = mapped_column(String(300))


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


class ExternalReviewSummary(TimestampMixin, Base):
    """Aggregate of a random sample of public reviews (e.g. Google), used only while
    a building has too few HOMIE reviews. Stores the summary, never the review text."""

    __tablename__ = "external_review_summaries"
    __table_args__ = (UniqueConstraint("apartment_id", "source"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    apartment_id: Mapped[int] = mapped_column(
        ForeignKey("apartments.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[str] = mapped_column(String(40))  # e.g. "google"
    sample_size: Mapped[int] = mapped_column(Integer)
    # How many reviews the provider could reach before sampling.
    pool_size: Mapped[int] = mapped_column(Integer)
    average_rating: Mapped[float | None] = mapped_column(Float)
    summary: Mapped[str] = mapped_column(Text, default="")
    insights: Mapped[dict] = mapped_column(JSONType, default=dict)  # ApartmentInsights
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ResidencyVerification(TimestampMixin, Base):
    """A lease document submitted to prove residency. The file is private to admins."""

    __tablename__ = "residency_verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    apartment_id: Mapped[int] = mapped_column(
        ForeignKey("apartments.id", ondelete="CASCADE"), index=True
    )
    document_path: Mapped[str | None] = mapped_column(String(400))
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
