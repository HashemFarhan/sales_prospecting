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
    const items: ProviderDrawerItem[] = providers.map((provider, index) => ({
      ...provider,
      rank: index
    }));
    return items;
  }, [providers]);

  const highPriorityCount = filteredProviders.filter((provider) => getPriorityTone(provider).label === "High Priority").length;

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <TopNavigation
        providers={providers}
        action={
          <div className="rounded-full border border-black bg-black px-4 py-2 text-sm text-white">
            Internal Tool
          </div>
        }
      />

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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-3">
                  <StatCard
                    label="Providers"
                    value={<AnimatedCounter value={providers.length} formatter={(value) => formatNumber(Math.round(value))} />}
                    helper="All records currently loaded."
                    inverse
                  />
                  <StatCard
                    label="High Priority"
                    value={<AnimatedCounter value={highPriorityCount} formatter={(value) => formatNumber(Math.round(value))} />}
                    helper="Based on queue position."
                    inverse
                  />
                  <StatCard
                    label="Latest Activity"
                    value={providers[0] ? formatDate(providers[0].latest_crm_note_date) : "No data"}
                    helper="Freshest CRM note across the queue."
                    inverse
                  />
                </div>

                <section className="rounded-[0.9rem] border border-slate-300 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-300 px-5 py-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Providers</div>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Queue</h2>
                    </div>
                    <div className="text-sm text-slate-500">{filteredProviders.length} visible</div>
                  </div>

                  <div className="space-y-0">
                    {filteredProviders.map((provider) => {
                      const priority = getPriorityTone(provider);
                      return (
                        <Link
                          key={provider.id}
                          href={`/providers/${provider.id}`}
                          className="block border-b border-slate-300 px-5 py-5 transition last:border-b-0 hover:bg-slate-50"
                        >
                          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-3">
                                <Building2 className="h-4 w-4 text-black" />
                                <h3 className="text-lg font-semibold tracking-tight text-slate-950">{provider.doctor_name}</h3>
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${priority.tagClassName}`}>
                                  {priority.label}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-500">{provider.clinic_or_hospital}</p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Last Note</div>
                                <div className="mt-1 text-sm font-medium text-slate-900">{formatDate(provider.latest_crm_note_date)}</div>
                              </div>
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Region</div>
                                <div className="mt-1 text-sm font-medium text-slate-900">{provider.region}</div>
                              </div>
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Specialty</div>
                                <div className="mt-1 text-sm font-medium text-slate-900">{provider.specialty}</div>
                              </div>
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Size</div>
                                <div className="mt-1 text-sm font-medium text-slate-900">{formatNumber(provider.size)}</div>
                              </div>
                              <div className="flex items-center justify-between gap-3 xl:justify-end">
                                <div>
                                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Open</div>
                                  <div className="mt-1 text-sm font-medium text-slate-900">View details</div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-black" />
                              </div>
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

              <aside className="rounded-[0.9rem] border border-slate-300 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-950">Data Intake</div>
                    <p className="mt-1 text-sm text-slate-500">Manage imports from the queue view.</p>
                  </div>
                  <UploadCloud className="h-5 w-5 text-black" />
                </div>

                <div className="mt-5 space-y-4">
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

                <div className="mt-5 rounded-[0.9rem] border border-black bg-black p-4 text-white">
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
