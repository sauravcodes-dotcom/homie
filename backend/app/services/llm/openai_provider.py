"""OpenAI-compatible chat completions provider.

Uses plain HTTP so any OpenAI-compatible endpoint (OpenAI, Azure-compatible
gateways, local servers such as vLLM or Ollama) works by changing the base URL.
"""

import httpx

from app.core.errors import AIProviderError
from app.services.llm.base import LLMProvider, Message


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, *, api_key: str, model: str, base_url: str, timeout: float = 30.0):
        self._model = model
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )

    def complete(
        self, messages: list[Message], *, temperature: float = 0.2, json_mode: bool = False
    ) -> str:
        payload: dict = {
            "model": self._model,
            "temperature": temperature,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        try:
            resp = self._client.post("/chat/completions", json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"] or ""
        except httpx.HTTPStatusError as exc:
            raise AIProviderError(
                f"LLM request failed with HTTP {exc.response.status_code}"
            ) from exc
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise AIProviderError("LLM request failed") from exc
