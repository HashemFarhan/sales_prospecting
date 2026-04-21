from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class Provider:
    id: str
    doctor_name: str
    clinic_or_hospital: str
    region: str
    size: int
    specialty: str
    created_at: datetime


@dataclass
class CRMRecord:
    id: str
    provider_id: str
    concern: str
    interest_text: str
    note_text: str
    note_date: date
    created_at: datetime


@dataclass
class Product:
    id: str
    product_name: str
    description: str
    details: str
    source_document: str
    created_at: datetime
    updated_at: datetime


@dataclass
class ProductChunk:
    id: str
    product_id: str
    source_document: str
    chunk_text: str
    section_title: str
    topic: str
    embedding: list[float] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DoctorProductMatch:
    id: str
    provider_id: str
    product_id: str
    interest_embedding_similarity: float
    llm_relevance_score: float
    llm_relevance_label: str
    llm_reasoning: str
    is_relevant: bool
    evaluation_source: str
    evaluation_notice: str | None
    created_at: datetime


@dataclass
class ImpactRanking:
    id: str
    provider_id: str
    relevant_product_count: int
    similarity_sum: float
    mean_llm_relevance_score: float
    size: int
    impact_score: float
    rank_reasoning: str
    match_source: str
    match_notice: str | None
    created_at: datetime


@dataclass
class GeneratedOutput:
    id: str
    provider_id: str
    top_product_ids: list[str]
    objection_handler: str
    meeting_script: str
    supporting_snippets: list[str]
    generation_source: str
    generation_notice: str | None
    created_at: datetime
