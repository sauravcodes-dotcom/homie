from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.auth import PublicUser


class ConversationStart(BaseModel):
    listing_id: int | None = None
    user_id: int | None = None
    body: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def _one_target(self) -> "ConversationStart":
        if (self.listing_id is None) == (self.user_id is None):
            raise ValueError("Provide exactly one of listing_id or user_id")
        return self


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: int
    sender_id: int
    is_mine: bool
    body: str
    created_at: datetime


class ConversationOut(BaseModel):
    id: int
    other: PublicUser
    listing_id: int | None
    listing_title: str | None
    last_message: str | None
    last_message_at: datetime | None
    unread: int
    can_review: bool = False


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]
    # Highest id among my messages the other person has opened (read receipts).
    other_read_up_to: int | None = None
    other_typing: bool = False


Trait = Literal["cleanliness", "communication", "reliability", "respect"]


class PersonReviewIn(BaseModel):
    relationship_kind: Literal["roommate", "subletter", "lister"]
    rating: int = Field(ge=1, le=5)
    traits: dict[Trait, int] = Field(default_factory=dict)
    body: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def _trait_range(self) -> "PersonReviewIn":
        if any(not 1 <= v <= 5 for v in self.traits.values()):
            raise ValueError("trait scores must be 1-5")
        return self


class PersonReviewOut(BaseModel):
    id: int
    relationship_kind: str
    rating: int
    traits: dict[str, int]
    body: str
    created_at: datetime
    is_mine: bool = False


class PersonProfile(BaseModel):
    """Public reputation page for a student."""

    user: PublicUser
    review_count: int
    average_rating: float | None
    trait_averages: dict[str, float]
    reviews: list[PersonReviewOut]
    can_review: bool
    my_review: PersonReviewOut | None = None
