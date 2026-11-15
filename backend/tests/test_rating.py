"""Rating engine: matches the reference JS in docs/rating-model.html and
behaves the way the doc promises on the failure modes of a plain average."""

from datetime import UTC, date, datetime

import pytest

from app.services.rating.apartments import review_rating
from app.services.rating.engine import (
    MIN_REVIEWS_FOR_CAMPUS_FIT,
    Rating,
    campus_average,
    estimate,
    fit_prior_mean,
)

R = Rating

# (ratings, score, low, high, rank_key, confidence) from running the doc's
# homie() in Node. The doc uses an erf approximation, hence the tolerance.
GOLDEN = {
    "one_five": ([R(5, "student", 10)], 4.41691, 3.64894, 4.96268, 4.03624, "low"),
    "popular": (
        [R(5 if i % 5 else 4, "verified" if i % 2 else "student", i * 40) for i in range(20)],
        4.72707,
        4.56081,
        4.87629,
        4.62697,
        "high",
    ),
    "review_bomb": (
        [R(4, "verified", 100 + i * 60) for i in range(10)]
        + [R(1, "student", i * 3) for i in range(6)],
        3.88401,
        3.46986,
        4.27948,
        3.58999,
        "high",
    ),
    "new_management": (
        [
            R(1, "verified", 1500),
            R(1, "verified", 1400),
            R(5, "verified", 30),
            R(5, "verified", 60),
        ],
        4.64400,
        4.13731,
        4.98006,
        4.40917,
        "medium",
    ),
    "subleaser": ([R(5, "subleaser", 5)], 4.19429, 3.22203, 4.92477, 3.64894, "low"),
}


@pytest.mark.parametrize("name", GOLDEN)
def test_matches_reference_implementation(name):
    ratings, score, low, high, rank_key, confidence = GOLDEN[name]
    est = estimate(ratings)
    assert est.score == pytest.approx(score, abs=1e-3)
    assert est.low == pytest.approx(low, abs=1e-3)
    assert est.high == pytest.approx(high, abs=1e-3)
    assert est.rank_key == pytest.approx(rank_key, abs=1e-3)
    assert est.confidence == confidence


def test_no_reviews_is_campus_average():
    est = estimate([])
    assert est.score == pytest.approx(campus_average(), abs=1e-9)
    assert est.score == pytest.approx(3.79717, abs=1e-3)
    assert est.review_count == 0


def test_one_five_star_cannot_beat_a_proven_building():
    lucky = estimate([R(5, "verified", 10)])
    proven = estimate([R(5 if i % 5 else 4, "verified", i * 10) for i in range(100)])
    assert proven.rank_key > lucky.rank_key
    assert lucky.high - lucky.low > proven.high - proven.low


def test_burst_of_untrusted_reviews_moves_score_less():
    base = [R(4, "verified", 100 + i * 60) for i in range(10)]
    spread = estimate(base + [R(1, "student", i * 200) for i in range(6)])
    burst = estimate(base + [R(1, "student", i * 3) for i in range(6)])
    assert burst.score > spread.score


def test_burst_check_uses_post_date_not_claimed_stay():
    """Fake reviews posted the same week cannot dodge the burst rule by
    claiming stays years apart."""
    base = [R(4, "verified", 100 + i * 60) for i in range(10)]
    fakes = [R(1, "student", age_days=i * 200, posted_age_days=i) for i in range(6)]
    honest = [R(1, "student", age_days=i * 200) for i in range(6)]
    assert estimate(base + fakes).score > estimate(base + honest).score


def test_old_reviews_count_less():
    now = estimate([R(1, "verified", 0)] * 3 + [R(5, "verified", 0)] * 3)
    stale_bad = estimate([R(1, "verified", 2000)] * 3 + [R(5, "verified", 0)] * 3)
    assert stale_bad.score > now.score


def test_subleaser_hint_is_discounted():
    assert estimate([R(5, "subleaser", 0)]).score < estimate([R(5, "tenant", 0)]).score


def test_bad_input_is_ignored():
    est = estimate([R(0, "verified", 0), R(9, "verified", 0), R(5, "nobody", 0)])  # type: ignore[arg-type]
    assert est.review_count == 0
    assert estimate([R(5, "verified", -30)]).score == estimate([R(5, "verified", 0)]).score


def test_campus_prior_needs_enough_data():
    assert fit_prior_mean(MIN_REVIEWS_FOR_CAMPUS_FIT - 1, 4.6) == 0.0
    assert fit_prior_mean(500, None) == 0.0
    mu = fit_prior_mean(500, 4.4)
    assert campus_average(mu) == pytest.approx(4.4, abs=1e-3)
    assert estimate([], prior_mean=mu).score == pytest.approx(4.4, abs=1e-3)


def test_review_rating_maps_rows():
    today = date(2026, 11, 14)
    posted = datetime(2026, 11, 1, tzinfo=UTC)
    r = review_rating(4, False, posted, date(2024, 11, 14), today)
    assert r.source == "student"
    assert r.age_days == 730 and r.posted_age_days == 13
    # A stay ending after the post date cannot make the review look fresher.
    r = review_rating(4, True, posted, date(2027, 6, 1), today)
    assert r.source == "verified" and r.age_days == 13
    # SQLite gives naive datetimes.
    assert review_rating(4, True, posted.replace(tzinfo=None), None, today).age_days == 13
