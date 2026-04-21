from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str | None = None
    openai_model: str = "gpt-5-mini"
    embedding_model: str = "text-embedding-3-small"
    database_url: str = "sqlite:///./tempus_sales_copilot_v2.db"
    vector_provider: str = "mock"
    raw_storage_dir: str = "./storage/raw"
    product_shortlist_count: int = 4
    impact_weight_relevant_count: float = 0.35
    impact_weight_similarity_sum: float = 0.3
    impact_weight_size: float = 0.2
    impact_weight_llm_score: float = 0.15

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
