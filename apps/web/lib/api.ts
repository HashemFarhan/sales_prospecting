import {
  AnalysisResponse,
  GeneratedOutputResponse,
  KnowledgeSnippet,
  MeetingScriptResponse,
  ProviderSummary,
  ProviderWorkspaceResponse,
  SourceFileDetail,
  SourceFileSummary
} from "@/lib/types";

const API_BASE_URL = "";

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const headers =
    init?.body instanceof FormData
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...(init?.headers ?? {})
        };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store"
    });
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "Network request failed.";
    throw new Error(`Network error while requesting ${path}: ${message}`);
  }

  if (!response.ok) {
    let detail = `Request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {}
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export async function getProviders(): Promise<ProviderSummary[]> {
  const payload = await fetchJSON<{ providers: ProviderSummary[] }>("/api/providers");
  return payload.providers;
}

export async function analyzeProvider(providerId: string): Promise<AnalysisResponse> {
  return fetchJSON<AnalysisResponse>(`/api/providers/${providerId}/analyze`, {
    method: "POST"
  });
}

export async function getProviderWorkspace(providerId: string): Promise<ProviderWorkspaceResponse> {
  return fetchJSON<ProviderWorkspaceResponse>(`/api/providers/${providerId}/workspace`);
}

export async function generateProviderOutput(providerId: string): Promise<GeneratedOutputResponse> {
  return fetchJSON<GeneratedOutputResponse>(`/api/providers/${providerId}/objection-handler`, {
    method: "POST"
  });
}

export async function getProviderEvidence(providerId: string): Promise<KnowledgeSnippet[]> {
  return fetchJSON<KnowledgeSnippet[]>(`/api/providers/${providerId}/evidence`);
}

export async function listSources(category?: string): Promise<SourceFileSummary[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const payload = await fetchJSON<{ sources: SourceFileSummary[] }>(`/api/sources${query}`);
  return payload.sources;
}

export async function getSourceDetail(sourceId: string): Promise<SourceFileDetail> {
  return fetchJSON<SourceFileDetail>(`/api/sources/detail?source_id=${encodeURIComponent(sourceId)}`);
}

export async function regenerateMeetingScript(
  providerId: string,
  feedback: string,
  currentScript?: string
): Promise<MeetingScriptResponse> {
  return fetchJSON<MeetingScriptResponse>(`/api/providers/${providerId}/meeting-script`, {
    method: "POST",
    body: JSON.stringify({
      feedback,
      current_script: currentScript
    })
  });
}

export async function uploadIngestionFile(
  kind: "providers" | "crm-notes" | "products",
  file: File
): Promise<{ ingested: number }> {
  const formData = new FormData();
  formData.append("file", file);
  return fetchJSON<{ ingested: number }>(`/api/ingest/${kind}/upload`, {
    method: "POST",
    body: formData
  });
}
