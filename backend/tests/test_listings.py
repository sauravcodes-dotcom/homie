from tests.conftest import sign_in

NEW_LISTING = {
    "title": "Room in a 3-bed on 30th St",
    "building_name": "Test Court",
    "address": "1201 W 30th St, Los Angeles, CA 90007",
    "unit": "4B",
    "monthly_rent": 1200,
    "available_from": "2027-01-10",
    "available_to": "2027-05-30",
    "lifestyle": {"smoking": False, "diet": "veg"},
}


def test_lorenzo_3157_demo_listing_is_seeded(client):
    page = client.get("/api/listings", params={"q": "3157"}).json()
    demo = next(item for item in page["items"] if item["unit"] == "3157")
    assert demo["building_name"] == "The Residences at Lorenzo"
    assert demo["is_demo"] is True
    assert demo["roommate_feedback"]["count"] == 1

    detail = client.get(f"/api/listings/{demo['id']}").json()
    assert detail["feedback"][0]["comment"] == "The roommates are very cool."
    assert detail["feedback"][0]["rating"] == 5


def test_subleaser_can_post_roommate_feedback(client):
    owner = sign_in(client, "owner@usc.edu")
    listing = client.post("/api/listings", json=NEW_LISTING, headers=owner).json()

    resp = client.post(
        f"/api/listings/{listing['id']}/roommate-feedback",
        json={"rating": 4, "tags": ["clean", "quiet", "clean"], "comment": "Quiet and tidy."},
        headers=owner,
    )
    assert resp.status_code == 201
    assert resp.json()["tags"] == ["clean", "quiet"]

    detail = client.get(f"/api/listings/{listing['id']}").json()
    summary = detail["roommate_feedback"]
    rating = summary.pop("rating")
    assert summary == {
        "count": 1,
        "average_rating": 4.0,
        "top_tags": ["clean", "quiet"],
    }
    # The subleaser's own stars are read as a hint: discounted, low confidence.
    assert rating["score"] < 4.0 and rating["confidence"] == "low"


def test_only_the_subleaser_can_post_feedback(client):
    owner = sign_in(client, "owner2@usc.edu")
    stranger = sign_in(client, "stranger@usc.edu")
    listing = client.post("/api/listings", json=NEW_LISTING, headers=owner).json()
    payload = {"rating": 1, "comment": "Not my place to say"}

    url = f"/api/listings/{listing['id']}/roommate-feedback"
    assert client.post(url, json=payload).status_code == 401
    assert client.post(url, json=payload, headers=stranger).status_code == 403


def test_creating_listing_requires_sign_in(client):
    assert client.post("/api/listings", json=NEW_LISTING).status_code == 401


def test_feedback_validation(client):
    owner = sign_in(client, "owner3@usc.edu")
    listing = client.post("/api/listings", json=NEW_LISTING, headers=owner).json()
    url = f"/api/listings/{listing['id']}/roommate-feedback"
    assert client.post(url, json={"rating": 6, "comment": "ok"}, headers=owner).status_code == 422
    bad_tag = {"rating": 3, "tags": ["rich"], "comment": "ok"}
    assert client.post(url, json=bad_tag, headers=owner).status_code == 422


def test_bulk_demo_listings_are_seeded_and_searchable(client):
    page = client.get("/api/listings", params={"limit": 5}).json()
    assert page["total"] >= 201
    assert len(page["items"]) == 5

    cheap = client.get(
        "/api/listings", params={"max_rent": 1100, "sort": "price_asc", "limit": 50}
    ).json()
    rents = [item["monthly_rent"] for item in cheap["items"]]
    assert rents == sorted(rents)
    assert all(r <= 1100 for r in rents)

    rooms = client.get("/api/listings", params={"listing_type": "room"}).json()
    assert rooms["total"] > 0
    assert all(item["listing_type"] == "room" for item in rooms["items"])


def test_demo_owners_use_reserved_domain(client):
    from app.database.session import SessionLocal
    from app.models import User

    with SessionLocal() as db:
        demo_users = db.query(User).filter(User.email.like("%homie-demo.invalid")).count()
        usc_demo = db.query(User).filter(User.email.like("student%@usc.edu")).count()
    assert demo_users > 0
    assert usc_demo == 0


def test_match_against_posted_listings(client):
    seeker = {
        "budget_max": 1300,
        "move_in": "2027-01-05",
        "move_out": "2027-05-20",
        "preferred_neighborhoods": ["North University Park"],
        "lifestyle": {"smoking": False, "diet": "veg"},
    }
    body = client.post("/api/matching/listings", json={"seeker": seeker, "limit": 10}).json()
    assert body["scanned"] >= 201
    scores = [r["match"]["score"] for r in body["results"]]
    assert len(scores) == 10
    assert scores == sorted(scores, reverse=True)
    assert all(r["listing"]["id"] for r in body["results"])

    rooms_only = client.post(
        "/api/matching/listings",
        json={"seeker": seeker, "listing_types": ["room"], "limit": 5},
    ).json()
    assert all(r["listing"]["listing_type"] == "room" for r in rooms_only["results"])
