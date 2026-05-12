export type HealthStatus = "up" | "down" | "unknown";

export type ThemeConfig = {
  mode: "light" | "dark" | "system";
  accentColor: string;
  background: {
    type: "color" | "image";
    value: string;
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

export type PublicSnapshot = {
  generatedAt: string;
  theme: ThemeConfig;
  layout: {
    editorButton: "bottom-right" | "bottom-left";
  };
  widgets: {
    refreshInterval: string;
    time: TimeWidgetConfig;
    weather: CachedWeather | null;
    monitors: MonitorCard[];
  };
  groups: PublicBookmarkGroup[];
};

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
  url: string;
  health: BookmarkHealthConfig;
};

export type IconSearchResult = {
  name: string;
  value: string;
  source: "simple-icons" | "mdi";
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
