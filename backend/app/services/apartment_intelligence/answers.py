"""Summaries and question answering over a building's reviews.

Counts always come from `aggregate_reviews`, never from the model. With a real
LLM configured the model only words the answer and must stay inside the
supplied evidence; offline, answers are assembled from the counts directly.
"""

from dataclasses import dataclass
from datetime import date

from pydantic import BaseModel, Field

from app.schemas.review import ApartmentInsights, CategoryInsight
from app.services.apartment_intelligence.offline import detect_categories
from app.services.embeddings import EmbeddingProvider, cosine_similarity
from app.services.llm import LLMProvider, Message

THIN_EVIDENCE = 3
MAX_CITATIONS = 4


@dataclass
class ReviewDoc:
    review_id: int
    body: str
    is_verified_resident: bool
    submitted_on: date
    embedding: list[float] | None
    extraction: dict | None


class Citation(BaseModel):
    review_id: int
    quote: str
    is_verified_resident: bool
    submitted_on: date


class Answer(BaseModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    sample_size: int
    verified_count: int
    source: str = Field(description='"homie", "google" or "none"')
    generated_by: str


def _label(c: CategoryInsight) -> str:
    return c.category.value


def summarize(insights: ApartmentInsights, llm: LLMProvider, *, source_label: str) -> str:
    """Two or three sentences on what reviewers say, grounded in the aggregate."""
    if insights.sample_size == 0:
        return ""
    if not llm.offline:
        return llm.complete(
            [
                Message(
                    role="system",
                    content=(
                        "You summarise apartment review statistics for USC students in 2-3 "
                        "plain sentences. Use only the numbers in the JSON. Mention the sample "
                        "size. Do not invent details. No bullet points."
                    ),
                ),
                Message(
                    role="user",
                    content=f"Source: {source_label}\n{insights.model_dump_json()}",
                ),
            ],
            temperature=0.2,
        ).strip()

    cats = insights.categories
    recurring = [c for c in cats if c.is_recurring_issue]
    praised = sorted(
        (c for c in cats if c.positive > c.negative and c.positive >= 2),
        key=lambda c: c.positive,
        reverse=True,
    )[:2]
    parts = [f"Based on {insights.sample_size} {source_label}."]
    if recurring:
        parts.append(
            "Recurring complaints: "
            + ", ".join(
                f"{_label(c)} ({c.negative} of {c.mentions} mentions negative)" for c in recurring
            )
            + "."
        )
    else:
        parts.append("No complaint comes up often enough to count as recurring.")
    if praised:
        parts.append(
            "Most praised: "
            + ", ".join(f"{_label(c)} ({c.positive} positive)" for c in praised)
            + "."
        )
    if insights.median_reported_monthly_cost:
        parts.append(
            f"Median monthly cost reported: ${insights.median_reported_monthly_cost:,.0f}."
        )
    return " ".join(parts)


def _category_sentence(c: CategoryInsight) -> str:
    text = (
        f"{c.negative} of the {c.mentions} reviews that mention {_label(c)} were negative"
        f" and {c.positive} were positive"
    )
    if c.mentions < THIN_EVIDENCE:
        text += ". That is too few to draw a conclusion"
    elif c.is_recurring_issue:
        text += ", so this looks like a recurring problem"
    elif c.negative_share <= 0.2:
        text += ", so it does not look like a common problem"
    return text + "."


def _top_docs(
    question: str, docs: list[ReviewDoc], embedder: EmbeddingProvider, categories: list
) -> list[ReviewDoc]:
    q = embedder.embed_one(question)
    wanted = {c.value for c in categories}

    def rank(d: ReviewDoc) -> float:
        sim = cosine_similarity(q, d.embedding) if d.embedding and len(d.embedding) == len(q) else 0
        cats = {f.get("category") for f in (d.extraction or {}).get("findings", [])}
        return sim + (1.0 if wanted & cats else 0.0) + (0.1 if d.is_verified_resident else 0.0)

    return sorted(docs, key=rank, reverse=True)[:MAX_CITATIONS]


def _quote(doc: ReviewDoc, categories: list) -> str:
    wanted = {c.value for c in categories}
    for f in (doc.extraction or {}).get("findings", []):
        if f.get("category") in wanted and f.get("evidence"):
            return f["evidence"]
    return doc.body.strip()[:160]


def answer_question(
    question: str,
    *,
    insights: ApartmentInsights,
    docs: list[ReviewDoc],
    source: str,
    llm: LLMProvider,
    embedder: EmbeddingProvider,
) -> Answer:
    base = {
        "sample_size": insights.sample_size,
        "verified_count": insights.verified_count,
        "source": source,
    }
    if insights.sample_size == 0:
        return Answer(
            answer="There are no reviews for this building yet, so HOMIE cannot answer that.",
            generated_by="offline",
            **{**base, "source": "none"},
        )

    categories = detect_categories(question)
    top = _top_docs(question, docs, embedder, categories) if docs else []
    citations = [
        Citation(
            review_id=d.review_id,
            quote=_quote(d, categories),
            is_verified_resident=d.is_verified_resident,
            submitted_on=d.submitted_on,
        )
        for d in top
    ]
    origin = (
        f"{insights.sample_size} HOMIE reviews ({insights.verified_count} from verified residents)"
        if source == "homie"
        else f"a sample of {insights.sample_size} public Google reviews (not verified residents)"
    )

    if not llm.offline:
        evidence = "\n".join(
            f"[{i + 1}] ({'verified' if c.is_verified_resident else 'unverified'}, "
            f"{c.submitted_on}) {d.body.strip()[:600]}"
            for i, (c, d) in enumerate(zip(citations, top, strict=True))
        )
        text = llm.complete(
            [
                Message(
                    role="system",
                    content=(
                        "You answer questions about one apartment building for USC students. "
                        "Use only the statistics and review excerpts provided. State how many "
                        "reviews the answer rests on. Cite excerpts as [1], [2]. If the "
                        "evidence is thin or does not cover the question, say so plainly. "
                        "3 sentences maximum."
                    ),
                ),
                Message(
                    role="user",
                    content=(
                        f"Question: {question}\n\nEvidence base: {origin}\n"
                        f"Statistics: {insights.model_dump_json()}\n\nExcerpts:\n"
                        f"{evidence or '(none available)'}"
                    ),
                ),
            ],
            temperature=0.1,
        ).strip()
        return Answer(answer=text, citations=citations, generated_by=llm.name, **base)

    by_cat = {c.category: c for c in insights.categories}
    hits = [by_cat[c] for c in categories if c in by_cat]
    if hits:
        text = f"From {origin}: " + " ".join(_category_sentence(c) for c in hits)
    elif categories:
        text = (
            f"None of the {origin} mention {', '.join(c.value for c in categories)}, "
            "so there is no evidence either way."
        )
    elif citations:
        text = (
            f"HOMIE could not map that to a review topic, so here are the closest passages "
            f"from {origin}."
        )
    else:
        text = f"HOMIE could not find anything about that in {origin}."
    return Answer(answer=text, citations=citations, generated_by="offline", **base)
