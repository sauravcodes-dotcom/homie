"""Bayesian star-rating engine, ported from docs/rating-model.html.

Each place has a hidden quality theta. A review is an ordered-probit reading
of theta, mixed with a chance that the review is "junk" (fake, grudge, wrong
building). That chance depends on who wrote it, and rises when untrusted
reviews arrive in a burst. Older reviews count less (two-year half-life).

The posterior is computed exactly on a fixed grid, so the same reviews always
give the same numbers: "numbers are computed, words are generated".

Pure functions only: no database, no I/O. Callers turn rows into `Rating`s.
"""

import math
from dataclasses import dataclass
from functools import cache
from typing import Literal

Source = Literal["verified", "student", "anonymous", "subleaser", "tenant"]
Confidence = Literal["low", "medium", "high"]

GRID: tuple[float, ...] = tuple(-4 + i * 0.05 for i in range(161))
# Star cutpoints on the theta scale and rater noise (doc's MODEL).
CUTPOINTS = (-1.9, -1.2, -0.5, 0.4)
NOISE = 0.75
# What a junk review looks like: mostly 1 or 5 stars.
JUNK_STARS = (0.40, 0.07, 0.06, 0.07, 0.40)
HALF_LIFE_DAYS = 730
# More than BURST_MIN untrusted reviews within +/- BURST_WINDOW_DAYS of each
# other are treated as a possible campaign.
BURST_WINDOW_DAYS = 30
BURST_MIN = 3
BURST_EPS = 0.6
# Campus prior: only fitted to real data once there is enough of it.
MIN_REVIEWS_FOR_CAMPUS_FIT = 50


@dataclass(frozen=True)
class SourceModel:
    eps: float  # chance a review from this source is junk
    bias: float  # how much this source over-rates (theta units)
    noise: float  # extra spread relative to NOISE


SOURCES: dict[str, SourceModel] = {
    "verified": SourceModel(eps=0.03, bias=0.0, noise=1.0),
    "student": SourceModel(eps=0.12, bias=0.0, noise=1.0),
    "anonymous": SourceModel(eps=0.30, bias=0.0, noise=1.0),
    # A subleaser rating their own roommates wants the room taken.
    "subleaser": SourceModel(eps=0.10, bias=0.8, noise=1.3),
    "tenant": SourceModel(eps=0.05, bias=0.0, noise=1.0),
}
TRUSTED = frozenset({"verified", "tenant"})


@dataclass(frozen=True)
class Rating:
    stars: int  # 1-5
    source: Source
    # Age of the experience, used for freshness.
    age_days: float
    # Age of the post itself, used for burst detection. Defaults to age_days.
    # Kept separate so a fake campaign cannot dodge the burst check by
    # back-dating when the reviewers claim to have lived there.
    posted_age_days: float | None = None


@dataclass(frozen=True)
class Estimate:
    score: float  # expected stars, 1-5
    low: float  # 10th percentile, in stars
    high: float  # 90th percentile, in stars
    rank_key: float  # 20th percentile, in stars: the cautious sort key
    confidence: Confidence
    review_count: int
    # Sum of freshness x trust: how many "full" reviews the evidence is worth.
    effective_reviews: float


def _phi(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def _expected_stars(theta: float) -> float:
    return 1 + sum(1 - _phi((t - theta) / NOISE) for t in CUTPOINTS)


EXPECTED_STARS: tuple[float, ...] = tuple(_expected_stars(t) for t in GRID)


@cache
def _likelihood(source: str) -> tuple[tuple[float, ...], ...]:
    """P(k stars | theta) for each star k and grid point, for one source."""
    s = SOURCES[source]
    scale = NOISE * s.noise

    def prob(theta: float, k: int) -> float:
        lo = 0.0 if k == 0 else _phi((CUTPOINTS[k - 1] - theta) / scale)
        hi = 1.0 if k == 4 else _phi((CUTPOINTS[k] - theta) / scale)
        return max(hi - lo, 1e-12)

    return tuple(tuple(prob(t + s.bias, k) for t in GRID) for k in range(5))


def _quantile(post: list[float], q: float) -> int:
    acc = 0.0
    for g, p in enumerate(post):
        acc += p
        if acc >= q:
            return g
    return len(post) - 1


def _prior_log(prior_mean: float) -> list[float]:
    return [-0.5 * (t - prior_mean) ** 2 for t in GRID]


def campus_average(prior_mean: float = 0.0) -> float:
    """Expected stars for a place with no reviews."""
    w = [math.exp(v) for v in _prior_log(prior_mean)]
    z = sum(w)
    return sum(p * s for p, s in zip(w, EXPECTED_STARS, strict=True)) / z


def fit_prior_mean(review_count: int, mean_stars: float | None) -> float:
    """Shift the prior so an unreviewed place starts at the real campus average.

    Below MIN_REVIEWS_FOR_CAMPUS_FIT the doc's default (0.0, about 3.8 stars)
    is used, so a handful of early reviews cannot set the baseline for
    everyone.
    """
    if mean_stars is None or review_count < MIN_REVIEWS_FOR_CAMPUS_FIT:
        return 0.0
    target = min(max(mean_stars, 1.05), 4.95)
    lo, hi = -3.0, 3.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if campus_average(mid) < target:
            lo = mid
        else:
            hi = mid
    return round((lo + hi) / 2, 4)


def estimate(ratings: list[Rating], *, prior_mean: float = 0.0) -> Estimate:
    ratings = [r for r in ratings if 1 <= r.stars <= 5 and r.source in SOURCES]
    lp = _prior_log(prior_mean)

    untrusted_posted = [
        r.posted_age_days if r.posted_age_days is not None else r.age_days
        for r in ratings
        if r.source not in TRUSTED
    ]
    effective = 0.0
    for r in ratings:
        age = max(0.0, r.age_days)
        weight = 0.5 ** (age / HALF_LIFE_DAYS)
        eps = SOURCES[r.source].eps
        if r.source not in TRUSTED:
            posted = r.posted_age_days if r.posted_age_days is not None else r.age_days
            near = sum(1 for o in untrusted_posted if abs(o - posted) <= BURST_WINDOW_DAYS)
            if near > BURST_MIN:
                eps = max(eps, BURST_EPS)
        effective += weight * (1 - eps)

        k = r.stars - 1
        table = _likelihood(r.source)[k]
        junk = JUNK_STARS[k] * eps
        for g in range(len(GRID)):
            lp[g] += weight * math.log((1 - eps) * table[g] + junk)

    top = max(lp)
    post = [math.exp(v - top) for v in lp]
    z = sum(post)
    post = [p / z for p in post]

    mean = sum(p * t for p, t in zip(post, GRID, strict=True))
    var = sum(p * (t - mean) ** 2 for p, t in zip(post, GRID, strict=True))
    score = sum(p * s for p, s in zip(post, EXPECTED_STARS, strict=True))
    # Share of the prior's uncertainty (variance 1) the reviews have removed.
    share = max(0.0, 1 - var)
    confidence: Confidence = "low" if share < 0.5 else "medium" if share < 0.8 else "high"

    return Estimate(
        score=score,
        low=EXPECTED_STARS[_quantile(post, 0.10)],
        high=EXPECTED_STARS[_quantile(post, 0.90)],
        rank_key=EXPECTED_STARS[_quantile(post, 0.20)],
        confidence=confidence,
        review_count=len(ratings),
        effective_reviews=effective,
    )
