import hashlib
import math
import re

from app.services.embeddings.base import EmbeddingProvider

_TOKEN = re.compile(r"[a-z0-9]+")


class HashingEmbeddingProvider(EmbeddingProvider):
    """Offline embeddings via the hashing trick over unigrams and bigrams.

    Not semantic in the way a learned model is, but deterministic, free and
    good enough to exercise the full pgvector pipeline locally and in CI.
    """

    name = "hashing"

    def __init__(self, dimensions: int = 384):
        self.dimensions = dimensions

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def _embed(self, text: str) -> list[float]:
        tokens = _TOKEN.findall(text.lower())
        features = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:], strict=False)]
        vec = [0.0] * self.dimensions
        for feat in features:
            digest = hashlib.blake2b(feat.encode(), digest_size=8).digest()
            h = int.from_bytes(digest, "little")
            sign = 1.0 if (h >> 63) & 1 else -1.0
            vec[h % self.dimensions] += sign
        norm = math.sqrt(sum(v * v for v in vec))
        return [v / norm for v in vec] if norm else vec
