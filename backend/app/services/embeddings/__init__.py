from functools import lru_cache

from app.core.config import Settings, get_settings
from app.core.errors import HomieError
from app.services.embeddings.base import EmbeddingProvider, cosine_similarity
from app.services.embeddings.hashing import HashingEmbeddingProvider
from app.services.embeddings.openai_embeddings import OpenAIEmbeddingProvider


def build_embedding_provider(settings: Settings) -> EmbeddingProvider:
    if settings.embedding_provider == "openai":
        if settings.openai_api_key is None:
            raise HomieError("EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY")
        return OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key.get_secret_value(),
            model=settings.embedding_model,
            dimensions=settings.embedding_dimensions,
            base_url=settings.openai_base_url,
            timeout=settings.ai_request_timeout_seconds,
        )
    return HashingEmbeddingProvider(settings.embedding_dimensions)


@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    return build_embedding_provider(get_settings())


__all__ = [
    "EmbeddingProvider",
    "HashingEmbeddingProvider",
    "build_embedding_provider",
    "cosine_similarity",
    "get_embedding_provider",
]
