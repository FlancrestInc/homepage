import type { AppConfig, PublicSnapshot } from "./types";

export async function getPublicSnapshot(): Promise<PublicSnapshot> {
  const response = await fetch("/api/public-snapshot");

  if (!response.ok) {
    throw new Error(`Failed to load public snapshot: ${response.status}`);
  }

  return response.json() as Promise<PublicSnapshot>;
}

export async function getConfig(): Promise<AppConfig> {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
  return response.json() as Promise<AppConfig>;
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config)
  });
  if (!response.ok) throw new Error(`Config save failed: ${response.status}`);
  return response.json() as Promise<AppConfig>;
}
