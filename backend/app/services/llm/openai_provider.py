"""OpenAI-compatible chat completions provider.

Uses plain HTTP so any OpenAI-compatible endpoint (OpenAI, Azure-compatible
gateways, local servers such as vLLM or Ollama) works by changing the base URL.
"""

import logging
import time

import httpx

from app.core.errors import AIProviderError
from app.services.llm.base import LLMProvider, Message

logger = logging.getLogger("homie")


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
        timeout: float = 30.0,
        name: str = "openai",
        extra_body: dict | None = None,
    ):
        self.name = name
        # Provider-specific request fields, e.g. Groq's reasoning_effort.
        self._extra_body = extra_body or {}
        self.model = model
        self._model = model
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )

    def complete(
        self,
        messages: list[Message],
        *,
        temperature: float = 0.2,
        json_mode: bool = False,
        max_tokens: int | None = None,
    ) -> str:
        payload: dict = {
            "model": self._model,
            "temperature": temperature,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        if max_tokens:
            # Also keeps rate-limited free tiers happy: some providers count the
            # requested output size against tokens-per-minute.
            payload["max_tokens"] = max_tokens
        payload.update(self._extra_body)
        try:
            resp = self._client.post("/chat/completions", json=payload)
            if resp.status_code == 429:
                wait = _retry_after_seconds(resp)
                if wait is not None and wait <= 4:
                    logger.info("%s rate limited; retrying in %.1fs", self.name, wait)
                    time.sleep(wait)
                    resp = self._client.post("/chat/completions", json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"] or ""
        except httpx.HTTPStatusError as exc:
            # Keep the provider's own explanation (e.g. "model not found") in the
            # logs; it is the fastest way to diagnose a misconfiguration.
            detail = exc.response.text[:300]
            logger.warning("%s returned HTTP %s: %s", self.name, exc.response.status_code, detail)
            raise AIProviderError(
                f"LLM request failed with HTTP {exc.response.status_code}"
            ) from exc
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise AIProviderError("LLM request failed") from exc


def _retry_after_seconds(resp: httpx.Response) -> float | None:
    raw = resp.headers.get("retry-after")
    if raw is None:
        return None
    try:
        return max(0.0, float(raw))
    except ValueError:
        return None
