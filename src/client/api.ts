import type { AppConfig, IconSearchResult, PublicSnapshot } from "./types";

export async function getPublicSnapshot(): Promise<PublicSnapshot> {
  const response = await fetch("/api/public-snapshot");

  if (!response.ok) {
    throw new Error(`Failed to load public snapshot: ${response.status}`);
  }

  return response.json() as Promise<PublicSnapshot>;
}

export async function getConfig(): Promise<AppConfig> {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Config request failed"));
  return response.json() as Promise<AppConfig>;
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config)
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Config save failed"));
  return response.json() as Promise<AppConfig>;
}

export async function searchIcons(query: string): Promise<IconSearchResult[]> {
  const response = await fetch(`/api/icons?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Icon search failed"));
  const body = (await response.json()) as { icons?: IconSearchResult[] };
  return Array.isArray(body.icons) ? body.icons : [];
}

async function responseErrorMessage(response: Response, prefix: string) {
  const details = await responseErrorDetails(response);
  return details ? `${prefix}: ${response.status} - ${details}` : `${prefix}: ${response.status}`;
}

async function responseErrorDetails(response: Response) {
  const textResponse = response.clone();
  try {
    const body = (await response.json()) as unknown;
    return formatErrorBody(body);
  } catch {
    try {
      const text = await textResponse.text();
      return text.trim();
    } catch {
      return "";
    }
  }
}

function formatErrorBody(body: unknown) {
  if (!body || typeof body !== "object") return "";

  const errorBody = body as { error?: unknown; message?: unknown; issues?: unknown };
  const summary = typeof errorBody.error === "string" ? errorBody.error : typeof errorBody.message === "string" ? errorBody.message : "";
  const issues = Array.isArray(errorBody.issues) ? errorBody.issues.map(formatIssue).filter(Boolean) : [];

  if (summary && issues.length) return `${summary}: ${issues.join("; ")}`;
  if (summary) return summary;
  return issues.join("; ");
}

function formatIssue(issue: unknown) {
  if (!issue || typeof issue !== "object") return "";

  const typedIssue = issue as { path?: unknown; message?: unknown };
  const message = typeof typedIssue.message === "string" ? typedIssue.message : "";
  const path = Array.isArray(typedIssue.path) ? typedIssue.path.map(String).join(".") : "";

  if (path && message) return `${path}: ${message}`;
  return message || path;
}
