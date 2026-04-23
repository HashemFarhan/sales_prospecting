"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gauge,
  MessageSquareQuote
} from "lucide-react";

import { generateProviderOutput, getProviderEvidence, getProviderWorkspace, getProviders, regenerateMeetingScript } from "@/lib/api";
import { GeneratedOutputResponse, KnowledgeSnippet, ProviderSummary, ProviderWorkspaceResponse } from "@/lib/types";
import { AnimatedCounter, buildObjectionRows, formatDate, formatNumber, highlightText, parsePitchStages, StatCard, TopNavigation } from "@/components/provider-ui";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <section className="rounded-[0.9rem] border border-slate-300 bg-white p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="skeleton-line h-10 w-40 rounded-[0.7rem]" />
            <div className="skeleton-line h-14 w-2/3 rounded-[0.7rem]" />
            <div className="grid gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[0.9rem] border border-black bg-black p-5">
                  <div className="skeleton-line h-3 w-20 rounded-full bg-slate-700" />
                  <div className="mt-4 skeleton-line h-8 w-24 rounded-[0.5rem] bg-slate-700" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[0.9rem] border border-slate-300 bg-white p-4">
                <div className="skeleton-line h-4 w-28 rounded-full" />
                <div className="mt-3 skeleton-line h-4 w-full rounded-full" />
                <div className="mt-2 skeleton-line h-4 w-5/6 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-[0.9rem] border border-slate-300 bg-white p-6">
            <div className="skeleton-line h-5 w-40 rounded-[0.5rem]" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 2 }).map((__, rowIndex) => (
                <div key={rowIndex} className="rounded-[0.8rem] border border-slate-200 p-4">
                  <div className="skeleton-line h-4 w-28 rounded-full" />
                  <div className="mt-3 skeleton-line h-4 w-full rounded-full" />
                  <div className="mt-2 skeleton-line h-4 w-5/6 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function PitchSkeleton() {
  return (
    <div className="mt-4 rounded-[0.8rem] border border-slate-300 bg-white p-4">
      <div className="skeleton-line h-4 w-36 rounded-full" />
      <div className="mt-4 space-y-3">
        <div className="skeleton-line h-4 w-full rounded-full" />
        <div className="skeleton-line h-4 w-5/6 rounded-full" />
        <div className="skeleton-line h-4 w-4/6 rounded-full" />
        <div className="skeleton-line h-4 w-3/6 rounded-full" />
      </div>
    </div>
  );
}

function hasDisplayableGeneratedOutput(output: GeneratedOutputResponse | null) {
  if (!output) {
    return false;
  }
  return Boolean(output.meeting_script?.trim()) && Boolean(output.objection_handler?.trim());
}

function buildPreview(text: string, maxLength = 140) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function ProviderDetailPage(props: { providerId: string }) {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [workspace, setWorkspace] = useState<ProviderWorkspaceResponse | null>(null);
  const [generatedOutput, setGeneratedOutput] = useState<GeneratedOutputResponse | null>(null);
  const [evidence, setEvidence] = useState<KnowledgeSnippet[]>([]);
  const [error, setError] = useState("");
  const [pitchFeedback, setPitchFeedback] = useState("");
  const [pitchMessage, setPitchMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isGeneratingOutput, startGeneratingTransition] = useTransition();
  const [isRegeneratingPitch, setIsRegeneratingPitch] = useState(false);
  const [currentPitchSlide, setCurrentPitchSlide] = useState(0);
  const [activeProductIndex, setActiveProductIndex] = useState(0);

  useEffect(() => {
    void getProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        try {
          setError("");
          setWorkspace(null);
          setGeneratedOutput(null);
          setEvidence([]);
          const payload = await getProviderWorkspace(props.providerId);
          setWorkspace(payload);
          setGeneratedOutput(hasDisplayableGeneratedOutput(payload.generated_output ?? null) ? payload.generated_output ?? null : null);
          setEvidence(payload.evidence ?? []);
          if (hasDisplayableGeneratedOutput(payload.generated_output ?? null)) {
            void getProviderEvidence(props.providerId).then(setEvidence).catch(() => {});
          }
          if (!hasDisplayableGeneratedOutput(payload.generated_output ?? null)) {
            startGeneratingTransition(() => {
              void (async () => {
                try {
                  const generated = await generateProviderOutput(props.providerId);
                  if (hasDisplayableGeneratedOutput(generated)) {
                    setGeneratedOutput(generated);
                    void getProviderEvidence(props.providerId).then(setEvidence).catch(() => {});
                  } else {
                    setGeneratedOutput(null);
                    setError("Generated content is still empty. Please try regenerating again.");
                  }
                } catch (caughtError) {
                  setError(caughtError instanceof Error ? caughtError.message : "Unable to generate provider output.");
                }
              })();
            });
          }
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load provider analysis.");
        }
      })();
    });
  }, [props.providerId]);

  function handlePitchRegeneration() {
    if (!workspace || !generatedOutput) {
      return;
    }
    if (!pitchFeedback.trim()) {
      setPitchMessage("Add an edit note first so the pitch can be regenerated around it.");
      return;
    }
    setIsRegeneratingPitch(true);
    setPitchMessage("Generating updated pitch...");
    void (async () => {
      try {
        setError("");
        const response = await regenerateMeetingScript(props.providerId, pitchFeedback.trim(), generatedOutput.meeting_script);
        if (response.meeting_script?.trim()) {
          setGeneratedOutput((current) =>
            current
              ? {
                  ...current,
                  meeting_script: response.meeting_script,
                  generation_source: response.generation_source,
                  generation_notice: response.generation_notice
                }
              : current
          );
          setPitchMessage("Pitch regenerated with your guidance.");
        } else {
          setPitchMessage("The regenerated pitch came back empty. Please try again.");
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to regenerate the meeting script.");
      } finally {
        setIsRegeneratingPitch(false);
      }
    })();
  }

  const analysisLike = workspace && generatedOutput
    ? {
        provider: workspace.provider,
        top_matched_products: workspace.top_matched_products,
        evidence,
        objection_handler: generatedOutput.objection_handler,
        meeting_script: generatedOutput.meeting_script
      }
    : null;
  const objectionRows = analysisLike ? buildObjectionRows(analysisLike as never) : [];
  const displayableGeneratedOutput = hasDisplayableGeneratedOutput(generatedOutput) ? generatedOutput : null;
  const pitchHighlights = useMemo(
    () =>
      workspace
        ? [
            workspace.provider.doctor_name,
            workspace.provider.clinic_or_hospital,
            workspace.provider.specialty,
            ...workspace.top_matched_products.slice(0, 2).map((product) => product.product_name),
            "pilot",
            "confidence",
            "outcomes"
          ]
        : [],
    [workspace]
  );
  const pitchStages = useMemo(
    () => (displayableGeneratedOutput ? parsePitchStages(displayableGeneratedOutput.meeting_script) : []),
    [displayableGeneratedOutput]
  );
  const activePitchStage = pitchStages[currentPitchSlide] ?? pitchStages[0] ?? null;

  useEffect(() => {
    setCurrentPitchSlide(0);
  }, [props.providerId, displayableGeneratedOutput?.meeting_script]);
  const crmRecords = workspace?.provider.crm_records.slice(0, 4) ?? [];
  const topProducts = workspace?.top_matched_products.slice(0, 3) ?? [];
  const activeProduct = topProducts[activeProductIndex] ?? topProducts[0] ?? null;
  const activeProductEvidence = activeProduct
    ? evidence.filter((snippet) => snippet.product_id === activeProduct.product_id)
    : [];
  const activeEvidence = activeProductEvidence[0] ?? evidence[0] ?? null;
  const topEvidenceCount = activeProductEvidence.length || evidence.length;

  useEffect(() => {
    setActiveProductIndex(0);
  }, [props.providerId, workspace?.provider.id, topProducts.length]);

  return (
    <main className="app-shell min-h-screen text-slate-950">
      <TopNavigation
        providers={providers}
        action={
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-black bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-900"
            >
            <ArrowLeft className="h-4 w-4" />
            Back to providers
          </Link>
        }
      />

      <div className="flex w-full flex-col pt-[88px] xl:flex-row">
        <WorkspaceSidebar />

        <section className="min-w-0 flex-1 p-6 xl:ml-[280px] xl:p-8">
          {error ? (
            <div className="panel-surface mb-4 flex items-center gap-3 rounded-[0.9rem] border border-red-200 bg-white/95 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          {!workspace ? (
            <DetailSkeleton />
          ) : (
            <div className="space-y-6">
              <section className="rounded-[0.9rem] border border-slate-300 bg-white p-6">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="space-y-5">
                    <div>
                      <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{workspace.provider.doctor_name}</h1>
                      <p className="mt-2 text-base text-slate-500">
                        {workspace.provider.clinic_or_hospital} | {workspace.provider.specialty} | {workspace.provider.region}
                      </p>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-4">
                      <StatCard
                        label="Snapshot Score"
                        value={<AnimatedCounter value={workspace.impact?.impact_score ?? 0} formatter={(value) => value.toFixed(2)} />}
                        helper="Overall ranking output."
                        inverse
                      />
                      <StatCard
                        label="Account Size"
                        value={<AnimatedCounter value={workspace.provider.size} formatter={(value) => formatNumber(Math.round(value))} />}
                        helper="Provider scale."
                        inverse
                      />
                      <StatCard
                        label="CRM Activity"
                        value={workspace.provider.crm_records[0] ? formatDate(workspace.provider.crm_records[0].note_date) : "No note"}
                        helper="Latest account activity."
                        inverse
                      />
                      <StatCard
                        label="Matches"
                        value={<AnimatedCounter value={workspace.impact?.relevant_product_count ?? workspace.top_matched_products.length} formatter={(value) => String(Math.round(value))} />}
                        helper="Relevant products."
                        inverse
                      />
                    </div>

                    <div className="rounded-[0.9rem] border border-slate-300 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                        <Building2 className="h-4 w-4 text-black" />
                        Snapshot
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{workspace.provider.interest_profile}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                    <div className="rounded-[0.95rem] border border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Generation</div>
                          <div className="mt-3 text-[1.05rem] font-semibold tracking-tight text-slate-950">{generatedOutput?.generation_source ?? "Pending"}</div>
                        </div>
                        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700">
                          {generatedOutput?.generation_source?.toLowerCase() === "live" ? "Live" : "Not live"}
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">Current output source for this provider brief.</p>
                    </div>
                    <div className="rounded-[0.95rem] border border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Similarity Sum</div>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="text-[1.15rem] font-semibold tracking-tight text-slate-950">
                          <AnimatedCounter value={workspace.impact?.similarity_sum ?? 0} formatter={(value) => value.toFixed(2)} />
                        </div>
                        <div className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white">
                          Aggregate
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-slate-950"
                          style={{ width: `${Math.max(8, Math.min(100, (workspace.impact?.similarity_sum ?? 0) * 100))}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">Combined similarity across the matched evidence set.</p>
                    </div>
                    <div className="rounded-[0.95rem] border border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                      <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Mean LLM Score</div>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="text-[1.15rem] font-semibold tracking-tight text-slate-950">
                          <AnimatedCounter value={workspace.impact?.mean_llm_relevance_score ?? 0} formatter={(value) => value.toFixed(2)} />
                        </div>
                        <div className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
                          Model Avg
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#475569_100%)]"
                          style={{ width: `${Math.max(8, Math.min(100, (workspace.impact?.mean_llm_relevance_score ?? 0) * 100))}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">Average relevance confidence assigned by the model.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel-surface rounded-[1.2rem] p-6">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                      <FileText className="h-4 w-4 text-slate-700" />
                      Sales Rep Talk Track
                    </div>
                    <h2 className="mt-1 text-[1.9rem] font-semibold tracking-tight text-slate-950">30-second pitch deck</h2>
                  </div>
                  <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                    3-step talk track
                  </div>
                </div>

                {displayableGeneratedOutput && !isRegeneratingPitch ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {pitchStages.map((stage, index) => (
                          <button
                            key={`${stage.label}-${index}`}
                            type="button"
                            onClick={() => setCurrentPitchSlide(index)}
                            className={`rounded-[0.95rem] border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                              index === currentPitchSlide
                                ? "border-slate-950 bg-slate-950 text-white"
                                : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700"
                            }`}
                          >
                            {index + 1}. {stage.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPitchSlide((current) => Math.max(0, current - 1))}
                          disabled={currentPitchSlide === 0}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[0.9rem] border text-white transition disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500"
                          style={currentPitchSlide === 0 ? undefined : { backgroundColor: "#206ef3", borderColor: "#206ef3", color: "#ffffff" }}
                          aria-label="Previous pitch slide"
                        >
                          <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPitchSlide((current) => Math.min(pitchStages.length - 1, current + 1))}
                          disabled={currentPitchSlide >= pitchStages.length - 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[0.9rem] border text-white transition disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500"
                          style={currentPitchSlide >= pitchStages.length - 1 ? undefined : { backgroundColor: "#206ef3", borderColor: "#206ef3", color: "#ffffff" }}
                          aria-label="Next pitch slide"
                        >
                          <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>

                    {activePitchStage ? (
                      <article className="rounded-[0.9rem] border border-slate-200 bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.03)]">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-[1.7rem] font-semibold tracking-tight text-slate-950">{activePitchStage.label}</h3>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {currentPitchSlide + 1} / {pitchStages.length}
                            </div>
                          </div>

                          <div className="rounded-[0.7rem] border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="min-h-[132px] text-[clamp(1rem,1.25vw,1.12rem)] leading-[1.6] text-slate-700 whitespace-pre-wrap break-words overflow-visible">
                              {highlightText(activePitchStage.body, pitchHighlights)}
                            </div>
                          </div>
                        </div>
                      </article>
                    ) : null}
                  </div>
                ) : (
                  <PitchSkeleton />
                )}

                <div className="panel-subtle mt-3 rounded-[0.9rem] p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-sm font-medium text-slate-900">Refine the 3-step pitch</label>
                  </div>
                  <textarea
                    value={pitchFeedback}
                    onChange={(event) => setPitchFeedback(event.target.value)}
                    rows={3}
                    placeholder="Example: make the hook more ROI-focused, simplify the value message, or tighten the close."
                    className="mt-3 w-full rounded-[0.9rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">{pitchMessage || "Hook, Value, Close."}</p>
                    <button
                      onClick={handlePitchRegeneration}
                      disabled={isRegeneratingPitch || !displayableGeneratedOutput}
                      className="inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-600"
                      style={isRegeneratingPitch || !displayableGeneratedOutput ? undefined : { backgroundColor: "#206ef3", borderColor: "#206ef3", color: "#ffffff" }}
                    >
                      {isRegeneratingPitch ? "Regenerating..." : "Regenerate Pitch"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel-surface rounded-[1.2rem] p-6">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-5">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                      <Gauge className="h-4 w-4 text-slate-700" />
                      Product-fit Workspace
                    </div>
                    <h2 className="mt-1 text-[1.9rem] font-semibold tracking-tight text-slate-950">Product-fit Workspace</h2>
                  </div>
                </div>

                <div className="mt-5 space-y-6">
                  <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Top product shortlist</div>
                      {topProducts.map((match, index) => {
                        const isActive = (topProducts[activeProductIndex] ?? topProducts[0])?.product_id === match.product_id;
                        return (
                          <button
                            key={match.product_id}
                            type="button"
                            onClick={() => setActiveProductIndex(index)}
                            className={`w-full rounded-[1rem] border p-4 text-left transition ${
                              isActive
                                ? "text-white shadow-[0_16px_32px_rgba(32,110,243,0.18)]"
                                : "panel-subtle border-slate-200 text-slate-950 hover:border-slate-300"
                            }`}
                            style={isActive ? { backgroundColor: "#206ef3", borderColor: "#206ef3" } : undefined}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Product {index + 1}</div>
                                <div className={`mt-1 text-sm font-semibold ${isActive ? "text-white" : "text-slate-950"}`}>{match.product_name}</div>
                              </div>
                              <div className={`rounded-full px-3 py-1 text-sm font-medium ${isActive ? "bg-white text-slate-950" : "border border-slate-900 bg-slate-950 text-white"}`}>
                                {match.llm_relevance_score.toFixed(2)}
                              </div>
                            </div>
                            <p className={`mt-3 text-sm leading-6 ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                              {buildPreview(match.llm_reasoning, 120)}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="panel-subtle rounded-[1rem] p-5 self-start">
                      {activeProduct ? (
                        <div className="space-y-5">
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div>
                              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Best-fit recommendation</div>
                              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{activeProduct.product_name}</h3>
                            </div>
                            <div className="rounded-full border border-slate-900 bg-slate-950 px-3 py-1 text-sm font-medium text-white">
                              {activeProduct.llm_relevance_score.toFixed(2)}
                            </div>
                          </div>

                          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                            <div className="rounded-[0.95rem] border border-slate-200 bg-white p-4">
                              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Why this is a fit</div>
                              <p className="mt-3 text-sm leading-7 text-slate-700">{activeProduct.llm_reasoning}</p>
                            </div>

                            <div className="grid gap-3">
                              <div className="rounded-[0.9rem] border border-slate-200 bg-white p-4">
                                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Product summary</div>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{activeProduct.description}</p>
                              </div>
                              <div className="rounded-[0.9rem] border border-slate-200 bg-white p-4">
                                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Scoring signals</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                                    Semantic {activeProduct.interest_embedding_similarity.toFixed(3)}
                                  </span>
                                  <span
                                    className="rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]"
                                    style={{ borderColor: "#bfd7ff", backgroundColor: "#eff6ff", color: "#206ef3" }}
                                  >
                                    {activeProduct.evaluation_source}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-[1rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-5">
                            {activeEvidence ? (
                              <div className="rounded-[0.9rem] border border-slate-200 bg-white p-4">
                                <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Evidence excerpt</div>
                                  <div className="text-sm font-medium text-slate-950">{activeEvidence.source_document}</div>
                                </div>
                                <div className="pt-3 text-sm leading-7 text-slate-700">
                                  {activeEvidence.display_text ?? activeEvidence.chunk_text}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-[0.8rem] border border-slate-300 bg-white p-4 text-sm text-slate-500">
                                No supporting evidence available yet.
                              </div>
                            )}

                            {generatedOutput && evidence.length === 0 ? (
                              <div className="mt-3 rounded-[0.8rem] border border-slate-300 bg-white p-4 text-sm text-slate-500">
                                Loading supporting evidence...
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[0.8rem] border border-slate-300 bg-white p-4 text-sm text-slate-500">
                          No product matches available yet.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
                <div className="space-y-6">
                  <div className="panel-surface rounded-[1.2rem] p-6">
                    <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                        <MessageSquareQuote className="h-4 w-4 text-slate-700" />
                        Objection Guidance
                      </div>
                      <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                        Step 3: Handle pushback
                      </div>
                    </div>
                    {displayableGeneratedOutput ? (
                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {objectionRows.map((item, index) => (
                          <article key={`${item.objection}-${index}`} className="panel-subtle rounded-[1rem] p-4">
                            <div className="rounded-[0.85rem] border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-rose-700">
                              Objection: {item.objection}
                            </div>
                            <div className="mt-4">
                              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">What to say</div>
                              <p className="mt-1 text-sm leading-6 text-slate-700">{item.answer}</p>
                            </div>
                            <div className="mt-4 rounded-[0.85rem] bg-slate-950 px-4 py-3">
                              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Proof point to reinforce</div>
                              <p className="mt-1 text-sm leading-6 text-slate-200">{item.resolution}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div key={index} className="rounded-[0.8rem] border border-slate-300 bg-white p-4">
                            <div className="skeleton-line h-4 w-24 rounded-full" />
                            <div className="mt-3 skeleton-line h-4 w-full rounded-full" />
                            <div className="mt-2 skeleton-line h-4 w-5/6 rounded-full" />
                            <div className="mt-3 skeleton-line h-4 w-full rounded-full" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                  <div className="panel-surface rounded-[1.2rem] p-6">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 pb-5">
                      <div>
                        <div className="text-sm font-medium text-slate-950">Sales Brief</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Reference this side panel during prep to understand why this account matters and what evidence supports the pitch.</p>
                      </div>
                      <div className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                        Support Rail
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3">
                      <div className="panel-subtle rounded-[1rem] p-4">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Priority focus</div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          Emphasize the top matched product first, connect it to the provider's current interest profile, and use the recent CRM note as your proof of timing.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <div className="rounded-[1rem] bg-slate-950 px-4 py-4 text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)]">
                          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Top product</div>
                          <div className="mt-2 text-base font-semibold">{topProducts[0]?.product_name ?? "Pending"}</div>
                        </div>
                        <div className="panel-subtle rounded-[1rem] p-4">
                          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Recent note</div>
                          <div className="mt-2 text-base font-semibold text-slate-950">
                            {crmRecords[0] ? formatDate(crmRecords[0].note_date) : "No note"}
                          </div>
                        </div>
                        <div className="panel-subtle rounded-[1rem] p-4">
                          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Evidence ready</div>
                          <div className="mt-2 text-base font-semibold text-slate-950">{topEvidenceCount}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              <section className="panel-surface rounded-[1.2rem] p-6">
                <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                    <CalendarDays className="h-4 w-4 text-slate-700" />
                    Recent CRM Activity
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {crmRecords.length} recent {crmRecords.length === 1 ? "entry" : "entries"}
                  </div>
                </div>

                {crmRecords.length ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
                    {crmRecords.map((record) => (
                      <article key={record.id} className="panel-subtle flex min-h-[220px] flex-col rounded-[0.95rem] border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Concern</div>
                            <div className="mt-1 text-base font-semibold capitalize tracking-tight text-slate-950">
                              {record.concern.replace(/-/g, " ")}
                            </div>
                          </div>
                          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                            {formatDate(record.note_date)}
                          </div>
                        </div>

                        <div className="mt-4 space-y-4">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Interest signal</div>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{record.interest_text}</p>
                          </div>

                          <div className="border-t border-slate-200 pt-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Latest note</div>
                            <p className="mt-2 text-sm leading-6 text-slate-500">{record.note_text}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[0.9rem] border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                    No CRM activity available yet.
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
