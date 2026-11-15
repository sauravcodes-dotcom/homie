from datetime import date
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class ReviewCategory(StrEnum):
    MAINTENANCE = "maintenance"
    PESTS = "pests"
    MANAGEMENT = "management"
    SAFETY = "safety"
    CLEANLINESS = "cleanliness"
    NOISE = "noise"
    INTERNET = "internet"
    COST = "cost"


class CategoryFinding(BaseModel):
    category: ReviewCategory
    sentiment: Literal["positive", "negative", "mixed"]
    severity: int = Field(default=1, ge=1, le=3, description="1 minor, 3 serious")
    evidence: str = Field(description="Short phrase from the review supporting this finding")


class ReviewExtraction(BaseModel):
    """Structured view of one free-text review, produced by the LLM."""

    findings: list[CategoryFinding] = Field(default_factory=list)
    reported_monthly_cost: float | None = Field(
        default=None, description="All-in monthly cost the reviewer reports, USD"
    )
    one_line_summary: str | None = None


class ReviewInput(BaseModel):
    """A review plus the metadata needed to aggregate it honestly."""

    review_id: int | str
    is_verified_resident: bool = False
    submitted_on: date
    extraction: ReviewExtraction


class CategoryInsight(BaseModel):
    category: ReviewCategory
    mentions: int
    positive: int
    negative: int
    mixed: int
    negative_share: float = Field(ge=0, le=1)
    is_recurring_issue: bool
    sample_evidence: list[str]


class ApartmentInsights(BaseModel):
    """Aggregate view. Always carries sample size and period so the UI can show them."""

    sample_size: int
    verified_count: int
    unverified_count: int
    period_start: date | None
    period_end: date | None
    categories: list[CategoryInsight]
    recurring_issues: list[ReviewCategory]
    median_reported_monthly_cost: float | None
