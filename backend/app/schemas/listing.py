from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.matching import Lifestyle

ListingTypeLiteral = Literal["sublease", "lease_takeover", "room", "roommate_replacement"]

RoommateTag = Literal[
    "friendly",
    "clean",
    "quiet",
    "social",
    "respectful",
    "studious",
    "pays on time",
    "shares chores",
]


class ListingCreate(BaseModel):
    listing_type: ListingTypeLiteral = "sublease"
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=4000)
    building_name: str = Field(min_length=2, max_length=200)
    address: str = Field(min_length=5, max_length=300)
    unit: str | None = Field(default=None, max_length=40)
    neighborhood: str | None = Field(default=None, max_length=120)
    monthly_rent: int = Field(gt=0, le=20_000)
    available_from: date
    available_to: date | None = None
    lifestyle: Lifestyle = Field(default_factory=Lifestyle)

    @model_validator(mode="after")
    def _dates(self) -> "ListingCreate":
        if self.available_to and self.available_to <= self.available_from:
            raise ValueError("available_to must be after available_from")
        return self


class FeedbackCreate(BaseModel):
    rating: int = Field(ge=1, le=5, description="How good the roommates are to live with")
    tags: list[RoommateTag] = Field(default_factory=list, max_length=8)
    comment: str = Field(min_length=2, max_length=2000)


class FeedbackOut(BaseModel):
    id: int
    rating: int
    tags: list[str]
    comment: str
    author_name: str
    author_verified: bool
    created_at: datetime


class FeedbackSummary(BaseModel):
    count: int
    average_rating: float | None
    top_tags: list[str]


class ListingOut(BaseModel):
    id: int
    listing_type: ListingTypeLiteral
    title: str
    description: str
    building_name: str | None
    address: str | None
    unit: str | None
    neighborhood: str | None
    monthly_rent: int
    available_from: date
    available_to: date | None
    lifestyle: Lifestyle
    owner_name: str
    owner_id: int
    is_demo: bool
    roommate_feedback: FeedbackSummary


class ListingDetail(ListingOut):
    feedback: list[FeedbackOut]
