"use client";

import { useEffect, useMemo, useState } from "react";

import { getSourceDetail, getProviders, listSources } from "@/lib/api";
import { ProviderSummary, SourceFileDetail, SourceFileSummary } from "@/lib/types";
import { TopNavigation } from "@/components/provider-ui";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function titleForCategory(category: string) {
  const map: Record<string, string> = {
    providers: "Provider Sources",
    crm: "CRM Sources",
    products: "Product Sources"
  };
  return map[category] ?? "Uploaded Sources";
}

export function SourceBrowserPage(props: { category: string }) {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [sources, setSources] = useState<SourceFileSummary[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [sourceDetail, setSourceDetail] = useState<SourceFileDetail | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    setIsLoadingSources(true);
    setError("");
    void (async () => {
      try {
        const items = await listSources(props.category);
        setSources(items);
        setSelectedSourceId(items[0]?.id ?? "");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load source files.");
      } finally {
        setIsLoadingSources(false);
      }
    })();
  }, [props.category]);

  useEffect(() => {
    if (!selectedSourceId) {
      setSourceDetail(null);
      return;
    }
    setIsLoadingDetail(true);
    void (async () => {
      try {
        const detail = await getSourceDetail(selectedSourceId);
        setSourceDetail(detail);
        setError("");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load source detail.");
      } finally {
        setIsLoadingDetail(false);
      }
    })();
  }, [selectedSourceId]);

  const emptyState = useMemo(
    () => `No uploaded files were found in the ${props.category} source bucket yet.`,
    [props.category]
  );

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <TopNavigation providers={providers} />

      <div className="flex w-full flex-col pt-[88px] xl:flex-row">
        <WorkspaceSidebar />

        <section className="min-w-0 flex-1 bg-white p-6 xl:ml-[280px] xl:p-8">
          {error ? <div className="mb-4 border border-red-300 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="border border-slate-300 bg-white">
              <div className="border-b border-slate-300 px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Uploaded Data</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{titleForCategory(props.category)}</h1>
              </div>

              <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                {isLoadingSources ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="border border-slate-300 p-4">
                        <div className="skeleton-line h-4 w-3/4" />
                        <div className="mt-3 skeleton-line h-3 w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : sources.length > 0 ? (
                  <div className="divide-y divide-slate-300">
                    {sources.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => setSelectedSourceId(source.id)}
                        className={`block w-full px-5 py-4 text-left transition ${
                          selectedSourceId === source.id ? "bg-black text-white" : "bg-white text-slate-950 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-sm font-medium">{source.display_name}</div>
                        <div className={`mt-2 text-xs ${selectedSourceId === source.id ? "text-slate-300" : "text-slate-500"}`}>
                          {source.extension.toUpperCase()} | {formatBytes(source.size_bytes)} | {formatDate(source.updated_at)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-10 text-sm text-slate-500">{emptyState}</div>
                )}
              </div>
            </aside>

            <section className="border border-slate-300 bg-white">
              {isLoadingDetail ? (
                <div className="space-y-4 p-6">
                  <div className="skeleton-line h-6 w-1/3" />
                  <div className="skeleton-line h-4 w-1/4" />
                  <div className="space-y-3 pt-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="skeleton-line h-4 w-full" />
                    ))}
                  </div>
                </div>
              ) : sourceDetail ? (
                <>
                  <div className="border-b border-slate-300 px-6 py-5">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{sourceDetail.extension.toUpperCase()} File</div>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{sourceDetail.display_name}</h2>
                    <div className="mt-2 text-sm text-slate-500">
                      {formatBytes(sourceDetail.size_bytes)} | Updated {formatDate(sourceDetail.updated_at)}
                      {sourceDetail.page_count ? ` | ${sourceDetail.page_count} pages` : ""}
                    </div>
                  </div>

                  <div className="p-6">
                    {sourceDetail.view_type === "table" ? (
                      <div className="overflow-x-auto border border-slate-300">
                        <table className="min-w-full border-collapse text-sm">
                          <thead className="bg-black text-white">
                            <tr>
                              {sourceDetail.headers.map((header) => (
                                <th key={header} className="border-b border-slate-700 px-4 py-3 text-left font-medium">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sourceDetail.rows.map((row, index) => (
                              <tr key={`${index}-${row.join("|")}`} className="border-t border-slate-300">
                                {sourceDetail.headers.map((_, cellIndex) => (
                                  <td key={cellIndex} className="px-4 py-3 align-top text-slate-700">
                                    {row[cellIndex] ?? ""}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : sourceDetail.view_type === "markdown" ? (
                      <article className="prose prose-slate max-w-none whitespace-pre-wrap border border-slate-300 p-6 text-sm leading-7">
                        {sourceDetail.text_content}
                      </article>
                    ) : sourceDetail.view_type === "json" ? (
                      <pre className="overflow-x-auto border border-slate-300 bg-black p-6 text-sm leading-7 text-white">
                        {sourceDetail.text_content}
                      </pre>
                    ) : (
                      <div className="whitespace-pre-wrap border border-slate-300 p-6 text-sm leading-7 text-slate-700">
                        {sourceDetail.text_content || "No displayable text content was extracted from this file."}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="px-6 py-10 text-sm text-slate-500">Select a source file to view it.</div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
