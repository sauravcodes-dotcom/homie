from datetime import date

from app.schemas.matching import Lifestyle, ListingCriteria, Personality, SeekerCriteria
from app.services.matching import score_match
from app.services.matching.personality import describe, personality_factor
from app.services.matching.scoring import score_roommates

QUIET = Personality(
    social_energy=2,
    home_vibe="quiet",
    study_style="at_home",
    communication="direct",
    traits=["organized", "reserved"],
    interests=["cooking", "gaming", "reading"],
)
LIVELY = Personality(
    social_energy=5, home_vibe="social", traits=["talkative"], interests=["nightlife"]
)


def _seeker(p: Personality | None) -> SeekerCriteria:
    return SeekerCriteria(
        budget_max=1500, move_in=date(2027, 1, 5), lifestyle=Lifestyle(personality=p)
    )


def _listing(p: Personality | None) -> ListingCriteria:
    return ListingCriteria(
        monthly_rent=1200, available_from=date(2027, 1, 1), lifestyle=Lifestyle(personality=p)
    )


def test_similar_personalities_score_high_and_explain_why() -> None:
    twin = QUIET.model_copy(update={"interests": ["cooking", "gaming"]})
    factor, fit = personality_factor(QUIET, twin, weight=0.2)
    assert factor.score >= 0.9
    assert "both want a quiet home" in fit
    assert "cooking and gaming" in fit


def test_quiet_person_in_party_house_is_capped_and_flagged() -> None:
    factor, fit = personality_factor(QUIET, LIVELY, weight=0.2, them_label="the roommates")
    assert factor.score <= 0.4
    assert "Worth talking about" in fit
    assert "the roommates want a lively one" in fit


def test_listing_match_includes_roommate_personality() -> None:
    good = score_match(_seeker(QUIET), _listing(QUIET))
    bad = score_match(_seeker(QUIET), _listing(LIVELY))
    assert any(f.factor == "personality" for f in good.factors)
    assert good.personality_fit and bad.personality_fit
    assert good.score > bad.score


def test_unknown_roommates_score_neutral() -> None:
    result = score_match(_seeker(QUIET), _listing(None))
    factor = next(f for f in result.factors if f.factor == "personality")
    assert factor.score == 0.5 and factor.weight == 0.1
    assert result.personality_fit is None
    good = score_match(_seeker(QUIET), _listing(QUIET))
    assert good.score > result.score


def test_no_personality_factor_when_seeker_skips_it() -> None:
    result = score_match(_seeker(None), _listing(QUIET))
    assert all(f.factor != "personality" for f in result.factors)


def test_roommate_match_weighs_personality() -> None:
    result = score_roommates(_seeker(QUIET), _seeker(LIVELY), other_id=7)
    factor = next(f for f in result.factors if f.factor == "personality")
    assert factor.weight == 0.35
    assert result.personality_fit


def test_household_description_reads_as_plural() -> None:
    text = describe(QUIET, plural=True)
    assert text.startswith("They are on the quieter side")
    assert "Into cooking, gaming and reading." in text
    assert describe(Personality()) is None


def test_listing_api_returns_household(client) -> None:
    res = client.get("/api/listings", params={"limit": 50})
    assert res.status_code == 200
    assert "household" in res.json()["items"][0]
