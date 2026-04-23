# Mock Upload Files

These files are designed to work with the current ingestion endpoints and parser logic in this repo.

## Files

- `focused_genomics/`
  Contains a fully aligned provider + CRM + product package centered on the main genomics products that should rank highest through normal embeddings and reranking.
- `market_intelligence_providers.csv`
  Uses the exact columns the provider upload expects:
  `id,name,hospital_name,specialty,estimated_patient_volume,territory`
- `crm_notes.csv`
  Uses the preferred CRM CSV shape:
  `id,provider_id,concern,interest_text,note_text,note_date`
- `crm_notes_alt.txt`
  Uses the TXT block format the CRM TXT parser expects:
  `provider_id:`, `concern_type:`, `note_date:`, `note_text:`
- `products.csv`
  Uses the product upload format:
  `id,product_name,description,details,source_document`

## Suggested upload order

1. Upload `market_intelligence_providers.csv`
2. Upload either `crm_notes.csv` or `crm_notes_alt.txt`
3. Upload `products.csv`

For the strongest genomics-focused matching behavior, use the files inside `focused_genomics/` instead.

## Notes

- All providers, hospitals, notes, and metrics are fictional but intentionally realistic.
- Provider IDs line up across the provider and CRM files so the ranking and retrieval flows work correctly.
- The CRM file now includes both `interest_text` and `note_text` so provider profiles are richer and product matching has better signal.
- The product details intentionally include workflow, clinical evidence, integration, and ROI language so the matching flow has realistic product signals to work with.
