"""Fair-price check: how a listing's rent compares with genuinely similar listings.

"Similar" means the same kind of space (a private room in a unit with the same number of
bedrooms, a studio, or a whole unit of the same size), in the same walking-distance band to
campus, and available around the same time. When there are too few of those, the comparison
widens one step at a time, and the result always says exactly what it was compared against,
so a badge never claims more precision than the data has.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import date
from statistics import median, quantiles

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Listing
from app.models.listing import ListingType
from app.schemas.listing import FairPrice
from app.services.housing.geo import travel_to_campus

MIN_COMPARABLES = 5
FAIR_BAND = 0.07  # within 7% of the median reads as a fair price
SAME_TIME_DAYS = 45
CACHE_SECONDS = 60

_BEDS = re.compile(r"\b(\d)\s*-?\s*(?:bed(?:room)?s?|br|bd)\b", re.I)
_WORD_BEDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
_WORD = re.compile(r"\b(one|two|three|four|five|six)[\s-]+bed(?:room)?s?\b", re.I)
_WHOLE = re.compile(r"\b(whole|entire|full)\b.*\b(unit|apartment|house|place)\b", re.I)


@dataclass(frozen=True)
class Space:
    kind: str  # "room" | "studio" | "whole"
    beds: int | None

    def label(self, with_beds: bool) -> str:
        if self.kind == "studio":
            return "studios"
        if self.kind == "whole":
            if with_beds and self.beds == 1:
                return "1-bed apartments"
            return f"whole {self.beds}-bed units" if with_beds and self.beds else "whole units"
        return f"private rooms in {self.beds}-beds" if with_beds and self.beds else "private rooms"


def classify(listing_type: ListingType | str, title: str, description: str = "") -> Space:
    """What kind of space is on offer, read from the listing type and its wording."""
    text = f"{title} {description[:300]}"
    beds = None
    if m := _BEDS.search(text):
        beds = int(m.group(1))
    elif m := _WORD.search(text):
        beds = _WORD_BEDS[m.group(1).lower()]
    if re.search(r"\bstudio\b", text, re.I):
        return Space("studio", 0)
    ltype = ListingType(listing_type)
    whole = bool(_WHOLE.search(title)) or (
        ltype == ListingType.LEASE_TAKEOVER and not re.search(r"\broom\b", title, re.I)
    )
    if whole:
        return Space("whole", beds)
    return Space("room", beds)


def distance_band(walk_minutes: int | None) -> tuple[int, str] | None:
    if walk_minutes is None:
        return None
    if walk_minutes <= 10:
        return 0, "within a 10-minute walk"
    if walk_minutes <= 20:
        return 1, "a 10 to 20 minute walk away"
    return 2, "more than a 20-minute walk away"


@dataclass(frozen=True)
class _Row:
    id: int
    rent: int
    space: Space
    band: int | None
    start: date


_cache: dict[str, object] = {}


def _index(db: Session) -> list[_Row]:
    """Every active listing that can serve as a comparable, cached briefly per data version."""
    version = db.execute(
        select(func.count(Listing.id), func.max(Listing.id), func.sum(Listing.monthly_rent)).where(
            Listing.is_active.is_(True)
        )
    ).one()
    key = ":".join(str(v) for v in version)
    now = time.monotonic()
    if _cache.get("key") == key and now - float(_cache.get("at", 0)) < CACHE_SECONDS:
        return _cache["rows"]  # type: ignore[return-value]

    rows: list[_Row] = []
    query = select(
        Listing.id,
        Listing.monthly_rent,
        Listing.listing_type,
        Listing.title,
        Listing.latitude,
        Listing.longitude,
        Listing.available_from,
        Listing.risk,
    ).where(Listing.is_active.is_(True))
    for lid, rent, ltype, title, lat, lng, start, risk in db.execute(query).all():
        # A scam's bait price is not a market price.
        if (risk or {}).get("level") == "high":
            continue
        travel = travel_to_campus(lat, lng)
        band = distance_band(travel.walk_minutes if travel else None)
        rows.append(_Row(lid, rent, classify(ltype, title), band[0] if band else None, start))
    _cache.update(key=key, at=now, rows=rows)
    return rows


def _verdict(rent: int, rents: list[int], what: str, where: str | None, when: bool) -> FairPrice:
    mid = median(rents)
    q = quantiles(rents, n=4, method="inclusive") if len(rents) > 1 else [mid, mid, mid]
    diff = rent - mid
    pct = diff / mid
    verdict = "fair" if abs(pct) <= FAIR_BAND else ("below" if pct < 0 else "above")
    scope = " ".join(
        p
        for p in (f"similar {what}", where, "starting around the same time" if when else None)
        if p
    )
    amount = f"${abs(round(diff / 5) * 5):,}"
    direction = "below" if diff < 0 else "above"
    if verdict == "fair":
        headline, lead = "Fair price", "About the median"
    else:
        headline, lead = f"{amount} {direction} similar", f"{amount} {direction} the median"
    return FairPrice(
        verdict=verdict,
        headline=headline,
        summary=f"{lead} of {len(rents)} {scope}.",
        compared_with=scope,
        sample_size=len(rents),
        median=round(mid),
        p25=round(q[0]),
        p75=round(q[2]),
        diff_dollars=round(diff),
        diff_pct=round(pct, 3),
    )


def fair_price_for(
    rows: list[_Row],
    *,
    listing_id: int | None,
    rent: int,
    space: Space,
    band: int | None,
    band_label: str | None,
    start: date,
) -> FairPrice | None:
    others = [r for r in rows if r.id != listing_id]
    same_kind = [r for r in others if r.space.kind == space.kind]
    same_size = (
        [r for r in same_kind if r.space.beds == space.beds] if space.beds is not None else []
    )

    def near(pool: list[_Row]) -> list[_Row]:
        return [r for r in pool if band is not None and r.band == band]

    def same_time(pool: list[_Row]) -> list[_Row]:
        return [r for r in pool if abs((r.start - start).days) <= SAME_TIME_DAYS]

    # Narrowest first; each step drops one condition.
    ladder = [
        (same_time(near(same_size)), True, band_label, True),
        (near(same_size), True, band_label, False),
        (same_size, True, None, False),
        (near(same_kind), False, band_label, False),
        (same_kind, False, None, False),
    ]
    for pool, with_beds, where, when in ladder:
        if len(pool) >= MIN_COMPARABLES:
            return _verdict(rent, [r.rent for r in pool], space.label(with_beds), where, when)
    return None


def fair_prices(db: Session, listings: list[Listing]) -> dict[int, FairPrice]:
    """Fair-price check for each listing, keyed by listing id."""
    if not listings:
        return {}
    rows = _index(db)
    out: dict[int, FairPrice] = {}
    for listing in listings:
        travel = travel_to_campus(listing.latitude, listing.longitude)
        band = distance_band(travel.walk_minutes if travel else None)
        result = fair_price_for(
            rows,
            listing_id=listing.id,
            rent=listing.monthly_rent,
            space=classify(listing.listing_type, listing.title, listing.description or ""),
            band=band[0] if band else None,
            band_label=band[1] if band else None,
            start=listing.available_from,
        )
        if result:
            out[listing.id] = result
    return out
