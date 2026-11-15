# Architecture

## Overview

```
 Browser ──► React (Vite) ──► /api ──► FastAPI routes ──► services ──► Postgres + pgvector
                                                            │
                                                            ├─► LLMProvider (mock | OpenAI-compatible)
                                                            └─► EmbeddingProvider (hashing | OpenAI-compatible)
```

Frontend and backend are independent projects in one repo. They share only the HTTP contract, which FastAPI publishes as OpenAPI at `/openapi.json`.

## Backend layers

| Layer | Responsibility | Depends on |
| --- | --- | --- |
| `api/` | HTTP: parse and validate input, call one service, shape output | schemas, services |
| `schemas/` | Pydantic contracts for requests, responses and AI outputs | nothing |
| `services/` | Business and AI logic. Pure functions where possible | schemas, provider interfaces |
| `models/` | SQLAlchemy tables | database |
| `database/` | Engine, sessions, schema creation | core.config |
| `core/` | Settings and error handling | nothing |

Rules that keep it testable:

- Routes contain no business logic.
- Scoring and aggregation are pure functions over Pydantic models, so they are unit tested without a database or network.
- Services receive AI providers as arguments (or via FastAPI `Depends`) rather than constructing them, so tests inject `MockLLMProvider`.
- Only the provider implementations know about vendors. Swapping OpenAI for another vendor means adding one class and one branch in the factory.

## Configuration

`app/core/config.py` loads typed settings from environment variables and `.env`. Defaults run fully offline: `LLM_PROVIDER=mock`, `EMBEDDING_PROVIDER=hashing`. API keys are `SecretStr` so they do not leak into logs or reprs.

## Error handling

- `HomieError` subclasses (`NotFoundError`, `AIProviderError`) map to JSON errors: `{"error": {"code", "message"}}`.
- Upstream AI failures and invalid model output become `502 ai_provider_error`.
- Unhandled exceptions are logged and returned as a generic `500` without internals.
- Validation errors use FastAPI's standard `422`.
- `/api/health` always returns `200` and reports `database: unavailable` instead of failing, so the frontend can show status.

## Frontend

- `src/lib/api.ts` is the single typed API client. It uses `VITE_API_URL` in production and the Vite dev proxy locally.
- The landing page's match card calls `POST /api/matching/score` live, which proves the end-to-end path.
- Tailwind v4 design tokens live in `src/index.css` under `@theme`.

## Planned next steps

1. Auth with USC email verification (magic link) and a `users` flow.
2. CRUD endpoints for listings, seeker profiles, apartments and reviews.
3. Embed listings and profiles on write; candidate retrieval with pgvector, then rerank with `score_match`.
4. Review pipeline: on submit, extract → store `reviews.extraction` → embed → refresh apartment insights.
5. RAG question answering over reviews (see AI_DESIGN.md).
6. Alembic migrations once real data exists.
