"""Explainable seeker-to-listing compatibility scoring.

Each factor yields a 0-1 score and a human-readable reason. The overall score
is a weighted mean over the factors that have data, so a sparse profile is
not penalised for fields the user never filled in. An LLM can later rephrase
these reasons, but the numbers themselves stay deterministic and auditable.
"""

import math
from datetime import date, timedelta

from app.schemas.matching import (
    FactorScore,
    Lifestyle,
    ListingCriteria,
    MatchResult,
    SeekerCriteria,
)

# USC University Park Campus (Tommy Trojan).
USC_LAT, USC_LNG = 34.0205, -118.2856

WEIGHTS = {
    "budget": 0.30,
    "dates": 0.25,
    "location": 0.20,
    "lifestyle": 0.25,
    "semantic": 0.15,
}

# Rent this far above budget scores zero.
BUDGET_TOLERANCE = 0.25
# Open-ended seeker stays are assumed to be one academic year.
DEFAULT_STAY = timedelta(days=330)


def score_match(
    seeker: SeekerCriteria,
    listing: ListingCriteria,
    *,
    semantic_similarity: float | None = None,
) -> MatchResult:
    factors = [
        _budget(seeker, listing),
        _dates(seeker, listing),
        _location(seeker, listing),
    ]
    lifestyle = _lifestyle(seeker.lifestyle, listing.lifestyle)
    if lifestyle:
        factors.append(lifestyle)
    if semantic_similarity is not None:
        sim = max(0.0, min(1.0, semantic_similarity))
        factors.append(
            FactorScore(
                factor="semantic",
                score=round(sim, 3),
                weight=WEIGHTS["semantic"],
                reason=f"Profile and listing descriptions are {_qualify(sim)} similar",
            )
        )

    total_weight = sum(f.weight for f in factors)
    overall = sum(f.score * f.weight for f in factors) / total_weight
    ranked = sorted(factors, key=lambda f: f.score, reverse=True)
    return MatchResult(
        listing_id=listing.id,
        score=round(overall * 100),
        factors=factors,
        highlights=[f.reason for f in ranked if f.score >= 0.75],
        concerns=[f.reason for f in reversed(ranked) if f.score < 0.5],
    )


def rank_listings(
    seeker: SeekerCriteria, listings: list[ListingCriteria], limit: int = 10
) -> list[MatchResult]:
    results = [score_match(seeker, listing) for listing in listings]
    results.sort(key=lambda r: r.score, reverse=True)
    return results[:limit]


def _budget(seeker: SeekerCriteria, listing: ListingCriteria) -> FactorScore:
    rent, cap = listing.monthly_rent, seeker.budget_max
    if rent <= cap:
        score = 1.0
        reason = f"${rent:,}/mo is within the ${cap:,} budget"
    else:
        over = (rent - cap) / cap
        score = max(0.0, 1 - over / BUDGET_TOLERANCE)
        reason = f"${rent:,}/mo is {over:.0%} over the ${cap:,} budget"
    return FactorScore(
        factor="budget", score=round(score, 3), weight=WEIGHTS["budget"], reason=reason
    )


def _dates(seeker: SeekerCriteria, listing: ListingCriteria) -> FactorScore:
    want_start = seeker.move_in
    want_end = seeker.move_out or seeker.move_in + DEFAULT_STAY
    have_start = listing.available_from
    have_end = listing.available_to or date.max

    overlap = (min(want_end, have_end) - max(want_start, have_start)).days
    needed = (want_end - want_start).days
    score = max(0.0, overlap / needed) if needed > 0 else 0.0

    if score >= 0.95:
        reason = "Lease dates cover the whole requested stay"
    elif score == 0:
        reason = "Lease dates do not overlap the requested stay"
    else:
        reason = f"Lease dates cover {score:.0%} of the requested stay"
    return FactorScore(
        factor="dates", score=round(score, 3), weight=WEIGHTS["dates"], reason=reason
    )


def _location(seeker: SeekerCriteria, listing: ListingCriteria) -> FactorScore:
    w = WEIGHTS["location"]
    preferred = {n.strip().lower() for n in seeker.preferred_neighborhoods}
    hood = (listing.neighborhood or "").strip().lower()

    if hood and hood in preferred:
        return FactorScore(
            factor="location",
            score=1.0,
            weight=w,
            reason=f"In a preferred area ({listing.neighborhood})",
        )

    if seeker.max_distance_miles and listing.latitude is not None and listing.longitude is not None:
        miles = _haversine_miles(USC_LAT, USC_LNG, listing.latitude, listing.longitude)
        limit = seeker.max_distance_miles
        score = 1.0 if miles <= limit else max(0.0, 1 - (miles - limit) / limit)
        return FactorScore(
            factor="location",
            score=round(score, 3),
            weight=w,
            reason=f"{miles:.1f} mi from campus (limit {limit:g} mi)",
        )

    if preferred and hood:
        return FactorScore(
            factor="location",
            score=0.3,
            weight=w,
            reason=f"{listing.neighborhood} is not a preferred area",
        )
    return FactorScore(
        factor="location", score=0.5, weight=w, reason="Not enough location detail to compare"
    )


def _lifestyle(a: Lifestyle, b: Lifestyle) -> FactorScore | None:
    scores: list[float] = []
    clashes: list[str] = []
    agreements: list[str] = []

    def scale(field: str, label: str) -> None:
        x, y = getattr(a, field), getattr(b, field)
        if x is None or y is None:
            return
        s = 1 - abs(x - y) / 4
        scores.append(s)
        (agreements if s >= 0.75 else clashes).append(label)

    def flag(field: str, label: str) -> None:
        x, y = getattr(a, field), getattr(b, field)
        if x is None or y is None:
            return
        scores.append(1.0 if x == y else 0.0)
        (agreements if x == y else clashes).append(label)

    if a.sleep_schedule and b.sleep_schedule:
        if a.sleep_schedule == b.sleep_schedule:
            s = 1.0
        elif "flexible" in (a.sleep_schedule, b.sleep_schedule):
            s = 0.7
        else:
            s = 0.2
        scores.append(s)
        (agreements if s >= 0.75 else clashes).append("sleep schedule")

    scale("cleanliness", "cleanliness")
    scale("noise_tolerance", "noise tolerance")
    scale("guests_frequency", "guest frequency")
    flag("smoking", "smoking")
    flag("drinking", "drinking")
    flag("pets", "pets")

    # Diet matters mostly for a shared kitchen: a mismatch is a real
    # friction point but rarely a dealbreaker on its own.
    if a.diet and b.diet:
        s = 1.0 if a.diet == b.diet else 0.4
        scores.append(s)
        (agreements if s >= 0.75 else clashes).append("diet")

    if not scores:
        return None

    score = sum(scores) / len(scores)
    # A smoking mismatch is usually a dealbreaker, so cap the factor.
    if "smoking" in clashes:
        score = min(score, 0.3)

    parts = []
    if agreements:
        parts.append("aligned on " + ", ".join(agreements))
    if clashes:
        parts.append("differ on " + ", ".join(clashes))
    reason = "Lifestyle: " + "; ".join(parts)
    return FactorScore(
        factor="lifestyle", score=round(score, 3), weight=WEIGHTS["lifestyle"], reason=reason
    )


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _qualify(sim: float) -> str:
    return "highly" if sim >= 0.75 else "moderately" if sim >= 0.5 else "not very"


def score_roommates(
    me: SeekerCriteria,
    other: SeekerCriteria,
    *,
    other_id: int | None = None,
    semantic_similarity: float | None = None,
) -> MatchResult:
    """Compatibility between two seekers who might share a place."""
    factors: list[FactorScore] = []

    lo, hi = sorted((me.budget_max, other.budget_max))
    budget = lo / hi
    factors.append(
        FactorScore(
            factor="budget",
            score=round(budget, 3),
            weight=WEIGHTS["budget"],
            reason=(
                "Budgets are close" if budget >= 0.85 else f"Budgets differ (${lo:,} vs ${hi:,})"
            ),
        )
    )

    gap = abs((me.move_in - other.move_in).days)
    dates = max(0.0, 1 - gap / 90)
    factors.append(
        FactorScore(
            factor="dates",
            score=round(dates, 3),
            weight=WEIGHTS["dates"],
            reason=(
                "Move-in dates line up" if gap <= 14 else f"Move-in dates are {gap} days apart"
            ),
        )
    )

    mine = {n.strip().lower() for n in me.preferred_neighborhoods}
    theirs = {n.strip().lower() for n in other.preferred_neighborhoods}
    if mine and theirs:
        shared = mine & theirs
        factors.append(
            FactorScore(
                factor="location",
                score=1.0 if shared else 0.3,
                weight=WEIGHTS["location"],
                reason=(
                    f"Both want {', '.join(sorted(shared)).title()}"
                    if shared
                    else "No preferred areas in common"
                ),
            )
        )

    lifestyle = _lifestyle(me.lifestyle, other.lifestyle)
    if lifestyle:
        # Day-to-day habits matter most between people sharing a home.
        factors.append(lifestyle.model_copy(update={"weight": 0.40}))
    if semantic_similarity is not None:
        sim = max(0.0, min(1.0, semantic_similarity))
        factors.append(
            FactorScore(
                factor="semantic",
                score=round(sim, 3),
                weight=WEIGHTS["semantic"],
                reason=f"Your bios are {_qualify(sim)} similar",
            )
        )

    total = sum(f.weight for f in factors)
    overall = sum(f.score * f.weight for f in factors) / total
    ranked = sorted(factors, key=lambda f: f.score, reverse=True)
    return MatchResult(
        listing_id=other_id,
        score=round(overall * 100),
        factors=factors,
        highlights=[f.reason for f in ranked if f.score >= 0.75],
        concerns=[f.reason for f in reversed(ranked) if f.score < 0.5],
    )
