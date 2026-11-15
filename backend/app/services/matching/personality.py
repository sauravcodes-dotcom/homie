"""Personality: describing who someone is to live with, and how two people would get along.

Kept separate from lifestyle habits (sleep, cleanliness, smoking): habits say how a home runs,
personality says what living with the people in it is like. Everything here is deterministic
and every score comes with the plain-English reason behind it.
"""

from dataclasses import dataclass, field

from app.schemas.matching import FactorScore, Personality

# (one person, a group of roommates)
ENERGY = {
    1: ("recharges alone", "recharge alone"),
    2: ("is on the quieter side", "are on the quieter side"),
    3: ("likes a mix of social and solo time", "like a mix of social and solo time"),
    4: ("is pretty social", "are pretty social"),
    5: ("is always up for people", "are always up for people"),
}
ENERGY_SHORT = {
    1: "recharge alone",
    2: "on the quieter side",
    3: "a mix of social and solo",
    4: "pretty social",
    5: "always up for people",
}
VIBE = {
    "quiet": ("wants home to be a quiet place", "want home to be a quiet place"),
    "balanced": (
        "likes a home that is social some nights and quiet others",
        "like a home that is social some nights and quiet others",
    ),
    "social": ("likes a lively home with people over", "like a lively home with people over"),
}
STUDY = {
    "at_home": ("studies at home", "study at home"),
    "library": ("studies on campus", "study on campus"),
    "mix": ("studies at home and on campus", "study at home and on campus"),
}
TALK = {
    "direct": ("brings things up right away", "bring things up right away"),
    "easygoing": ("lets small things go", "let small things go"),
}
VIBE_ADJ = {"quiet": "quiet", "balanced": "balanced", "social": "lively"}
TRAIT_LABEL = {
    "organized": "organized",
    "laid_back": "laid-back",
    "talkative": "talkative",
    "reserved": "reserved",
    "spontaneous": "spontaneous",
    "planner": "a planner",
    "homebody": "a homebody",
    "adventurous": "adventurous",
}
INTEREST_LABEL = {"tech": "tech", "faith": "faith community"}
# Trait pairs that pull in opposite directions. Not dealbreakers, but worth a conversation.
OPPOSITES = (("talkative", "reserved"), ("planner", "spontaneous"), ("homebody", "adventurous"))


def _join(items: list[str]) -> str:
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _energy(level: int, them: bool = False) -> str:
    s = ENERGY_SHORT[level]
    if s == "recharge alone":
        return "recharge alone" if them else "someone who recharges alone"
    return ("are " if them else "") + s


def _interest(i: str) -> str:
    return INTEREST_LABEL.get(i, i)


def describe(p: Personality | None, *, plural: bool = False) -> str | None:
    """A couple of sentences about a person, or about a household of roommates when `plural`."""
    if p is None or p.is_empty():
        return None
    k = 1 if plural else 0
    bits = []
    if p.social_energy:
        bits.append(ENERGY[p.social_energy][k])
    if p.home_vibe:
        bits.append(VIBE[p.home_vibe][k])
    if p.study_style:
        bits.append(STUDY[p.study_style][k])
    if p.communication:
        bits.append(TALK[p.communication][k])

    sentences: list[str] = []
    if bits:
        sentences.append(("They " if plural else "Someone who ") + _join(bits) + ".")
    if p.traits:
        t = _join([TRAIT_LABEL[x] for x in p.traits])
        sentences.append("Described as " + t + ".")
    if p.interests:
        sentences.append("Into " + _join([_interest(i) for i in p.interests]) + ".")
    if p.about:
        sentences.append(p.about.strip())
    return " ".join(sentences) or None


@dataclass
class _Tally:
    scores: list[float] = field(default_factory=list)
    good: list[str] = field(default_factory=list)
    talk: list[str] = field(default_factory=list)

    def add(self, score: float, good: str | None = None, talk: str | None = None) -> None:
        self.scores.append(score)
        if score >= 0.75 and good:
            self.good.append(good)
        elif score < 0.75 and talk:
            self.talk.append(talk)


def personality_factor(
    me: Personality | None,
    them: Personality | None,
    *,
    weight: float,
    them_label: str = "they",
) -> tuple[FactorScore, str] | None:
    """Score how two personalities fit. Returns the factor and a sentence for the UI.

    `them_label` reads as the subject for the other side, e.g. "the roommates".
    """
    if me is None or them is None or me.is_empty() or them.is_empty():
        return None
    t = _Tally()
    they = them_label

    if me.social_energy and them.social_energy:
        gap = abs(me.social_energy - them.social_energy)
        t.add(
            1 - gap / 4,
            good="similar social energy" if gap == 0 else "close social energy",
            talk=f"you're {_energy(me.social_energy)}, {they} {_energy(them.social_energy, True)}",
        )

    if me.home_vibe and them.home_vibe:
        if me.home_vibe == them.home_vibe:
            s = 1.0
        elif "balanced" in (me.home_vibe, them.home_vibe):
            s = 0.7
        else:
            s = 0.1
        t.add(
            s,
            good=f"both want a {VIBE_ADJ[me.home_vibe]} home",
            talk=(
                f"you want a {VIBE_ADJ[me.home_vibe]} home, "
                f"{they} want a {VIBE_ADJ[them.home_vibe]} one"
            ),
        )

    if me.study_style and them.study_style:
        if me.study_style == them.study_style:
            s = 1.0
        elif "mix" in (me.study_style, them.study_style):
            s = 0.8
        else:
            s = 0.6
        # Studying at home next to a social household is the real friction.
        if me.study_style == "at_home" and them.home_vibe == "social":
            s = min(s, 0.4)
        t.add(
            s,
            good="study habits line up",
            talk=(
                f"you study at home and {they} keep a lively home"
                if me.study_style == "at_home" and them.home_vibe == "social"
                else f"you {STUDY[me.study_style][1]}, {they} {STUDY[them.study_style][1]}"
            ),
        )

    if me.communication and them.communication:
        same = me.communication == them.communication
        t.add(
            1.0 if same else 0.6,
            good="same way of raising problems",
            talk=f"you {TALK[me.communication][1]}, {they} {TALK[them.communication][1]}",
        )

    if me.traits and them.traits:
        mine, theirs = set(me.traits), set(them.traits)
        clash = [
            (a, b)
            for a, b in OPPOSITES
            if (a in mine and b in theirs) or (b in mine and a in theirs)
        ]
        shared = sorted(mine & theirs)
        s = 0.55 if clash else (1.0 if shared else 0.8)
        if clash:
            a, b = clash[0]
            mine_t, their_t = (a, b) if a in mine else (b, a)
            t.add(s, talk=f"you're {TRAIT_LABEL[mine_t]}, {they} are {TRAIT_LABEL[their_t]}")
        else:
            t.add(s, good=("both " + _join([TRAIT_LABEL[x] for x in shared])) if shared else None)

    if me.interests and them.interests:
        shared = [i for i in me.interests if i in them.interests]
        s = 1.0 if len(shared) >= 2 else 0.8 if shared else 0.5
        t.add(
            s,
            good="both into " + _join([_interest(i) for i in shared]) if shared else None,
            talk="no interests in common yet",
        )

    if not t.scores:
        return None
    score = sum(t.scores) / len(t.scores)
    # A quiet-home person in a party house rarely works out, whatever else lines up.
    if {me.home_vibe, them.home_vibe} == {"quiet", "social"}:
        score = min(score, 0.4)

    parts = []
    if t.good:
        parts.append(_join(t.good))
    if t.talk:
        parts.append("differ: " + "; ".join(t.talk[:2]) + ("; and more" if len(t.talk) > 2 else ""))
    reason = "Personality: " + ("; ".join(parts) if parts else "partly compared")

    fit: list[str] = []
    if t.good:
        g = _join(t.good)
        fit.append(g[0].upper() + g[1:] + ".")
    if t.talk:
        fit.append("Worth talking about: " + "; ".join(t.talk) + ".")
    factor = FactorScore(factor="personality", score=round(score, 3), weight=weight, reason=reason)
    return factor, " ".join(fit)
