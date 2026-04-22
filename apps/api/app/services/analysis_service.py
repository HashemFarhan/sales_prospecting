from uuid import uuid4

from app.models.entities import GeneratedOutput
from app.schemas.provider import (
    AnalysisResponse,
    GeneratedOutputResponse,
    ImpactBreakdown,
    MeetingScriptResponse,
    PipelineDiagnostics,
    ProductMatchResponse,
    ProviderRankingResponse,
    ProviderWorkspaceResponse,
    RankedProvider,
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
        output = self._build_generated_output(provider_id)
        if output is None:
            return None
        return self._generated_output_response(provider_id, output)

    def regenerate_meeting_script(
        self,
        provider_id: str,
        feedback: str,
        current_script: str | None = None,
    ) -> MeetingScriptResponse | None:
        output = self._build_generated_output(
            provider_id,
            pitch_feedback=feedback,
            current_script=current_script,
        )
        if output is None:
            return None
        return MeetingScriptResponse(
            provider_id=provider_id,
            meeting_script=output.meeting_script,
            generation_source=output.generation_source,
            generation_notice=output.generation_notice,
        )

    def _build_generated_output(
        self,
        provider_id: str,
        pitch_feedback: str | None = None,
        current_script: str | None = None,
    ) -> GeneratedOutput | None:
        provider = repository.get_provider_detail(provider_id)
        if provider is None:
            return None
        all_matches = repository.get_doctor_product_matches(provider_id)
        matches = [match for match in all_matches if match.is_relevant]
        selected_matches = matches[:3] if matches else all_matches[:2]
        top_product_ids = [match.product_id for match in selected_matches]
        top_products = repository.get_products(top_product_ids)
        retrieval_result = self.retrieve_evidence(provider_id, top_product_ids)
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
            "evidence": [snippet.display_text or snippet.chunk_text for snippet in retrieval_result.snippets],
            "sources": [f"{snippet.source_document}::{snippet.section_title}" for snippet in retrieval_result.snippets],
            "meeting_script_requirements": {
                "duration_target": "30 seconds",
                "structure": [
                    "1. Hook: one slightly fuller sentence tied to the doctor's current priority and context",
                    "2. Value: one slightly fuller sentence on the strongest Tempus value or proof point",
                    "3. Close: one slightly fuller sentence with a practical next step"
                ],
                "max_sentences": 3,
                "tone": "clear, polished, practical, and easy for a sales rep to deliver live",
                "format": "Return the meeting_script as exactly three numbered lines labeled Hook, Value, and Close."
            },
        }
        if pitch_feedback:
            prompt_payload["pitch_feedback"] = pitch_feedback
        if current_script:
            prompt_payload["current_script"] = current_script
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
        return output

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
        ranking_diagnostics = self.ranking_service.get_last_run_diagnostics(provider_id)
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
        retrieval_result = self.retrieve_evidence(provider_id, generated.top_product_ids)
        assert impact is not None
        rerank_source = matches[0].evaluation_source if matches else impact.match_source
        rerank_notice = matches[0].evaluation_notice if matches else impact.match_notice
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
            evidence=retrieval_result.snippets,
            citations=generated.supporting_snippets,
            generation_source=generated.generation_source,
            generation_notice=generated.generation_notice,
            diagnostics=PipelineDiagnostics(
                embedding_source=str(ranking_diagnostics["embedding_source"]),
                embedding_notice=ranking_diagnostics["embedding_notice"],
                rerank_source=rerank_source or str(ranking_diagnostics["rerank_source"]),
                rerank_notice=rerank_notice or ranking_diagnostics["rerank_notice"],
                retrieval_source=retrieval_result.source,
                retrieval_notice=retrieval_result.notice,
                scoring_source=str(ranking_diagnostics["scoring_source"]),
                generation_source=generated.generation_source,
                generation_notice=generated.generation_notice,
            ),
        )

    def get_provider_workspace(self, provider_id: str) -> ProviderWorkspaceResponse | None:
        provider = repository.get_provider_detail(provider_id)
        if provider is None:
            return None

        impact, matches = self._ensure_workspace_scoring(provider_id)
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

        provider_summaries = repository.list_providers()
        provider_summary_map = {item.id: item for item in provider_summaries}
        ranked_items = []
        for provider_summary in provider_summaries:
            provider_impact = repository.get_impact_ranking(provider_summary.id)
            if provider_impact is None:
                continue
            ranked_items.append((provider_summary.id, provider_impact))
        ranked_items.sort(key=lambda item: item[1].impact_score, reverse=True)
        ranking = ProviderRankingResponse(
            selected_provider_id=provider_id,
            ranked_providers=[
                RankedProvider(
                    provider_id=item_id,
                    doctor_name=provider_summary_map[item_id].doctor_name,
                    clinic_or_hospital=provider_summary_map[item_id].clinic_or_hospital,
                    impact_score=provider_impact.impact_score,
                    rank_reasoning=provider_impact.rank_reasoning,
                )
                for item_id, provider_impact in ranked_items
            ],
        )

        stored_output = repository.get_generated_output(provider_id)
        generated_output = None
        if self._has_displayable_generated_output(stored_output):
            generated_output = self._generated_output_response(provider_id, stored_output)

        impact_payload = None
        if impact is not None:
            impact_payload = ImpactBreakdown(
                relevant_product_count=impact.relevant_product_count,
                similarity_sum=impact.similarity_sum,
                mean_llm_relevance_score=impact.mean_llm_relevance_score,
                size=impact.size,
                impact_score=impact.impact_score,
                rank_reasoning=impact.rank_reasoning,
                match_source=impact.match_source,
                match_notice=impact.match_notice,
            )

        return ProviderWorkspaceResponse(
            provider=provider,
            ranking=ranking,
            top_matched_products=top_matched_products,
            impact=impact_payload,
            generated_output=generated_output,
            evidence=[],
        )

    def _ensure_workspace_scoring(self, provider_id: str):
        impact = repository.get_impact_ranking(provider_id)
        matches = repository.get_doctor_product_matches(provider_id)

        if impact is not None and matches:
            return impact, matches

        if not repository.get_products():
            return impact, matches

        self.rank_provider(provider_id)
        refreshed_impact = repository.get_impact_ranking(provider_id)
        refreshed_matches = repository.get_doctor_product_matches(provider_id)
        return refreshed_impact, refreshed_matches

    def get_cached_evidence(self, provider_id: str) -> list:
        stored_output = repository.get_generated_output(provider_id)
        if not self._has_displayable_generated_output(stored_output):
            return []
        return self.retrieve_evidence(provider_id, stored_output.top_product_ids).snippets

    def _generated_output_response(self, provider_id: str, output: GeneratedOutput) -> GeneratedOutputResponse:
        return GeneratedOutputResponse(
            provider_id=provider_id,
            top_product_ids=output.top_product_ids,
            objection_handler=output.objection_handler,
            meeting_script=output.meeting_script,
            supporting_snippets=output.supporting_snippets,
            generation_source=output.generation_source,
            generation_notice=output.generation_notice,
        )

    def _has_displayable_generated_output(self, output: GeneratedOutput | None) -> bool:
        if output is None:
            return False
        return bool(output.meeting_script and output.meeting_script.strip()) and bool(
            output.objection_handler and output.objection_handler.strip()
        )
