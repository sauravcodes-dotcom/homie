from fastapi import APIRouter

from app.schemas.matching import MatchResult, RankRequest, ScoreRequest
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
