import json
from datetime import date

from app.main import app
from app.services.llm import MockLLMProvider, get_llm_provider
from app.services.matching.ai_search import keyword_understand, to_seeker

TODAY = date(2026, 11, 14)


def test_keyword_reader_understands_a_typical_request():
    p = keyword_understand(
        "Vegetarian grad student, quiet, no smoking, budget $1,300, Jan to May, "
        "walking distance to campus in North University Park, furnished with parking",
        TODAY,
    )
    assert p.budget_max == 1300
    assert p.move_in == date(2027, 1, 5)
    assert p.move_out == date(2027, 5, 25)
    assert p.diet == "veg"
    assert p.smoking is False
    assert p.noise_tolerance == 2
    assert p.preferred_neighborhoods == ["North University Park"]
    assert p.near_campus is True
    assert "furnished" in p.must_haves and "parking" in p.must_haves


def test_seasons_and_defaults():
    p = keyword_understand("need a place for summer, I have a dog", TODAY)
    assert p.move_in == date(2027, 5, 20) and p.move_out == date(2027, 8, 15)
    assert p.pets is True
    seeker = to_seeker(keyword_understand("anything cheap", TODAY), TODAY)
    assert seeker.budget_max == 1500


def test_ai_endpoint_without_model_uses_keyword_reader(client):
    body = client.post(
        "/api/matching/ai",
        json={"query": "furnished room under $1200 in spring, vegetarian, no smoking", "limit": 5},
    ).json()
    assert body["used_model"] is False
    assert body["understood"]["budget_max"] == 1200
    assert body["scanned"] >= 201
    assert len(body["results"]) == 5
    assert all(r["why"] for r in body["results"])
    # Must-have words lift listings that mention them.
    assert any("furnished" in r["feature_hits"] for r in body["results"])


def test_ai_endpoint_with_model_parses_reranks_and_explains(client):
    calls = []

    def responder(messages):
        calls.append(messages)
        user = messages[-1].content
        if "Request:" in user:
            return json.dumps(
                {
                    "summary": "Quiet veg-friendly room in spring under $1,250",
                    "budget_max": 1250,
                    "move_in": "2027-01-05",
                    "move_out": "2027-05-20",
                    "diet": "veg",
                    "must_haves": ["balcony"],
                }
            )
        candidates = json.loads(user)["candidates"]
        chosen = candidates[-1]["listing_id"]  # the model may reorder the scorer's list
        return json.dumps(
            {
                "picks": [
                    {"listing_id": chosen, "why": "Under budget and the balcony you asked for."},
                    {"listing_id": 999999, "why": "Hallucinated id, must be dropped."},
                ]
            }
        )

    app.dependency_overrides[get_llm_provider] = lambda: MockScripted(responder)
    try:
        body = client.post(
            "/api/matching/ai", json={"query": "quiet room for spring, veg, balcony", "limit": 4}
        ).json()
    finally:
        app.dependency_overrides.clear()

    assert len(calls) == 2
    assert body["used_model"] is True
    assert body["understood"]["budget_max"] == 1250
    assert body["results"][0]["why"] == "Under budget and the balcony you asked for."
    ids = [r["listing"]["id"] for r in body["results"]]
    assert 999999 not in ids
    assert len(ids) == len(set(ids)) == 4


def test_ai_endpoint_falls_back_when_model_breaks(client):
    app.dependency_overrides[get_llm_provider] = lambda: MockScripted(lambda _: "not json")
    try:
        body = client.post("/api/matching/ai", json={"query": "room under 1400"}).json()
    finally:
        app.dependency_overrides.clear()
    assert body["used_model"] is False
    assert body["note"]
    assert body["understood"]["budget_max"] == 1400
    assert body["results"]


class MockScripted(MockLLMProvider):
    """A scripted provider that counts as a real model (not the offline mock)."""

    name = "scripted"
    model = "scripted-test-model"
