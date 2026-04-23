"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Building2, Database, UploadCloud } from "lucide-react";

import { getProviders, uploadIngestionFile } from "@/lib/api";
import { ProviderSummary } from "@/lib/types";
import { AnimatedCounter, formatDate, formatNumber, getPriorityTone, ProviderDrawerItem, StatCard, TopNavigation, UploadPanel } from "@/components/provider-ui";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";

type UploadKind = "providers" | "crm-notes" | "products";

export function Dashboard() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [providerFile, setProviderFile] = useState<File | null>(null);
  const [crmFile, setCrmFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isUploading, startUploadTransition] = useTransition();

  async function loadProviders() {
    const items = await getProviders();
    setProviders(items);
  }

  useEffect(() => {
    void loadProviders().catch(() => setError("Unable to load providers from the API."));
  }, []);

  function handleUpload(kind: UploadKind, file: File | null) {
    if (!file) {
      setUploadMessage(`Choose a file for ${kind} first.`);
      return;
    }
    startUploadTransition(() => {
      void (async () => {
        try {
          setError("");
          setUploadMessage("");
          const result = await uploadIngestionFile(kind, file);
          setUploadMessage(`Replaced the active ${kind} dataset with ${result.ingested} records from ${file.name}.`);
          await loadProviders();
        } catch (caughtError) {
          const message = caughtError instanceof Error ? caughtError.message : `Unable to ingest ${file.name}.`;
          setError(message);
        }
      })();
    });
  }

  const filteredProviders = useMemo(() => {
    const items: ProviderDrawerItem[] = providers.map((provider) => ({
      ...provider,
      impactScore: provider.impact_score ?? undefined,
      rankReasoning: provider.rank_reasoning ?? undefined
    }));
    return items.sort((left, right) => {
      const leftScore = left.impactScore ?? left.impact_score ?? -1;
      const rightScore = right.impactScore ?? right.impact_score ?? -1;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return left.doctor_name.localeCompare(right.doctor_name);
    });
  }, [providers]);

  const highPriorityCount = filteredProviders.filter((provider) => getPriorityTone(provider).label === "Priority").length;

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <TopNavigation providers={providers} />

      <div className="flex w-full flex-col pt-[88px] xl:flex-row">
        <WorkspaceSidebar />

        <section className="min-w-0 flex-1 bg-white p-6 xl:ml-[280px] xl:p-8">
          {error ? (
            <div className="rounded-[0.9rem] border border-red-300 bg-white px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          {uploadMessage ? (
            <div className="mt-4 rounded-[0.9rem] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">{uploadMessage}</div>
          ) : null}

          <div className="flex flex-col gap-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-6">
                <div className="grid gap-3 rounded-[1.2rem] border border-black/8 bg-white p-5 lg:grid-cols-3">
                  <StatCard
                    label="Providers"
                    value={<AnimatedCounter value={providers.length} formatter={(value) => formatNumber(Math.round(value))} />}
                    helper="All records currently loaded."
                    className="border-0 shadow-none"
                  />
                  <StatCard
                    label="Priority"
                    value={<AnimatedCounter value={highPriorityCount} formatter={(value) => formatNumber(Math.round(value))} />}
                    helper="Based on impact scoring."
                    className="border-0 shadow-none"
                  />
                  <StatCard
                    label="Latest Activity"
                    value={filteredProviders[0] ? formatDate(filteredProviders[0].latest_crm_note_date) : "No data"}
                    helper="Freshest CRM note across the queue."
                    className="border-0 shadow-none"
                  />
                </div>

                <section className="rounded-[1.2rem] border border-black/8 bg-white">
                  <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-black/35">Providers</div>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-black">Queue</h2>
                    </div>
                    <div className="text-sm text-black/45">{filteredProviders.length} visible</div>
                  </div>

                  <div className="space-y-0">
                    {filteredProviders.map((provider) => {
                      const priority = getPriorityTone(provider);
                      return (
                        <Link
                          key={provider.id}
                          href={`/providers/${provider.id}`}
                          className="block border-b border-black/8 px-5 py-5 transition last:border-b-0 hover:bg-black/[0.02]"
                        >
                          <div className="grid gap-x-5 gap-y-4 xl:grid-cols-[minmax(280px,1.7fr)_minmax(110px,0.9fr)_minmax(110px,0.9fr)_minmax(140px,1fr)_minmax(72px,0.55fr)_minmax(110px,0.7fr)] xl:items-start">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex h-11 w-11 items-center justify-center rounded-[0.85rem] bg-transparent">
                                  <Building2 className="h-4 w-4 text-[#206ef3]" />
                                </div>
                                <h3 className="min-w-0 break-words text-lg font-semibold tracking-tight text-black">{provider.doctor_name}</h3>
                                <span className={`inline-flex shrink-0 rounded-[0.35rem] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] xl:ml-1 ${priority.tagClassName}`}>
                                  {priority.label}
                                </span>
                              </div>
                              <p className="mt-2 break-words text-sm leading-6 text-black/55">{provider.clinic_or_hospital}</p>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-[0.22em] text-black/35">Last Note</div>
                              <div className="mt-1 break-words text-sm font-medium text-black">{formatDate(provider.latest_crm_note_date)}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-[0.22em] text-black/35">Region</div>
                              <div className="mt-1 break-words text-sm font-medium text-black">{provider.region}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-[0.22em] text-black/35">Specialty</div>
                              <div className="mt-1 break-words text-sm font-medium text-black">{provider.specialty}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-[0.22em] text-black/35">Size</div>
                              <div className="mt-1 text-sm font-medium text-black">{formatNumber(provider.size)}</div>
                            </div>
                            <div className="flex min-w-0 items-start justify-between gap-3 xl:justify-end">
                              <div>
                                <div className="break-words text-sm font-medium text-[#206ef3]">View details</div>
                              </div>
                              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#206ef3]" />
                            </div>
                          </div>
                        </Link>
                      );
                    })}

                    {filteredProviders.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-slate-500">No providers matched that search.</div>
                    ) : null}
                  </div>
                </section>
              </div>

              <aside className="rounded-[1.2rem] border border-black/8 bg-white p-0 shadow-[0_12px_28px_rgba(17,17,17,0.04)]">
                <div className="flex items-center justify-between">
                  <div className="border-b border-black/8 px-5 py-5">
                    <div className="text-2xl font-semibold text-black">Data Intake</div>
                    <p className="mt-2 text-sm leading-6 text-black/55">Manage imports from the queue view.</p>
                  </div>
                  <UploadCloud className="mr-5 h-5 w-5 text-[#206ef3]" />
                </div>

                <div className="space-y-4 p-5 pt-0">
                  <UploadPanel
                    title="Providers"
                    hint="CSV with doctor_name, clinic_or_hospital, region, size, and specialty."
                    accept=".csv"
                    disabled={isUploading}
                    onSelect={setProviderFile}
                    onUpload={() => handleUpload("providers", providerFile)}
                  />
                  <UploadPanel
                    title="CRM Notes"
                    hint="CSV or TXT with concern, interest_text, and note_text."
                    accept=".csv,.txt"
                    disabled={isUploading}
                    onSelect={setCrmFile}
                    onUpload={() => handleUpload("crm-notes", crmFile)}
                  />
                  <UploadPanel
                    title="Products"
                    hint="CSV, JSON, Markdown, TXT, or PDF for canonical product knowledge."
                    accept=".csv,.json,.md,.txt,.pdf"
                    disabled={isUploading}
                    onSelect={setProductFile}
                    onUpload={() => handleUpload("products", productFile)}
                  />
                </div>

                <div className="mx-5 mb-5 rounded-[1rem] border border-black bg-black p-4 text-white">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Database className="h-4 w-4" />
                    Workspace Notes
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">Use the queue to review providers, then open a record for CRM notes, objections, pitch, score, and product fit.</p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
