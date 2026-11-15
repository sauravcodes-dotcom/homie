"""Turn a free-text resident review into a validated ReviewExtraction."""

from app.schemas.review import ReviewCategory, ReviewExtraction
from app.services.llm import LLMProvider, Message

MAX_REVIEW_CHARS = 6000

SYSTEM_PROMPT = f"""You analyse student apartment reviews near USC.
Extract only what the review states. Do not infer or invent problems.
Categories: {", ".join(c.value for c in ReviewCategory)}.
For each category the review actually discusses, add one finding with:
- sentiment: positive, negative or mixed
- severity: 1 (minor) to 3 (serious, e.g. safety incidents, infestations, no heat/water)
- evidence: a short phrase copied from the review
If the reviewer states an all-in monthly cost, set reported_monthly_cost in USD."""


def extract_review(text: str, llm: LLMProvider) -> ReviewExtraction:
    body = text.strip()[:MAX_REVIEW_CHARS]
    if not body:
        return ReviewExtraction()
    return llm.complete_structured(
        [
            Message(role="system", content=SYSTEM_PROMPT),
            Message(role="user", content=f"Review:\n<<<\n{body}\n>>>"),
        ],
        ReviewExtraction,
    )
