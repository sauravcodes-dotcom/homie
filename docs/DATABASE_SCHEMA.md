# Database schema

PostgreSQL 16 with the `vector` extension (pgvector). Tables are defined in `backend/app/models/` and created by `python -m app.database.init_db`. Alembic migrations come once real data exists.

Vector columns use `EMBEDDING_DIMENSIONS` (default 384). Changing it requires recreating those columns.

```
users ─┬─< listings >── apartments ──< reviews
       ├─< seeker_profiles
       └─< reviews (author, optional)
```

## users

| Column | Type | Notes |
| --- | --- | --- |
| id | serial PK | |
| email | varchar(320) unique | |
| full_name | varchar(200) | |
| is_usc_verified | bool | true after verifying a usc.edu address |
| created_at | timestamptz | |

## listings (housing supply)

| Column | Type | Notes |
| --- | --- | --- |
| id | serial PK | |
| owner_id | FK users | cascade delete |
| apartment_id | FK apartments, nullable | links to resident reviews |
| listing_type | enum | `sublease`, `lease_takeover`, `room`, `roommate_replacement` |
| title, description | text | |
| monthly_rent | int | whole USD |
| available_from / available_to | date | `available_to` null = open-ended |
| neighborhood, latitude, longitude | | |
| lifestyle | jsonb | household lifestyle signals |
| embedding | vector(N) | listing text embedding |
| created_at | timestamptz | |

## seeker_profiles (housing demand)

| Column | Type | Notes |
| --- | --- | --- |
| id | serial PK | |
| user_id | FK users | |
| budget_min, budget_max | int | |
| move_in, move_out | date | |
| preferred_neighborhoods | jsonb (list) | |
| max_distance_miles | float | from USC University Park campus |
| lifestyle | jsonb | |
| bio | text | |
| embedding | vector(N) | |

## apartments

| Column | Type | Notes |
| --- | --- | --- |
| id | serial PK | |
| name | varchar(200) | indexed |
| address | varchar(300) | |
| neighborhood, latitude, longitude | | |

## reviews

| Column | Type | Notes |
| --- | --- | --- |
| id | serial PK | |
| apartment_id | FK apartments | |
| author_id | FK users, nullable | |
| is_verified_resident | bool | indexed; drives verified/unverified reporting |
| body | text | raw review |
| overall_rating | int | 1 to 5 |
| lived_from / lived_to | date | residency period |
| extraction | jsonb | validated `ReviewExtraction` |
| embedding | vector(N) | for RAG retrieval |
| created_at | timestamptz | reporting period is computed from this |

## login_codes / user_sessions

One-time sign-in codes (HMAC hash, expiry, attempt count, used flag) and session tokens (SHA-256 hash, expiry). Raw codes and tokens are never stored.

## roommate_feedback

| Column | Type | Notes |
| --- | --- | --- |
| id | serial PK | |
| listing_id | FK listings | cascade delete |
| author_id | FK users | must be the listing owner (the subleaser) |
| rating | int | 1 to 5 |
| tags | json | from a fixed tag set |
| comment | text | |
| created_at | timestamptz | |

Listings also gained `unit` and `is_demo`. On SQLite (tests, the Vercel demo fallback) JSONB becomes JSON and vector columns are stored as JSON arrays.

## Indexes to add with real data

- HNSW indexes for similarity search, e.g. `CREATE INDEX ON listings USING hnsw (embedding vector_cosine_ops);` (same for `seeker_profiles`, `reviews`).
- `listings (available_from, monthly_rent)` for hard filters before vector search.
- `reviews (apartment_id, created_at)` for per-apartment, per-period aggregation.
