# Tempus Sales Copilot

A full-stack case study prototype built with Next.js and FastAPI.

## Stack

- Frontend: Next.js 14, React, TypeScript, Tailwind CSS
- Backend: FastAPI, Pydantic, SQLAlchemy
- Data: PostgreSQL + pgvector in production, SQLite fallback for local demo
- LLM: OpenAI Responses API with structured JSON output

## Structure

- `apps/web`: sales copilot frontend
- `apps/api`: FastAPI backend

## Local setup

### 1. Frontend

```bash
cd apps/web
npm install
npm run dev
```

### 2. Backend

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

To ingest a local PDF or markdown knowledge source without using the browser:

```bash
cd apps/api
py -3.11 scripts/ingest_local_knowledge.py "C:\path\to\document.pdf"
```

### 3. Environment

Copy `.env.example` values into:

- `apps/api/.env`
- `apps/web/.env.local`

## Notes

- The repo now defaults to strict live execution. If live embeddings or OpenAI responses fail, the API returns an explicit error instead of quietly substituting fallback output.
- Set `ALLOW_MOCK_FALLBACK=true` only when you intentionally want deterministic local fallback behavior for demos.
- Set `DATABASE_URL` to a managed Postgres connection string for production. The repository switches to SQLAlchemy + pgvector mode automatically when the URL starts with `postgresql`.
- Set `VECTOR_PROVIDER=pgvector` when you wire in live embeddings and similarity search.
- Uploaded raw files are stored under `RAW_STORAGE_DIR` and parsed into provider rows, CRM records, or canonical products that are chunked into `product_chunks`.
- Product chunks now receive embeddings during ingestion. With `OPENAI_API_KEY` set, the app uses real OpenAI embeddings; without a working live embedding path, ingestion and analysis now fail explicitly unless you opt into `ALLOW_MOCK_FALLBACK=true`.
- The v2 schema defaults to a fresh local SQLite file so it does not collide with the legacy prototype database. Point `DATABASE_URL` at Supabase Postgres when you are ready for hosted persistence and pgvector.
- The web UI now includes a Pipeline Status panel so you can verify embedding, reranking, retrieval, and generation sources for each analysis run.

## Upload formats

### Providers CSV

Expected columns:

- `id`
- `doctor_name`
- `clinic_or_hospital`
- `region`
- `size`
- `specialty`

### CRM CSV or TXT

CSV columns:

- `id`
- `provider_id`
- `concern`
- `interest_text`
- `note_text`
- `note_date`

TXT blocks:

```txt
provider_id: prov-101
concern: workflow
note_date: 2026-04-20
interest_text: Needs clearer turnaround-time evidence before committing to a pilot.
note_text: Needs clearer turnaround-time evidence before committing to a pilot.
```

### Products

Supported formats:

- `.csv`
- `.json`
- `.pdf`
- `.md`
- `.txt`
