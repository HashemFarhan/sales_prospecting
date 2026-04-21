import { AnalysisResponse, ProviderSummary } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const headers =
    init?.body instanceof FormData
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...(init?.headers ?? {})
        };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
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
