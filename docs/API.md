# API

Base path: `/api`. Interactive docs are served at `/docs` (Swagger) and `/redoc` while the backend runs.

Errors use one shape:

```json
{ "error": { "code": "ai_provider_error", "message": "..." } }
```

Validation errors are FastAPI's standard `422` with a `detail` array.

## GET /api/health

Always `200`.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "development",
  "database": "ok",
  "llm_provider": "mock",
  "embedding_provider": "hashing"
}
```

`status` is `degraded` and `database` is `unavailable` when Postgres cannot be reached.

## Auth (USC email only)

Passwordless sign-in. Only addresses whose domain is exactly `usc.edu` are accepted (`x@notusc.edu`, `x@mail.usc.edu` and `x@usc.edu.evil.com` are rejected with `403 email_domain_not_allowed`).

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/request-code` | `{ "email" }` → `{ email, delivered_by_email, demo_code }`. `demo_code` is only set in demo mode (no `RESEND_API_KEY`). |
| POST | `/api/auth/verify` | `{ email, code }` → `{ token, user }`. Codes expire after 10 minutes, allow 5 attempts and are single-use. |
| GET | `/api/auth/me` | Requires `Authorization: Bearer <token>`. |
| POST | `/api/auth/logout` | Revokes the token. `204`. |

Codes and session tokens are stored only as hashes.

## Listings and the roommate feedback channel

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/listings` | `{ total, items }`. Query: `q` (street, building, unit), `listing_type`, `neighborhood`, `min_rent`, `max_rent`, `available_by`, `sort` (`newest`, `price_asc`, `price_desc`, `soonest`), `limit` (max 100), `offset`. Items include a roommate feedback summary. |
| GET | `/api/listings/{id}` | Listing plus every roommate note. |
| POST | `/api/listings` | Signed in. Creates a listing; the building is matched or created by name. |
| POST | `/api/listings/{id}/roommate-feedback` | Signed in **and** the listing's owner (the student subleasing). Others get `403`. Body: `{ rating: 1-5, tags: [...], comment }`. |

Allowed tags: `friendly, clean, quiet, social, respectful, studious, pays on time, shares chores`.

About 3,000 demo listings are generated on startup (`DEMO_LISTING_COUNT`, deterministic, real street names near USC with invented numbers, rents and people; owners use the reserved `homie-demo.invalid` domain). Also seeded: *Private room in unit 3157 at Lorenzo* (The Residences at Lorenzo, 325 W Adams Blvd) with the roommate note "The roommates are very cool."

## POST /api/matching/score

Score one seeker against one listing.

```json
{
  "seeker": {
    "budget_max": 1200,
    "move_in": "2027-01-05",
    "move_out": "2027-05-20",
    "preferred_neighborhoods": ["University Park"],
    "max_distance_miles": 1.5,
    "lifestyle": { "sleep_schedule": "early", "cleanliness": 5, "smoking": false }
  },
  "listing": {
    "id": "ellendale-2b",
    "monthly_rent": 1150,
    "available_from": "2027-01-03",
    "available_to": "2027-05-31",
    "neighborhood": "University Park",
    "lifestyle": { "sleep_schedule": "early", "cleanliness": 4, "smoking": false }
  }
}
```

Response:

```json
{
  "listing_id": "ellendale-2b",
  "score": 98,
  "factors": [
    { "factor": "budget", "score": 1.0, "weight": 0.3, "reason": "$1,150/mo is within the $1,200 budget" },
    { "factor": "dates", "score": 1.0, "weight": 0.25, "reason": "Lease dates cover the whole requested stay" },
    { "factor": "location", "score": 1.0, "weight": 0.2, "reason": "In a preferred area (University Park)" },
    { "factor": "lifestyle", "score": 0.917, "weight": 0.25, "reason": "Lifestyle: aligned on sleep schedule, cleanliness, smoking" }
  ],
  "highlights": ["..."],
  "concerns": []
}
```

Lifestyle fields (all optional): `sleep_schedule` (`early | flexible | late`), `cleanliness`, `noise_tolerance`, `guests_frequency` (1 to 5), `smoking`, `drinking`, `pets` (bool), `diet` (`veg | non_veg`).

## POST /api/matching/listings

Scores **every posted listing** for one seeker and returns the best matches with reasons.

```json
{ "seeker": { ...SeekerCriteria }, "listing_types": ["sublease", "room"], "limit": 20 }
```

Response: `{ "scanned": 3001, "results": [ { "listing": Listing, "match": MatchResult } ] }`. An empty `listing_types` means all types. Scoring ~3,000 listings takes about 150 ms.

## POST /api/matching/rank

```json
{ "seeker": { ... }, "listings": [ { ... }, { ... } ], "limit": 10 }
```

Returns a list of `MatchResult`, best first. Up to 200 listings per call.

## POST /api/apartment-intelligence/extract

Runs the configured LLM over one review.

```json
{ "text": "AC was broken for two weeks and we saw roaches in the kitchen. About $1,250 a month all in." }
```

Response (`ReviewExtraction`):

```json
{
  "findings": [
    { "category": "maintenance", "sentiment": "negative", "severity": 2, "evidence": "AC was broken for two weeks" },
    { "category": "pests", "sentiment": "negative", "severity": 2, "evidence": "roaches in the kitchen" }
  ],
  "reported_monthly_cost": 1250,
  "one_line_summary": "Slow maintenance and roaches."
}
```

Categories: `maintenance, pests, management, safety, cleanliness, noise, internet, cost`. With the default `mock` provider this returns an empty extraction; set `LLM_PROVIDER=openai` for real output. Invalid model output returns `502 ai_provider_error`.

## POST /api/apartment-intelligence/insights

Aggregates extracted reviews. Deterministic, no LLM.

```json
{
  "reviews": [
    {
      "review_id": 1,
      "is_verified_resident": true,
      "submitted_on": "2026-09-03",
      "extraction": { "findings": [ ... ], "reported_monthly_cost": 1300 }
    }
  ]
}
```

Response (`ApartmentInsights`) always includes `sample_size`, `verified_count`, `unverified_count`, `period_start`, `period_end`, per-category counts with sample evidence, `recurring_issues` and `median_reported_monthly_cost`.

## Product endpoints

All of these need `Authorization: Bearer <token>` unless marked public.

| Method and path | Purpose |
| --- | --- |
| `PATCH /api/auth/me` | Set the display name. |
| `GET /api/listings` (public) | Search active listings; returns `{ total, items }`. Filters: `q`, `listing_type`, `neighborhood`, `min_rent`, `max_rent`, `available_by`, `apartment_id`, `sort`, `limit`, `offset`. |
| `PUT /api/listings/{id}`, `DELETE /api/listings/{id}` | Edit or delete your own listing. |
| `POST /api/uploads/photo` | Upload a listing photo (JPEG, PNG, WebP). |
| `POST /api/ai/listing-draft` | Rough notes to title and description. |
| `POST /api/ai/risk-check` (public) | Preview the red-flag check for a draft. |
| `GET /api/benchmark` (public) | Rent vs comparable listings, with sample size. |

Every listing in any response also carries `fair_price`: `verdict` (`below`, `fair` within 7%, `above`), a short `headline` for badges ("$140 above similar"), a `summary` sentence, `compared_with` (exactly which listings, e.g. "similar private rooms in 2-beds within a 10-minute walk starting around the same time"), `sample_size`, `median`, `p25`, `p75`, `diff_dollars` and `diff_pct`. Comparables share the kind of space (private room in an N-bed, studio, or whole N-bed unit), the walking band to campus (10 min, 10 to 20, over 20) and a start date within 45 days; when fewer than 5 match, conditions are dropped one at a time and `compared_with` says which remain. Listings with high-risk red flags are never used as comparables. `null` when there are too few.
| `GET /api/map/listings` (public) | Listings with coordinates and travel estimates. |
| `GET/PUT /api/profile` | Lifestyle quiz answers. |
| `GET /api/feed` | Listings ranked for the signed-in seeker. |
| `GET /api/roommates` | Opt-in roommate profiles, ranked. |
| `POST /api/swipes`, `DELETE /api/swipes/{type}/{id}`, `GET /api/saved`, `GET /api/saved/roommates` | Save or pass. |
| `GET/POST /api/conversations`, `GET /api/conversations/{id}`, `POST /api/conversations/{id}/messages` | Messaging. |
| `GET /api/people/{id}` (public), `PUT/DELETE /api/people/{id}/review` | Person reviews. |
| `GET/POST /api/apartments`, `GET /api/apartments/{id}` (GETs public) | Buildings and their insights. |
| `GET/POST /api/apartments/{id}/reviews` | Building reviews. |
| `POST /api/apartments/{id}/ask` (public) | Question answered from reviews, with citations. |
| `POST /api/apartments/{id}/external-summary` (public) | Build the public-review summary when HOMIE reviews are too few. |
| `POST /api/apartments/{id}/verification` | Upload a lease page for the verified-resident badge. |
| `GET /api/admin/verifications`, `POST /api/admin/verifications/{id}/decision` | Admin review (emails in `ADMIN_EMAILS`). |

Interactive docs with full schemas are at `/docs` on the running API.

