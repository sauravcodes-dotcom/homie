from functools import lru_cache

from app.core.config import Settings, get_settings
from app.core.errors import HomieError
from app.services.llm.base import LLMProvider, Message
from app.services.llm.mock import MockLLMProvider
from app.services.llm.openai_provider import OpenAIProvider


def build_llm_provider(settings: Settings) -> LLMProvider:
    provider = settings.effective_llm_provider
    if provider == "groq":
        if settings.groq_api_key is None:
            raise HomieError("LLM_PROVIDER=groq requires GROQ_API_KEY")
        return OpenAIProvider(
            api_key=settings.groq_api_key.get_secret_value(),
            model=settings.groq_model,
            base_url=settings.groq_base_url,
            timeout=settings.ai_request_timeout_seconds,
            name="groq",
            # GPT-OSS models reason before answering; low effort keeps search fast.
            extra_body={"reasoning_effort": "low"} if "gpt-oss" in settings.groq_model else None,
        )
    if provider == "openai":
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
