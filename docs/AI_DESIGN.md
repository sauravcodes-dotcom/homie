# AI design

Two principles shape every AI feature in HOMIE:

1. **Numbers are computed, words are generated.** Scores, counts and rankings come from deterministic code that can be tested and audited. LLMs extract structure from text and phrase answers, but they do not invent the numbers.
2. **Every claim shows its evidence.** Apartment answers carry sample size, verified-resident count and reporting period. If the evidence is thin, the answer says so.

## Provider layer

```
services/llm/base.py          LLMProvider (abstract): complete(), complete_structured()
services/llm/mock.py          deterministic, scriptable, offline
services/llm/openai_provider  any OpenAI-compatible /chat/completions endpoint
services/embeddings/base.py   EmbeddingProvider (abstract): embed(), cosine_similarity()
services/embeddings/hashing   offline feature-hashing embeddings
services/embeddings/openai_*  any OpenAI-compatible /embeddings endpoint
```

`complete_structured(messages, Schema)` is implemented once in the base class: it sends the Pydantic JSON Schema, requests JSON mode, strips code fences and validates. Callers get a typed object or an `AIProviderError`. Adding Anthropic, Gemini or a local model means one subclass implementing `complete()`.

Offline defaults keep development, tests and CI free, deterministic and key-less.

## Module A: matching

**Current:** `services/matching/scoring.py`

| Factor | Weight | Logic |
| --- | --- | --- |
| Budget | 0.30 | 1.0 at or under budget, linear to 0 at 25% over |
| Dates | 0.25 | Overlap of availability and requested stay ÷ requested stay (open-ended stays assume ~11 months) |
| Location | 0.20 | Preferred neighborhood = 1.0; else haversine distance from USC campus vs the seeker's limit; 0.5 when unknown |
| Lifestyle | 0.25 | Mean agreement over shared fields (sleep, cleanliness, noise, guests, smoking, drinking, diet, pets). Smoking mismatch caps it at 0.3; a veg vs non-veg mismatch scores 0.4 |
| Semantic | 0.15 | Optional cosine similarity of profile and listing embeddings |

Weights are renormalised over the factors that have data, so sparse profiles are not penalised. Each factor emits a reason string; `highlights` and `concerns` are derived from them.

**Next:**

1. Embed listing text and seeker bio on write (`listings.embedding`, `seeker_profiles.embedding`).
2. Retrieval: hard filters in SQL (dates, rent ≤ 1.25 × budget), then top-K by pgvector cosine distance.
3. Rerank candidates with `score_match(..., semantic_similarity=...)`.
4. Optional LLM pass that rewrites the factor reasons into a friendly paragraph, constrained to the computed factors.
5. Mutual matching for roommates: score both directions and combine (e.g. harmonic mean) so a match must work for both people.

## Module B: apartment intelligence

**Pipeline**

```
review text ─► extract_review (LLM, validated) ─► reviews.extraction (JSONB)
                                               └► embed review text ─► reviews.embedding
reviews for apartment ─► aggregate_reviews (deterministic) ─► ApartmentInsights
question ─► retrieve reviews (pgvector + apartment filter) ─► grounded answer (LLM)
```

**Extraction** (`extraction.py`): the prompt restricts the model to what the review states, fixes the category set, and asks for a short evidence phrase per finding. Output is validated against `ReviewExtraction`; anything off-schema is rejected.

**Aggregation** (`aggregation.py`): counts each category at most once per review, so one long review cannot outweigh several residents. A category is a *recurring issue* when ≥ 2 reviews are negative and they are ≥ 40% of that category's mentions. Output always carries sample size, verified/unverified counts and the reporting period.

**RAG Q&A (next):**

1. Embed the question; retrieve the top-K reviews for the apartment, preferring verified and recent ones.
2. Pass the aggregated `ApartmentInsights` plus the retrieved review snippets (with IDs, dates and verified flags) to the LLM.
3. Require the answer to cite review IDs and state the sample size and period. Refuse to conclude when fewer than about 3 relevant reviews exist.
4. Validate with a structured schema (`answer`, `confidence`, `citations[]`) before returning.

**Comparison (next):** run `aggregate_reviews` per apartment and weight categories by the user's stated priorities (for example "pests matter most").

## Trust and safety

- Verified vs unverified reviews are stored separately (`is_verified_resident`) and always reported separately.
- Extraction never infers problems that are not in the text.
- Evidence snippets let users see the source of every flagged issue.
- Prompt-injection hygiene: review text is wrapped in delimiters and treated as data in the system prompt; outputs are schema-validated.
