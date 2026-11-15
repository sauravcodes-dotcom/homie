from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import optional_user
from app.api.presenters import listing_criteria, listings_out
from app.database.session import get_db
from app.models import Listing, ListingType, User
from app.schemas.listing import ListingMatch, ListingMatchResponse
from app.schemas.matching import ListingMatchRequest, MatchResult, RankRequest, ScoreRequest
from app.services.matching import rank_listings, score_match

router = APIRouter(prefix="/matching", tags=["matching"])


@router.post("/score", response_model=MatchResult)
def score(req: ScoreRequest) -> MatchResult:
    """Explainable compatibility score between one seeker and one listing."""
    return score_match(req.seeker, req.listing)


@router.post("/rank", response_model=list[MatchResult])
def rank(req: RankRequest) -> list[MatchResult]:
    """Rank candidate listings for a seeker, best first."""
    return rank_listings(req.seeker, req.listings, req.limit)


@router.post("/listings", response_model=ListingMatchResponse)
def match_posted_listings(
    req: ListingMatchRequest,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(optional_user),
) -> ListingMatchResponse:
    """Score every active listing for this seeker and return the best matches with reasons.

    Needs no account: the seeker's criteria come in the request.
    """
    stmt = select(Listing).where(Listing.is_active.is_(True))
    if req.listing_types:
        stmt = stmt.where(Listing.listing_type.in_([ListingType(t) for t in req.listing_types]))
    candidates = db.scalars(stmt).all()

    scored = [(score_match(req.seeker, listing_criteria(row)), row) for row in candidates]
    # Best score first (cheaper wins ties); listings with serious red flags go last.
    scored.sort(
        key=lambda pair: (
            (pair[1].risk or {}).get("level") == "high",
            -pair[0].score,
            pair[1].monthly_rent,
        )
    )
    top = scored[: req.limit]
    outs = listings_out(db, [row for _, row in top], viewer)
    return ListingMatchResponse(
        scanned=len(candidates),
        results=[
            ListingMatch(listing=out, match=match)
            for out, (match, _) in zip(outs, top, strict=True)
        ],
    )
