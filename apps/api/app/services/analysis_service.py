from uuid import uuid4

from app.models.entities import GeneratedOutput
from app.schemas.provider import (
    AnalysisResponse,
    GeneratedOutputResponse,
    ImpactBreakdown,
    ProductMatchResponse,
    ProviderRankingResponse,
)
from app.services.openai_service import OpenAIService
from app.services.ranking_service import RankingService
from app.services.repository import repository
from app.services.retrieval_service import RetrievalService


class AnalysisService:
    def __init__(self) -> None:
        self.retrieval_service = RetrievalService()
        self.ranking_service = RankingService()
        self.openai_service = OpenAIService()

    def retrieve_evidence(self, provider_id: str, product_ids: list[str]) -> list:
        return self.retrieval_service.retrieve_for_provider(provider_id, product_ids)

    def rank_provider(self, provider_id: str) -> ProviderRankingResponse | None:
        return self.ranking_service.rank_providers(provider_id)

    def generate_output(self, provider_id: str) -> GeneratedOutputResponse | None:
        provider = repository.get_provider_detail(provider_id)
        if provider is None:
            return None
        all_matches = repository.get_doctor_product_matches(provider_id)
        matches = [match for match in all_matches if match.is_relevant]
        selected_matches = matches[:3] if matches else all_matches[:2]
        top_product_ids = [match.product_id for match in selected_matches]
        top_products = repository.get_products(top_product_ids)
        evidence = self.retrieve_evidence(provider_id, top_product_ids)
        prompt_payload = {
            "provider": provider.model_dump(mode="json"),
            "top_products": [
                {
                    "product_id": product.id,
                    "product_name": product.product_name,
                    "description": product.description,
                }
                for product in top_products
            ],
            "evidence": [snippet.display_text or snippet.chunk_text for snippet in evidence],
            "sources": [f"{snippet.source_document}::{snippet.section_title}" for snippet in evidence],
        }
        generated = self.openai_service.generate_sales_output(prompt_payload)
        output = GeneratedOutput(
            id=str(uuid4()),
            provider_id=provider_id,
            top_product_ids=top_product_ids,
            objection_handler=generated["objection_handler"],
            meeting_script=generated["meeting_script"],
            supporting_snippets=generated["citations"],
            generation_source=generated["generation_source"],
            generation_notice=generated.get("generation_notice"),
            created_at=repository.now(),
        )
        repository.upsert_generated_output(output)
        return GeneratedOutputResponse(
            provider_id=provider_id,
            top_product_ids=output.top_product_ids,
            objection_handler=output.objection_handler,
            meeting_script=output.meeting_script,
            supporting_snippets=output.supporting_snippets,
            generation_source=output.generation_source,
            generation_notice=output.generation_notice,
        )

    def analyze_provider(self, provider_id: str) -> AnalysisResponse | None:
        provider = repository.get_provider_detail(provider_id)
        if provider is None:
            return None

        ranking = self.rank_provider(provider_id)
        generated = self.generate_output(provider_id)
        assert ranking is not None
        assert generated is not None
        impact = repository.get_impact_ranking(provider_id)
        matches = repository.get_doctor_product_matches(provider_id)
        product_map = {product.id: product for product in repository.get_products([match.product_id for match in matches])}
        top_matched_products = [
            ProductMatchResponse(
                product_id=match.product_id,
                product_name=product_map[match.product_id].product_name,
                description=product_map[match.product_id].description,
                interest_embedding_similarity=match.interest_embedding_similarity,
                llm_relevance_score=match.llm_relevance_score,
                llm_relevance_label=match.llm_relevance_label,
                llm_reasoning=match.llm_reasoning,
                is_relevant=match.is_relevant,
                evaluation_source=match.evaluation_source,
                evaluation_notice=match.evaluation_notice,
            )
            for match in matches[:4]
            if match.product_id in product_map
        ]
        evidence = self.retrieve_evidence(provider_id, generated.top_product_ids)
        assert impact is not None
        return AnalysisResponse(
            provider=provider,
            ranking=ranking,
            top_matched_products=top_matched_products,
            impact=ImpactBreakdown(
                relevant_product_count=impact.relevant_product_count,
                similarity_sum=impact.similarity_sum,
                mean_llm_relevance_score=impact.mean_llm_relevance_score,
                size=impact.size,
                impact_score=impact.impact_score,
                rank_reasoning=impact.rank_reasoning,
                match_source=impact.match_source,
                match_notice=impact.match_notice,
            ),
            objection_handler=generated.objection_handler,
            meeting_script=generated.meeting_script,
            evidence=evidence,
            citations=generated.supporting_snippets,
            generation_source=generated.generation_source,
            generation_notice=generated.generation_notice,
        )
