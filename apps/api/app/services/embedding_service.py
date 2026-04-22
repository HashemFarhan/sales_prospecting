from __future__ import annotations

from hashlib import sha256

from app.core.config import settings
from app.models.entities import EmbeddingResult
from app.services.openai_service import OpenAIService
from app.services.openai_service import LiveDependencyError


class EmbeddingService:
    def __init__(self) -> None:
        self.openai_service = OpenAIService()
        self.dimensions = 1536

    def embed_texts_with_metadata(self, texts: list[str]) -> EmbeddingResult:
        cleaned = [text.strip() for text in texts]
        if not cleaned:
            return EmbeddingResult(vectors=[], source="none", notice=None)
        vectors, notice = self.openai_service.create_embeddings(cleaned)
        if vectors is not None:
            return EmbeddingResult(vectors=vectors, source="live", notice=None)
        if settings.allow_mock_fallback:
            return EmbeddingResult(
                vectors=[self._mock_embedding(text) for text in cleaned],
                source="fallback",
                notice=notice,
            )
        raise LiveDependencyError(notice or "Live embeddings are unavailable.")

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return self.embed_texts_with_metadata(texts).vectors

    def embed_text_with_metadata(self, text: str) -> EmbeddingResult:
        result = self.embed_texts_with_metadata([text])
        if not result.vectors:
            result.vectors = [self._mock_embedding(text)] if settings.allow_mock_fallback else []
        return result

    def embed_text(self, text: str) -> list[float]:
        result = self.embed_text_with_metadata(text)
        return result.vectors[0] if result.vectors else self._mock_embedding(text)

    def _mock_embedding(self, text: str) -> list[float]:
        digest = sha256(text.encode("utf-8")).digest()
        values = []
        for index in range(self.dimensions):
            byte = digest[index % len(digest)]
            values.append((byte / 255.0) - 0.5)
        return values


embedding_service = EmbeddingService()
