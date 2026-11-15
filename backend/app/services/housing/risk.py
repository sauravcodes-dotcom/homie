"""Scam and red-flag check for a listing.

Deterministic rules, so every flag is explainable and nothing depends on an
LLM being available. A flag is a prompt for the reader to be careful, not an
accusation.
"""

import re

from app.schemas.listing import RentBenchmark, RiskFlag, RiskReport
from app.services.embeddings import cosine_similarity

FAR_BELOW_MARKET = -0.40
COPIED_TEXT_SIMILARITY = 0.92
MIN_TEXT_FOR_COPY_CHECK = 80

_PAYMENT = re.compile(
    r"\b(zelle|venmo|cash\s?app|western union|moneygram|wire (?:transfer|the|me)|gift ?cards?|"
    r"crypto|bitcoin|paypal friends)\b",
    re.I,
)
_UPFRONT = re.compile(
    r"(deposit|payment|first month)[^.]{0,40}\b(before|prior to|without)\b[^.]{0,25}"
    r"\b(view|viewing|tour|seeing|visit)|\b(hold|secure|reserve) (it|the (room|unit|place))"
    r"[^.]{0,30}\b(deposit|payment)",
    re.I,
)
_ABSENT = re.compile(
    r"\b(out of (the )?(country|state)|overseas|abroad for work|missionary|sight unseen|"
    r"can(?:'|no)?t (show|meet)|unable to (show|meet)|mail (you )?the keys?)\b",
    re.I,
)
_CONTACT = re.compile(
    r"\b(whats\s?app|telegram|signal|text me|call me|dm me on|instagram|snap(chat)?)\b|"
    r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\(\d{3}\)\s?\d{3}[-.\s]\d{4}|[\w.+-]+@[\w-]+\.[\w.]+",
    re.I,
)


def assess_risk(
    *,
    title: str,
    description: str,
    benchmark: RentBenchmark | None,
    has_photos: bool,
    embedding: list[float] | None = None,
    other_embeddings: list[list[float]] | None = None,
) -> RiskReport:
    text = f"{title}\n{description}"
    flags: list[RiskFlag] = []

    if benchmark and benchmark.diff_pct <= FAR_BELOW_MARKET:
        flags.append(
            RiskFlag(
                code="far_below_market",
                severity="high",
                message=(
                    f"Rent is {abs(benchmark.diff_pct):.0%} below the median for "
                    f"{benchmark.scope_label} ({benchmark.sample_size} listings)."
                ),
            )
        )
    if _UPFRONT.search(text):
        flags.append(
            RiskFlag(
                code="payment_before_viewing",
                severity="high",
                message="Asks for money before you can see the place.",
            )
        )
    if _ABSENT.search(text):
        flags.append(
            RiskFlag(
                code="cannot_show",
                severity="high",
                message="The lister says they cannot show the place in person.",
            )
        )
    if m := _PAYMENT.search(text):
        flags.append(
            RiskFlag(
                code="off_platform_payment",
                severity="medium",
                message=f'Mentions "{m.group(0).strip()}". Never pay before signing and seeing '
                "the unit.",
            )
        )
    if _CONTACT.search(text):
        flags.append(
            RiskFlag(
                code="off_platform_contact",
                severity="medium",
                message="Pushes contact off HOMIE. Messages here keep a record.",
            )
        )
    if (
        embedding
        and other_embeddings
        and len(description) >= MIN_TEXT_FOR_COPY_CHECK
        and any(cosine_similarity(embedding, o) >= COPIED_TEXT_SIMILARITY for o in other_embeddings)
    ):
        flags.append(
            RiskFlag(
                code="copied_text",
                severity="medium",
                message="The description closely matches another lister's post.",
            )
        )
    if not has_photos:
        flags.append(
            RiskFlag(code="no_photos", severity="low", message="No photos yet. Ask for some.")
        )

    highs = sum(f.severity == "high" for f in flags)
    mediums = sum(f.severity == "medium" for f in flags)
    level = "high" if highs or mediums >= 2 else "medium" if mediums else "low"
    return RiskReport(level=level, flags=flags)
