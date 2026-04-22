export type ProviderSummary = {
  id: string;
  doctor_name: string;
  clinic_or_hospital: string;
  region: string;
  size: number;
  specialty: string;
  latest_crm_note_date?: string | null;
};

export type CRMRecord = {
  id: string;
  provider_id: string;
  concern: string;
  interest_text: string;
  note_text: string;
  note_date: string;
};

export type ProviderDetail = ProviderSummary & {
  crm_records: CRMRecord[];
  recent_concern_summary: string;
  interest_profile: string;
};

export type ProductMatch = {
  product_id: string;
  product_name: string;
  description: string;
  interest_embedding_similarity: number;
  llm_relevance_score: number;
  llm_relevance_label: string;
  llm_reasoning: string;
  is_relevant: boolean;
  evaluation_source: string;
  evaluation_notice?: string | null;
};

export type ImpactBreakdown = {
  relevant_product_count: number;
  similarity_sum: number;
  mean_llm_relevance_score: number;
  size: number;
  impact_score: number;
  rank_reasoning: string;
  match_source: string;
  match_notice?: string | null;
};

export type KnowledgeSnippet = {
  id: string;
  product_id: string;
  source_document: string;
  section_title: string;
  topic: string;
  chunk_text: string;
  display_text?: string | null;
  relevance_score?: number | null;
};

export type PipelineDiagnostics = {
  embedding_source: string;
  embedding_notice?: string | null;
  rerank_source: string;
  rerank_notice?: string | null;
  retrieval_source: string;
  retrieval_notice?: string | null;
  scoring_source: string;
  generation_source: string;
  generation_notice?: string | null;
};

export type RankedProvider = {
  provider_id: string;
  doctor_name: string;
  clinic_or_hospital: string;
  impact_score: number;
  rank_reasoning: string;
};

export type ProviderRankingResponse = {
  selected_provider_id: string;
  ranked_providers: RankedProvider[];
};

export type AnalysisResponse = {
  provider: ProviderDetail;
  ranking: ProviderRankingResponse;
  top_matched_products: ProductMatch[];
  impact: ImpactBreakdown;
  objection_handler: string;
  meeting_script: string;
  evidence: KnowledgeSnippet[];
  citations: string[];
  generation_source: string;
  generation_notice?: string | null;
  diagnostics: PipelineDiagnostics;
};

export type GeneratedOutputResponse = {
  provider_id: string;
  top_product_ids: string[];
  objection_handler: string;
  meeting_script: string;
  supporting_snippets: string[];
  generation_source: string;
  generation_notice?: string | null;
};

export type ProviderWorkspaceResponse = {
  provider: ProviderDetail;
  ranking: ProviderRankingResponse;
  top_matched_products: ProductMatch[];
  impact?: ImpactBreakdown | null;
  generated_output?: GeneratedOutputResponse | null;
  evidence: KnowledgeSnippet[];
};

export type SourceFileSummary = {
  id: string;
  category: string;
  filename: string;
  display_name: string;
  extension: string;
  size_bytes: number;
  updated_at: string;
};

export type SourceFileDetail = SourceFileSummary & {
  view_type: "table" | "json" | "markdown" | "pdf" | "text";
  headers: string[];
  rows: string[][];
  text_content?: string | null;
  page_count?: number | null;
};

export type MeetingScriptResponse = {
  provider_id: string;
  meeting_script: string;
  generation_source: string;
  generation_notice?: string | null;
};
