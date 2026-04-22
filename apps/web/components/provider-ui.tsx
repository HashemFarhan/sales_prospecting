import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { KnowledgeSnippet, ProductMatch, ProviderDetail, ProviderSummary } from "@/lib/types";

export type ProviderDrawerItem = ProviderSummary & {
  impactScore?: number;
  rankReasoning?: string;
  rank?: number;
};

export function formatDate(value?: string | null) {
  if (!value) {
    return "No recent note";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

export function getPriorityTone(item: ProviderDrawerItem) {
  if (typeof item.rank === "number") {
    if (item.rank < 3) {
      return {
        label: "High Priority",
        tagClassName: "border border-black bg-black text-white"
      };
    }
    if (item.rank < 7) {
      return {
        label: "Active",
        tagClassName: "border border-slate-400 bg-slate-100 text-slate-900"
      };
    }
  }
  if (item.size >= 500) {
      return {
        label: "Strategic",
        tagClassName: "border border-black bg-black text-white"
      };
  }
  if (item.size >= 150) {
    return {
      label: "Watchlist",
      tagClassName: "border border-slate-300 bg-slate-100 text-slate-700"
    };
  }
  return {
    label: "Emerging",
    tagClassName: "border border-slate-200 bg-white text-slate-600"
  };
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightText(text: string, highlights: string[]) {
  const tokens = highlights.filter(Boolean).sort((left, right) => right.length - left.length);
  if (tokens.length === 0) {
    return text;
  }
  const regex = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    tokens.some((token) => token.toLowerCase() === part.toLowerCase()) ? (
      <strong key={`${part}-${index}`} className="font-semibold text-slate-950">
        {part}
      </strong>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export function parseScriptParagraphs(text: string) {
  return text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parsePitchStages(text: string) {
  const defaults = ["Hook", "Value", "Close"];
  const segments = text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const mergedStages: Array<{ order: number; label: string; body: string }> = [];

  for (const segment of segments) {
    const match = segment.match(
      /^(?:Stage\s*)?([1-3])[\).\:-]?\s*(Hook|Value|Close|Opening|Intro|Problem|Why Tempus|Recommendation|Ask)?\s*[:\-]?\s*(.+)?$/i
    );

    if (match) {
      const order = Number(match[1]) - 1;
      const rawLabel = (match[2] || defaults[order] || `Stage ${match[1]}`).trim();
      const label =
        /^opening|intro|problem$/i.test(rawLabel) ? "Hook" :
        /^why tempus$/i.test(rawLabel) ? "Value" :
        /^recommendation|ask$/i.test(rawLabel) ? "Close" :
        rawLabel;
      const body = (match[3] || "").trim();
      mergedStages.push({
        order,
        label,
        body
      });
      continue;
    }

    const lastStage = mergedStages[mergedStages.length - 1];
    if (lastStage) {
      lastStage.body = `${lastStage.body} ${segment}`.trim();
    }
  }

  const explicitStages = mergedStages
    .map((item) => {
      if (!item.body) {
        return null;
      }
      return item;
    })
    .filter((item): item is { order: number; label: string; body: string } => Boolean(item))
    .sort((left, right) => left.order - right.order);

  if (explicitStages.length === 3) {
    return explicitStages;
  }

  if (segments.length === 3) {
    return segments.map((segment, index) => ({
      order: index,
      label: defaults[index],
      body: segment.replace(/^(?:Stage\s*)?[1-3][\).\:-]?\s*/i, "").trim()
    }));
  }

  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return defaults.map((label, index) => ({
    order: index,
    label,
    body: sentences[index] ?? segments[index] ?? ""
  })).filter((item) => item.body);
}

export function buildObjectionRows(analysis: {
  provider: ProviderDetail;
  top_matched_products: ProductMatch[];
  evidence: KnowledgeSnippet[];
  objection_handler: string;
}) {
  const concerns = Array.from(
    new Set(
      analysis.provider.crm_records
        .map((record) => record.concern.trim())
        .filter(Boolean)
    )
  ).slice(0, 3);

  const fallbackConcern = analysis.provider.recent_concern_summary.replace(/^Primary recent concern:\s*/i, "").replace(/\.$/, "");
  const values = concerns.length > 0 ? concerns : [fallbackConcern || "provider fit"];

  return values.map((concern, index) => {
    const match = analysis.top_matched_products[index] ?? analysis.top_matched_products[0];
    const snippet = analysis.evidence[index] ?? analysis.evidence[0];
    return {
      objection: concern.replace(/-/g, " "),
      answer: match?.llm_reasoning ?? analysis.objection_handler,
      resolution: snippet?.display_text ?? snippet?.chunk_text ?? analysis.provider.recent_concern_summary
    };
  });
}

export function AnimatedCounter(props: {
  value: number;
  durationMs?: number;
  formatter?: (value: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = props.durationMs ?? 900;
    const start = performance.now();
    let frame = 0;

    function tick(timestamp: number) {
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(props.value * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    setDisplayValue(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [props.durationMs, props.value]);

  return <>{(props.formatter ?? ((value: number) => String(Math.round(value))))(displayValue)}</>;
}

export function StatCard(props: {
  label: string;
  value: ReactNode;
  helper?: string;
  className?: string;
  inverse?: boolean;
}) {
  return (
    <div
      className={`rounded-[1rem] border p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)] ${
        props.inverse ? "border-black bg-black text-white" : "border-slate-200 bg-white text-slate-950"
      } ${props.className ?? ""}`}
    >
      <div className={`text-[11px] uppercase tracking-[0.28em] ${props.inverse ? "text-slate-400" : "text-slate-400"}`}>{props.label}</div>
      <div className={`mt-3 text-2xl font-semibold tracking-tight ${props.inverse ? "text-white" : "text-slate-950"}`}>{props.value}</div>
      {props.helper ? <p className={`mt-2 text-sm leading-6 ${props.inverse ? "text-slate-300" : "text-slate-500"}`}>{props.helper}</p> : null}
    </div>
  );
}

export function UploadPanel(props: {
  title: string;
  hint: string;
  accept: string;
  disabled: boolean;
  onSelect: (file: File | null) => void;
  onUpload: () => void;
}) {
  return (
    <div className="rounded-[1rem] border border-black bg-black p-4">
      <div className="text-sm font-medium text-white">{props.title}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{props.hint}</p>
      <input
        type="file"
        accept={props.accept}
        onChange={(event) => props.onSelect(event.target.files?.[0] ?? null)}
        className="mt-4 block w-full text-sm text-slate-400 file:mr-3 file:rounded-full file:border file:border-black file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-900"
      />
      <button
        onClick={props.onUpload}
        disabled={props.disabled}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Upload
      </button>
    </div>
  );
}

export function TopNavigation(props: { action?: ReactNode; providers?: ProviderSummary[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const providers = props.providers ?? [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) {
        return;
      }
      event.preventDefault();
      setIsOpen(true);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return providers.slice(0, 8);
    }
    return providers
      .filter((provider) =>
        [provider.doctor_name, provider.clinic_or_hospital, provider.region]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 8);
  }, [providers, query]);

  function openProvider(providerId: string) {
    setIsOpen(false);
    setQuery("");
    router.push(`/providers/${providerId}`);
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-[88px] w-full items-center justify-between gap-4 border-b border-black bg-black px-6 py-5 text-white">
        <div className="text-[2rem] font-semibold tracking-tight text-white">Tempus</div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="hidden min-w-[460px] items-center justify-between rounded-[0.9rem] border border-zinc-800 bg-zinc-950 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-zinc-600 md:flex"
        >
          <span className="flex items-center gap-3">
            <Search className="h-4 w-4 text-slate-400" />
            Search provider, hospital, or region
          </span>
          <span className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-slate-400">Cmd/Ctrl + K</span>
        </button>
        <div className="flex items-center gap-3">
          {props.action}
          <LogoutButton />
        </div>
      </header>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-16 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-[1rem] border border-zinc-800 bg-black shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center gap-3 rounded-[0.9rem] border border-zinc-800 bg-zinc-950 px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by provider, hospital, or region"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
                <span className="text-xs text-slate-500">Esc</span>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-3">
              {results.length > 0 ? (
                <div className="space-y-2">
                  {results.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => openProvider(provider.id)}
                      className="flex w-full items-center justify-between rounded-[0.8rem] border border-zinc-800 bg-zinc-950 px-4 py-4 text-left transition hover:border-zinc-600 hover:bg-zinc-900"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{provider.clinic_or_hospital}</div>
                        <div className="mt-1 text-sm text-slate-400">{provider.doctor_name} | {provider.region}</div>
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{provider.specialty}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[0.8rem] border border-zinc-800 bg-zinc-950 px-4 py-10 text-center text-sm text-slate-500">
                  No providers found for that search.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
