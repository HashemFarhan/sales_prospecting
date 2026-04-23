from __future__ import annotations

from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import delete, func, select

from app.db.models import (
    CRMRecordRecord,
    DoctorProductMatchRecord,
    GeneratedOutputRecord,
    ImpactRankingRecord,
    ProductChunkRecord,
    ProductRecord,
    ProviderRecord,
)
from app.db.session import SessionLocal
from app.models.entities import (
    CRMRecord,
    DoctorProductMatch,
    GeneratedOutput,
    ImpactRanking,
    Product,
    ProductChunk,
    Provider,
)
from app.schemas.provider import CRMRecordResponse, ProviderDetail, ProviderSummary, ProductSummary


class Repository(ABC):
    @abstractmethod
    def list_providers(self) -> list[ProviderSummary]: ...

    @abstractmethod
    def get_provider(self, provider_id: str) -> Provider | None: ...

    @abstractmethod
    def get_provider_detail(self, provider_id: str) -> ProviderDetail | None: ...

    @abstractmethod
    def get_crm_records_for_provider(self, provider_id: str) -> list[CRMRecord]: ...

    @abstractmethod
    def upsert_providers(self, providers: list[Provider]) -> int: ...

    @abstractmethod
    def upsert_crm_records(self, records: list[CRMRecord]) -> int: ...

    @abstractmethod
    def replace_provider_dataset(self, providers: list[Provider]) -> int: ...

    @abstractmethod
    def replace_crm_dataset(self, records: list[CRMRecord]) -> int: ...

    @abstractmethod
    def list_products(self) -> list[ProductSummary]: ...

    @abstractmethod
    def get_product(self, product_id: str) -> Product | None: ...

    @abstractmethod
    def get_products(self, product_ids: list[str] | None = None) -> list[Product]: ...

    @abstractmethod
    def upsert_products(self, products: list[Product]) -> int: ...

    @abstractmethod
    def replace_product_dataset(self, products: list[Product]) -> int: ...

    @abstractmethod
    def replace_product_chunks_for_products(self, product_ids: list[str], chunks: list[ProductChunk]) -> None: ...

    @abstractmethod
    def list_product_chunks(self, product_ids: list[str] | None = None) -> list[ProductChunk]: ...

    @abstractmethod
    def search_product_chunks(
        self,
        query_embedding: list[float],
        product_ids: list[str],
        limit: int,
    ) -> tuple[list[ProductChunk], str, str | None]: ...

    @abstractmethod
    def replace_doctor_product_matches(self, provider_id: str, matches: list[DoctorProductMatch]) -> None: ...

    @abstractmethod
    def get_doctor_product_matches(self, provider_id: str) -> list[DoctorProductMatch]: ...

    @abstractmethod
    def upsert_impact_ranking(self, ranking: ImpactRanking) -> None: ...

    @abstractmethod
    def get_impact_ranking(self, provider_id: str) -> ImpactRanking | None: ...

    @abstractmethod
    def upsert_generated_output(self, output: GeneratedOutput) -> None: ...

    @abstractmethod
    def get_generated_output(self, provider_id: str) -> GeneratedOutput | None: ...

    @abstractmethod
    def now(self) -> datetime: ...

    @abstractmethod
    def clear_analysis_cache(self) -> None: ...


class SQLAlchemyRepository(Repository):
    def list_providers(self) -> list[ProviderSummary]:
        with SessionLocal() as session:
            rows = session.execute(
                select(
                    ProviderRecord,
                    func.max(CRMRecordRecord.note_date),
                    ImpactRankingRecord.impact_score,
                    ImpactRankingRecord.rank_reasoning,
                )
                .outerjoin(CRMRecordRecord, CRMRecordRecord.provider_id == ProviderRecord.id)
                .outerjoin(ImpactRankingRecord, ImpactRankingRecord.provider_id == ProviderRecord.id)
                .group_by(
                    ProviderRecord.id,
                    ImpactRankingRecord.impact_score,
                    ImpactRankingRecord.rank_reasoning,
                )
                .order_by(ProviderRecord.doctor_name)
            ).all()
            return [
                _provider_summary(
                    _provider_from_record(record),
                    latest_crm_note_date=latest_crm_note_date,
                    impact_score=impact_score,
                    rank_reasoning=rank_reasoning,
                )
                for record, latest_crm_note_date, impact_score, rank_reasoning in rows
            ]

    def get_provider(self, provider_id: str) -> Provider | None:
        with SessionLocal() as session:
            record = session.get(ProviderRecord, provider_id)
            return _provider_from_record(record) if record else None

    def get_provider_detail(self, provider_id: str) -> ProviderDetail | None:
        provider = self.get_provider(provider_id)
        if provider is None:
            return None
        records = self.get_crm_records_for_provider(provider_id)
        return _provider_detail(provider, records)

    def get_crm_records_for_provider(self, provider_id: str) -> list[CRMRecord]:
        with SessionLocal() as session:
            records = session.scalars(
                select(CRMRecordRecord)
                .where(CRMRecordRecord.provider_id == provider_id)
                .order_by(CRMRecordRecord.note_date.desc())
            ).all()
            return [_crm_record_from_record(record) for record in records]

    def upsert_providers(self, providers: list[Provider]) -> int:
        with SessionLocal() as session:
            for provider in providers:
                session.merge(_provider_record(provider))
            session.commit()
        return len(providers)

    def upsert_crm_records(self, records: list[CRMRecord]) -> int:
        with SessionLocal() as session:
            for record in records:
                session.merge(_crm_record_record(record))
            session.commit()
        return len(records)

    def replace_provider_dataset(self, providers: list[Provider]) -> int:
        incoming_ids = {provider.id for provider in providers}
        with SessionLocal() as session:
            existing_ids = set(session.scalars(select(ProviderRecord.id)).all())
            removed_ids = existing_ids - incoming_ids
            if removed_ids:
                session.execute(delete(CRMRecordRecord).where(CRMRecordRecord.provider_id.in_(removed_ids)))
                session.execute(delete(DoctorProductMatchRecord).where(DoctorProductMatchRecord.provider_id.in_(removed_ids)))
                session.execute(delete(ImpactRankingRecord).where(ImpactRankingRecord.provider_id.in_(removed_ids)))
                session.execute(delete(GeneratedOutputRecord).where(GeneratedOutputRecord.provider_id.in_(removed_ids)))
                session.execute(delete(ProviderRecord).where(ProviderRecord.id.in_(removed_ids)))
            for provider in providers:
                session.merge(_provider_record(provider))
            session.commit()
        return len(providers)

    def replace_crm_dataset(self, records: list[CRMRecord]) -> int:
        with SessionLocal() as session:
            session.execute(delete(CRMRecordRecord))
            session.add_all([_crm_record_record(record) for record in records])
            session.commit()
        return len(records)

    def list_products(self) -> list[ProductSummary]:
        with SessionLocal() as session:
            records = session.scalars(select(ProductRecord).order_by(ProductRecord.product_name)).all()
            return [
                ProductSummary(
                    id=record.id,
                    product_name=record.product_name,
                    description=record.description,
                    source_document=record.source_document,
                )
                for record in records
            ]

    def get_product(self, product_id: str) -> Product | None:
        with SessionLocal() as session:
            record = session.get(ProductRecord, product_id)
            return _product_from_record(record) if record else None

    def get_products(self, product_ids: list[str] | None = None) -> list[Product]:
        with SessionLocal() as session:
            stmt = select(ProductRecord)
            if product_ids:
                stmt = stmt.where(ProductRecord.id.in_(product_ids))
            records = session.scalars(stmt.order_by(ProductRecord.product_name)).all()
            return [_product_from_record(record) for record in records]

    def upsert_products(self, products: list[Product]) -> int:
        with SessionLocal() as session:
            for product in products:
                session.merge(_product_record(product))
            session.commit()
        return len(products)

    def replace_product_dataset(self, products: list[Product]) -> int:
        with SessionLocal() as session:
            session.execute(delete(ProductChunkRecord))
            session.execute(delete(DoctorProductMatchRecord))
            session.execute(delete(ProductRecord))
            session.add_all([_product_record(product) for product in products])
            session.commit()
        return len(products)

    def replace_product_chunks_for_products(self, product_ids: list[str], chunks: list[ProductChunk]) -> None:
        if not product_ids:
            return
        with SessionLocal() as session:
            session.execute(delete(ProductChunkRecord).where(ProductChunkRecord.product_id.in_(product_ids)))
            session.add_all([_product_chunk_record(chunk) for chunk in chunks])
            session.commit()

    def list_product_chunks(self, product_ids: list[str] | None = None) -> list[ProductChunk]:
        with SessionLocal() as session:
            stmt = select(ProductChunkRecord)
            if product_ids:
                stmt = stmt.where(ProductChunkRecord.product_id.in_(product_ids))
            records = session.scalars(stmt).all()
            return [_product_chunk_from_record(record) for record in records]

    def search_product_chunks(
        self,
        query_embedding: list[float],
        product_ids: list[str],
        limit: int,
    ) -> tuple[list[ProductChunk], str, str | None]:
        if not product_ids:
            return [], "none", None
        with SessionLocal() as session:
            stmt = (
                select(ProductChunkRecord)
                .where(ProductChunkRecord.product_id.in_(product_ids))
                .where(ProductChunkRecord.embedding.is_not(None))
            )
            if session.bind and str(session.bind.url).startswith("postgresql"):
                try:
                    distance_expr = ProductChunkRecord.__table__.c.embedding.op("<=>")(query_embedding)
                    records = session.scalars(stmt.order_by(distance_expr).limit(limit)).all()
                    return [_product_chunk_from_record(record) for record in records], "pgvector", None
                except (AttributeError, SQLAlchemyError, TypeError, ValueError) as exc:
                    records = session.scalars(stmt).all()
                    chunks = [_product_chunk_from_record(record) for record in records]
                    scored = [
                        (_cosine_similarity(query_embedding, chunk.embedding), chunk)
                        for chunk in chunks
                        if chunk.embedding
                    ]
                    scored.sort(key=lambda item: item[0], reverse=True)
                    return [chunk for _, chunk in scored[:limit]], "postgres-local-cosine", (
                        f"Fell back from pgvector ordering to local cosine scoring: {type(exc).__name__}."
                    )

            records = session.scalars(stmt).all()
            chunks = [_product_chunk_from_record(record) for record in records]
            scored = [
                (_cosine_similarity(query_embedding, chunk.embedding), chunk)
                for chunk in chunks
                if chunk.embedding
            ]
            scored.sort(key=lambda item: item[0], reverse=True)
            return [chunk for _, chunk in scored[:limit]], "local-cosine", None

    def replace_doctor_product_matches(self, provider_id: str, matches: list[DoctorProductMatch]) -> None:
        with SessionLocal() as session:
            session.execute(delete(DoctorProductMatchRecord).where(DoctorProductMatchRecord.provider_id == provider_id))
            session.add_all([_doctor_product_match_record(match) for match in matches])
            session.commit()

    def get_doctor_product_matches(self, provider_id: str) -> list[DoctorProductMatch]:
        with SessionLocal() as session:
            records = session.scalars(
                select(DoctorProductMatchRecord)
                .where(DoctorProductMatchRecord.provider_id == provider_id)
                .order_by(DoctorProductMatchRecord.llm_relevance_score.desc(), DoctorProductMatchRecord.interest_embedding_similarity.desc())
            ).all()
            return [_doctor_product_match_from_record(record) for record in records]

    def upsert_impact_ranking(self, ranking: ImpactRanking) -> None:
        with SessionLocal() as session:
            existing = session.get(ImpactRankingRecord, ranking.id)
            record = _impact_ranking_record(ranking)
            session.merge(record if existing is None else record)
            session.commit()

    def get_impact_ranking(self, provider_id: str) -> ImpactRanking | None:
        with SessionLocal() as session:
            record = session.scalar(select(ImpactRankingRecord).where(ImpactRankingRecord.provider_id == provider_id))
            return _impact_ranking_from_record(record) if record else None

    def upsert_generated_output(self, output: GeneratedOutput) -> None:
        with SessionLocal() as session:
            existing = session.scalar(select(GeneratedOutputRecord).where(GeneratedOutputRecord.provider_id == output.provider_id))
            if existing is None:
                session.add(_generated_output_record(output))
            else:
                existing.top_product_ids = output.top_product_ids
                existing.objection_handler = output.objection_handler
                existing.meeting_script = output.meeting_script
                existing.supporting_snippets = output.supporting_snippets
                existing.generation_source = output.generation_source
                existing.generation_notice = output.generation_notice
                existing.created_at = output.created_at
            session.commit()

    def get_generated_output(self, provider_id: str) -> GeneratedOutput | None:
        with SessionLocal() as session:
            record = session.scalar(select(GeneratedOutputRecord).where(GeneratedOutputRecord.provider_id == provider_id))
            return _generated_output_from_record(record) if record else None

    def now(self) -> datetime:
        return datetime.utcnow()

    def clear_analysis_cache(self) -> None:
        with SessionLocal() as session:
            session.execute(delete(DoctorProductMatchRecord))
            session.execute(delete(ImpactRankingRecord))
            session.execute(delete(GeneratedOutputRecord))
            session.commit()


def _provider_summary(provider: Provider, latest_crm_note_date=None, impact_score=None, rank_reasoning=None) -> ProviderSummary:
    return ProviderSummary(
        id=provider.id,
        doctor_name=provider.doctor_name,
        clinic_or_hospital=provider.clinic_or_hospital,
        region=provider.region,
        size=provider.size,
        specialty=provider.specialty,
        latest_crm_note_date=latest_crm_note_date,
        impact_score=impact_score,
        rank_reasoning=rank_reasoning,
    )


def _provider_detail(provider: Provider, records: list[CRMRecord]) -> ProviderDetail:
    concern_counts: dict[str, int] = defaultdict(int)
    interests: list[str] = []
    for record in records:
        concern_counts[record.concern] += 1
        interests.append(record.interest_text)
    top_concern = max(concern_counts.items(), key=lambda item: item[1])[0] if concern_counts else "general"
    summary = f"Primary recent concern: {top_concern.replace('-', ' ')}."
    interest_profile = " ".join(
        [
            f"{provider.doctor_name} is a {provider.specialty} provider at {provider.clinic_or_hospital}.",
            f"Primary concern is {top_concern.replace('-', ' ')}.",
            " ".join(interests[:3]),
        ]
    ).strip()
    return ProviderDetail(
        id=provider.id,
        doctor_name=provider.doctor_name,
        clinic_or_hospital=provider.clinic_or_hospital,
        region=provider.region,
        size=provider.size,
        specialty=provider.specialty,
        recent_concern_summary=summary,
        interest_profile=interest_profile,
        crm_records=[
            CRMRecordResponse(
                id=record.id,
                provider_id=record.provider_id,
                concern=record.concern,
                interest_text=record.interest_text,
                note_text=record.note_text,
                note_date=record.note_date,
            )
            for record in records
        ],
    )


def _provider_record(provider: Provider) -> ProviderRecord:
    return ProviderRecord(
        id=provider.id,
        doctor_name=provider.doctor_name,
        clinic_or_hospital=provider.clinic_or_hospital,
        region=provider.region,
        size=provider.size,
        specialty=provider.specialty,
        created_at=provider.created_at,
    )


def _crm_record_record(record: CRMRecord) -> CRMRecordRecord:
    return CRMRecordRecord(
        id=record.id,
        provider_id=record.provider_id,
        concern=record.concern,
        interest_text=record.interest_text,
        note_text=record.note_text,
        note_date=record.note_date,
        created_at=record.created_at,
    )


def _product_record(product: Product) -> ProductRecord:
    return ProductRecord(
        id=product.id,
        product_name=product.product_name,
        description=product.description,
        details=product.details,
        source_document=product.source_document,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


def _product_chunk_record(chunk: ProductChunk) -> ProductChunkRecord:
    return ProductChunkRecord(
        id=chunk.id,
        product_id=chunk.product_id,
        source_document=chunk.source_document,
        chunk_text=chunk.chunk_text,
        section_title=chunk.section_title,
        topic=chunk.topic,
        embedding=chunk.embedding or None,
        created_at=chunk.created_at,
    )


def _doctor_product_match_record(match: DoctorProductMatch) -> DoctorProductMatchRecord:
    return DoctorProductMatchRecord(
        id=match.id,
        provider_id=match.provider_id,
        product_id=match.product_id,
        interest_embedding_similarity=match.interest_embedding_similarity,
        llm_relevance_score=match.llm_relevance_score,
        llm_relevance_label=match.llm_relevance_label,
        llm_reasoning=match.llm_reasoning,
        is_relevant=match.is_relevant,
        evaluation_source=match.evaluation_source,
        evaluation_notice=match.evaluation_notice,
        created_at=match.created_at,
    )


def _impact_ranking_record(ranking: ImpactRanking) -> ImpactRankingRecord:
    return ImpactRankingRecord(
        id=ranking.id,
        provider_id=ranking.provider_id,
        relevant_product_count=ranking.relevant_product_count,
        similarity_sum=ranking.similarity_sum,
        mean_llm_relevance_score=ranking.mean_llm_relevance_score,
        size=ranking.size,
        impact_score=ranking.impact_score,
        rank_reasoning=ranking.rank_reasoning,
        match_source=ranking.match_source,
        match_notice=ranking.match_notice,
        created_at=ranking.created_at,
    )


def _generated_output_record(output: GeneratedOutput) -> GeneratedOutputRecord:
    return GeneratedOutputRecord(
        id=output.id,
        provider_id=output.provider_id,
        top_product_ids=output.top_product_ids,
        objection_handler=output.objection_handler,
        meeting_script=output.meeting_script,
        supporting_snippets=output.supporting_snippets,
        generation_source=output.generation_source,
        generation_notice=output.generation_notice,
        created_at=output.created_at,
    )


def _provider_from_record(record: ProviderRecord) -> Provider:
    return Provider(
        id=record.id,
        doctor_name=record.doctor_name,
        clinic_or_hospital=record.clinic_or_hospital,
        region=record.region,
        size=record.size,
        specialty=record.specialty,
        created_at=record.created_at,
    )


def _crm_record_from_record(record: CRMRecordRecord) -> CRMRecord:
    return CRMRecord(
        id=record.id,
        provider_id=record.provider_id,
        concern=record.concern,
        interest_text=record.interest_text,
        note_text=record.note_text,
        note_date=record.note_date,
        created_at=record.created_at,
    )


def _product_from_record(record: ProductRecord) -> Product:
    return Product(
        id=record.id,
        product_name=record.product_name,
        description=record.description,
        details=record.details,
        source_document=record.source_document,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _product_chunk_from_record(record: ProductChunkRecord) -> ProductChunk:
    embedding = list(record.embedding) if record.embedding is not None else []
    return ProductChunk(
        id=record.id,
        product_id=record.product_id,
        source_document=record.source_document,
        chunk_text=record.chunk_text,
        section_title=record.section_title,
        topic=record.topic,
        embedding=embedding,
        created_at=record.created_at,
    )


def _doctor_product_match_from_record(record: DoctorProductMatchRecord) -> DoctorProductMatch:
    return DoctorProductMatch(
        id=record.id,
        provider_id=record.provider_id,
        product_id=record.product_id,
        interest_embedding_similarity=record.interest_embedding_similarity,
        llm_relevance_score=record.llm_relevance_score,
        llm_relevance_label=record.llm_relevance_label,
        llm_reasoning=record.llm_reasoning,
        is_relevant=record.is_relevant,
        evaluation_source=record.evaluation_source,
        evaluation_notice=record.evaluation_notice,
        created_at=record.created_at,
    )


def _impact_ranking_from_record(record: ImpactRankingRecord) -> ImpactRanking:
    return ImpactRanking(
        id=record.id,
        provider_id=record.provider_id,
        relevant_product_count=record.relevant_product_count,
        similarity_sum=record.similarity_sum,
        mean_llm_relevance_score=record.mean_llm_relevance_score,
        size=record.size,
        impact_score=record.impact_score,
        rank_reasoning=record.rank_reasoning,
        match_source=record.match_source,
        match_notice=record.match_notice,
        created_at=record.created_at,
    )


def _generated_output_from_record(record: GeneratedOutputRecord) -> GeneratedOutput:
    return GeneratedOutput(
        id=record.id,
        provider_id=record.provider_id,
        top_product_ids=record.top_product_ids,
        objection_handler=record.objection_handler,
        meeting_script=record.meeting_script,
        supporting_snippets=record.supporting_snippets,
        generation_source=record.generation_source,
        generation_notice=record.generation_notice,
        created_at=record.created_at,
    )


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = sum(a * a for a in left) ** 0.5
    right_norm = sum(b * b for b in right) ** 0.5
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


repository: Repository = SQLAlchemyRepository()
