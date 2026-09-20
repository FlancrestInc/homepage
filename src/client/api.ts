import type { AppConfig, AttentionEvent, BookmarkSnapshot, CockpitSnapshot, IconSearchResult, ModuleDefinitionSummary, PublicSnapshot, WidgetSnapshot } from "./types";

export async function getBookmarkSnapshot(): Promise<BookmarkSnapshot> {
  const response = await fetch("/api/bookmarks-snapshot");

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to load bookmarks"));
  }

  return response.json() as Promise<BookmarkSnapshot>;
}

export async function getWidgetSnapshot(): Promise<WidgetSnapshot> {
  const response = await fetch("/api/widgets-snapshot");

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to load widgets"));
  }

  return response.json() as Promise<WidgetSnapshot>;
}

export async function getPublicSnapshot(): Promise<PublicSnapshot> {
  const response = await fetch("/api/public-snapshot");

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to load public snapshot"));
  }

  return response.json() as Promise<PublicSnapshot>;
}

export async function getCockpitSnapshot(): Promise<CockpitSnapshot> {
  const response = await fetch("/api/cockpit-snapshot");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to load cockpit"));
  return response.json() as Promise<CockpitSnapshot>;
}

export async function getModules(): Promise<ModuleDefinitionSummary[]> {
  const response = await fetch("/api/modules");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to load modules"));
  return response.json() as Promise<ModuleDefinitionSummary[]>;
}

export async function testModule(input: { kind: string; instanceId: string; config: Record<string, unknown>; secretRefs: Record<string, string> }) {
  const response = await fetch("/api/modules/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Connection test failed"));
  return response.json() as Promise<{ testId: string; expiresAt: string; fingerprint: string; ok: boolean; message: string }>;
}

export async function saveModule(input: { kind: string; instanceId: string; name: string; config: Record<string, unknown>; secretRefs: Record<string, string>; testId: string; enabled: boolean }) {
  const response = await fetch("/api/modules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Module save failed"));
  return response.json();
}

export async function getModuleDetails(instanceId: string, resourceId = "default") {
  const response = await fetch(`/api/modules/${encodeURIComponent(instanceId)}/details?resourceId=${encodeURIComponent(resourceId)}`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Details unavailable"));
  return response.json() as Promise<unknown>;
}

export async function executeModuleAction(instanceId: string, action: string, input: { resourceId?: string; input?: unknown; confirmationToken?: string }) {
  const response = await fetch(`/api/modules/${encodeURIComponent(instanceId)}/actions/${encodeURIComponent(action)}`, { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Action failed"));
  return response.json();
}

export async function acknowledgeAttention(eventId: string): Promise<AttentionEvent> {
  const response = await fetch(`/api/attention/${encodeURIComponent(eventId)}/acknowledge`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Acknowledgement failed"));
  return response.json() as Promise<AttentionEvent>;
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

export async function searchIcons(query: string, signal?: AbortSignal): Promise<IconSearchResult[]> {
  const response = await fetch(`/api/icons?q=${encodeURIComponent(query)}`, signal ? { signal } : undefined);
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
      return formatTextErrorBody(text, response.headers.get("content-type"), response.headers.get("server"));
    } catch {
      return "";
    }
  }
}

function formatTextErrorBody(text: string, contentType: string | null, server: string | null) {
  const trimmedText = text.trim();
  if (!trimmedText) return "";

  if (contentType?.includes("text/html")) {
    const title = trimmedText.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, " ").trim();
    const source = server?.toLowerCase().includes("cloudflare") ? "Cloudflare/proxy" : "Proxy/origin";
    return title ? `${source} returned an HTML error page: ${title}` : `${source} returned an HTML error page`;
  }

  return trimmedText.length > 240 ? `${trimmedText.slice(0, 240)}...` : trimmedText;
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
