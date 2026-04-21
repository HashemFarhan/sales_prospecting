from datetime import date, datetime

from app.models.entities import CRMRecord, Product, ProductChunk, Provider
from app.services.embedding_service import embedding_service
from app.services.repository import repository


def seed_demo_state() -> None:
    if repository.list_providers():
        return

    now = datetime.utcnow()
    providers = [
        Provider(
            id="prov-101",
            doctor_name="Dr. Maya Chen",
            clinic_or_hospital="North Valley Oncology",
            region="Midwest East",
            size=320,
            specialty="Medical Oncology",
            created_at=now,
        ),
        Provider(
            id="prov-102",
            doctor_name="Dr. Javier Patel",
            clinic_or_hospital="Riverside Precision Care",
            region="Midwest East",
            size=270,
            specialty="Molecular Pathology",
            created_at=now,
        ),
        Provider(
            id="prov-103",
            doctor_name="Dr. Elena Brooks",
            clinic_or_hospital="Saint Aurora Cancer Center",
            region="Great Lakes",
            size=410,
            specialty="Thoracic Oncology",
            created_at=now,
        ),
    ]

    crm_records = [
        CRMRecord(
            id="crm-101",
            provider_id="prov-101",
            concern="workflow",
            interest_text="Reduce manual prep time before short oncology consults and tumor board review.",
            note_text="Wants stronger evidence for workflow impact and faster turnaround time before a pilot.",
            note_date=date(2026, 4, 12),
            created_at=now,
        ),
        CRMRecord(
            id="crm-102",
            provider_id="prov-101",
            concern="clinical-evidence",
            interest_text="Interested in measurable performance metrics for difficult-to-profile cases.",
            note_text="Interested in measurable performance metrics for difficult-to-profile cases.",
            note_date=date(2026, 4, 17),
            created_at=now,
        ),
        CRMRecord(
            id="crm-103",
            provider_id="prov-102",
            concern="integration",
            interest_text="Needs a low-disruption adoption path for the pathology review workflow.",
            note_text="Asked whether Tempus can integrate cleanly with the pathology review workflow.",
            note_date=date(2026, 4, 8),
            created_at=now,
        ),
        CRMRecord(
            id="crm-104",
            provider_id="prov-103",
            concern="roi",
            interest_text="Needs a clear value story for expanding genomic testing access across a high-volume service line.",
            note_text="Large patient volume and leadership interest, but needs clear ROI for expanding genomic testing access.",
            note_date=date(2026, 4, 18),
            created_at=now,
        ),
    ]

    products = [
        Product(
            id="prod-101",
            product_name="Tempus Workflow Navigator",
            description="Workflow support product for consolidating fragmented oncology case context.",
            details=(
                "Tempus Workflow Navigator centralizes clinical, genomic, and note review into a single workspace. "
                "It is designed to reduce manual chart digging before consult prep and tumor board review. "
                "Teams can pilot it in one service line, measure prep time reduction, and expand after validating impact."
            ),
            source_document="tempus-workflow-navigator.md",
            created_at=now,
            updated_at=now,
        ),
        Product(
            id="prod-102",
            product_name="Tempus Evidence Insights",
            description="Evidence-focused product for surfacing clinically relevant details in complex cases.",
            details=(
                "Tempus Evidence Insights helps clinicians surface clinically relevant molecular and clinical details faster. "
                "It is especially useful for difficult-to-profile cases where providers need measurable performance evidence "
                "and a repeatable way to review high-priority findings."
            ),
            source_document="tempus-evidence-insights.md",
            created_at=now,
            updated_at=now,
        ),
        Product(
            id="prod-103",
            product_name="Tempus Rollout Path",
            description="Implementation-focused product for phased adoption across oncology workflows.",
            details=(
                "Tempus Rollout Path gives teams a phased implementation model that starts with one physician champion and one "
                "disease area. It is designed to minimize disruption, fit existing review workflows, and create a measurable "
                "90-day pilot plan for broader rollout decisions."
            ),
            source_document="tempus-rollout-path.md",
            created_at=now,
            updated_at=now,
        ),
    ]

    repository.upsert_providers(providers)
    repository.upsert_crm_records(crm_records)
    repository.upsert_products(products)

    chunks: list[ProductChunk] = []
    for product in products:
        texts = _chunk_text(product.details)
        embeddings = embedding_service.embed_texts(texts)
        for index, text in enumerate(texts):
            chunks.append(
                ProductChunk(
                    id=f"{product.id}-chunk-{index + 1}",
                    product_id=product.id,
                    source_document=product.source_document,
                    chunk_text=text,
                    section_title=f"Chunk {index + 1}",
                    topic=_infer_topic(text),
                    embedding=embeddings[index],
                    created_at=now,
                )
            )
    repository.replace_product_chunks_for_products([product.id for product in products], chunks)


def _chunk_text(text: str, chunk_size: int = 420, overlap: int = 60) -> list[str]:
    normalized = " ".join(text.split())
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + chunk_size, len(normalized))
        chunks.append(normalized[start:end].strip())
        if end == len(normalized):
            break
        start = max(end - overlap, start + 1)
    return chunks


def _infer_topic(text: str) -> str:
    lowered = text.lower()
    for topic in ["workflow", "clinical-evidence", "integration", "roi", "operations"]:
        if topic.replace("-", " ") in lowered or topic in lowered:
            return topic
    return "product-fit"
