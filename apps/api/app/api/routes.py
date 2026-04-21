from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.provider import (
    AnalysisResponse,
    CRMIngestRequest,
    GeneratedOutputResponse,
    KnowledgeSnippet,
    ProductIngestRequest,
    ProductListResponse,
    ProviderDetail,
    ProviderIngestRequest,
    ProviderListResponse,
    ProviderRankingResponse,
)
from app.services.analysis_service import AnalysisService
from app.services.ingestion_service import IngestionService
from app.services.repository import repository

router = APIRouter()
analysis_service = AnalysisService()
ingestion_service = IngestionService()


@router.get("/providers", response_model=ProviderListResponse)
def list_providers() -> ProviderListResponse:
    return ProviderListResponse(providers=repository.list_providers())


@router.get("/products", response_model=ProductListResponse)
def list_products() -> ProductListResponse:
    return ProductListResponse(products=repository.list_products())


@router.get("/providers/{provider_id}", response_model=ProviderDetail)
def get_provider(provider_id: str) -> ProviderDetail:
    provider = repository.get_provider_detail(provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.post("/providers/{provider_id}/analyze", response_model=AnalysisResponse)
def analyze_provider(provider_id: str) -> AnalysisResponse:
    result = analysis_service.analyze_provider(provider_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return result


@router.post("/providers/{provider_id}/rank", response_model=ProviderRankingResponse)
def rank_provider(provider_id: str) -> ProviderRankingResponse:
    ranking = analysis_service.rank_provider(provider_id)
    if ranking is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return ranking


@router.post("/providers/{provider_id}/objection-handler", response_model=GeneratedOutputResponse)
def generate_objection_handler(provider_id: str) -> GeneratedOutputResponse:
    result = analysis_service.generate_output(provider_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return result


@router.post("/providers/{provider_id}/meeting-script", response_model=GeneratedOutputResponse)
def generate_meeting_script(provider_id: str) -> GeneratedOutputResponse:
    result = analysis_service.generate_output(provider_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return result


@router.get("/providers/{provider_id}/evidence", response_model=list[KnowledgeSnippet])
def get_provider_evidence(provider_id: str) -> list[KnowledgeSnippet]:
    output = analysis_service.generate_output(provider_id)
    if output is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return analysis_service.retrieve_evidence(provider_id, output.top_product_ids)


@router.post("/ingest/providers")
def ingest_providers(payload: ProviderIngestRequest) -> dict[str, int]:
    return {"ingested": ingestion_service.ingest_providers(payload)}


@router.post("/ingest/providers/upload")
async def ingest_provider_upload(file: UploadFile = File(...)) -> dict[str, int]:
    return {"ingested": await ingestion_service.ingest_provider_upload(file)}


@router.post("/ingest/crm-notes")
def ingest_crm_notes(payload: CRMIngestRequest) -> dict[str, int]:
    return {"ingested": ingestion_service.ingest_crm_records(payload)}


@router.post("/ingest/crm-notes/upload")
async def ingest_crm_notes_upload(file: UploadFile = File(...)) -> dict[str, int]:
    return {"ingested": await ingestion_service.ingest_crm_upload(file)}


@router.post("/ingest/products")
def ingest_products(payload: ProductIngestRequest) -> dict[str, int]:
    return {"ingested": ingestion_service.ingest_products(payload)}


@router.post("/ingest/products/upload")
async def ingest_product_upload(file: UploadFile = File(...)) -> dict[str, int]:
    return {"ingested": await ingestion_service.ingest_product_upload(file)}
