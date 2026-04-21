import json
from typing import Any

from openai import OpenAI

from app.core.config import settings


class OpenAIService:
    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    def rerank_products(self, prompt_payload: dict[str, Any]) -> dict[str, Any]:
        if self.client is None:
            return self._fallback_rerank(prompt_payload, "No OPENAI_API_KEY configured.")
        try:
            response = self.client.responses.create(
                model=settings.openai_model,
                input=[
                    {
                        "role": "system",
                        "content": [
                            {
                                "type": "input_text",
                                "text": (
                                    "You are ranking product relevance for oncology sales outreach. "
                                    "Use only the provider profile and product candidates provided. "
                                    "Return relevant products sorted descending by fit."
                                ),
                            }
                        ],
                    },
                    {"role": "user", "content": [{"type": "input_text", "text": json.dumps(prompt_payload)}]},
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "product_relevance",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "matches": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "product_id": {"type": "string"},
                                            "llm_relevance_score": {"type": "number"},
                                            "llm_relevance_label": {"type": "string"},
                                            "llm_reasoning": {"type": "string"},
                                            "is_relevant": {"type": "boolean"},
                                        },
                                        "required": [
                                            "product_id",
                                            "llm_relevance_score",
                                            "llm_relevance_label",
                                            "llm_reasoning",
                                            "is_relevant",
                                        ],
                                        "additionalProperties": False,
                                    },
                                }
                            },
                            "required": ["matches"],
                            "additionalProperties": False,
                        },
                        "strict": True,
                    }
                },
            )
            parsed = json.loads(getattr(response, "output_text", "") or "{}")
            parsed["evaluation_source"] = "live"
            parsed["evaluation_notice"] = None
            return parsed
        except Exception as exc:
            return self._fallback_rerank(prompt_payload, f"Live reranking failed: {type(exc).__name__}.")

    def generate_sales_output(self, prompt_payload: dict[str, Any]) -> dict[str, Any]:
        if self.client is None:
            return self._fallback_generation(prompt_payload, "Live OpenAI generation is unavailable because no OPENAI_API_KEY is configured.")
        try:
            response = self.client.responses.create(
                model=settings.openai_model,
                input=[
                    {
                        "role": "system",
                        "content": [
                            {
                                "type": "input_text",
                                "text": (
                                    "You are a Tempus sales copilot. Use only the supplied matched products and evidence. "
                                    "Return concise, executive-ready output for oncology sales reps."
                                ),
                            }
                        ],
                    },
                    {"role": "user", "content": [{"type": "input_text", "text": json.dumps(prompt_payload)}]},
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "tempus_sales_output",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "objection_handler": {"type": "string"},
                                "meeting_script": {"type": "string"},
                                "citations": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": ["objection_handler", "meeting_script", "citations"],
                            "additionalProperties": False,
                        },
                        "strict": True,
                    }
                },
            )
            parsed = json.loads(getattr(response, "output_text", "") or "{}")
            parsed["generation_source"] = "live"
            parsed["generation_notice"] = None
            return parsed
        except Exception as exc:
            return self._fallback_generation(prompt_payload, f"Live OpenAI generation failed, so the app returned a local fallback draft. Reason: {type(exc).__name__}.")

    def create_embeddings(self, texts: list[str]) -> list[list[float]] | None:
        if self.client is None or not texts:
            return None
        try:
            response = self.client.embeddings.create(model=settings.embedding_model, input=texts)
            return [item.embedding for item in response.data]
        except Exception:
            return None

    def _fallback_rerank(self, prompt_payload: dict[str, Any], notice: str) -> dict[str, Any]:
        matches = []
        for candidate in prompt_payload["candidates"]:
            score = round(float(candidate["interest_embedding_similarity"]) * 5, 2)
            matches.append(
                {
                    "product_id": candidate["product_id"],
                    "llm_relevance_score": score,
                    "llm_relevance_label": "high" if score >= 3 else "medium",
                    "llm_reasoning": f"Fallback evaluation based on semantic similarity to the provider interest profile for {candidate['product_name']}.",
                    "is_relevant": score >= 2.25,
                }
            )
        matches.sort(key=lambda item: item["llm_relevance_score"], reverse=True)
        return {"matches": matches, "evaluation_source": "fallback", "evaluation_notice": notice}

    def _fallback_generation(self, prompt_payload: dict[str, Any], notice: str) -> dict[str, Any]:
        provider = prompt_payload["provider"]
        top_products = prompt_payload.get("top_products", [])
        evidence = prompt_payload.get("evidence", [])
        product_line = ", ".join(product["product_name"] for product in top_products[:2]) or "the matched Tempus products"
        evidence_line = evidence[0] if evidence else "No supporting evidence was retrieved."
        return {
            "objection_handler": (
                f"Fallback draft: {provider['doctor_name']} is primarily focused on {provider['recent_concern_summary'].lower()}. "
                f"Lead with the strongest matched products, especially {product_line}, and connect them to the evidence: {evidence_line}"
            ),
            "meeting_script": (
                f"Fallback draft: Dr. {provider['doctor_name'].split()[-1]}, based on your team's priorities, I wanted to share how "
                f"{product_line} can help reduce friction and improve confidence before short oncology meetings. "
                f"If it makes sense, we can start with a measurable pilot at {provider['clinic_or_hospital']}."
            ),
            "citations": prompt_payload.get("sources", []),
            "generation_source": "fallback",
            "generation_notice": notice,
        }
