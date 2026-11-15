from typing import Literal

from pydantic import BaseModel


class RatingSummary(BaseModel):
    """HOMIE score from the rating engine (see docs/rating-model.html).

    `score` is the best guess in stars; `low`-`high` is where the true score
    probably is (80% range). Sort "best" lists by `rank_key`, the cautious
    lower estimate, so a place has to prove itself to reach the top.
    """

    score: float
    low: float
    high: float
    rank_key: float
    confidence: Literal["low", "medium", "high"]
    rated_reviews: int
