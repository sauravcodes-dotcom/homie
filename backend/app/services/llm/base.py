"""Provider-agnostic LLM interface.

Application code depends only on `LLMProvider`. Concrete providers live next
to this file and are selected at runtime by `get_llm_provider()`.
"""

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal, TypeVar

from pydantic import BaseModel, ValidationError

from app.core.errors import AIProviderError

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class Message:
    role: Literal["system", "user", "assistant"]
    content: str


class LLMProvider(ABC):
    name: str = "base"
    model: str | None = None
    # True when no real model is behind this provider. Services then use their
    # deterministic offline path instead of asking for generated text.
    offline: bool = False

    @abstractmethod
    def complete(
        self,
        messages: list[Message],
        *,
        temperature: float = 0.2,
        json_mode: bool = False,
        max_tokens: int | None = None,
    ) -> str:
        """Return the model's text response."""

    def complete_structured(
        self,
        messages: list[Message],
        schema: type[T],
        *,
        temperature: float = 0.0,
        max_tokens: int | None = None,
    ) -> T:
        """Ask for JSON matching `schema` and validate it.

        Validation happens here, not in each provider, so every provider gets
        the same guarantees: callers receive a typed object or an AIProviderError.
        """
        instruction = Message(
            role="system",
            content=(
                "Respond with a single JSON object only, no prose. It must validate "
                f"against this JSON Schema:\n{json.dumps(schema.model_json_schema())}"
            ),
        )
        raw = self.complete(
            [instruction, *messages],
            temperature=temperature,
            json_mode=True,
            max_tokens=max_tokens,
        )
        try:
            return schema.model_validate_json(_strip_code_fence(raw))
        except ValidationError as exc:
            raise AIProviderError(
                f"{self.name} returned output that does not match {schema.__name__}"
            ) from exc


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0]
    return text.strip()
