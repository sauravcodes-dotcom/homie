from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.review import ApartmentInsights


class ApartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    address: str = Field(min_length=4, max_length=300)
    neighborhood: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class ApartmentCard(BaseModel):
    id: int
    name: str
    address: str
    neighborhood: str | None
    latitude: float | None
    longitude: float | None
    review_count: int
    verified_count: int
    average_rating: float | None
    listing_count: int


class ExternalInfo(BaseModel):
    """State of the public-review fallback for this building."""

    status: Literal["not_needed", "ready", "missing", "disabled"]
    provider: str | None = None
    sample_size: int | None = None
    pool_size: int | None = None
    average_rating: float | None = None
    fetched_at: datetime | None = None


class ApartmentDetail(ApartmentCard):
    # Where the insights below come from. "homie_thin" = HOMIE reviews, but fewer
    # than the threshold and no public-review summary available.
    insights_source: Literal["homie", "google", "homie_thin", "none"]
    min_reviews: int
    insights: ApartmentInsights | None
    summary: str
    external: ExternalInfo
    median_listing_rent: int | None
    my_verification: Literal["none", "pending", "approved", "rejected"] = "none"
    my_review_id: int | None = None


class ReviewCreate(BaseModel):
    body: str = Field(min_length=30, max_length=6000)
    overall_rating: int = Field(ge=1, le=5)
    lived_from: date | None = None
    lived_to: date | None = None

    @model_validator(mode="after")
    def _dates(self) -> "ReviewCreate":
        if self.lived_from and self.lived_to and self.lived_to < self.lived_from:
            raise ValueError("lived_to must not be before lived_from")
        return self


class ReviewOut(BaseModel):
    id: int
    body: str
    overall_rating: int | None
    lived_from: date | None
    lived_to: date | None
    is_verified_resident: bool
    created_at: datetime
    is_mine: bool
    topics: list[str]


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=400)


class VerificationOut(BaseModel):
    id: int
    apartment_id: int
    apartment_name: str
    user_display: str
    status: str
    created_at: datetime
    has_document: bool


class Decision(BaseModel):
    approve: bool
