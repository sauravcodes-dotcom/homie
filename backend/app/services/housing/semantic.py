"""Embedding helpers for semantic matching."""

from app.services.embeddings import cosine_similarity

# Raw cosine similarity between two unrelated short texts sits near zero and
# two closely related ones rarely exceed ~0.5, so stretch that range to 0-1
# before it is used as a match factor.
SIM_FLOOR = 0.05
SIM_CEIL = 0.50
MIN_TEXT = 20


def listing_text(title: str, description: str) -> str:
    return f"{title}\n{description}".strip()


def worth_embedding(text: str) -> bool:
    return len(text.strip()) >= MIN_TEXT


def calibrated_similarity(a: list[float] | None, b: list[float] | None) -> float | None:
    if not a or not b or len(a) != len(b):
        return None
    sim = cosine_similarity(a, b)
    return max(0.0, min(1.0, (sim - SIM_FLOOR) / (SIM_CEIL - SIM_FLOOR)))
