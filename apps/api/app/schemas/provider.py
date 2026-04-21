from datetime import date

from pydantic import BaseModel, Field


class ProviderSummary(BaseModel):
    id: str
    doctor_name: str
    clinic_or_hospital: str
    region: str
    size: int
    specialty: str


class CRMRecordResponse(BaseModel):
    id: str
    provider_id: str
    concern: str
    interest_text: str
    note_text: str
    note_date: date


class ProductSummary(BaseModel):
    id: str
    product_name: str
    description: str
    source_document: str


class ProductMatchResponse(BaseModel):
    product_id: str
    product_name: str
    description: str
    interest_embedding_similarity: float
    llm_relevance_score: float
    llm_relevance_label: str
    llm_reasoning: str
    is_relevant: bool
    evaluation_source: str
    evaluation_notice: str | None = None


class ImpactBreakdown(BaseModel):
    relevant_product_count: int
    similarity_sum: float
    mean_llm_relevance_score: float
    size: int
    impact_score: float
    rank_reasoning: str
    match_source: str
    match_notice: str | None = None


class KnowledgeSnippet(BaseModel):
    id: str
    product_id: str
    source_document: str
    section_title: str
    topic: str
    chunk_text: str
    display_text: str | None = None
    relevance_score: float | None = None


class ProviderDetail(ProviderSummary):
    crm_records: list[CRMRecordResponse]
    recent_concern_summary: str
    interest_profile: str


class RankedProvider(BaseModel):
    provider_id: str
    doctor_name: str
    clinic_or_hospital: str
    impact_score: float
    rank_reasoning: str


class ProviderRankingResponse(BaseModel):
    selected_provider_id: str
    ranked_providers: list[RankedProvider]


class GeneratedOutputResponse(BaseModel):
    provider_id: str
    top_product_ids: list[str]
    objection_handler: str
    meeting_script: str
    supporting_snippets: list[str]
    generation_source: str
    generation_notice: str | None = None


class AnalysisResponse(BaseModel):
    provider: ProviderDetail
    ranking: ProviderRankingResponse
    top_matched_products: list[ProductMatchResponse]
    impact: ImpactBreakdown
    objection_handler: str
    meeting_script: str
    evidence: list[KnowledgeSnippet]
    citations: list[str]
    generation_source: str
    generation_notice: str | None = None


class ProviderListResponse(BaseModel):
    providers: list[ProviderSummary]


class ProductListResponse(BaseModel):
    products: list[ProductSummary]


class ProviderCreate(BaseModel):
    id: str
    doctor_name: str
    clinic_or_hospital: str
    region: str
    size: int = Field(ge=0)
    specialty: str


class ProviderIngestRequest(BaseModel):
    providers: list[ProviderCreate]


class CRMRecordCreate(BaseModel):
    id: str
    provider_id: str
    concern: str
    interest_text: str
    note_text: str
    note_date: date


class CRMIngestRequest(BaseModel):
    crm_records: list[CRMRecordCreate]


class ProductCreate(BaseModel):
    id: str
    product_name: str
    description: str
    details: str
    source_document: str


class ProductIngestRequest(BaseModel):
    products: list[ProductCreate]
