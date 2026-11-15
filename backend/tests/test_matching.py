from datetime import date

from app.schemas.matching import Lifestyle, ListingCriteria, SeekerCriteria
from app.services.matching import rank_listings, score_match

SEEKER = SeekerCriteria(
    budget_max=1200,
    move_in=date(2027, 1, 5),
    move_out=date(2027, 5, 20),
    preferred_neighborhoods=["University Park"],
    lifestyle=Lifestyle(sleep_schedule="early", cleanliness=5, smoking=False),
)


def listing(**overrides) -> ListingCriteria:
    base = dict(
        id="a",
        monthly_rent=1100,
        available_from=date(2027, 1, 1),
        available_to=date(2027, 6, 1),
        neighborhood="University Park",
        lifestyle=Lifestyle(sleep_schedule="early", cleanliness=4, smoking=False),
    )
    base.update(overrides)
    return ListingCriteria(**base)


def test_strong_match_scores_high_and_explains_why():
    result = score_match(SEEKER, listing())
    assert result.score >= 90
    assert any("within" in h for h in result.highlights)
    assert result.concerns == []


def test_over_budget_reduces_score():
    cheap = score_match(SEEKER, listing()).score
    pricey = score_match(SEEKER, listing(monthly_rent=1450)).score
    assert pricey < cheap
    budget = next(
        f for f in score_match(SEEKER, listing(monthly_rent=1500)).factors if f.factor == "budget"
    )
    assert budget.score == 0


def test_non_overlapping_dates_flagged():
    result = score_match(
        SEEKER, listing(available_from=date(2027, 6, 1), available_to=date(2027, 8, 1))
    )
    dates = next(f for f in result.factors if f.factor == "dates")
    assert dates.score == 0
    assert any("do not overlap" in c for c in result.concerns)


def test_smoking_mismatch_caps_lifestyle():
    result = score_match(
        SEEKER, listing(lifestyle=Lifestyle(sleep_schedule="early", cleanliness=5, smoking=True))
    )
    lifestyle = next(f for f in result.factors if f.factor == "lifestyle")
    assert lifestyle.score <= 0.3


def test_distance_used_when_no_neighborhood_match():
    seeker = SEEKER.model_copy(update={"preferred_neighborhoods": [], "max_distance_miles": 1.0})
    near = score_match(seeker, listing(neighborhood=None, latitude=34.025, longitude=-118.285))
    far = score_match(seeker, listing(neighborhood=None, latitude=34.10, longitude=-118.33))
    assert near.score > far.score


def test_rank_orders_best_first():
    results = rank_listings(SEEKER, [listing(id="bad", monthly_rent=2000), listing(id="good")])
    assert [r.listing_id for r in results] == ["good", "bad"]


def test_score_endpoint(client):
    payload = {
        "seeker": SEEKER.model_dump(mode="json"),
        "listing": listing().model_dump(mode="json"),
    }
    resp = client.post("/api/matching/score", json=payload)
    assert resp.status_code == 200
    assert 0 <= resp.json()["score"] <= 100


def test_invalid_dates_rejected(client):
    payload = {
        "seeker": {"budget_max": 1000, "move_in": "2027-05-01", "move_out": "2027-01-01"},
        "listing": listing().model_dump(mode="json"),
    }
    assert client.post("/api/matching/score", json=payload).status_code == 422
