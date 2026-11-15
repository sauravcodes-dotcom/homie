from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

SleepSchedule = Literal["early", "flexible", "late"]
Diet = Literal["veg", "non_veg"]


class Lifestyle(BaseModel):
    """Lifestyle signals. Every field is optional; only shared fields are compared."""

    sleep_schedule: SleepSchedule | None = None
    cleanliness: int | None = Field(default=None, ge=1, le=5)
    noise_tolerance: int | None = Field(default=None, ge=1, le=5)
    guests_frequency: int | None = Field(default=None, ge=1, le=5)
    smoking: bool | None = None
    drinking: bool | None = None
    diet: Diet | None = None
    pets: bool | None = None


class SeekerCriteria(BaseModel):
    budget_max: int = Field(gt=0, description="Max monthly rent in USD")
    budget_min: int | None = Field(default=None, ge=0)
    move_in: date
    move_out: date | None = None
    preferred_neighborhoods: list[str] = Field(default_factory=list)
    max_distance_miles: float | None = Field(
        default=None, gt=0, description="Max distance from USC University Park campus"
    )
    lifestyle: Lifestyle = Field(default_factory=Lifestyle)

    @model_validator(mode="after")
    def _check_dates(self) -> "SeekerCriteria":
        if self.move_out and self.move_out <= self.move_in:
            raise ValueError("move_out must be after move_in")
        return self


class ListingCriteria(BaseModel):
    id: str | int | None = None
    monthly_rent: int = Field(gt=0)
    available_from: date
    available_to: date | None = None
    neighborhood: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    lifestyle: Lifestyle = Field(default_factory=Lifestyle)

    @model_validator(mode="after")
    def _check_dates(self) -> "ListingCriteria":
        if self.available_to and self.available_to <= self.available_from:
            raise ValueError("available_to must be after available_from")
        return self


class FactorScore(BaseModel):
    factor: Literal["budget", "dates", "location", "lifestyle", "semantic"]
    score: float = Field(ge=0, le=1)
    weight: float
    reason: str


class MatchResult(BaseModel):
    listing_id: str | int | None = None
    score: int = Field(ge=0, le=100, description="Overall compatibility, 0-100")
    factors: list[FactorScore]
    highlights: list[str] = Field(description="Strongest reasons this is a good fit")
    concerns: list[str] = Field(description="Factors that weaken the match")


class ScoreRequest(BaseModel):
    seeker: SeekerCriteria
    listing: ListingCriteria


class RankRequest(BaseModel):
    seeker: SeekerCriteria
    listings: list[ListingCriteria] = Field(min_length=1, max_length=200)
    limit: int = Field(default=10, ge=1, le=50)
