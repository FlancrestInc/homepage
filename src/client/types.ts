export type HealthStatus = "up" | "down" | "unknown";

export type ThemeConfig = {
  mode: "light" | "dark" | "system";
  accentColor: string;
  background: {
    type: "color" | "image";
    value: string;
    style: "cover" | "contain" | "stretch" | "tile" | "center";
  };
};

export type TimeWidgetConfig = {
  enabled: boolean;
  format: string;
  showSeconds: boolean;
  hourCycle: "12" | "24";
  timezone?: string;
  showTimezone: boolean;
};

export type CachedWeather = {
  updatedAt: string;
  staleAfter: string;
  location: string;
  temperature: number | null;
  condition: string;
  error?: string;
};

export type MetricPoint = {
  timestamp: string;
  value: number;
};

export type MonitorCard = {
  name: string;
  updatedAt: string;
  cpu: {
    current: number | null;
    history: MetricPoint[];
  };
  ram: {
    current: number | null;
    history: MetricPoint[];
  };
  error?: string;
};

export type PublicBookmark = {
  name: string;
  group: string;
  icon: string;
  iconPath?: string;
  iconDefaultColor?: string;
  iconColor?: string;
  url: string;
  healthMode: "default" | "custom" | "disabled";
  status: HealthStatus;
  checkedAt?: string;
};

export type PublicBookmarkGroup = {
  name: string;
  order?: number;
  columns?: number;
  width?: "compact" | "normal" | "wide";
  row?: number;
  bookmarks: PublicBookmark[];
};

export type BookmarkSnapshot = {
  generatedAt: string;
  theme: ThemeConfig;
  layout: {
    editorButton: "bottom-right" | "bottom-left";
  };
  groups: PublicBookmarkGroup[];
};

export type WidgetSnapshot = {
  generatedAt: string;
  widgets: {
    refreshInterval: string;
    time: TimeWidgetConfig;
    weather: CachedWeather | null;
    monitors: MonitorCard[];
  };
};

export type PublicSnapshot = BookmarkSnapshot & WidgetSnapshot;

export type ModuleStatus = "healthy" | "degraded" | "down" | "unknown";
export type ModuleStatusResource = {
  instanceId: string;
  resourceId: string;
  status: ModuleStatus;
  checkedAt: string;
  lastSuccessAt: string | null;
  staleAt: string | null;
  freshness: "fresh" | "stale" | "never_succeeded";
  summary: string;
  fields: Array<{ key: string; status: "healthy" | "degraded" | "unknown"; value: string | number | boolean | null; error?: string }>;
  evidence: Record<string, string | number | boolean | null>;
  error?: string;
};
export type ModuleSummary = { instanceId: string; kind: string; name: string; enabled: boolean; status: ModuleStatus; statuses: ModuleStatusResource[]; links: string[] };
export type AttentionEvent = { eventId: string; eventKey: string; instanceId: string; resourceId: string; conditionId: string; severity: "warning" | "critical"; state: "open" | "acknowledged" | "recovered"; title: string; summary: string; evidence: Record<string, string | number | boolean | null>; openedAt: string; lastSeenAt: string; acknowledgedAt?: string; nextAction?: { label: string; action: string }; link?: string };
export type CockpitSnapshot = { generatedAt: string; modules: ModuleSummary[]; attention: AttentionEvent[]; eventsSummary: { active: number } };
export type ModuleSetupField = { key: string; label: string; type: "text" | "url" | "number" | "boolean" | "select" | "secretRef"; required?: boolean; options?: string[]; placeholder?: string };
export type ModuleDefinitionSummary = { kind: string; name: string; category: string; version: number; setupSchema: { fields: ModuleSetupField[] }; secretFields: string[]; actions?: Array<{ id: string; label: string; requiresConfirmation?: boolean }> ; instances: Array<{ instanceId: string; name: string; enabled: boolean; config: Record<string, unknown>; secretRefs: Record<string, string> }> };

export type BookmarkHealthConfig = {
  mode: "default" | "custom" | "disabled";
  url?: string;
  method: "GET" | "HEAD" | "POST";
  headers: Record<string, string>;
  expectedStatuses: number[];
  interval?: string;
};

export type BookmarkConfig = {
  name: string;
  group: string;
  icon: string;
  iconColor?: string;
  url: string;
  health: BookmarkHealthConfig;
};

export type IconSearchResult = {
  name: string;
  value: string;
  source: "simple-icons" | "mdi";
  path: string;
  color?: string;
};

export type BookmarkGroupConfig = {
  name: string;
  order: number;
  columns?: number;
  width?: "compact" | "normal" | "wide";
  row?: number;
};

export type WeatherWidgetConfig = {
  enabled: boolean;
  provider: "open-meteo";
  location: string;
  latitude?: number;
  longitude?: number;
  units: "imperial" | "metric";
  refreshInterval: string;
};

export type MonitorServerConfig = {
  name: string;
  source?: "prometheus" | "glances";
  enabled: boolean;
  cpuQuery?: string;
  ramQuery?: string;
  glancesUrl?: string;
};

export type MonitorWidgetConfig = {
  source: "prometheus" | "glances";
  prometheusUrl?: string;
  historyWindow: string;
  sampleInterval: string;
  refreshInterval: string;
  servers: MonitorServerConfig[];
};

export type AppConfig = {
  theme: ThemeConfig;
  layout: {
    editorButton: "bottom-right" | "bottom-left";
    groups: BookmarkGroupConfig[];
  };
  bookmarks: BookmarkConfig[];
  widgets: {
    refreshInterval: string;
    time: TimeWidgetConfig;
    weather: WeatherWidgetConfig;
    monitors: MonitorWidgetConfig;
  };
  healthChecks: {
    defaultInterval: string;
    timeout: string;
  };
};
