from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.listing import ListingType
from app.schemas.auth import PublicUser
from app.schemas.matching import Lifestyle, MatchResult

PhotoUrl = str

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
    count: int = 0
    average_rating: float | None = None
    top_tags: list[str] = Field(default_factory=list)


class RiskFlag(BaseModel):
    code: str
    severity: Literal["low", "medium", "high"]
    message: str


class RiskReport(BaseModel):
    level: Literal["low", "medium", "high"] = "low"
    flags: list[RiskFlag] = Field(default_factory=list)


class RentBenchmark(BaseModel):
    """How a rent compares with other HOMIE listings. Always carries its sample size."""

    scope: Literal["building", "neighborhood", "all"]
    scope_label: str
    sample_size: int
    median: int
    p25: int
    p75: int
    diff_pct: float = Field(description="Listing rent vs median, e.g. -0.12 is 12% below")
    verdict: Literal["below", "typical", "above"]


class TravelEstimate(BaseModel):
    miles: float
    walk_minutes: int
    bike_minutes: int


class ListingBase(BaseModel):
    listing_type: ListingType = ListingType.SUBLEASE
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=6000)
    monthly_rent: int = Field(gt=0, le=20000)
    available_from: date
    available_to: date | None = None
    neighborhood: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    # Link the listing to a building either by id, or by name and address (the
    # building is created the first time someone posts in it).
    apartment_id: int | None = None
    building_name: str | None = Field(default=None, min_length=2, max_length=200)
    address: str | None = Field(default=None, min_length=5, max_length=300)
    unit: str | None = Field(default=None, max_length=40)
    lifestyle: Lifestyle = Field(default_factory=Lifestyle)
    photos: list[PhotoUrl] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _check(self) -> "ListingBase":
        if self.available_to and self.available_to <= self.available_from:
            raise ValueError("available_to must be after available_from")
        for url in self.photos:
            if not url.startswith("/api/uploads/photos/"):
                raise ValueError("photos must be uploaded through /api/uploads/photo")
        return self


class ListingCreate(ListingBase):
    pass


class ListingUpdate(ListingBase):
    is_active: bool = True


class ListingOut(BaseModel):
    id: int
    listing_type: ListingType
    title: str
    description: str
    monthly_rent: int
    available_from: date
    available_to: date | None
    neighborhood: str | None
    latitude: float | None
    longitude: float | None
    apartment_id: int | None
    building_name: str | None = None
    address: str | None = None
    unit: str | None = None
    lifestyle: Lifestyle
    photos: list[str]
    is_active: bool
    is_demo: bool = False
    created_at: datetime
    owner: PublicUser
    owner_id: int
    owner_name: str
    # Notes about the current roommates from the student subleasing the room.
    roommate_feedback: FeedbackSummary = Field(default_factory=FeedbackSummary)
    is_mine: bool = False
    is_saved: bool = False
    risk: RiskReport | None = None
    travel: TravelEstimate | None = None


class ListingDetail(ListingOut):
    feedback: list[FeedbackOut] = Field(default_factory=list)
    benchmark: RentBenchmark | None = None
    match: MatchResult | None = None


class FeedItem(BaseModel):
    listing: ListingOut
    match: MatchResult


class ProfileIn(BaseModel):
    budget_max: int = Field(gt=0, le=20000)
    budget_min: int | None = Field(default=None, ge=0)
    move_in: date
    move_out: date | None = None
    preferred_neighborhoods: list[str] = Field(default_factory=list, max_length=12)
    max_distance_miles: float | None = Field(default=None, gt=0, le=30)
    lifestyle: Lifestyle = Field(default_factory=Lifestyle)
    bio: str = Field(default="", max_length=1500)
    is_discoverable: bool = False

    @model_validator(mode="after")
    def _check(self) -> "ProfileIn":
        if self.move_out and self.move_out <= self.move_in:
            raise ValueError("move_out must be after move_in")
        return self


class ProfileOut(ProfileIn):
    pass


class RoommateCard(BaseModel):
    user: PublicUser
    bio: str
    budget_max: int
    move_in: date
    move_out: date | None
    preferred_neighborhoods: list[str]
    lifestyle: Lifestyle
    match: MatchResult


class SwipeIn(BaseModel):
    target_type: Literal["listing", "user"] = "listing"
    target_id: int
    action: Literal["save", "pass"]


class DraftRequest(BaseModel):
    notes: str = Field(min_length=3, max_length=3000)
    listing_type: ListingType = ListingType.SUBLEASE
    monthly_rent: int | None = Field(default=None, gt=0)
    neighborhood: str | None = None
    available_from: date | None = None
    available_to: date | None = None


class DraftResponse(BaseModel):
    title: str = ""
    description: str = ""
    generated_by: str = "offline"


class RiskCheckRequest(BaseModel):
    title: str = ""
    description: str = ""
    monthly_rent: int = Field(gt=0)
    neighborhood: str | None = None
    apartment_id: int | None = None
    has_photos: bool = True


class MapPoint(BaseModel):
    id: int
    title: str
    monthly_rent: int
    listing_type: ListingType
    latitude: float
    longitude: float
    neighborhood: str | None
    travel: TravelEstimate
    photo: str | None = None
