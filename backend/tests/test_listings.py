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
    listings = client.get("/api/listings").json()
    demo = next(item for item in listings if item["unit"] == "3157")
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
    assert detail["roommate_feedback"] == {
        "count": 1,
        "average_rating": 4.0,
        "top_tags": ["clean", "quiet"],
    }


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
