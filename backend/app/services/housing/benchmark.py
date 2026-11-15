"""Rent benchmark from active HOMIE listings.

Uses the narrowest scope that has enough data (same building, then same
neighborhood, then every listing) and always reports which scope and how many
listings the numbers rest on.
"""

from statistics import median, quantiles

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Apartment, Listing
from app.schemas.listing import RentBenchmark

MIN_SAMPLE = 3
TYPICAL_BAND = 0.10


def rent_benchmark(
    db: Session,
    rent: int,
    *,
    apartment_id: int | None = None,
    neighborhood: str | None = None,
    exclude_listing_id: int | None = None,
) -> RentBenchmark | None:
    base = select(Listing.monthly_rent, Listing.risk).where(Listing.is_active.is_(True))
    if exclude_listing_id is not None:
        base = base.where(Listing.id != exclude_listing_id)

    scopes: list[tuple[str, str, object]] = []
    if apartment_id is not None:
        name = db.scalar(select(Apartment.name).where(Apartment.id == apartment_id))
        scopes.append(
            ("building", name or "this building", base.where(Listing.apartment_id == apartment_id))
        )
    if neighborhood:
        scopes.append(
            (
                "neighborhood",
                neighborhood,
                base.where(func.lower(Listing.neighborhood) == neighborhood.strip().lower()),
            )
        )
    scopes.append(("all", "all HOMIE listings", base))

    for scope, label, query in scopes:
        # Listings with serious red flags are left out: a scam's bait price is not a market price.
        rents = sorted(
            rent for rent, risk in db.execute(query).all() if (risk or {}).get("level") != "high"
        )
        if len(rents) < MIN_SAMPLE:
            continue
        mid = median(rents)
        q = quantiles(rents, n=4, method="inclusive")
        diff = (rent - mid) / mid
        verdict = "below" if diff < -TYPICAL_BAND else "above" if diff > TYPICAL_BAND else "typical"
        return RentBenchmark(
            scope=scope,
            scope_label=label,
            sample_size=len(rents),
            median=round(mid),
            p25=round(q[0]),
            p75=round(q[2]),
            diff_pct=round(diff, 3),
            verdict=verdict,
        )
    return None
