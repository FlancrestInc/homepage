import type { PublicSnapshot } from "./types";

export async function getPublicSnapshot(): Promise<PublicSnapshot> {
  const response = await fetch("/api/public-snapshot");

  if (!response.ok) {
    throw new Error(`Failed to load public snapshot: ${response.status}`);
  }

  return response.json() as Promise<PublicSnapshot>;
}
