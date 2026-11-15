"""Aggregate per-review extractions into apartment-level insights.

This is plain counting, not generation: every number the UI or a RAG answer
shows about an apartment should trace back to this function's output, which
always includes sample size, verified count and the reporting period.
"""

from collections import defaultdict
from statistics import median

from app.schemas.review import (
    ApartmentInsights,
    CategoryInsight,
    ReviewCategory,
    ReviewInput,
)

# A category is a recurring issue when at least this many distinct reviews
# report it negatively and they make up at least this share of its mentions.
RECURRING_MIN_REVIEWS = 2
RECURRING_MIN_SHARE = 0.4
MAX_EVIDENCE = 3


def aggregate_reviews(reviews: list[ReviewInput]) -> ApartmentInsights:
    counts: dict[ReviewCategory, dict[str, int]] = defaultdict(
        lambda: {"positive": 0, "negative": 0, "mixed": 0}
    )
    evidence: dict[ReviewCategory, list[str]] = defaultdict(list)
    costs: list[float] = []

    for review in reviews:
        # Count each category at most once per review so one long rant
        # cannot outweigh several independent residents.
        seen: set[ReviewCategory] = set()
        for finding in review.extraction.findings:
            if finding.category in seen:
                continue
            seen.add(finding.category)
            counts[finding.category][finding.sentiment] += 1
            if len(evidence[finding.category]) < MAX_EVIDENCE:
                evidence[finding.category].append(finding.evidence)
        if review.extraction.reported_monthly_cost:
            costs.append(review.extraction.reported_monthly_cost)

    categories = []
    for category in ReviewCategory:
        c = counts.get(category)
        if not c:
            continue
        mentions = sum(c.values())
        share = c["negative"] / mentions
        categories.append(
            CategoryInsight(
                category=category,
                mentions=mentions,
                positive=c["positive"],
                negative=c["negative"],
                mixed=c["mixed"],
                negative_share=round(share, 3),
                is_recurring_issue=c["negative"] >= RECURRING_MIN_REVIEWS
                and share >= RECURRING_MIN_SHARE,
                sample_evidence=evidence[category],
            )
        )

    dates = [r.submitted_on for r in reviews]
    verified = sum(r.is_verified_resident for r in reviews)
    return ApartmentInsights(
        sample_size=len(reviews),
        verified_count=verified,
        unverified_count=len(reviews) - verified,
        period_start=min(dates) if dates else None,
        period_end=max(dates) if dates else None,
        categories=categories,
        recurring_issues=[c.category for c in categories if c.is_recurring_issue],
        median_reported_monthly_cost=median(costs) if costs else None,
    )
