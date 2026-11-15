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

Lifestyle fields (all optional): `sleep_schedule` (`early | flexible | late`), `cleanliness`, `noise_tolerance`, `guests_frequency` (1 to 5), `smoking`, `pets` (bool).

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
