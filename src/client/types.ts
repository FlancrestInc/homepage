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
