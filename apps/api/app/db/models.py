from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProviderRecord(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    doctor_name: Mapped[str] = mapped_column(String, nullable=False)
    clinic_or_hospital: Mapped[str] = mapped_column(String, nullable=False)
    region: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    specialty: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class CRMRecordRecord(Base):
    __tablename__ = "crm_records"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    concern: Mapped[str] = mapped_column(String, nullable=False)
    interest_text: Mapped[str] = mapped_column(Text, nullable=False)
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    note_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ProductRecord(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    source_document: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ProductChunkRecord(Base):
    __tablename__ = "product_chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    source_document: Mapped[str] = mapped_column(String, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    section_title: Mapped[str] = mapped_column(String, nullable=False)
    topic: Mapped[str] = mapped_column(String, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(JSON().with_variant(Vector(1536), "postgresql"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class DoctorProductMatchRecord(Base):
    __tablename__ = "doctor_product_matches"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    interest_embedding_similarity: Mapped[float] = mapped_column(Float, nullable=False)
    llm_relevance_score: Mapped[float] = mapped_column(Float, nullable=False)
    llm_relevance_label: Mapped[str] = mapped_column(String, nullable=False)
    llm_reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    is_relevant: Mapped[bool] = mapped_column(Boolean, nullable=False)
    evaluation_source: Mapped[str] = mapped_column(String, nullable=False)
    evaluation_notice: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ImpactRankingRecord(Base):
    __tablename__ = "impact_rankings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    relevant_product_count: Mapped[int] = mapped_column(Integer, nullable=False)
    similarity_sum: Mapped[float] = mapped_column(Float, nullable=False)
    mean_llm_relevance_score: Mapped[float] = mapped_column(Float, nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    impact_score: Mapped[float] = mapped_column(Float, nullable=False)
    rank_reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    match_source: Mapped[str] = mapped_column(String, nullable=False)
    match_notice: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class GeneratedOutputRecord(Base):
    __tablename__ = "generated_outputs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    top_product_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    objection_handler: Mapped[str] = mapped_column(Text, nullable=False)
    meeting_script: Mapped[str] = mapped_column(Text, nullable=False)
    supporting_snippets: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    generation_source: Mapped[str] = mapped_column(String, nullable=False)
    generation_notice: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
