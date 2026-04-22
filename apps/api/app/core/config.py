from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


API_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = API_ROOT / "tempus_sales_copilot_v2.db"
DEFAULT_RAW_STORAGE_DIR = API_ROOT / "storage" / "raw"


class Settings(BaseSettings):
    openai_api_key: str | None = None
    openai_model: str = "gpt-5-mini"
    embedding_model: str = "text-embedding-3-small"
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    vector_provider: str = "mock"
    raw_storage_dir: str = str(DEFAULT_RAW_STORAGE_DIR)
    product_shortlist_count: int = 4
    impact_weight_relevant_count: float = 0.35
    impact_weight_similarity_sum: float = 0.3
    impact_weight_size: float = 0.2
    impact_weight_llm_score: float = 0.15
    allow_mock_fallback: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def resolve_local_paths(self) -> "Settings":
        if self.database_url.startswith("sqlite:///./"):
            relative_db = self.database_url.removeprefix("sqlite:///./")
            self.database_url = f"sqlite:///{(API_ROOT / relative_db).as_posix()}"

        raw_storage_path = Path(self.raw_storage_dir)
        if not raw_storage_path.is_absolute():
            self.raw_storage_dir = str((API_ROOT / raw_storage_path).resolve())

        return self


settings = Settings()
