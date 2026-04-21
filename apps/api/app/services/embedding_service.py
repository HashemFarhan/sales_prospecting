from __future__ import annotations

from hashlib import sha256

from app.core.config import settings
from app.services.openai_service import OpenAIService


class EmbeddingService:
    def __init__(self) -> None:
        self.openai_service = OpenAIService()
        self.dimensions = 1536

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        cleaned = [text.strip() for text in texts]
        if not cleaned:
            return []
        vectors = self.openai_service.create_embeddings(cleaned)
        if vectors is not None:
            return vectors
        return [self._mock_embedding(text) for text in cleaned]

    def embed_text(self, text: str) -> list[float]:
        vectors = self.embed_texts([text])
        return vectors[0] if vectors else self._mock_embedding(text)

    def _mock_embedding(self, text: str) -> list[float]:
        digest = sha256(text.encode("utf-8")).digest()
        values = []
        for index in range(self.dimensions):
            byte = digest[index % len(digest)]
            values.append((byte / 255.0) - 0.5)
        return values


embedding_service = EmbeddingService()
