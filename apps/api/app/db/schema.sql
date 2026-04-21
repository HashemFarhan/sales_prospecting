CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  doctor_name TEXT NOT NULL,
  clinic_or_hospital TEXT NOT NULL,
  region TEXT NOT NULL,
  size INTEGER NOT NULL,
  specialty TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_records (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  concern TEXT NOT NULL,
  interest_text TEXT NOT NULL,
  note_text TEXT NOT NULL,
  note_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  description TEXT NOT NULL,
  details TEXT NOT NULL,
  source_document TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_chunks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_document TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  section_title TEXT NOT NULL,
  topic TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_product_matches (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  interest_embedding_similarity DOUBLE PRECISION NOT NULL,
  llm_relevance_score DOUBLE PRECISION NOT NULL,
  llm_relevance_label TEXT NOT NULL,
  llm_reasoning TEXT NOT NULL,
  is_relevant BOOLEAN NOT NULL,
  evaluation_source TEXT NOT NULL,
  evaluation_notice TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS impact_rankings (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  relevant_product_count INTEGER NOT NULL,
  similarity_sum DOUBLE PRECISION NOT NULL,
  mean_llm_relevance_score DOUBLE PRECISION NOT NULL,
  size INTEGER NOT NULL,
  impact_score DOUBLE PRECISION NOT NULL,
  rank_reasoning TEXT NOT NULL,
  match_source TEXT NOT NULL,
  match_notice TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_outputs (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  top_product_ids JSONB NOT NULL,
  objection_handler TEXT NOT NULL,
  meeting_script TEXT NOT NULL,
  supporting_snippets JSONB NOT NULL,
  generation_source TEXT NOT NULL,
  generation_notice TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
