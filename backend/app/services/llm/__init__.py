from functools import lru_cache

from app.core.config import Settings, get_settings
from app.core.errors import HomieError
from app.services.llm.base import LLMProvider, Message
from app.services.llm.mock import MockLLMProvider
from app.services.llm.openai_provider import OpenAIProvider


def build_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "openai":
        if settings.openai_api_key is None:
            raise HomieError("LLM_PROVIDER=openai requires OPENAI_API_KEY")
        return OpenAIProvider(
            api_key=settings.openai_api_key.get_secret_value(),
            model=settings.llm_model,
            base_url=settings.openai_base_url,
            timeout=settings.ai_request_timeout_seconds,
        )
    return MockLLMProvider()


@lru_cache
def get_llm_provider() -> LLMProvider:
    """FastAPI dependency. Override in tests via app.dependency_overrides."""
    return build_llm_provider(get_settings())


__all__ = ["LLMProvider", "Message", "MockLLMProvider", "build_llm_provider", "get_llm_provider"]
