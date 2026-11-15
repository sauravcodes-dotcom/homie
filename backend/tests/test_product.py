"""End-to-end tests of the product API (feed, messaging, reviews, buildings)."""

import random
from datetime import date

from app.models import Apartment
from app.services.apartment_intelligence.offline import extract_offline
from app.services.housing.risk import assess_risk
from app.services.llm import MockLLMProvider
from app.services.reviews.external import (
    ExternalBatch,
    ExternalReview,
    ExternalReviewProvider,
    get_external_provider,
    sample_and_aggregate,
)

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def listing(**over):
    base = {
        "listing_type": "sublease",
        "title": "Sunny room on Ellendale",
        "description": "Quiet furnished room in a clean two bedroom, five minutes from campus.",
        "monthly_rent": 1200,
        "available_from": "2027-01-05",
        "available_to": "2027-05-31",
        "neighborhood": "University Park",
        "latitude": 34.0312,
        "longitude": -118.2901,
        "lifestyle": {"sleep_schedule": "early", "cleanliness": 4, "smoking": False},
    }
    return base | over


PROFILE = {
    "budget_max": 1300,
    "move_in": "2027-01-05",
    "move_out": "2027-05-20",
    "preferred_neighborhoods": ["University Park"],
    "lifestyle": {"sleep_schedule": "early", "cleanliness": 5, "smoking": False},
    "bio": "Quiet junior who likes a clean furnished room close to campus.",
    "is_discoverable": True,
}


# --- Listings, feed, swipes -------------------------------------------------


def test_listing_crud_filters_and_ownership(login):
    owner, other = login("owner@usc.edu", "Olivia Owner"), login("other@usc.edu")
    a = owner.post("/api/listings", json=listing()).json()
    owner.post("/api/listings", json=listing(title="Pricey studio", monthly_rent=2100))
    assert a["owner"]["display_name"] == "Olivia O." == a["owner_name"]
    assert "email" not in a["owner"]
    # Before a name is set, the email's local part must not leak as the display name.
    unnamed = other.post("/api/listings", json=listing()).json()
    assert unnamed["owner_name"] == "A Trojan"
    assert other.delete(f"/api/listings/{unnamed['id']}").status_code == 204
    assert a["travel"]["walk_minutes"] > 0

    cheap = other.get("/api/listings", params={"max_rent": 1500}).json()["items"]
    assert [x["title"] for x in cheap] == ["Sunny room on Ellendale"]
    assert (
        other.get("/api/listings", params={"q": "studio"}).json()["items"][0]["monthly_rent"]
        == 2100
    )

    assert (
        other.put(f"/api/listings/{a['id']}", json=listing() | {"is_active": False}).status_code
        == 403
    )
    assert other.delete(f"/api/listings/{a['id']}").status_code == 403
    assert (
        owner.put(f"/api/listings/{a['id']}", json=listing() | {"is_active": False}).status_code
        == 200
    )
    assert other.get("/api/listings").json()["total"] == 1


def test_photo_upload_checks_file_type(login):
    c = login("pics@usc.edu")
    ok = c.post("/api/uploads/photo", files={"file": ("a.png", PNG, "image/png")})
    assert ok.status_code == 200 and ok.json()["url"].startswith("/api/uploads/photos/")
    assert c.get(ok.json()["url"]).status_code == 200
    bad = c.post("/api/uploads/photo", files={"file": ("a.png", b"<script>", "image/png")})
    assert bad.status_code == 400
    assert (
        c.post("/api/listings", json=listing(photos=["https://evil.example/x.png"])).status_code
        == 422
    )


def test_feed_ranks_by_fit_and_hides_swiped(login):
    owner, seeker = login("owner@usc.edu"), login("seeker@usc.edu")
    good = owner.post("/api/listings", json=listing()).json()
    bad = owner.post(
        "/api/listings",
        json=listing(
            title="Far away party house",
            description="Loud house, people smoke inside, parties every weekend.",
            monthly_rent=2400,
            neighborhood="Koreatown",
            available_from="2027-08-01",
            available_to=None,
            lifestyle={"sleep_schedule": "late", "cleanliness": 1, "smoking": True},
        ),
    ).json()
    assert seeker.get("/api/feed").status_code == 404  # no profile yet
    assert seeker.put("/api/profile", json=PROFILE).status_code == 200

    feed = seeker.get("/api/feed").json()
    assert [f["listing"]["id"] for f in feed] == [good["id"], bad["id"]]
    assert feed[0]["match"]["score"] > 85 > feed[1]["match"]["score"]
    assert any(f["factor"] == "semantic" for f in feed[0]["match"]["factors"])
    assert owner.put("/api/profile", json=PROFILE).status_code == 200
    assert owner.get("/api/feed").json() == []  # never your own listings

    seeker.post("/api/swipes", json={"target_id": good["id"], "action": "save"})
    seeker.post("/api/swipes", json={"target_id": bad["id"], "action": "pass"})
    assert seeker.get("/api/feed").json() == []
    assert [x["id"] for x in seeker.get("/api/saved").json()] == [good["id"]]
    detail = seeker.get(f"/api/listings/{good['id']}").json()
    assert detail["is_saved"] is True and detail["match"]["score"] > 85


def test_roommate_discovery_is_opt_in(login):
    me, open_, hidden = (
        login("me@usc.edu"),
        login("open@usc.edu", "Riley Park"),
        login("hid@usc.edu"),
    )
    me.put("/api/profile", json=PROFILE)
    open_.put("/api/profile", json=PROFILE)
    hidden.put("/api/profile", json=PROFILE | {"is_discoverable": False})
    cards = me.get("/api/roommates").json()
    assert [c["user"]["display_name"] for c in cards] == ["Riley P."]
    assert cards[0]["match"]["score"] > 80


# --- Benchmark and red flags ------------------------------------------------


def test_benchmark_reports_scope_and_sample(login):
    c = login("owner@usc.edu")
    for rent in (1000, 1200, 1400):
        c.post("/api/listings", json=listing(monthly_rent=rent))
    b = c.get("/api/benchmark", params={"rent": 900, "neighborhood": "University Park"}).json()
    assert b["scope"] == "neighborhood" and b["sample_size"] == 3 and b["median"] == 1200
    assert b["verdict"] == "below" and b["diff_pct"] == -0.25
    assert (
        c.get("/api/benchmark", params={"rent": 900, "neighborhood": "Nowhere"}).json()["scope"]
        == "all"
    )


def test_too_few_listings_means_no_benchmark(login):
    c = login("owner@usc.edu")
    c.post("/api/listings", json=listing())
    assert c.get("/api/benchmark", params={"rent": 900}).json() is None


def test_scam_flags(login):
    c, scammer = login("owner@usc.edu"), login("scam@usc.edu")
    for rent in (1100, 1200, 1300):
        c.post("/api/listings", json=listing(monthly_rent=rent))
    out = scammer.post(
        "/api/listings",
        json=listing(
            monthly_rent=450,
            description="I am out of the country for work. Send the deposit by Zelle before "
            "viewing and I will mail the keys. WhatsApp me.",
        ),
    ).json()
    codes = {f["code"] for f in out["risk"]["flags"]}
    assert out["risk"]["level"] == "high"
    assert {
        "far_below_market",
        "cannot_show",
        "off_platform_payment",
        "off_platform_contact",
    } <= codes

    clean = assess_risk(
        title="Room", description="Nice clean room.", benchmark=None, has_photos=True
    )
    assert clean.level == "low" and clean.flags == []


def test_red_flagged_listings_sink_in_the_feed(login):
    owner, seeker = login("owner@usc.edu"), login("seeker@usc.edu")
    for rent in (1100, 1200, 1300):
        owner.post("/api/listings", json=listing(monthly_rent=rent, neighborhood="Koreatown"))
    scam = owner.post(
        "/api/listings",
        json=listing(description="Send the deposit by Zelle before viewing. WhatsApp me."),
    ).json()
    assert scam["risk"]["level"] == "high"
    seeker.put("/api/profile", json=PROFILE)
    feed = seeker.get("/api/feed").json()
    # It fits the seeker best on paper (right neighborhood), yet is ranked last.
    assert feed[-1]["listing"]["id"] == scam["id"]
    assert feed[-1]["match"]["score"] > feed[0]["match"]["score"]


def test_listing_writer_offline_uses_only_given_facts(login):
    c = login("w@usc.edu")
    d = c.post(
        "/api/ai/listing-draft",
        json={
            "notes": "furnished\nshared bath; parking spot",
            "monthly_rent": 1100,
            "neighborhood": "North University Park",
        },
    ).json()
    assert d["generated_by"] == "offline"
    assert d["title"] == "Sublease in North University Park, $1,100/mo"
    assert "Furnished." in d["description"] and "Parking spot." in d["description"]


# --- Messaging and person reviews -------------------------------------------


def test_messaging_and_person_reviews(login):
    owner, seeker, stranger = (
        login("owner@usc.edu", "Olivia Owner"),
        login("seek@usc.edu", "Sam Lee"),
        login("x@usc.edu"),
    )
    lst = owner.post("/api/listings", json=listing()).json()
    owner_id = lst["owner"]["id"]
    assert (
        owner.post("/api/conversations", json={"listing_id": lst["id"], "body": "hi"}).status_code
        == 400
    )

    conv = seeker.post(
        "/api/conversations", json={"listing_id": lst["id"], "body": "Is it available?"}
    ).json()
    assert conv["other"]["display_name"] == "Olivia O." and conv["can_review"] is False
    # Same pair + listing reuses the conversation.
    again = seeker.post(
        "/api/conversations", json={"listing_id": lst["id"], "body": "Hello?"}
    ).json()
    assert again["id"] == conv["id"]

    assert stranger.get(f"/api/conversations/{conv['id']}").status_code == 404
    assert owner.get("/api/conversations/unread-count").json() == {"unread": 2}
    thread = owner.get(f"/api/conversations/{conv['id']}").json()
    assert [m["is_mine"] for m in thread["messages"]] == [False, False]
    assert owner.get("/api/conversations/unread-count").json() == {"unread": 0}

    review = {
        "relationship_kind": "lister",
        "rating": 5,
        "traits": {"communication": 5},
        "body": "Great",
    }
    # One-sided contact is not enough to review someone.
    assert seeker.put(f"/api/people/{owner_id}/review", json=review).status_code == 403
    assert stranger.put(f"/api/people/{owner_id}/review", json=review).status_code == 403
    owner.post(f"/api/conversations/{conv['id']}/messages", json={"body": "Yes, come by."})
    assert seeker.put(f"/api/people/{owner_id}/review", json=review).status_code == 200
    assert (
        seeker.put(f"/api/people/{owner_id}/review", json=review | {"rating": 4}).status_code == 200
    )

    page = stranger.get(f"/api/people/{owner_id}").json()
    assert page["review_count"] == 1 and page["average_rating"] == 4
    assert page["trait_averages"] == {"communication": 5}
    assert page["can_review"] is False and page["reviews"][0]["is_mine"] is False
    assert "author" not in page["reviews"][0]
    assert (
        seeker.put(
            f"/api/people/{seeker.get('/api/auth/me').json()['id']}/review", json=review
        ).status_code
        == 400
    )


# --- Buildings and reviews --------------------------------------------------

BAD = (
    "Roaches in the kitchen for months and maintenance never came to fix the leak. "
    "Rent was $1,450 a month."
)
GOOD = "Management was friendly and responsive, and the wifi was fast and reliable the whole year."


def building(c, name="Adams Court"):
    return c.post("/api/apartments", json={"name": name, "address": "1200 W Adams Blvd"}).json()


def test_offline_extraction_finds_topics_and_cost():
    e = extract_offline(BAD)
    cats = {f.category.value: f.sentiment for f in e.findings}
    assert cats["pests"] == "negative" and cats["maintenance"] == "negative"
    assert e.reported_monthly_cost == 1450
    good = {f.category.value: f.sentiment for f in extract_offline(GOOD).findings}
    assert good == {"management": "positive", "internet": "positive"}


def test_building_reviews_insights_and_ask(login):
    users = [login(f"r{i}@usc.edu") for i in range(5)]
    apt = building(users[0])
    assert (
        users[1]
        .post("/api/apartments", json={"name": "adams court", "address": "1200 w adams blvd"})
        .status_code
        == 409
    )
    empty = users[0].get(f"/api/apartments/{apt['id']}").json()
    assert empty["insights_source"] == "none" and empty["external"]["status"] == "disabled"
    assert empty["rating"] is None

    for i, u in enumerate(users):
        body = BAD if i < 3 else GOOD
        assert (
            u.post(
                f"/api/apartments/{apt['id']}/reviews",
                json={"body": body, "overall_rating": 2 if i < 3 else 5},
            ).status_code
            == 201
        )
    assert (
        users[0]
        .post(f"/api/apartments/{apt['id']}/reviews", json={"body": BAD, "overall_rating": 1})
        .status_code
        == 409
    )

    d = users[0].get(f"/api/apartments/{apt['id']}").json()
    assert d["insights_source"] == "homie" and d["review_count"] == 5 and d["average_rating"] == 3.2
    # HOMIE score: same reviews, pulled toward the campus average, with a range.
    r = d["rating"]
    assert r["rated_reviews"] == 5 and r["low"] < r["score"] < r["high"]
    assert r["rank_key"] <= r["score"]
    listed = users[0].get("/api/apartments").json()
    assert next(a for a in listed if a["id"] == apt["id"])["rating"] == r
    assert set(d["insights"]["recurring_issues"]) == {"maintenance", "pests"}
    assert d["insights"]["median_reported_monthly_cost"] == 1450
    assert "5 HOMIE reviews" in d["summary"] and d["my_review_id"] is not None

    a = (
        users[0]
        .post(f"/api/apartments/{apt['id']}/ask", json={"question": "Is there a roach problem?"})
        .json()
    )
    assert a["source"] == "homie" and a["sample_size"] == 5
    assert "3 of the 3 reviews that mention pests were negative" in a["answer"]
    assert a["citations"] and "Roaches" in a["citations"][0]["quote"]
    none = (
        users[0]
        .post(f"/api/apartments/{apt['id']}/ask", json={"question": "How is the noise?"})
        .json()
    )
    assert "no evidence either way" in none["answer"]


def test_residency_verification_flow(login):
    student, admin = login("res@usc.edu"), login("admin@usc.edu")
    apt = building(student)
    student.post(f"/api/apartments/{apt['id']}/reviews", json={"body": BAD, "overall_rating": 2})
    assert (
        student.post(
            f"/api/apartments/{apt['id']}/verification",
            files={"file": ("x.exe", b"MZ..", "image/png")},
        ).status_code
        == 400
    )
    assert (
        student.post(
            f"/api/apartments/{apt['id']}/verification",
            files={"file": ("lease.png", PNG, "image/png")},
        ).status_code
        == 201
    )
    assert (
        student.post(
            f"/api/apartments/{apt['id']}/verification",
            files={"file": ("lease.png", PNG, "image/png")},
        ).status_code
        == 409
    )
    assert student.get(f"/api/apartments/{apt['id']}").json()["my_verification"] == "pending"

    assert student.get("/api/admin/verifications").status_code == 403
    pending = admin.get("/api/admin/verifications").json()
    vid = pending[0]["id"]
    assert student.get(f"/api/admin/verifications/{vid}/document").status_code == 403
    assert admin.get(f"/api/admin/verifications/{vid}/document").content == PNG
    done = admin.post(f"/api/admin/verifications/{vid}/decision", json={"approve": True}).json()
    assert done["status"] == "approved" and done["has_document"] is False
    assert admin.get(f"/api/admin/verifications/{vid}/document").status_code == 400  # deleted

    d = student.get(f"/api/apartments/{apt['id']}").json()
    assert d["verified_count"] == 1 and d["my_verification"] == "approved"
    assert (
        student.get(f"/api/apartments/{apt['id']}/reviews").json()[0]["is_verified_resident"]
        is True
    )


# --- Public-review fallback -------------------------------------------------


class FakeProvider(ExternalReviewProvider):
    name = "fake"

    def __init__(self, n):
        self.n = n
        self.calls = 0

    def fetch(self, apartment: Apartment, pool_size: int) -> ExternalBatch:
        self.calls += 1
        reviews = [
            ExternalReview(
                text=BAD if i % 2 else GOOD, rating=2 if i % 2 else 5, published=date(2026, 5, 1)
            )
            for i in range(min(self.n, pool_size))
        ]
        return ExternalBatch(place_id="place-1", reviews=reviews, average_rating=3.4)


def test_sample_is_random_capped_and_stores_no_text():
    batch = FakeProvider(180).fetch(None, 200)
    r = sample_and_aggregate(batch, MockLLMProvider(), sample_size=100, rng=random.Random(1))
    assert r.pool_size == 180 and r.sample_size == 100 and r.insights.sample_size == 100
    assert r.insights.verified_count == 0
    assert all(c.sample_evidence == [] for c in r.insights.categories)


def test_google_fallback_used_until_enough_homie_reviews(login):
    from app.main import app

    provider = FakeProvider(180)
    app.dependency_overrides[get_external_provider] = lambda: provider
    users = [login(f"g{i}@usc.edu") for i in range(5)]
    apt = building(users[0], "Thin Reviews Tower")
    url = f"/api/apartments/{apt['id']}"
    users[0].post(f"{url}/reviews", json={"body": GOOD, "overall_rating": 5})

    before = users[0].get(url).json()
    assert before["insights_source"] == "homie_thin" and before["external"]["status"] == "missing"

    info = users[0].post(f"{url}/external-summary").json()
    assert info == info | {
        "status": "ready",
        "sample_size": 100,
        "pool_size": 180,
        "average_rating": 3.4,
    }
    users[0].post(f"{url}/external-summary")
    assert provider.calls == 1  # fresh summary is reused, not refetched

    d = users[0].get(url).json()
    assert d["insights_source"] == "google" and d["insights"]["sample_size"] == 100
    assert d["review_count"] == 1  # HOMIE's own count is not inflated
    assert "public Google reviews" in d["summary"] and "not verified residents" in d["summary"]
    ans = users[0].post(f"{url}/ask", json={"question": "Any pests?"}).json()
    assert ans["source"] == "google" and ans["citations"] == [] and ans["verified_count"] == 0

    for u in users[1:]:
        u.post(f"{url}/reviews", json={"body": BAD, "overall_rating": 2})
    after = users[0].get(url).json()
    assert after["insights_source"] == "homie" and after["external"]["status"] == "not_needed"
    assert after["insights"]["sample_size"] == 5
