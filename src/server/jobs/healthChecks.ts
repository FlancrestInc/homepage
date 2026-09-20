import { bookmarkHealthKey, type CachedHealth } from "../cache/publicSnapshot.js";
import type { Bookmark } from "../config/schema.js";

type FetchImpl = typeof fetch;

export type RefreshHealthChecksInput = {
  bookmarks: Bookmark[];
  timeout: number;
  defaultInterval?: number;
  previous?: CachedHealth;
  now?: Date;
  fetchImpl?: FetchImpl;
};

export async function refreshHealthChecks(input: RefreshHealthChecksInput): Promise<CachedHealth> {
  const entries = await Promise.all(input.bookmarks.map((bookmark) => checkBookmark(bookmark, input)));
  const health: CachedHealth = {};
  for (const entry of entries) {
    if (entry) {
      health[entry[0]] = entry[1];
    }
  }
  return health;
}

async function checkBookmark(bookmark: Bookmark, input: RefreshHealthChecksInput) {
  if (bookmark.health.mode === "disabled") {
    return null;
  }

  const previous = input.previous?.[bookmarkHealthKey(bookmark)];
  const interval = bookmark.health.interval ? durationToMs(bookmark.health.interval) : input.defaultInterval;
  if (previous && interval !== undefined && Date.parse(previous.checkedAt) + interval > (input.now ?? new Date()).getTime()) {
    return [bookmarkHealthKey(bookmark), previous] as const;
  }

  const checkedAt = new Date().toISOString();
  const url = bookmark.health.url ?? bookmark.url;

  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      method: bookmark.health.method,
      headers: bookmark.health.headers,
      signal: AbortSignal.timeout(input.timeout)
    });
    const status = bookmark.health.expectedStatuses.includes(response.status) ? "up" : "down";
    return [
      bookmarkHealthKey(bookmark),
      {
        status,
        checkedAt,
        ...(status === "down" ? { error: `Unexpected status ${response.status}` } : {})
      }
    ] as const;
  } catch (error) {
    return [
      bookmarkHealthKey(bookmark),
      {
        status: "down",
        checkedAt,
        error: error instanceof Error ? error.message : "Health check failed"
      }
    ] as const;
  }
}

function durationToMs(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  return amount * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] ?? 1);
}
