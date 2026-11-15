"""Fill a development database with sample data.

Run with: python -m app.database.sample_data

Everything here is invented: the buildings, people and reviews are fictional
and exist only so the app has something to show locally. Refuses to run in
production.
"""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.database.init_db import init_db
from app.database.session import SessionLocal
from app.models import Apartment, Listing, ListingType, Review, SeekerProfile, User
from app.services.apartment_intelligence import extract_review
from app.services.embeddings import get_embedding_provider
from app.services.housing.benchmark import rent_benchmark
from app.services.housing.risk import assess_risk
from app.services.housing.semantic import listing_text
from app.services.llm import get_llm_provider

PEOPLE = [
    ("maya.demo@usc.edu", "Maya Chen"),
    ("jordan.demo@usc.edu", "Jordan Reyes"),
    ("priya.demo@usc.edu", "Priya Nair"),
    ("alex.demo@usc.edu", "Alex Kim"),
    ("sofia.demo@usc.edu", "Sofia Marin"),
    ("deshawn.demo@usc.edu", "DeShawn Carter"),
]

# (name, address, neighborhood, lat, lng) - fictional buildings at approximate spots.
BUILDINGS = [
    ("Cardinal Court (sample)", "100 Sample St", "University Park", 34.0276, -118.2892),
    ("Gold Line Lofts (sample)", "200 Sample Ave", "North University Park", 34.0331, -118.2846),
    ("Figueroa Flats (sample)", "300 Sample Blvd", "Exposition Park", 34.0159, -118.2812),
]

REVIEWS = {
    0: [
        (
            2,
            "Roaches in the kitchen for months. Maintenance never came to fix the leak under "
            "the sink. I paid $1,450 a month all in.",
        ),
        (
            2,
            "Cockroaches on the ground floor all summer and the landlord ignored our emails. "
            "Wifi was fast though.",
        ),
        (
            3,
            "Maintenance is slow, it took three weeks to fix the heater. The building is quiet "
            "and the gate feels secure.",
        ),
        (
            4,
            "Great location and the internet is reliable. Had a mouse problem once but "
            "management was responsive.",
        ),
        (
            2,
            "Pests are a real problem here, we had roaches every month. Rent was $1,500 a month "
            "and not worth it.",
        ),
        (4, "Clean hallways, friendly staff, and it felt safe walking back at night."),
    ],
    1: [
        (
            5,
            "Management is responsive and the building is clean. Wifi is fast and reliable. "
            "Rent was $1,700 a month.",
        ),
        (4, "Quiet building, secure gate, helpful staff. A little expensive for the size."),
        (3, "Thin walls so it gets loud on weekends, parties upstairs every week."),
    ],
    2: [],
}

LISTINGS = [
    (
        0,
        0,
        ListingType.SUBLEASE,
        "Spring sublease, private room in a 2-bed",
        1150,
        0,
        148,
        "Furnished private room with a shared bath. Quiet apartment, we keep the kitchen clean "
        "and go to bed early on weekdays. Laundry in the building.",
        {
            "sleep_schedule": "early",
            "cleanliness": 4,
            "noise_tolerance": 2,
            "smoking": False,
            "pets": False,
        },
        34.0279,
        -118.2889,
    ),
    (
        1,
        0,
        ListingType.ROOMMATE_REPLACEMENT,
        "Roommate moving out, room open in a 4-bed",
        980,
        10,
        None,
        "One of our roommates is graduating early. Social house, friends over on weekends, "
        "everyone cooks. Street parking is easy.",
        {
            "sleep_schedule": "late",
            "cleanliness": 3,
            "guests_frequency": 4,
            "smoking": False,
            "pets": True,
        },
        34.0268,
        -118.2901,
    ),
    (
        2,
        1,
        ListingType.LEASE_TAKEOVER,
        "Take over my studio lease through July",
        1725,
        20,
        210,
        "Bright studio on the third floor with a full kitchen. Taking over the lease keeps last "
        "year's rate. Gated entry and bike storage.",
        {"sleep_schedule": "flexible", "cleanliness": 5, "smoking": False, "pets": False},
        34.0334,
        -118.2849,
    ),
    (
        3,
        1,
        ListingType.ROOM,
        "Room in a quiet grad apartment",
        1300,
        5,
        None,
        "Two grad students looking for a third. We study at home most evenings, so it is calm. "
        "In-unit washer and a balcony.",
        {"sleep_schedule": "early", "cleanliness": 5, "noise_tolerance": 1, "smoking": False},
        34.0329,
        -118.2841,
    ),
    (
        4,
        2,
        ListingType.SUBLEASE,
        "Summer sublease across from Expo Park",
        1050,
        180,
        270,
        "Shared room for the summer, close to the Expo line. Building has a small gym. "
        "Roommates are easygoing.",
        {"sleep_schedule": "flexible", "cleanliness": 3, "smoking": False, "pets": False},
        34.0162,
        -118.2815,
    ),
    (
        5,
        None,
        ListingType.ROOM,
        "Room in a house on the west side of campus",
        1400,
        30,
        None,
        "Big room in a five bedroom house with a backyard. Two friendly dogs live here. "
        "Driveway parking included.",
        {
            "sleep_schedule": "late",
            "cleanliness": 3,
            "guests_frequency": 3,
            "smoking": False,
            "pets": True,
        },
        34.0242,
        -118.2978,
    ),
    (
        0,
        None,
        ListingType.SUBLEASE,
        "Too good to be true studio",
        420,
        3,
        None,
        "I am out of the country for work so I cannot show it. Send the deposit by Zelle before "
        "viewing and I will mail the keys. WhatsApp me.",
        {},
        34.0301,
        -118.2795,
    ),
]

PROFILES = [
    (
        2,
        1400,
        7,
        ["University Park", "North University Park"],
        {
            "sleep_schedule": "early",
            "cleanliness": 5,
            "noise_tolerance": 2,
            "smoking": False,
            "pets": False,
        },
        "Quiet pre-med junior. I study at home, cook most nights and keep things clean.",
    ),
    (
        3,
        1200,
        14,
        ["University Park"],
        {
            "sleep_schedule": "late",
            "cleanliness": 3,
            "guests_frequency": 4,
            "smoking": False,
            "pets": True,
        },
        "Film major, night owl, love having friends over and I have a small dog.",
    ),
    (
        4,
        1600,
        3,
        ["North University Park", "Exposition Park"],
        {"sleep_schedule": "flexible", "cleanliness": 4, "smoking": False, "pets": False},
        "Grad student in engineering. Calm, tidy, at the lab most days.",
    ),
]


def load_sample_data() -> None:
    if get_settings().is_production:
        raise SystemExit("Refusing to seed a production database.")
    init_db()
    llm, embedder = get_llm_provider(), get_embedding_provider()
    today = date.today()
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email == PEOPLE[0][0])):
            print("Sample data already present.")
            return
        users = [User(email=e, full_name=n, is_usc_verified=True) for e, n in PEOPLE]
        db.add_all(users)
        buildings = [
            Apartment(name=n, address=a, neighborhood=h, latitude=lat, longitude=lng)
            for n, a, h, lat, lng in BUILDINGS
        ]
        db.add_all(buildings)
        db.flush()

        for b_index, items in REVIEWS.items():
            for i, (rating, body) in enumerate(items):
                db.add(
                    Review(
                        apartment_id=buildings[b_index].id,
                        author_id=users[i % len(users)].id,
                        is_verified_resident=i % 3 != 2,
                        body=body,
                        overall_rating=rating,
                        extraction=extract_review(body, llm).model_dump(mode="json"),
                        embedding=embedder.embed_one(body),
                        created_at=datetime.now(UTC) - timedelta(days=30 * (i + 1)),
                    )
                )

        rows = []
        for owner, b, kind, title, rent, start, end, desc, life, lat, lng in LISTINGS:
            building = buildings[b] if b is not None else None
            row = Listing(
                owner_id=users[owner].id,
                apartment_id=building.id if building else None,
                listing_type=kind,
                title=title,
                description=desc,
                monthly_rent=rent,
                available_from=today + timedelta(days=start),
                available_to=today + timedelta(days=end) if end else None,
                neighborhood=building.neighborhood if building else "University Park",
                latitude=lat,
                longitude=lng,
                lifestyle=life,
                photos=[],
                embedding=embedder.embed_one(listing_text(title, desc)),
            )
            db.add(row)
            rows.append(row)
        db.flush()
        for row in rows:
            row.risk = assess_risk(
                title=row.title,
                description=row.description,
                benchmark=rent_benchmark(
                    db,
                    row.monthly_rent,
                    apartment_id=row.apartment_id,
                    neighborhood=row.neighborhood,
                    exclude_listing_id=row.id,
                ),
                has_photos=False,
            ).model_dump()

        for u, budget, start, hoods, life, bio in PROFILES:
            db.add(
                SeekerProfile(
                    user_id=users[u].id,
                    budget_max=budget,
                    move_in=today + timedelta(days=start),
                    preferred_neighborhoods=hoods,
                    lifestyle=life,
                    bio=bio,
                    is_discoverable=True,
                    embedding=embedder.embed_one(bio),
                )
            )
        db.commit()
    print(f"Seeded {len(PEOPLE)} people, {len(BUILDINGS)} buildings, {len(LISTINGS)} listings.")


if __name__ == "__main__":
    load_sample_data()
