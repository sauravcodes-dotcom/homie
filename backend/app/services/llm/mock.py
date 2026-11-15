from collections.abc import Callable

from app.services.llm.base import LLMProvider, Message

Responder = Callable[[list[Message]], str]


class MockLLMProvider(LLMProvider):
    """Deterministic, offline provider for development and tests.

    Pass a `responder` to script responses in tests. Without one it returns an
    empty JSON object in JSON mode, which validates against schemas whose
    fields all have defaults.
    """

    name = "mock"

    def __init__(self, responder: Responder | None = None):
        self._responder = responder
        # A scripted mock behaves like a real model; an unscripted one is "offline".
        self.offline = responder is None

    def complete(
        self, messages: list[Message], *, temperature: float = 0.2, json_mode: bool = False
    ) -> str:
        if self._responder is not None:
            return self._responder(messages)
        return "{}" if json_mode else "This is a mock response."
