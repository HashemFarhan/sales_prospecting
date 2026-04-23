from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.db.session import create_tables
from app.db.seed import seed_demo_state

app = FastAPI(
    title="Tempus Sales",
    version="0.1.0",
    description="Backend orchestration service for provider ranking, objection handling, and meeting script generation.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

create_tables()
seed_demo_state()
app.include_router(router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
