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
