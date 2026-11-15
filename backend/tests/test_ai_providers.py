import pytest

from app.core.config import Settings
from app.core.errors import HomieError
from app.services.embeddings import (
    HashingEmbeddingProvider,
    build_embedding_provider,
    cosine_similarity,
)
from app.services.llm import MockLLMProvider, build_llm_provider


def test_hashing_embeddings_are_deterministic_and_normalised():
    p = HashingEmbeddingProvider(64)
    a1, a2 = p.embed(["quiet early riser, very clean", "quiet early riser, very clean"])
    assert a1 == a2
    assert len(a1) == 64
    assert abs(sum(x * x for x in a1) - 1) < 1e-9


def test_similar_text_scores_higher():
    p = HashingEmbeddingProvider(256)
    base = p.embed_one("quiet clean non smoker who sleeps early")
    close = p.embed_one("clean quiet non smoker, sleeps early")
    far = p.embed_one("party every weekend with loud music")
    assert cosine_similarity(base, close) > cosine_similarity(base, far)


def test_factory_defaults_to_offline_providers():
    s = Settings(llm_provider="mock", embedding_provider="hashing", embedding_dimensions=32)
    assert isinstance(build_llm_provider(s), MockLLMProvider)
    assert build_embedding_provider(s).dimensions == 32


def test_openai_provider_requires_key():
    with pytest.raises(HomieError):
        build_llm_provider(Settings(llm_provider="openai", openai_api_key=None))


def test_openai_compatible_provider_sends_caps_and_retries_once_on_429(monkeypatch):
    import httpx

    from app.services.llm import Message
    from app.services.llm import openai_provider as op

    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json

        calls.append(_json.loads(request.content))
        if len(calls) == 1:
            return httpx.Response(429, headers={"retry-after": "0"}, json={"error": "slow down"})
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    monkeypatch.setattr(op.time, "sleep", lambda s: None)
    provider = op.OpenAIProvider(
        api_key="test",
        model="openai/gpt-oss-120b",
        base_url="https://api.groq.com/openai/v1",
        name="groq",
        extra_body={"reasoning_effort": "low"},
    )
    provider._client = httpx.Client(
        base_url="https://api.groq.com/openai/v1", transport=httpx.MockTransport(handler)
    )
    assert provider.complete([Message("user", "hi")], max_tokens=50) == "ok"
    assert len(calls) == 2
    assert calls[1]["max_tokens"] == 50
    assert calls[1]["reasoning_effort"] == "low"
    assert calls[1]["model"] == "openai/gpt-oss-120b"
