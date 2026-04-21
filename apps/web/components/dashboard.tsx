"use client";

import { ReactNode, useEffect, useState, useTransition } from "react";
import { AlertCircle, Building2, FileText, Gauge, MessageSquareQuote, Package2, Sparkles, Upload } from "lucide-react";

import { analyzeProvider, getProviders, uploadIngestionFile } from "@/lib/api";
import { AnalysisResponse, ProviderSummary } from "@/lib/types";

function SectionCard(props: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-3xl border border-white/60 p-6 shadow-card ${props.className ?? ""}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-sky/80 p-2 text-teal">{props.icon}</div>
        <h2 className="text-lg font-semibold text-ink">{props.title}</h2>
      </div>
      {props.children}
    </section>
  );
}

export function Dashboard() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [providerFile, setProviderFile] = useState<File | null>(null);
  const [crmFile, setCrmFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, startUploadTransition] = useTransition();

  async function loadProviders(preserveSelected = true) {
    const items = await getProviders();
    setProviders(items);
    if (items.length === 0) {
      setSelectedProviderId("");
      return;
    }
    if (preserveSelected && items.some((item) => item.id === selectedProviderId)) {
      return;
    }
    setSelectedProviderId(items[0].id);
  }

  useEffect(() => {
    void loadProviders(false).catch(() => setError("Unable to load providers from the API."));
  }, []);

  useEffect(() => {
    if (!selectedProviderId) {
      return;
    }
    startTransition(() => {
      void (async () => {
        try {
          setError("");
          const payload = await analyzeProvider(selectedProviderId);
          setAnalysis(payload);
        } catch {
          setError("Unable to generate provider analysis right now.");
        }
      })();
    });
  }, [selectedProviderId]);

  function handleUpload(kind: "providers" | "crm-notes" | "products", file: File | null) {
    if (!file) {
      setUploadMessage(`Choose a file for ${kind} first.`);
      return;
    }
    startUploadTransition(() => {
      void (async () => {
        try {
          setError("");
          const result = await uploadIngestionFile(kind, file);
          setUploadMessage(`Ingested ${result.ingested} records from ${file.name}.`);
          await loadProviders(false);
        } catch {
          setError(`Unable to ingest ${file.name}.`);
        }
      })();
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="glass overflow-hidden rounded-[2rem] border border-white/70 p-8 shadow-card">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-teal">
              <Sparkles className="h-4 w-4" />
              Tempus Sales Copilot
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Rank prospects by doctor-product fit, account size, and grounded evidence.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              The app combines provider records, CRM interests, and canonical product knowledge to identify the highest-impact accounts and the best product angle for outreach.
            </p>
          </div>

          <div className="w-full max-w-sm rounded-3xl bg-ink p-5 text-white">
            <label className="mb-2 block text-sm font-medium text-sky-100">Target provider</label>
            <select
              value={selectedProviderId}
              onChange={(event) => setSelectedProviderId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none ring-0"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.doctor_name} | {provider.clinic_or_hospital}
                </option>
              ))}
            </select>
            <p className="mt-3 text-sm text-slate-300">Switch accounts to rerun product matching and impact scoring instantly.</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {uploadMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{uploadMessage}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Providers Upload" icon={<Upload className="h-5 w-5" />}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">Upload a CSV with `doctor_name`, `clinic_or_hospital`, `region`, `size`, and `specialty`.</p>
            <input type="file" accept=".csv" onChange={(event) => setProviderFile(event.target.files?.[0] ?? null)} />
            <button onClick={() => handleUpload("providers", providerFile)} className="rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white disabled:opacity-50" disabled={isUploading}>
              Upload providers
            </button>
          </div>
        </SectionCard>

        <SectionCard title="CRM Upload" icon={<MessageSquareQuote className="h-5 w-5" />}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">Upload CRM records as CSV or TXT with `concern`, `interest_text`, and `note_text`.</p>
            <input type="file" accept=".csv,.txt" onChange={(event) => setCrmFile(event.target.files?.[0] ?? null)} />
            <button onClick={() => handleUpload("crm-notes", crmFile)} className="rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white disabled:opacity-50" disabled={isUploading}>
              Upload CRM
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Products Upload" icon={<Package2 className="h-5 w-5" />}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">Upload canonical products as CSV, JSON, Markdown, TXT, or PDF. Product details will be chunked and embedded automatically.</p>
            <input type="file" accept=".csv,.json,.md,.txt,.pdf" onChange={(event) => setProductFile(event.target.files?.[0] ?? null)} />
            <button onClick={() => handleUpload("products", productFile)} className="rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white disabled:opacity-50" disabled={isUploading}>
              Upload products
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <SectionCard title="Provider Snapshot" icon={<Building2 className="h-5 w-5" />}>
          {analysis ? (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Clinic / Hospital</div>
                  <div className="mt-1 font-medium">{analysis.provider.clinic_or_hospital}</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Region</div>
                  <div className="mt-1 font-medium text-ink">{analysis.provider.region}</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Size</div>
                  <div className="mt-1 font-medium text-ink">{analysis.provider.size}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-sand p-4 text-sm leading-7 text-ember">{analysis.provider.recent_concern_summary}</div>
              <div className="rounded-2xl bg-white p-4 text-sm leading-7 text-slate-700">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">Interest Profile</div>
                {analysis.provider.interest_profile}
              </div>
              <div className="space-y-3">
                {analysis.provider.crm_records.map((record) => (
                  <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                      <span>{record.concern}</span>
                      <span>{record.note_date}</span>
                    </div>
                    <p className="text-sm font-medium leading-6 text-slate-700">{record.interest_text}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{record.note_text}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{isPending ? "Analyzing provider..." : "Select a provider to begin."}</p>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Impact Breakdown" icon={<Gauge className="h-5 w-5" />}>
            {analysis ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Impact Score</div>
                    <div className="mt-2 text-2xl font-semibold text-ink">{analysis.impact.impact_score.toFixed(4)}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Relevant Products</div>
                    <div className="mt-2 text-2xl font-semibold text-ink">{analysis.impact.relevant_product_count}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Similarity Sum</div>
                    <div className="mt-2 text-2xl font-semibold text-ink">{analysis.impact.similarity_sum.toFixed(2)}</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Mean LLM Score</div>
                    <div className="mt-2 text-2xl font-semibold text-ink">{analysis.impact.mean_llm_relevance_score.toFixed(2)}</div>
                  </div>
                </div>
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{analysis.impact.rank_reasoning}</p>
                {analysis.impact.match_notice ? <p className="text-sm leading-6 text-amber-700">{analysis.impact.match_notice}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Impact details will appear after analysis.</p>
            )}
          </SectionCard>

          <SectionCard title="Top Matched Products" icon={<Package2 className="h-5 w-5" />}>
            <div className="space-y-3">
              {analysis?.top_matched_products.map((match) => (
                <article key={match.product_id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-ink">{match.product_name}</div>
                      <div className="text-sm text-slate-500">{match.llm_relevance_label}</div>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">{match.llm_relevance_score.toFixed(2)}</div>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{match.description}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{match.llm_reasoning}</p>
                  <div className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">Semantic {match.interest_embedding_similarity.toFixed(3)} | {match.evaluation_source}</div>
                </article>
              )) ?? <p className="text-sm text-slate-500">Matched products will appear after analysis.</p>}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Ranked Provider List" icon={<Gauge className="h-5 w-5" />}>
        <div className="grid gap-4 lg:grid-cols-3">
          {analysis?.ranking.ranked_providers.map((item, index) => (
            <article key={item.provider_id} className={`rounded-2xl border p-4 ${item.provider_id === analysis.ranking.selected_provider_id ? "border-teal bg-teal/5" : "border-slate-200 bg-white"}`}>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink">#{index + 1} {item.doctor_name}</div>
                  <div className="text-sm text-slate-500">{item.clinic_or_hospital}</div>
                </div>
                <div className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">{item.impact_score.toFixed(4)}</div>
              </div>
              <p className="text-sm leading-6 text-slate-600">{item.rank_reasoning}</p>
            </article>
          )) ?? <p className="text-sm text-slate-500">Provider rankings will appear after analysis.</p>}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Objection Handler" icon={<MessageSquareQuote className="h-5 w-5" />}>
          {analysis ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${analysis.generation_source === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {analysis.generation_source === "live" ? "Live OpenAI Output" : "Fallback Draft"}
                </span>
              </div>
              {analysis.generation_notice ? <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{analysis.generation_notice}</p> : null}
              <p className="text-sm leading-7 text-slate-700">{analysis.objection_handler}</p>
            </div>
          ) : (
            <p className="text-sm leading-7 text-slate-700">Waiting for generated response.</p>
          )}
        </SectionCard>

        <SectionCard title="30-Second Meeting Script" icon={<FileText className="h-5 w-5" />}>
          <p className="text-sm leading-7 text-slate-700">{analysis?.meeting_script ?? "Waiting for generated response."}</p>
        </SectionCard>
      </div>

      <SectionCard title="Grounding Evidence" icon={<Sparkles className="h-5 w-5" />}>
        <div className="grid gap-4 lg:grid-cols-3">
          {analysis?.evidence.map((snippet) => (
            <article key={snippet.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-400">{snippet.topic} | {snippet.section_title}</div>
              <p className="text-sm leading-8 text-slate-700 [text-wrap:pretty]">{snippet.display_text ?? snippet.chunk_text}</p>
              <div className="mt-4 text-xs font-medium text-teal">{snippet.source_document}</div>
            </article>
          )) ?? <p className="text-sm text-slate-500">Evidence will appear after analysis.</p>}
        </div>
      </SectionCard>
    </main>
  );
}
