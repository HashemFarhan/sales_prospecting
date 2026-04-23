# Focused Genomics Mock Uploads

This folder is tuned so the ranking and matching pipeline naturally favors these four products:

- `Single Platform Somatic Plus Germline Testing`
- `Solid Tumor Plus Normal Match`
- `DNA Sequencing Plus Whole Transcriptome RNA Sequencing`
- `Solid Tumor Plus Liquid Biopsy`

The matches are not hardcoded. The effect comes from:

- provider specialties and hospital context
- CRM `interest_text`
- CRM `note_text`
- concern labels
- product descriptions and details

## Expected pattern

- Strongest fit:
  - `prov-301`
  - `prov-302`
- Strong to moderate fit:
  - `prov-303`
  - `prov-304`
- Weak fit:
  - `prov-305`
  - `prov-306`

## Upload order

1. `market_intelligence_providers.csv`
2. `crm_notes.csv`
3. `products.csv`

## Why this package works

- The strongest providers explicitly discuss:
  - liquid biopsy
  - actionable variants
  - DNA plus RNA sequencing
  - driver fusions
  - tumor-normal matched sequencing
  - somatic plus germline testing
- Lower-fit providers focus on:
  - staffing
  - scheduling
  - referral management
  - access and operations

That gives embeddings and reranking clearer separation between the target products and the rest of the portfolio.
