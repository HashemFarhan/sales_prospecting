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
  const impactScore = typeof item.impactScore === "number" ? item.impactScore : item.impact_score;

  if (typeof impactScore === "number") {
    if (impactScore >= 0.7) {
      return {
        label: "Priority",
        tagClassName: "border border-emerald-200 bg-emerald-50 text-emerald-800"
      };
    }
    if (impactScore >= 0.4) {
      return {
        label: "Moderate",
        tagClassName: "border border-amber-200 bg-amber-50 text-amber-800"
      };
    }
    return {
      label: "Emerging",
      tagClassName: "border border-violet-200 bg-violet-50 text-violet-800"
    };
  }

  if (item.size >= 300) {
    return {
      label: "Moderate",
      tagClassName: "border border-amber-200 bg-amber-50 text-amber-800"
    };
  }
  return {
    label: "Emerging",
    tagClassName: "border border-violet-200 bg-violet-50 text-violet-800"
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
      /^(?:Stage\s*)?([1-3])[\).\:-]?\s*(Hook|Value|Close|Opening|Intro|Problem|Why Tempus|Recommendation|Ask)?\s*[:\-]?\s*(.*)?$/i
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
      const existingStage = mergedStages.find((item) => item.order === order);
      if (existingStage) {
        existingStage.label = label;
        if (body) {
          existingStage.body = existingStage.body ? `${existingStage.body} ${body}`.trim() : body;
        }
      } else {
        mergedStages.push({
          order,
          label,
          body
        });
      }
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
      body: segment
        .replace(/^(?:Stage\s*)?[1-3][\).\:-]?\s*(Hook|Value|Close|Opening|Intro|Problem|Why Tempus|Recommendation|Ask)?\s*[:\-]?\s*/i, "")
        .trim()
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
      className={`rounded-[1rem] border p-5 shadow-[0_10px_24px_rgba(17,17,17,0.04)] ${
        props.inverse ? "border-black bg-black text-white" : "border-black/8 bg-white text-slate-950"
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
    <div className="rounded-[1rem] border border-black/8 bg-white p-5 shadow-[0_10px_24px_rgba(17,17,17,0.04)]">
      <div className="text-lg font-semibold text-black">{props.title}</div>
      <p className="mt-2 text-sm leading-7 text-black/55">{props.hint}</p>
      <input
        type="file"
        accept={props.accept}
        onChange={(event) => props.onSelect(event.target.files?.[0] ?? null)}
        className="mt-5 block w-full text-sm text-black/45 file:mr-3 file:rounded-[0.85rem] file:border file:border-black/10 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-black"
      />
      <button
        onClick={props.onUpload}
        disabled={props.disabled}
        className="mt-5 inline-flex w-full items-center justify-center rounded-[0.85rem] border px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-600"
        style={props.disabled ? undefined : { backgroundColor: "#206ef3", borderColor: "#206ef3", color: "#ffffff" }}
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
      <header className="fixed inset-x-0 top-0 z-40 flex h-[88px] w-full items-center justify-between gap-4 border-b border-white/10 bg-[rgba(0,0,0,0.84)] px-6 py-5 text-white backdrop-blur-xl">
        <div className="text-[2rem] font-semibold tracking-tight text-white">TEMPEST</div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="hidden min-w-[580px] items-center justify-between rounded-[1rem] border border-white/10 bg-white px-5 py-3.5 text-left text-sm text-black/65 transition hover:border-[#206ef3]/40 md:flex"
        >
          <span className="flex items-center gap-3">
            <Search className="h-4 w-4 text-black/45" />
            Search provider, hospital, or region
          </span>
          <span className="rounded-[0.65rem] border border-black/10 px-2.5 py-1 text-xs text-black/45">Ctrl/Cmd K</span>
        </button>
        <div className="flex items-center gap-3">
          {props.action}
          <LogoutButton />
        </div>
      </header>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-16 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-[1rem] border border-white/10 bg-black shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3 rounded-[0.9rem] border border-white/10 bg-white px-4 py-3">
                <Search className="h-4 w-4 text-black/45" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by provider, hospital, or region"
                  className="w-full bg-transparent text-sm text-black outline-none placeholder:text-black/35"
                />
                <span className="text-xs text-black/35">Esc</span>
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
                      className="flex w-full items-center justify-between rounded-[0.8rem] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-[#206ef3]/40 hover:bg-white/10"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{provider.clinic_or_hospital}</div>
                        <div className="mt-1 text-sm text-white/55">{provider.doctor_name} | {provider.region}</div>
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/45">{provider.specialty}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[0.8rem] border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/45">
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
