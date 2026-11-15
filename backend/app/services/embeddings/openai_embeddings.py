import httpx

from app.core.errors import AIProviderError
from app.services.embeddings.base import EmbeddingProvider


class OpenAIEmbeddingProvider(EmbeddingProvider):
    name = "openai"

    def __init__(
        self, *, api_key: str, model: str, dimensions: int, base_url: str, timeout: float = 30.0
    ):
        self._model = model
        self.dimensions = dimensions
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )

    def embed(self, texts: list[str]) -> list[list[float]]:
        payload = {"model": self._model, "input": texts, "dimensions": self.dimensions}
        try:
            resp = self._client.post("/embeddings", json=payload)
            resp.raise_for_status()
            data = sorted(resp.json()["data"], key=lambda d: d["index"])
            return [d["embedding"] for d in data]
        except httpx.HTTPStatusError as exc:
            raise AIProviderError(
                f"Embedding request failed with HTTP {exc.response.status_code}"
            ) from exc
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise AIProviderError("Embedding request failed") from exc
