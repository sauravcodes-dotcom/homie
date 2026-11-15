"""Turn stored resident reviews into rating-engine estimates."""

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Review
from app.models.base import as_utc
from app.schemas.rating import RatingSummary
from app.services.rating.engine import Estimate, Rating, estimate, fit_prior_mean


def summarize(est: Estimate) -> RatingSummary:
    return RatingSummary(
        score=round(est.score, 2),
        low=round(est.low, 2),
        high=round(est.high, 2),
        rank_key=round(est.rank_key, 2),
        confidence=est.confidence,
        rated_reviews=est.review_count,
    )


def review_rating(
    stars: int,
    is_verified_resident: bool,
    created_at: datetime,
    lived_to: date | None,
    today: date,
) -> Rating:
    posted = as_utc(created_at).date()
    # Freshness follows when the experience happened. lived_to can only make a
    # review older, never newer than its post date.
    experienced = min(lived_to, posted) if lived_to else posted
    return Rating(
        stars=stars,
        # Every HOMIE author is a signed-in USC student; the only stored trust
        # signal is residency verification, so there is no "anonymous" tier yet.
        source="verified" if is_verified_resident else "student",
        age_days=max(0, (today - experienced).days),
        posted_age_days=max(0, (today - posted).days),
    )


def campus_prior(db: Session) -> float:
    count, avg = db.execute(
        select(func.count(Review.overall_rating), func.avg(Review.overall_rating))
    ).one()
    return fit_prior_mean(count or 0, float(avg) if avg is not None else None)


def apartment_ratings(
    db: Session, apartment_ids: list[int], today: date
) -> dict[int, RatingSummary]:
    """Rating summary per apartment that has at least one star rating."""
    if not apartment_ids:
        return {}
    grouped: dict[int, list[Rating]] = {}
    for apt_id, stars, verified, created_at, lived_to in db.execute(
        select(
            Review.apartment_id,
            Review.overall_rating,
            Review.is_verified_resident,
            Review.created_at,
            Review.lived_to,
        ).where(Review.apartment_id.in_(apartment_ids), Review.overall_rating.is_not(None))
    ).all():
        grouped.setdefault(apt_id, []).append(
            review_rating(stars, verified, created_at, lived_to, today)
        )
    if not grouped:
        return {}
    prior = campus_prior(db)
    return {
        apt_id: summarize(estimate(ratings, prior_mean=prior))
        for apt_id, ratings in grouped.items()
    }
