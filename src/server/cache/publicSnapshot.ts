import type { AppConfig, Bookmark } from "../config/schema.js";

export type HealthStatus = "up" | "down" | "unknown";

export type CachedHealth = Record<string, {
  status: HealthStatus;
  checkedAt: string;
  error?: string;
}>;

export type PublicSnapshotInput = {
  health: CachedHealth;
  weather: unknown;
  monitors: unknown[];
};

export function buildPublicSnapshot(config: AppConfig, cached: PublicSnapshotInput) {
  const configuredGroups = [...config.layout.groups].sort((a, b) => a.order - b.order);
  const groupNames = new Set(configuredGroups.map((group) => group.name));
  for (const bookmark of config.bookmarks) {
    groupNames.add(bookmark.group);
  }

  const groups = [...groupNames]
    .sort((a, b) => {
      const left = configuredGroups.find((group) => group.name === a)?.order ?? Number.MAX_SAFE_INTEGER;
      const right = configuredGroups.find((group) => group.name === b)?.order ?? Number.MAX_SAFE_INTEGER;
      return left === right ? a.localeCompare(b) : left - right;
    })
    .map((name) => ({
      ...configuredGroups.find((group) => group.name === name),
      name,
      bookmarks: config.bookmarks
        .filter((bookmark) => bookmark.group === name)
        .map((bookmark) => publicBookmark(bookmark, cached.health[bookmarkHealthKey(bookmark)]))
    }));

  return {
    generatedAt: new Date().toISOString(),
    theme: config.theme,
    layout: { editorButton: config.layout.editorButton },
    widgets: {
      refreshInterval: config.widgets.refreshInterval,
      time: config.widgets.time,
      weather: cached.weather,
      monitors: cached.monitors
    },
    groups
  };
}

export function bookmarkHealthKey(bookmark: Bookmark): string {
  return `${bookmark.group}\u0000${bookmark.name}\u0000${bookmark.url}`;
}

function publicBookmark(bookmark: Bookmark, health?: CachedHealth[string]) {
  return {
    name: bookmark.name,
    group: bookmark.group,
    icon: bookmark.icon,
    iconColor: bookmark.iconColor,
    url: bookmark.url,
    healthMode: bookmark.health.mode,
    status: health?.status ?? "unknown",
    checkedAt: health?.checkedAt
  };
}
