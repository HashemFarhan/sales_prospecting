from uuid import uuid4

from app.core.config import settings
from app.models.entities import DoctorProductMatch, ImpactRanking
from app.schemas.provider import ProviderRankingResponse, RankedProvider
from app.services.embedding_service import embedding_service
from app.services.openai_service import OpenAIService
from app.services.repository import repository


class RankingService:
    def __init__(self) -> None:
        self.openai_service = OpenAIService()

    def rank_providers(self, selected_provider_id: str) -> ProviderRankingResponse | None:
        providers = [repository.get_provider(item.id) for item in repository.list_providers()]
        providers = [provider for provider in providers if provider is not None]
        if not any(provider.id == selected_provider_id for provider in providers):
            return None

        products = repository.get_products()
        product_payloads = [
            {
                "product_id": product.id,
                "product_name": product.product_name,
                "description": product.description,
                "comparison_text": self._product_comparison_text(product),
            }
            for product in products
        ]
        product_embeddings = embedding_service.embed_texts([payload["comparison_text"] for payload in product_payloads]) if product_payloads else []

        raw_scores: list[dict] = []
        for provider in providers:
            detail = repository.get_provider_detail(provider.id)
            if detail is None:
                continue
            provider_embedding = embedding_service.embed_text(detail.interest_profile)
            candidate_scores = []
            for payload, product_embedding in zip(product_payloads, product_embeddings):
                similarity = self._cosine_similarity(provider_embedding, product_embedding)
                candidate_scores.append(
                    {
                        "product_id": payload["product_id"],
                        "product_name": payload["product_name"],
                        "description": payload["description"],
                        "interest_embedding_similarity": similarity,
                    }
                )
            candidate_scores.sort(key=lambda item: item["interest_embedding_similarity"], reverse=True)
            shortlisted = candidate_scores[: settings.product_shortlist_count]
            reranked = self.openai_service.rerank_products(
                {
                    "provider": detail.model_dump(mode="json"),
                    "candidates": shortlisted,
                }
            )
            reranked_by_id = {item["product_id"]: item for item in reranked["matches"]}
            matches: list[DoctorProductMatch] = []
            for candidate in shortlisted:
                llm_item = reranked_by_id.get(candidate["product_id"])
                if llm_item is None:
                    continue
                matches.append(
                    DoctorProductMatch(
                        id=str(uuid4()),
                        provider_id=provider.id,
                        product_id=candidate["product_id"],
                        interest_embedding_similarity=round(candidate["interest_embedding_similarity"], 4),
                        llm_relevance_score=float(llm_item["llm_relevance_score"]),
                        llm_relevance_label=llm_item["llm_relevance_label"],
                        llm_reasoning=llm_item["llm_reasoning"],
                        is_relevant=bool(llm_item["is_relevant"]),
                        evaluation_source=reranked["evaluation_source"],
                        evaluation_notice=reranked.get("evaluation_notice"),
                        created_at=repository.now(),
                    )
                )
            repository.replace_doctor_product_matches(provider.id, matches)
            relevant = [match for match in matches if match.is_relevant]
            raw_scores.append(
                {
                    "provider": provider,
                    "matches": matches,
                    "relevant_product_count": len(relevant),
                    "similarity_sum": sum(match.interest_embedding_similarity for match in matches),
                    "mean_llm_relevance_score": (
                        sum(match.llm_relevance_score for match in relevant) / len(relevant) if relevant else 0.0
                    ),
                    "size": provider.size,
                    "match_source": reranked["evaluation_source"],
                    "match_notice": reranked.get("evaluation_notice"),
                }
            )

        self._persist_rankings(raw_scores)
        ranked_providers = [
            RankedProvider(
                provider_id=item["provider"].id,
                doctor_name=item["provider"].doctor_name,
                clinic_or_hospital=item["provider"].clinic_or_hospital,
                impact_score=item["impact_score"],
                rank_reasoning=item["rank_reasoning"],
            )
            for item in sorted(raw_scores, key=lambda row: row["impact_score"], reverse=True)
        ]
        return ProviderRankingResponse(selected_provider_id=selected_provider_id, ranked_providers=ranked_providers)

    def _persist_rankings(self, raw_scores: list[dict]) -> None:
        if not raw_scores:
            return
        relevant_counts = [item["relevant_product_count"] for item in raw_scores]
        similarity_sums = [item["similarity_sum"] for item in raw_scores]
        sizes = [item["size"] for item in raw_scores]
        llm_scores = [item["mean_llm_relevance_score"] for item in raw_scores]

        for item in raw_scores:
            normalized_relevant = self._normalize(item["relevant_product_count"], relevant_counts)
            normalized_similarity = self._normalize(item["similarity_sum"], similarity_sums)
            normalized_size = self._normalize(item["size"], sizes)
            normalized_llm = self._normalize(item["mean_llm_relevance_score"], llm_scores)
            impact_score = round(
                settings.impact_weight_relevant_count * normalized_relevant
                + settings.impact_weight_similarity_sum * normalized_similarity
                + settings.impact_weight_size * normalized_size
                + settings.impact_weight_llm_score * normalized_llm,
                4,
            )
            rank_reasoning = (
                f"Impact score combines {item['relevant_product_count']} relevant products, "
                f"{round(item['similarity_sum'], 2)} total semantic similarity, size {item['size']}, "
                f"and mean LLM relevance {round(item['mean_llm_relevance_score'], 2)}."
            )
            item["impact_score"] = impact_score
            item["rank_reasoning"] = rank_reasoning
            repository.upsert_impact_ranking(
                ImpactRanking(
                    id=item["provider"].id,
                    provider_id=item["provider"].id,
                    relevant_product_count=item["relevant_product_count"],
                    similarity_sum=round(item["similarity_sum"], 4),
                    mean_llm_relevance_score=round(item["mean_llm_relevance_score"], 4),
                    size=item["size"],
                    impact_score=impact_score,
                    rank_reasoning=rank_reasoning,
                    match_source=item["match_source"],
                    match_notice=item["match_notice"],
                    created_at=repository.now(),
                )
            )

    def _normalize(self, value: float, collection: list[float]) -> float:
        minimum = min(collection)
        maximum = max(collection)
        if maximum == minimum:
            return 1.0 if maximum > 0 else 0.0
        return (value - minimum) / (maximum - minimum)

    def _product_comparison_text(self, product) -> str:
        return f"{product.product_name}. {product.description}. {product.details}"

    def _cosine_similarity(self, left: list[float], right: list[float]) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right))
        left_norm = sum(a * a for a in left) ** 0.5
        right_norm = sum(b * b for b in right) ** 0.5
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return dot / (left_norm * right_norm)
