from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.matching import ListingMatchRequest, MatchResult, RankRequest, ScoreRequest
from app.services.listings import ListingMatchResponse, match_listings
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
    req: ListingMatchRequest, db: Session = Depends(get_db)
) -> ListingMatchResponse:
    """Score every posted listing for this seeker and return the best matches with reasons."""
    return match_listings(db, req)
