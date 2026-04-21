import re

from app.schemas.provider import KnowledgeSnippet
from app.services.embedding_service import embedding_service
from app.services.repository import repository


class RetrievalService:
    def retrieve_for_provider(self, provider_id: str, product_ids: list[str], limit: int = 3) -> list[KnowledgeSnippet]:
        provider = repository.get_provider_detail(provider_id)
        if provider is None or not product_ids:
            return []

        query_embedding = embedding_service.embed_text(provider.interest_profile)
        semantic_matches = repository.search_product_chunks(query_embedding, product_ids, limit * 3)
        if semantic_matches:
            return [
                KnowledgeSnippet(
                    id=chunk.id,
                    product_id=chunk.product_id,
                    source_document=chunk.source_document,
                    section_title=chunk.section_title,
                    topic=chunk.topic,
                    chunk_text=chunk.chunk_text,
                    display_text=self._format_display_text(chunk.chunk_text),
                    relevance_score=1.0,
                )
                for chunk in semantic_matches[:limit]
            ]

        return [
            KnowledgeSnippet(
                id=chunk.id,
                product_id=chunk.product_id,
                source_document=chunk.source_document,
                section_title=chunk.section_title,
                topic=chunk.topic,
                chunk_text=chunk.chunk_text,
                display_text=self._format_display_text(chunk.chunk_text),
                relevance_score=0.0,
            )
            for chunk in repository.list_product_chunks(product_ids)[:limit]
        ]

    def _format_display_text(self, text: str) -> str:
        cleaned = text.replace("\ufb01", "fi").replace("\ufb02", "fl")
        cleaned = cleaned.replace("\u25cf", "; ").replace("•", "; ").replace("○", "; ")
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
        if not cleaned:
            return ""

        if cleaned and cleaned[0].islower():
            sentence_boundary = re.search(r"[.!?;]\s+", cleaned[:160])
            if sentence_boundary:
                cleaned = cleaned[sentence_boundary.end():].strip()

        sentence_matches = re.findall(r"[^.!?]+[.!?]?", cleaned)
        sentences = [sentence.strip() for sentence in sentence_matches if sentence.strip()]
        excerpt_parts: list[str] = []
        total_length = 0
        for sentence in sentences or [cleaned]:
            if total_length + len(sentence) > 520 and excerpt_parts:
                break
            excerpt_parts.append(sentence)
            total_length += len(sentence) + 1
        excerpt = " ".join(excerpt_parts).strip()
        if excerpt and not excerpt.endswith((".", "!", "?")) and len(cleaned) > len(excerpt):
            excerpt = f"{excerpt}..."
        return excerpt
