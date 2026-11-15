"""AI listing writer: rough notes in, clean title and description out."""

import re

from app.schemas.listing import DraftRequest, DraftResponse
from app.services.llm import LLMProvider, Message

SYSTEM_PROMPT = """You write student housing listings near USC.
Turn the lister's rough notes into a clear title (max 70 characters) and a
description of 60-140 words. Use only facts from the notes and the given fields.
Do not invent amenities, distances or prices. Plain, friendly, no hype, no emojis,
no contact details and no payment instructions."""

_TYPE_LABEL = {
    "sublease": "Sublease",
    "lease_takeover": "Lease takeover",
    "room": "Room",
    "roommate_replacement": "Roommate wanted",
}


def draft_listing(req: DraftRequest, llm: LLMProvider) -> DraftResponse:
    if llm.offline:
        return _offline(req)
    facts = [f"Type: {_TYPE_LABEL[req.listing_type.value]}"]
    if req.monthly_rent:
        facts.append(f"Rent: ${req.monthly_rent}/month")
    if req.neighborhood:
        facts.append(f"Neighborhood: {req.neighborhood}")
    if req.available_from:
        facts.append(f"Available from: {req.available_from.isoformat()}")
    if req.available_to:
        facts.append(f"Available to: {req.available_to.isoformat()}")
    draft = llm.complete_structured(
        [
            Message(role="system", content=SYSTEM_PROMPT),
            Message(
                role="user",
                content="Fields:\n" + "\n".join(facts) + f"\n\nNotes:\n<<<\n{req.notes}\n>>>",
            ),
        ],
        DraftResponse,
        temperature=0.4,
    )
    draft.generated_by = llm.name
    draft.title = draft.title[:200]
    return draft


def _offline(req: DraftRequest) -> DraftResponse:
    """No model configured: tidy the notes into sentences instead of generating text."""
    label = _TYPE_LABEL[req.listing_type.value]
    where = f" in {req.neighborhood}" if req.neighborhood else " near USC"
    price = f", ${req.monthly_rent:,}/mo" if req.monthly_rent else ""
    title = f"{label}{where}{price}"

    parts = [p.strip(" -*\t") for p in re.split(r"[\n;]+|(?<=[.!?])\s+", req.notes)]
    sentences = []
    for p in parts:
        if not p:
            continue
        p = p[0].upper() + p[1:]
        sentences.append(p if p[-1] in ".!?" else p + ".")
    lead = f"{label}{where}."
    if req.available_from:
        end = f" to {req.available_to:%b %-d, %Y}" if req.available_to else ""
        lead += f" Available {req.available_from:%b %-d, %Y}{end}."
    return DraftResponse(
        title=title[:200], description=" ".join([lead, *sentences]), generated_by="offline"
    )
