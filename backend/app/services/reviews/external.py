"""Fallback for buildings with too few HOMIE reviews: summarise public reviews.

A provider fetches a pool of public reviews, we take a random sample, run the
same extraction and aggregation used for HOMIE reviews, and store only the
aggregate. Review text is never persisted.

Provider notes:
- "places" is Google's official Places API. It returns at most 5 reviews per
  place, so a 100-review sample is not possible with it.
- "serpapi" pages through Google Maps reviews via SerpApi (a paid third-party
  service), which is what makes a random sample of 100 possible.
"""

import random
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, date, datetime

import httpx

from app.core.config import Settings
from app.core.errors import AIProviderError, HomieError
from app.models import Apartment
from app.schemas.review import ApartmentInsights, ReviewInput
from app.services.apartment_intelligence import aggregate_reviews, extract_review
from app.services.llm import LLMProvider

# How many of the most recent reviews to pull before sampling.
POOL_MULTIPLIER = 2


@dataclass
class ExternalReview:
    text: str
    rating: float | None
    published: date | None


@dataclass
class ExternalBatch:
    place_id: str | None
    reviews: list[ExternalReview]
    average_rating: float | None


class ExternalReviewProvider(ABC):
    name: str
    source: str = "google"

    @abstractmethod
    def fetch(self, apartment: Apartment, pool_size: int) -> ExternalBatch:
        """Return up to `pool_size` public reviews for the building."""


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None


class GooglePlacesProvider(ExternalReviewProvider):
    name = "places"

    def __init__(self, api_key: str, timeout: float = 15.0):
        self._key = api_key
        self._timeout = timeout

    def fetch(self, apartment: Apartment, pool_size: int) -> ExternalBatch:
        try:
            resp = httpx.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers={
                    "X-Goog-Api-Key": self._key,
                    "X-Goog-FieldMask": "places.id,places.rating,places.reviews",
                },
                json={"textQuery": f"{apartment.name}, {apartment.address}", "pageSize": 1},
                timeout=self._timeout,
            )
            resp.raise_for_status()
            places = resp.json().get("places") or []
        except (httpx.HTTPError, ValueError) as exc:
            raise AIProviderError("Google Places request failed") from exc
        if not places:
            return ExternalBatch(place_id=None, reviews=[], average_rating=None)
        place = places[0]
        reviews = [
            ExternalReview(
                text=(r.get("text") or {}).get("text", ""),
                rating=r.get("rating"),
                published=_parse_date(r.get("publishTime")),
            )
            for r in place.get("reviews") or []
        ]
        return ExternalBatch(
            place_id=place.get("id"),
            reviews=[r for r in reviews if r.text.strip()][:pool_size],
            average_rating=place.get("rating"),
        )


class SerpApiProvider(ExternalReviewProvider):
    name = "serpapi"
    _URL = "https://serpapi.com/search.json"
    _MAX_PAGES = 30

    def __init__(self, api_key: str, timeout: float = 20.0):
        self._key = api_key
        self._timeout = timeout

    def _get(self, params: dict) -> dict:
        try:
            resp = httpx.get(
                self._URL, params={**params, "api_key": self._key}, timeout=self._timeout
            )
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise AIProviderError("SerpApi request failed") from exc

    def fetch(self, apartment: Apartment, pool_size: int) -> ExternalBatch:
        data_id = apartment.google_place_id
        rating = None
        if not data_id:
            found = self._get(
                {
                    "engine": "google_maps",
                    "type": "search",
                    "q": f"{apartment.name} {apartment.address}",
                }
            )
            place = found.get("place_results") or next(iter(found.get("local_results") or []), None)
            if not place or not place.get("data_id"):
                return ExternalBatch(place_id=None, reviews=[], average_rating=None)
            data_id, rating = place["data_id"], place.get("rating")

        reviews: list[ExternalReview] = []
        token: str | None = None
        for _ in range(self._MAX_PAGES):
            params = {"engine": "google_maps_reviews", "data_id": data_id, "sort_by": "newestFirst"}
            if token:
                params |= {"next_page_token": token, "num": 20}
            page = self._get(params)
            rating = rating or (page.get("place_info") or {}).get("rating")
            for r in page.get("reviews") or []:
                text = r.get("snippet") or (r.get("extracted_snippet") or {}).get("original") or ""
                if text.strip():
                    reviews.append(
                        ExternalReview(
                            text=text,
                            rating=r.get("rating"),
                            published=_parse_date(r.get("iso_date")),
                        )
                    )
            token = (page.get("serpapi_pagination") or {}).get("next_page_token")
            if not token or len(reviews) >= pool_size:
                break
        return ExternalBatch(place_id=data_id, reviews=reviews[:pool_size], average_rating=rating)


def build_external_provider(settings: Settings) -> ExternalReviewProvider | None:
    if settings.external_reviews_provider == "places":
        if settings.google_places_api_key is None:
            raise HomieError("EXTERNAL_REVIEWS_PROVIDER=places requires GOOGLE_PLACES_API_KEY")
        return GooglePlacesProvider(settings.google_places_api_key.get_secret_value())
    if settings.external_reviews_provider == "serpapi":
        if settings.serpapi_api_key is None:
            raise HomieError("EXTERNAL_REVIEWS_PROVIDER=serpapi requires SERPAPI_API_KEY")
        return SerpApiProvider(settings.serpapi_api_key.get_secret_value())
    return None


def get_external_provider() -> ExternalReviewProvider | None:
    """FastAPI dependency. Override in tests via app.dependency_overrides."""
    from app.core.config import get_settings

    return build_external_provider(get_settings())


@dataclass
class ExternalResult:
    place_id: str | None
    pool_size: int
    sample_size: int
    average_rating: float | None
    insights: ApartmentInsights


def sample_and_aggregate(
    batch: ExternalBatch,
    llm: LLMProvider,
    *,
    sample_size: int,
    rng: random.Random | None = None,
) -> ExternalResult:
    """Random sample of the pool -> per-review extraction -> aggregate (text discarded)."""
    rng = rng or random.Random()
    pool = batch.reviews
    sample = pool if len(pool) <= sample_size else rng.sample(pool, sample_size)
    today = datetime.now(UTC).date()

    def one(item: tuple[int, ExternalReview]) -> ReviewInput:
        i, review = item
        return ReviewInput(
            review_id=i,
            is_verified_resident=False,
            submitted_on=review.published or today,
            extraction=extract_review(review.text, llm),
        )

    with ThreadPoolExecutor(max_workers=8) as pool_exec:
        inputs = list(pool_exec.map(one, enumerate(sample)))

    insights = aggregate_reviews(inputs)
    # Keep counts only: drop the short quotes so no third-party text is stored.
    for category in insights.categories:
        category.sample_evidence = []
    ratings = [r.rating for r in sample if r.rating is not None]
    return ExternalResult(
        place_id=batch.place_id,
        pool_size=len(pool),
        sample_size=len(sample),
        average_rating=batch.average_rating
        or (round(sum(ratings) / len(ratings), 2) if ratings else None),
        insights=insights,
    )
