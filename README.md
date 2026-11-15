# HOMIE

**Find your place. Find your people.**

HOMIE is an AI-powered student housing network, starting with USC. It connects students who are subleasing, taking over leases, looking for rooms or replacing roommates, and it gives every apartment building an honest, evidence-backed profile built from resident reviews.

| Module | What it does |
| --- | --- |
| **AI housing & roommate matching** | Scores a seeker against a listing on rent, dates, location, lifestyle and (soon) semantic profile similarity. Every score comes with the reasons behind it. |
| **AI apartment intelligence** | Extracts structured findings from free-text reviews, flags recurring problems and answers questions, always reporting sample size, verified-resident count and reporting period. |

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4
- **Backend:** Python 3.11+, FastAPI, Pydantic v2, pydantic-settings
- **Database:** PostgreSQL 16, SQLAlchemy 2, pgvector
- **AI:** provider-agnostic LLM and embedding layers (offline mock/hashing providers by default, any OpenAI-compatible API when configured)

## Repository layout

```
homie/
├── frontend/                 React + Vite landing page and future web app
├── backend/
│   ├── app/
│   │   ├── api/              HTTP routes (thin: validate, call service, return)
│   │   ├── core/             settings, error types and handlers
│   │   ├── database/         engine, sessions, schema init
│   │   ├── models/           SQLAlchemy tables (with pgvector columns)
│   │   ├── schemas/          Pydantic request/response models
│   │   ├── services/
│   │   │   ├── matching/                 compatibility scoring and ranking
│   │   │   ├── apartment_intelligence/   review extraction and aggregation
│   │   │   ├── embeddings/               embedding provider interface + impls
│   │   │   └── llm/                      LLM provider interface + impls
│   │   └── main.py           app factory
│   ├── tests/
│   └── requirements.txt
├── docs/                     architecture, API, AI design, database schema
├── .github/workflows/ci.yml  lint, tests, schema check, frontend build
├── docker-compose.yml        Postgres + pgvector for local dev
└── .env.example
```

## Quick start

Prerequisites: Python 3.11+, Node 20+, and Docker (or any Postgres 16 with pgvector).

```bash
git clone https://github.com/sauravcodes-dotcom/homie.git
cd homie
cp .env.example .env            # defaults work offline, no API keys needed
```

**1. Database**

```bash
docker compose up -d db
```

**2. Backend** (http://localhost:8000, interactive docs at `/docs`)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m app.database.init_db   # creates the vector extension and tables
uvicorn app.main:app --reload
```

**3. Frontend** (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend, so the landing page's live match card and API status indicator work with no CORS setup.

### Using a real model

Set these in `.env` and restart the API:

```
LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

`OPENAI_BASE_URL` can point at any OpenAI-compatible server (vLLM, Ollama, a gateway). Keep `EMBEDDING_DIMENSIONS` in sync with the vector columns; changing it means recreating them.

## Checks

```bash
cd backend && ruff check . && ruff format --check . && pytest
cd frontend && npm run lint && npm run build
```

CI runs the same steps on every push and pull request, plus schema creation against a real Postgres + pgvector service.

## API at a glance

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness, DB status, active AI providers |
| POST | `/api/matching/score` | Explainable score for one seeker and one listing |
| POST | `/api/matching/rank` | Rank many listings for a seeker |
| POST | `/api/apartment-intelligence/extract` | Structured extraction from one review (LLM) |
| POST | `/api/apartment-intelligence/insights` | Aggregate extracted reviews into grounded insights |

Details in [docs/API.md](docs/API.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [AI design](docs/AI_DESIGN.md)
- [Database schema](docs/DATABASE_SCHEMA.md)

## Security

Secrets are read from environment variables only. `.env` files are git-ignored; commit changes to `.env.example` instead. Never put real keys in code, tests or docs.
