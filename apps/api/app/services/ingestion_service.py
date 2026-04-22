from datetime import datetime
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.exc import IntegrityError

from app.models.entities import CRMRecord, Product, ProductChunk, Provider
from app.schemas.provider import CRMIngestRequest, ProductIngestRequest, ProviderIngestRequest
from app.services.embedding_service import embedding_service
from app.services.file_parsing_service import file_parsing_service
from app.services.repository import repository
from app.services.storage_service import storage_service


class IngestionValidationError(Exception):
    pass


class IngestionService:
    def ingest_providers(self, payload: ProviderIngestRequest) -> int:
        providers = [
            Provider(
                id=item.id,
                doctor_name=item.doctor_name,
                clinic_or_hospital=item.clinic_or_hospital,
                region=item.region,
                size=item.size,
                specialty=item.specialty,
                created_at=datetime.utcnow(),
            )
            for item in payload.providers
        ]
        return repository.upsert_providers(providers)

    def ingest_crm_records(self, payload: CRMIngestRequest) -> int:
        records = [
            CRMRecord(
                id=item.id,
                provider_id=item.provider_id,
                concern=item.concern,
                interest_text=item.interest_text,
                note_text=item.note_text,
                note_date=item.note_date,
                created_at=datetime.utcnow(),
            )
            for item in payload.crm_records
        ]
        return repository.upsert_crm_records(records)

    def ingest_products(self, payload: ProductIngestRequest) -> int:
        products = [
            Product(
                id=item.id,
                product_name=item.product_name,
                description=item.description,
                details=item.details,
                source_document=item.source_document,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            for item in payload.products
        ]
        return self._store_products_with_chunks(products)

    async def ingest_provider_upload(self, file: UploadFile) -> int:
        content = await file.read()
        providers = file_parsing_service.parse_providers_csv(file.filename or "providers.csv", content)
        ingested = repository.replace_provider_dataset(providers)
        storage_service.replace_upload(file.filename or "providers.csv", content, "providers")
        repository.clear_analysis_cache()
        return ingested

    async def ingest_crm_upload(self, file: UploadFile) -> int:
        content = await file.read()
        records = file_parsing_service.parse_crm_file(file.filename or "crm-records.txt", content)
        self._validate_crm_records(records)
        try:
            ingested = repository.replace_crm_dataset(records)
        except IntegrityError as exc:
            raise self._crm_provider_reference_error(records) from exc
        storage_service.replace_upload(file.filename or "crm-records.txt", content, "crm")
        repository.clear_analysis_cache()
        return ingested

    async def ingest_product_upload(self, file: UploadFile) -> int:
        content = await file.read()
        products = file_parsing_service.parse_products_file(file.filename or "products.csv", content)
        ingested = self._replace_products_with_chunks(products)
        storage_service.replace_upload(file.filename or "products.csv", content, "products")
        return ingested

    def _store_products_with_chunks(self, products: list[Product]) -> int:
        if not products:
            return 0
        repository.upsert_products(products)
        chunks = self._build_product_chunks(products)
        repository.replace_product_chunks_for_products([product.id for product in products], chunks)
        return len(products)

    def _replace_products_with_chunks(self, products: list[Product]) -> int:
        if not products:
            repository.replace_product_dataset([])
            repository.clear_analysis_cache()
            return 0
        chunks = self._build_product_chunks(products)
        repository.replace_product_dataset(products)
        repository.replace_product_chunks_for_products([product.id for product in products], chunks)
        repository.clear_analysis_cache()
        return len(products)

    def _build_product_chunks(self, products: list[Product]) -> list[ProductChunk]:
        chunks: list[ProductChunk] = []
        chunk_texts: list[str] = []
        for product in products:
            for index, text in enumerate(self._chunk_text(product.details), start=1):
                chunks.append(
                    ProductChunk(
                        id=f"{product.id}-chunk-{uuid4()}",
                        product_id=product.id,
                        source_document=product.source_document,
                        chunk_text=text,
                        section_title=f"Chunk {index}",
                        topic=self._infer_topic(product, text),
                        created_at=datetime.utcnow(),
                    )
                )
                chunk_texts.append(text)

        embeddings = embedding_service.embed_texts(chunk_texts)
        for chunk, embedding in zip(chunks, embeddings):
            chunk.embedding = embedding
        return chunks

    def _chunk_text(self, text: str, chunk_size: int = 900, overlap: int = 140) -> list[str]:
        normalized = " ".join(text.split())
        if not normalized:
            return []
        chunks: list[str] = []
        start = 0
        while start < len(normalized):
            end = min(start + chunk_size, len(normalized))
            chunks.append(normalized[start:end].strip())
            if end == len(normalized):
                break
            start = max(end - overlap, start + 1)
        return chunks

    def _infer_topic(self, product: Product, text: str) -> str:
        lowered = f"{product.product_name} {product.description} {text}".lower()
        for topic in ["workflow", "clinical-evidence", "integration", "roi", "operations"]:
            if topic.replace("-", " ") in lowered or topic in lowered:
                return topic
        return "product-fit"

    def _validate_crm_records(self, records: list[CRMRecord]) -> None:
        provider_ids = {provider.id for provider in repository.list_providers()}
        missing_provider_ids = sorted({record.provider_id for record in records if record.provider_id not in provider_ids})
        if missing_provider_ids:
            raise self._crm_provider_reference_error(records)

    def _crm_provider_reference_error(self, records: list[CRMRecord]) -> IngestionValidationError:
        provider_ids = {provider.id for provider in repository.list_providers()}
        missing_provider_ids = sorted({record.provider_id for record in records if record.provider_id not in provider_ids})
        missing_preview = ", ".join(missing_provider_ids[:8]) if missing_provider_ids else "unknown provider IDs"
        suffix = "..." if len(missing_provider_ids) > 8 else ""
        return IngestionValidationError(
            "CRM upload references provider IDs that are not in the active providers dataset: "
            f"{missing_preview}{suffix}. Upload the matching providers file first."
        )
