import json
from datetime import date

import pytest

from app.core.errors import AIProviderError
from app.main import app
from app.schemas.review import CategoryFinding, ReviewExtraction, ReviewInput
from app.services.apartment_intelligence import aggregate_reviews, extract_review
from app.services.llm import MockLLMProvider, get_llm_provider


def finding(category, sentiment, evidence="..."):
    return CategoryFinding(category=category, sentiment=sentiment, evidence=evidence)


def review(rid, findings, verified=False, day=1, cost=None):
    return ReviewInput(
        review_id=rid,
        is_verified_resident=verified,
        submitted_on=date(2026, 9, day),
        extraction=ReviewExtraction(findings=findings, reported_monthly_cost=cost),
    )


def test_aggregation_reports_sample_size_and_period():
    insights = aggregate_reviews(
        [
            review(
                1,
                [finding("pests", "negative", "roaches in kitchen")],
                verified=True,
                day=3,
                cost=1300,
            ),
            review(2, [finding("pests", "negative", "saw a mouse")], day=10, cost=1500),
            review(
                3,
                [finding("pests", "positive"), finding("internet", "positive")],
                verified=True,
                day=20,
            ),
        ]
    )
    assert insights.sample_size == 3
    assert insights.verified_count == 2
    assert insights.period_start == date(2026, 9, 3)
    assert insights.period_end == date(2026, 9, 20)
    assert insights.recurring_issues == ["pests"]
    assert insights.median_reported_monthly_cost == 1400
    pests = next(c for c in insights.categories if c.category == "pests")
    assert pests.mentions == 3 and pests.negative == 2


def test_single_complaint_is_not_recurring():
    insights = aggregate_reviews([review(1, [finding("noise", "negative")])])
    assert insights.recurring_issues == []


def test_duplicate_findings_in_one_review_counted_once():
    insights = aggregate_reviews(
        [review(1, [finding("noise", "negative"), finding("noise", "negative")])]
    )
    assert insights.categories[0].mentions == 1


def test_extract_review_validates_llm_output():
    scripted = {
        "findings": [
            {
                "category": "maintenance",
                "sentiment": "negative",
                "severity": 2,
                "evidence": "AC broken for two weeks",
            }
        ],
        "reported_monthly_cost": 1250,
    }
    llm = MockLLMProvider(lambda _: json.dumps(scripted))
    result = extract_review("AC broken for two weeks. I pay about $1250 all in.", llm)
    assert result.findings[0].category == "maintenance"
    assert result.reported_monthly_cost == 1250


def test_extract_review_rejects_malformed_output():
    llm = MockLLMProvider(lambda _: '{"findings": [{"category": "parking"}]}')
    with pytest.raises(AIProviderError):
        extract_review("Parking is impossible", llm)


def test_extract_endpoint_maps_provider_errors_to_502(client):
    app.dependency_overrides[get_llm_provider] = lambda: MockLLMProvider(lambda _: "not json")
    try:
        resp = client.post("/api/apartment-intelligence/extract", json={"text": "hello"})
    finally:
        app.dependency_overrides.clear()
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "ai_provider_error"
