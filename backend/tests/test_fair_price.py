from datetime import date

from app.models.listing import ListingType
from app.services.housing.fair_price import (
    Space,
    _Row,
    classify,
    distance_band,
    fair_price_for,
)

START = date(2027, 1, 10)
ROOM_2 = Space("room", 2)


def test_classify_reads_the_kind_of_space():
    assert classify(ListingType.SUBLEASE, "Private room in a 3-bed on Ellendale") == Space(
        "room", 3
    )
    assert classify(ListingType.SUBLEASE, "Studio sublease on Hoover") == Space("studio", 0)
    assert classify(ListingType.LEASE_TAKEOVER, "Take over my 1-bed lease") == Space("whole", 1)
    assert classify(ListingType.LEASE_TAKEOVER, "Whole 4-bed unit lease takeover") == Space(
        "whole", 4
    )
    assert classify(ListingType.ROOM, "Room in a two bedroom near campus") == Space("room", 2)
    assert classify(ListingType.ROOM, "Cozy room, great roommates") == Space("room", None)


def test_distance_bands():
    assert distance_band(None) is None
    assert distance_band(8)[0] == 0
    assert distance_band(15)[0] == 1
    assert distance_band(35)[0] == 2


def _rows(n, *, rent, space=ROOM_2, band=0, start=START, first_id=100):
    return [_Row(first_id + i, rent + i * 10, space, band, start) for i in range(n)]


def _check(rows, rent, space=ROOM_2, band=0):
    return fair_price_for(
        rows,
        listing_id=1,
        rent=rent,
        space=space,
        band=band,
        band_label="within a 10-minute walk",
        start=START,
    )


def test_above_similar_uses_the_narrowest_scope():
    rows = _rows(6, rent=1200)  # median 1225
    fp = _check(rows, 1365)
    assert fp.verdict == "above"
    assert fp.headline == "$140 above similar"
    assert fp.compared_with == (
        "similar private rooms in 2-beds within a 10-minute walk starting around the same time"
    )
    assert fp.sample_size == 6


def test_fair_within_band_and_below():
    rows = _rows(6, rent=1200)
    assert _check(rows, 1240).verdict == "fair"
    below = _check(rows, 1000)
    assert below.verdict == "below" and below.diff_dollars == -225


def test_never_compares_rooms_with_whole_units_or_other_sizes():
    rows = _rows(6, rent=4000, space=Space("whole", 2)) + _rows(
        6, rent=900, space=Space("room", 4), first_id=200
    )
    # No 2-bed rooms to compare with: it falls back to rooms of any size, never whole units.
    fp = _check(rows, 1200)
    assert fp.compared_with.startswith("similar private rooms within")
    assert fp.median < 1000


def test_widens_when_too_few_and_says_so():
    rows = _rows(3, rent=1200) + _rows(6, rent=1300, band=2, first_id=300)
    fp = _check(rows, 1250)
    assert fp.compared_with == "similar private rooms in 2-beds"  # distance dropped
    assert fp.sample_size == 9


def test_none_without_enough_data_and_excludes_itself():
    assert _check(_rows(4, rent=1200), 1200) is None
    rows = _rows(5, rent=1200, first_id=1)  # includes listing id 1
    assert _check(rows, 1200) is None
