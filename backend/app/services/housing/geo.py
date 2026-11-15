"""Distance and rough travel time to the USC University Park campus."""

from app.schemas.listing import TravelEstimate
from app.services.matching.scoring import USC_LAT, USC_LNG, _haversine_miles

# Streets are not straight lines; scale the straight-line distance.
DETOUR_FACTOR = 1.3
WALK_MPH = 3.0
BIKE_MPH = 10.0


def travel_to_campus(lat: float | None, lng: float | None) -> TravelEstimate | None:
    if lat is None or lng is None:
        return None
    miles = _haversine_miles(USC_LAT, USC_LNG, lat, lng)
    route = miles * DETOUR_FACTOR
    return TravelEstimate(
        miles=round(miles, 2),
        walk_minutes=max(1, round(route / WALK_MPH * 60)),
        bike_minutes=max(1, round(route / BIKE_MPH * 60)),
    )
