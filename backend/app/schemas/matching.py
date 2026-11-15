from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

SleepSchedule = Literal["early", "flexible", "late"]
Diet = Literal["veg", "non_veg"]
HomeVibe = Literal["quiet", "balanced", "social"]
StudyStyle = Literal["at_home", "library", "mix"]
Communication = Literal["direct", "easygoing"]

# Fixed vocabularies keep personality comparable between people (free text is the bio's job).
TRAITS = (
    "organized",
    "laid_back",
    "talkative",
    "reserved",
    "spontaneous",
    "planner",
    "homebody",
    "adventurous",
)
INTERESTS = (
    "cooking",
    "fitness",
    "gaming",
    "music",
    "movies",
    "outdoors",
    "sports",
    "art",
    "reading",
    "nightlife",
    "tech",
    "faith",
)
Trait = Literal[TRAITS]  # type: ignore[valid-type]
Interest = Literal[INTERESTS]  # type: ignore[valid-type]


class Personality(BaseModel):
    """Who a person is to live with. On a listing it describes the current roommates.
    Every field is optional; only fields both sides filled in are compared."""

    social_energy: int | None = Field(
        default=None, ge=1, le=5, description="1 recharges alone, 5 always around people"
    )
    home_vibe: HomeVibe | None = None
    study_style: StudyStyle | None = None
    communication: Communication | None = Field(
        default=None, description="direct: says it right away; easygoing: lets small things go"
    )
    traits: list[Trait] = Field(default_factory=list, max_length=4)
    interests: list[Interest] = Field(default_factory=list, max_length=6)
    about: str | None = Field(
        default=None, max_length=400, description="Listings: a line about the roommates"
    )

    def is_empty(self) -> bool:
        return not any(
            (
                self.social_energy,
                self.home_vibe,
                self.study_style,
                self.communication,
                self.traits,
                self.interests,
                self.about,
            )
        )


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
    personality: Personality | None = None


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
    factor: Literal["budget", "dates", "location", "lifestyle", "personality", "semantic"]
    score: float = Field(ge=0, le=1)
    weight: float
    reason: str


class MatchResult(BaseModel):
    listing_id: str | int | None = None
    score: int = Field(ge=0, le=100, description="Overall compatibility, 0-100")
    factors: list[FactorScore]
    highlights: list[str] = Field(description="Strongest reasons this is a good fit")
    concerns: list[str] = Field(description="Factors that weaken the match")
    personality_fit: str | None = Field(
        default=None, description="How the two personalities fit, in a sentence or two"
    )


class ScoreRequest(BaseModel):
    seeker: SeekerCriteria
    listing: ListingCriteria


class RankRequest(BaseModel):
    seeker: SeekerCriteria
    listings: list[ListingCriteria] = Field(min_length=1, max_length=200)
    limit: int = Field(default=10, ge=1, le=50)


class ListingMatchRequest(BaseModel):
    seeker: SeekerCriteria
    listing_types: list[Literal["sublease", "lease_takeover", "room", "roommate_replacement"]] = (
        Field(default_factory=list, description="Empty means all types")
    )
    limit: int = Field(default=20, ge=1, le=50)
