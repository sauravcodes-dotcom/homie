"""Keyword-based review extraction used when no LLM is configured.

Much cruder than a model: it only sees listed keywords and simple negation.
It exists so the product works end to end offline and in tests.
"""

import re

from app.schemas.review import CategoryFinding, ReviewCategory, ReviewExtraction

KEYWORDS: dict[ReviewCategory, str] = {
    ReviewCategory.MAINTENANCE: (
        r"maintenance|repairs?|broken|broke|fix(?:ed|es)?|leak(?:s|ing|y)?|plumbing|heater|"
        r"heat|a/?c\b|air condition\w*|elevator|hot water|mold|appliances?"
    ),
    ReviewCategory.PESTS: (
        r"roach(?:es)?|cockroach(?:es)?|mice|mouse|rats?|bed ?bugs?|ants|pests?|infest\w*|"
        r"termites?"
    ),
    ReviewCategory.MANAGEMENT: (
        r"management|landlord|manager|leasing office|front office|staff|property manager|"
        r"deposit"
    ),
    ReviewCategory.SAFETY: (
        r"safe(?:ty)?|unsafe|security|break[- ]?ins?|theft|stolen|robb\w*|gate[ds]?|sketchy|dps"
    ),
    ReviewCategory.CLEANLINESS: r"clean(?:liness)?|dirty|trash|filthy|smell\w*|garbage|gross",
    ReviewCategory.NOISE: r"nois[ey]\w*|loud|quiet|part(?:y|ies)|thin walls",
    ReviewCategory.INTERNET: r"wi-?fi|internet|connection|router",
    ReviewCategory.COST: (
        r"rent|price[ds]?|pricey|expensive|cheap|overpriced|fees?|utilities|affordable|"
        r"worth"
    ),
}
_COMPILED = {c: re.compile(rf"\b(?:{p})\b", re.I) for c, p in KEYWORDS.items()}

_NEG = re.compile(
    r"\b(bad|terrible|awful|horrible|worst|slow|never|ignored?|broken|broke|dirty|filthy|"
    r"gross|loud|noisy|unsafe|sketchy|stolen|theft|robb\w*|break[- ]?ins?|roach\w*|cockroach\w*|"
    r"mice|rats?|bed ?bugs?|infest\w*|mold|leak\w*|expensive|overpriced|pricey|rude|"
    r"unresponsive|issues?|problems?|complain\w*|hate|avoid|scam|drops?|outages?|weeks|"
    r"months|disgusting|smell\w*|unreliable|nightmare|hidden fees?)\b",
    re.I,
)
_POS = re.compile(
    r"\b(good|great|excellent|amazing|love[ds]?|fast|quick(?:ly)?|responsive|clean|quiet|"
    r"safe|secure|friendly|helpful|reliable|affordable|cheap|reasonable|worth|nice|solid|"
    r"best|recommend|no (?:issues|problems|complaints)|never had (?:an? )?(?:issue|problem)s?)\b",
    re.I,
)
_NEGATED_POS = re.compile(
    r"\b(?:not|never|isn'?t|wasn'?t|aren'?t|hardly|barely)\s+(?:\w+\s+){0,2}"
    r"(good|great|clean|quiet|safe|secure|fast|responsive|helpful|reliable|worth|affordable)\b",
    re.I,
)
_SERIOUS = re.compile(
    r"\b(infest\w*|bed ?bugs?|break[- ]?ins?|robb\w*|assault\w*|mold|no (?:hot water|heat)|"
    r"flood\w*|gas leak)\b",
    re.I,
)
_PERSISTENT = re.compile(
    r"\b(always|constantly|every (?:day|night|week)|weeks|months|still|multiple times)\b", re.I
)
_COST = re.compile(r"\$\s?(\d{1,2},?\d{3}|\d{3,4})(?:\s*(?:/|per|a)\s*(?:mo\b|month))?", re.I)
_SENTENCE = re.compile(r"(?<=[.!?])\s+|\n+")


def extract_offline(text: str) -> ReviewExtraction:
    sentences = [s.strip() for s in _SENTENCE.split(text) if s.strip()]
    best: dict[ReviewCategory, tuple[int, int, int, str]] = {}

    for sentence in sentences:
        positive_free = _POS.findall(sentence)
        pos = len(positive_free)
        neg = len(_NEG.findall(sentence))
        # "never had a problem" reads as praise even though it contains negative words.
        if re.search(
            r"\b(no|never had (?:an? |any )?)\s*(issues?|problems?|complaints?)\b", sentence, re.I
        ):
            neg = max(0, neg - 2)
            pos += 1
        flipped = len(_NEGATED_POS.findall(sentence))
        pos, neg = max(0, pos - flipped), neg + flipped
        severity = 3 if _SERIOUS.search(sentence) else 2 if _PERSISTENT.search(sentence) else 1
        for category, pattern in _COMPILED.items():
            if not pattern.search(sentence):
                continue
            p0, n0, sev0, ev0 = best.get(category, (0, 0, 1, sentence))
            best[category] = (p0 + pos, n0 + neg, max(sev0, severity if neg else 1), ev0)

    findings = []
    for category, (pos, neg, severity, evidence) in best.items():
        if pos == 0 and neg == 0:
            continue
        sentiment = (
            "mixed"
            if pos and neg and abs(pos - neg) <= 1
            else ("negative" if neg > pos else "positive")
        )
        findings.append(
            CategoryFinding(
                category=category,
                sentiment=sentiment,
                severity=severity if sentiment != "positive" else 1,
                evidence=evidence[:140],
            )
        )

    cost = None
    for m in _COST.finditer(text):
        window = text[max(0, m.start() - 40) : m.end() + 40].lower()
        if re.search(r"rent|month|/mo|pay|paid|utilities", window):
            cost = float(m.group(1).replace(",", ""))
            break

    return ReviewExtraction(
        findings=findings,
        reported_monthly_cost=cost,
        one_line_summary=sentences[0][:160] if sentences else None,
    )


def detect_categories(question: str) -> list[ReviewCategory]:
    return [c for c, pattern in _COMPILED.items() if pattern.search(question)]
