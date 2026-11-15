"""Deterministic generator for demo listings around USC.

Same seed -> same data on every server instance, so serverless instances
with their own temporary storage still show identical listings and IDs.
Street names are real streets near the University Park campus; house
numbers, rents, people and notes are invented. All rows are flagged is_demo.
"""

import random
from dataclasses import dataclass, field
from datetime import date, timedelta

DEMO_EMAIL_DOMAIN = "homie-demo.invalid"  # reserved TLD: can never be a real inbox


@dataclass(frozen=True)
class Street:
    name: str
    neighborhood: str
    lat: float  # approximate centre of the stretch near campus
    lng: float
    numbers: tuple[int, int]
    span: tuple[float, float]  # jitter (lat, lng) along the street


STREETS: tuple[Street, ...] = (
    Street(
        "Ellendale Pl", "North University Park", 34.0310, -118.2870, (2600, 2699), (0.0020, 0.0003)
    ),
    Street(
        "Portland St", "North University Park", 34.0305, -118.2805, (2300, 2699), (0.0040, 0.0003)
    ),
    Street(
        "Orchard Ave", "North University Park", 34.0300, -118.2830, (2300, 2699), (0.0040, 0.0003)
    ),
    Street("Menlo Ave", "University Park", 34.0255, -118.2900, (2900, 3199), (0.0030, 0.0003)),
    Street(
        "Severance St", "North University Park", 34.0315, -118.2780, (2300, 2399), (0.0010, 0.0003)
    ),
    Street(
        "Magnolia Ave", "North University Park", 34.0330, -118.2885, (2300, 2499), (0.0020, 0.0003)
    ),
    Street(
        "Raymond Ave", "North University Park", 34.0335, -118.2915, (2000, 2699), (0.0050, 0.0003)
    ),
    Street("Budlong Ave", "University Park", 34.0250, -118.2950, (2600, 3199), (0.0060, 0.0003)),
    Street("Catalina St", "University Park", 34.0255, -118.2960, (2900, 3199), (0.0030, 0.0003)),
    Street("S Hoover St", "University Park", 34.0270, -118.2840, (2500, 3099), (0.0060, 0.0004)),
    Street("S Vermont Ave", "University Park", 34.0240, -118.2915, (2600, 3699), (0.0080, 0.0004)),
    Street("W 27th St", "North University Park", 34.0290, -118.2860, (900, 1399), (0.0004, 0.0060)),
    Street("W 28th St", "North University Park", 34.0275, -118.2855, (900, 1399), (0.0004, 0.0060)),
    Street("W 29th St", "University Park", 34.0262, -118.2860, (900, 1399), (0.0004, 0.0060)),
    Street("W 30th St", "University Park", 34.0250, -118.2860, (900, 1399), (0.0004, 0.0060)),
    Street("W 35th St", "University Park", 34.0205, -118.2950, (1100, 1399), (0.0004, 0.0040)),
    Street("W 36th Pl", "University Park", 34.0190, -118.2950, (1100, 1399), (0.0004, 0.0040)),
    Street("W 37th St", "University Park", 34.0175, -118.2950, (1100, 1399), (0.0004, 0.0040)),
    Street("W 37th Pl", "University Park", 34.0168, -118.2955, (1100, 1699), (0.0004, 0.0050)),
    Street(
        "W Jefferson Blvd", "University Park", 34.0255, -118.2880, (1000, 1399), (0.0004, 0.0070)
    ),
    Street(
        "W Adams Blvd", "North University Park", 34.0330, -118.2800, (200, 1499), (0.0006, 0.0120)
    ),
    Street(
        "S Figueroa St", "Figueroa Corridor", 34.0240, -118.2760, (2600, 3799), (0.0080, 0.0006)
    ),
    Street("Flower St", "Figueroa Corridor", 34.0260, -118.2740, (2600, 3199), (0.0050, 0.0004)),
    Street(
        "W Exposition Blvd", "Exposition Park", 34.0185, -118.2900, (800, 1399), (0.0005, 0.0080)
    ),
    Street("Van Buren Pl", "University Park", 34.0270, -118.2965, (2600, 3099), (0.0030, 0.0003)),
)

FIRST_NAMES = [
    "Aarav",
    "Aditi",
    "Alex",
    "Amara",
    "Ana",
    "Andre",
    "Ava",
    "Ben",
    "Bianca",
    "Caleb",
    "Camila",
    "Chloe",
    "Daniel",
    "Dev",
    "Diego",
    "Elena",
    "Emily",
    "Ethan",
    "Fatima",
    "Gabriel",
    "Grace",
    "Hannah",
    "Ishaan",
    "Isabel",
    "Jackson",
    "Jae",
    "Jasmine",
    "Jordan",
    "Kai",
    "Kavya",
    "Leah",
    "Leo",
    "Lucas",
    "Maya",
    "Mei",
    "Mohammed",
    "Naomi",
    "Nikhil",
    "Noah",
    "Olivia",
    "Omar",
    "Priya",
    "Rahul",
    "Riya",
    "Rohan",
    "Ryan",
    "Sakura",
    "Sam",
    "Sara",
    "Sofia",
    "Tanvi",
    "Theo",
    "Uma",
    "Victor",
    "Wei",
    "Yara",
    "Zoe",
    "Zara",
    "Arjun",
    "Ishita",
    "Kenji",
    "Lina",
]
LAST_INITIALS = "ABCDEFGHIJKLMNOPRSTVWYZ"

FEATURES = (
    "fully furnished",
    "in-unit laundry",
    "laundry on site",
    "central AC",
    "gated parking spot",
    "street parking only",
    "big shared kitchen",
    "balcony",
    "hardwood floors",
    "walk-in closet",
    "private bathroom",
    "shared bathroom",
    "gym in the building",
    "rooftop deck",
    "bike storage",
    "utilities included",
    "fast fiber internet",
    "dishwasher",
)

REASONS = (
    "studying abroad in spring",
    "graduating in December",
    "starting a summer internship out of state",
    "moving closer to my lab",
    "transferring to another campus",
    "moving in with my partner",
    "doing a co-op in the Bay Area",
    "my plans changed for next semester",
)

ROOMMATE_NOTES = (
    "The roommates are super chill and respectful of quiet hours.",
    "Everyone cleans up after themselves. Kitchen is always usable.",
    "Two grad students and a senior, all pretty studious during the week.",
    "Very social house, people hang out in the living room most evenings.",
    "Roommates are friendly but mostly keep to themselves.",
    "We split chores on a whiteboard schedule and it actually works.",
    "One roommate cooks a lot and shares, honestly a perk.",
    "Quiet during exams, a few small get-togethers on weekends.",
    "Rent and utilities always paid on time, zero drama.",
    "Great people. We do a group dinner most Sundays.",
    "Roommates are early risers, so mornings are lively and nights are quiet.",
    "Easygoing household, guests are fine with a heads-up.",
)
NOTE_TAGS = (
    "friendly",
    "clean",
    "quiet",
    "social",
    "respectful",
    "studious",
    "pays on time",
    "shares chores",
)

# (listing_type, weight, title template, rent range)
TYPES = (
    ("sublease", 45, "Private room in a {beds}-bed on {street}", (950, 1750)),
    ("sublease", 10, "Studio sublease on {street}", (1450, 2400)),
    ("lease_takeover", 12, "Take over my 1-bed lease on {street}", (1750, 2800)),
    ("lease_takeover", 8, "Whole {beds}-bed unit lease takeover on {street}", (2600, 5600)),
    ("room", 15, "Room open in a {beds}-bed house on {street}", (850, 1550)),
    ("roommate_replacement", 10, "Replacing a roommate in our {beds}-bed on {street}", (900, 1600)),
)

# Typical windows students need covered: (start offset days from Dec 1 2026, length days)
WINDOWS = (
    (30, 140),  # spring semester
    (35, 210),  # spring + summer
    (180, 80),  # summer only
    (240, 330),  # next academic year
    (5, 60),  # winter break + January
    (60, 120),  # mid-spring to summer
    (15, 240),  # rest of lease
)
BASE_DATE = date(2026, 12, 1)


@dataclass
class DemoListing:
    owner_index: int
    listing_type: str
    title: str
    description: str
    address: str
    unit: str | None
    neighborhood: str
    latitude: float
    longitude: float
    monthly_rent: int
    available_from: date
    available_to: date | None
    lifestyle: dict
    days_ago: int
    notes: list[dict] = field(default_factory=list)


def owner_name(index: int) -> str:
    rng = random.Random(10_000 + index)
    return f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_INITIALS)}."


def owner_email(index: int) -> str:
    return f"student{index:04d}@{DEMO_EMAIL_DOMAIN}"


def generate(count: int, seed: int = 2026) -> list[DemoListing]:
    rng = random.Random(seed)
    owners = max(1, int(count * 0.8))
    type_weights = [t[1] for t in TYPES]
    out: list[DemoListing] = []

    for _ in range(count):
        street = rng.choice(STREETS)
        ltype, _, title_tpl, (lo, hi) = rng.choices(TYPES, weights=type_weights)[0]
        beds = rng.choice((2, 2, 3, 3, 4, 4, 5))
        number = rng.randint(*street.numbers)
        unit = rng.choice(
            (None, None, f"{rng.randint(1, 4)}{rng.choice('ABCD')}", str(rng.randint(101, 420)))
        )
        address = f"{number} {street.name}, Los Angeles, CA 90007"

        rent = rng.randint(lo, hi)
        if street.neighborhood == "Figueroa Corridor":
            rent = int(rent * 1.12)  # newer high-rises
        rent = round(rent / 25) * 25

        start_off, length = rng.choice(WINDOWS)
        start = BASE_DATE + timedelta(days=start_off + rng.randint(-10, 20))
        open_ended = ltype == "lease_takeover" and rng.random() < 0.3
        end = None if open_ended else start + timedelta(days=length + rng.randint(-15, 25))

        sleep = rng.choice(("early", "flexible", "flexible", "late"))
        lifestyle = {
            "sleep_schedule": sleep,
            "cleanliness": rng.choice((2, 3, 3, 4, 4, 5)),
            "noise_tolerance": rng.randint(1, 5),
            "guests_frequency": rng.randint(1, 5),
            "smoking": rng.random() < 0.08,
            "drinking": rng.random() < 0.55,
            "pets": rng.random() < 0.15,
        }
        diet = rng.choices(("veg", "non_veg", None), weights=(30, 45, 25))[0]
        if diet:
            lifestyle["diet"] = diet

        features = rng.sample(FEATURES, k=3)
        walk = rng.randint(4, 22)
        reason = rng.choice(REASONS)
        description = (
            f"I'm {reason}, so this is open. {features[0].capitalize()}, {features[1]}, "
            f"and {features[2]}. About a {walk}-minute walk to campus. Demo listing."
        )

        notes: list[dict] = []
        if ltype != "lease_takeover" and rng.random() < 0.45:
            for _ in range(1 if rng.random() < 0.8 else 2):
                rating = rng.choices((5, 4, 3, 2), weights=(45, 35, 15, 5))[0]
                notes.append(
                    {
                        "rating": rating,
                        "tags": rng.sample(NOTE_TAGS, k=rng.randint(1, 3)),
                        "comment": rng.choice(ROOMMATE_NOTES),
                    }
                )

        out.append(
            DemoListing(
                owner_index=rng.randrange(owners),
                listing_type=ltype,
                title=title_tpl.format(beds=beds, street=street.name),
                description=description,
                address=address,
                unit=unit,
                neighborhood=street.neighborhood,
                latitude=round(street.lat + rng.uniform(-1, 1) * street.span[0], 5),
                longitude=round(street.lng + rng.uniform(-1, 1) * street.span[1], 5),
                monthly_rent=rent,
                available_from=start,
                available_to=end,
                lifestyle=lifestyle,
                days_ago=rng.randint(1, 45),
                notes=notes,
            )
        )
    return out
