from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.schemas.review import ApartmentInsights, ReviewExtraction, ReviewInput
from app.services.apartment_intelligence import aggregate_reviews, extract_review
from app.services.llm import LLMProvider, get_llm_provider

router = APIRouter(prefix="/apartment-intelligence", tags=["apartment intelligence"])


class ExtractRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)


class InsightsRequest(BaseModel):
    reviews: list[ReviewInput] = Field(max_length=1000)


@router.post("/extract", response_model=ReviewExtraction)
def extract(req: ExtractRequest, llm: LLMProvider = Depends(get_llm_provider)) -> ReviewExtraction:
    """Structured extraction of one review using the configured LLM provider."""
    return extract_review(req.text, llm)


@router.post("/insights", response_model=ApartmentInsights)
def insights(req: InsightsRequest) -> ApartmentInsights:
    """Aggregate extracted reviews into grounded, sample-size-aware insights."""
    return aggregate_reviews(req.reviews)
