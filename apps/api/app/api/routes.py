from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.provider import (
    AnalysisResponse,
    CRMIngestRequest,
    GeneratedOutputResponse,
    KnowledgeSnippet,
    MeetingScriptRegenerationRequest,
    MeetingScriptResponse,
    ProductIngestRequest,
    ProductListResponse,
    ProviderDetail,
    ProviderIngestRequest,
    ProviderListResponse,
    ProviderRankingResponse,
    ProviderWorkspaceResponse,
    SourceFileDetail,
    SourceListResponse,
)
from app.services.analysis_service import AnalysisService
from app.services.ingestion_service import IngestionService, IngestionValidationError
from app.services.openai_service import LiveDependencyError
from app.services.repository import repository
from app.services.source_service import source_service

router = APIRouter()
analysis_service = AnalysisService()
ingestion_service = IngestionService()


@router.get("/providers", response_model=ProviderListResponse)
def list_providers() -> ProviderListResponse:
    return ProviderListResponse(providers=repository.list_providers())


@router.get("/products", response_model=ProductListResponse)
def list_products() -> ProductListResponse:
    return ProductListResponse(products=repository.list_products())


@router.get("/sources", response_model=SourceListResponse)
def list_sources(category: str | None = None) -> SourceListResponse:
    return SourceListResponse(sources=source_service.list_sources(category=category))


@router.get("/sources/detail", response_model=SourceFileDetail)
def get_source_detail(source_id: str) -> SourceFileDetail:
    result = source_service.get_source_detail(source_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Source file not found")
    return result


@router.get("/providers/{provider_id}", response_model=ProviderDetail)
def get_provider(provider_id: str) -> ProviderDetail:
    provider = repository.get_provider_detail(provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.get("/providers/{provider_id}/workspace", response_model=ProviderWorkspaceResponse)
def get_provider_workspace(provider_id: str) -> ProviderWorkspaceResponse:
    try:
        result = analysis_service.get_provider_workspace(provider_id)
    except LiveDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return result


@router.post("/providers/{provider_id}/analyze", response_model=AnalysisResponse)
def analyze_provider(provider_id: str) -> AnalysisResponse:
    try:
        result = analysis_service.analyze_provider(provider_id)
    except LiveDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return result


@router.post("/providers/{provider_id}/rank", response_model=ProviderRankingResponse)
def rank_provider(provider_id: str) -> ProviderRankingResponse:
    try:
        ranking = analysis_service.rank_provider(provider_id)
    except LiveDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if ranking is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return ranking


@router.post("/providers/{provider_id}/objection-handler", response_model=GeneratedOutputResponse)
def generate_objection_handler(provider_id: str) -> GeneratedOutputResponse:
    try:
        result = analysis_service.generate_output(provider_id)
    except LiveDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return result


@router.post("/providers/{provider_id}/meeting-script", response_model=MeetingScriptResponse)
def generate_meeting_script(
    provider_id: str,
    payload: MeetingScriptRegenerationRequest | None = None,
) -> MeetingScriptResponse:
    try:
        if payload is None:
            generated = analysis_service.generate_output(provider_id)
            result = None if generated is None else MeetingScriptResponse(
                provider_id=generated.provider_id,
                meeting_script=generated.meeting_script,
                generation_source=generated.generation_source,
                generation_notice=generated.generation_notice,
            )
        else:
            result = analysis_service.regenerate_meeting_script(
                provider_id,
                feedback=payload.feedback,
                current_script=payload.current_script,
            )
    except LiveDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return result


@router.get("/providers/{provider_id}/evidence", response_model=list[KnowledgeSnippet])
def get_provider_evidence(provider_id: str) -> list[KnowledgeSnippet]:
    provider = repository.get_provider_detail(provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        return analysis_service.get_cached_evidence(provider_id)
    except LiveDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/ingest/providers")
def ingest_providers(payload: ProviderIngestRequest) -> dict[str, int]:
    return {"ingested": ingestion_service.ingest_providers(payload)}


@router.post("/ingest/providers/upload")
async def ingest_provider_upload(file: UploadFile = File(...)) -> dict[str, int]:
    try:
        return {"ingested": await ingestion_service.ingest_provider_upload(file)}
    except IngestionValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/ingest/crm-notes")
def ingest_crm_notes(payload: CRMIngestRequest) -> dict[str, int]:
    return {"ingested": ingestion_service.ingest_crm_records(payload)}


@router.post("/ingest/crm-notes/upload")
async def ingest_crm_notes_upload(file: UploadFile = File(...)) -> dict[str, int]:
    try:
        return {"ingested": await ingestion_service.ingest_crm_upload(file)}
    except IngestionValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/ingest/products")
def ingest_products(payload: ProductIngestRequest) -> dict[str, int]:
    return {"ingested": ingestion_service.ingest_products(payload)}


@router.post("/ingest/products/upload")
async def ingest_product_upload(file: UploadFile = File(...)) -> dict[str, int]:
    try:
        return {"ingested": await ingestion_service.ingest_product_upload(file)}
    except IngestionValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
