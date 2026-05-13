import { useEffect, useState } from "react";
import type { CachedWeather, MetricPoint, MonitorCard, TimeWidgetConfig } from "../types";

type WidgetBandProps = {
  generatedAt: string;
  time: TimeWidgetConfig;
  weather: CachedWeather | null;
  monitors: MonitorCard[];
};

export function WidgetBand({ generatedAt, time, weather, monitors }: WidgetBandProps) {
  const now = useClock(time.enabled, time.showSeconds);

  return (
    <section className="widget-band" aria-label="Status widgets">
      <div className="widget-summary">
        <div className="time-widget">
          <span className="date-line">{time.enabled ? formatDate(now, time) : "Time disabled"}</span>
          <span className="snapshot-line">snapshot {formatRelativeTime(generatedAt)}</span>
        </div>
        <WeatherWidget weather={weather} />
      </div>

      <div className="monitor-grid">
        {monitors.length > 0 ? (
          monitors.map((monitor) => <MonitorWidget key={monitor.name} monitor={monitor} />)
        ) : (
          <div className="monitor-card empty-monitor">
            <span className="monitor-name">No monitors</span>
            <span className="monitor-meta">waiting for configuration</span>
          </div>
        )}
      </div>
    </section>
  );
}

function useClock(enabled: boolean, showSeconds: boolean) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return undefined;

    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, showSeconds ? 1000 : 60000);

    return () => window.clearInterval(intervalId);
  }, [enabled, showSeconds]);

  return now;
}

function WeatherWidget({ weather }: { weather: CachedWeather | null }) {
  if (!weather) {
    return (
      <div className="weather-widget">
        <span className="weather-temp">--</span>
        <span className="weather-meta">weather unavailable</span>
      </div>
    );
  }

  return (
    <div className="weather-widget" title={weather.error}>
      <span className="weather-temp">{weather.temperature === null ? "--" : `${Math.round(weather.temperature)}°`}</span>
      <span className="weather-meta">
        {weather.location} · {weather.condition}
      </span>
    </div>
  );
}

function MonitorWidget({ monitor }: { monitor: MonitorCard }) {
  return (
    <article className="monitor-card" title={monitor.error}>
      <div className="monitor-header">
        <span className="monitor-name">{monitor.name}</span>
        <span className="monitor-meta">as of {formatTime(monitor.updatedAt)}</span>
      </div>
      <Sparkline cpu={monitor.cpu.history} ram={monitor.ram.history} />
      <div className="monitor-values">
        <span className="cpu-value">CPU {formatPercent(monitor.cpu.current)}</span>
        <span className="ram-value">RAM {formatPercent(monitor.ram.current)}</span>
      </div>
    </article>
  );
}

function Sparkline({ cpu, ram }: { cpu: MetricPoint[]; ram: MetricPoint[] }) {
  const cpuPath = pointsToPath(cpu);
  const ramPath = pointsToPath(ram);
  const startTime = formatStartTime([...cpu, ...ram]);

  return (
    <svg className="monitor-sparkline" viewBox="0 0 150 48" role="img" aria-label={`CPU and RAM history from ${startTime}`}>
      <text x="0" y="9" className="sparkline-label">
        100%
      </text>
      <text x="7" y="36" className="sparkline-label">
        0%
      </text>
      <text x="24" y="46" className="sparkline-label">
        Start {startTime}
      </text>
      <line x1="24" y1="4" x2="24" y2="34" className="sparkline-axis" />
      <line x1="24" y1="34" x2="150" y2="34" className="sparkline-axis" />
      <line x1="24" y1="19" x2="150" y2="19" className="sparkline-axis sparkline-midline" />
      {cpuPath ? <path d={cpuPath} className="sparkline-cpu" /> : null}
      {ramPath ? <path d={ramPath} className="sparkline-ram" /> : null}
    </svg>
  );
}

function pointsToPath(points: MetricPoint[]) {
  const finite = points.filter((point) => Number.isFinite(point.value));
  if (finite.length === 0) return "";
  if (finite.length === 1) {
    const y = valueToY(finite[0].value);
    return `M 24 ${y} L 150 ${y}`;
  }

  return finite
    .map((point, index) => {
      const x = 24 + (index / (finite.length - 1)) * 126;
      const y = valueToY(point.value);
      return `${index === 0 ? "M" : "L"} ${round(x)} ${y}`;
    })
    .join(" ");
}

function valueToY(value: number) {
  const clamped = Math.max(0, Math.min(100, value));
  return round(34 - (clamped / 100) * 30);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatDate(date: Date, time: TimeWidgetConfig) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: time.showSeconds ? "2-digit" : undefined,
    hourCycle: time.hourCycle === "24" ? "h23" : "h12",
    timeZone: time.timezone,
    timeZoneName: time.showTimezone ? "short" : undefined
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatStartTime(points: MetricPoint[]) {
  const timestamps = points.map((point) => new Date(point.timestamp).getTime()).filter((timestamp) => Number.isFinite(timestamp));
  if (!timestamps.length) return "unknown";
  return formatTime(new Date(Math.min(...timestamps)).toISOString());
}

function formatPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "--" : `${Math.round(value)}%`;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return formatTime(value);
}
