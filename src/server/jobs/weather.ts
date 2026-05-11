import type { AppConfig } from "../config/schema.js";

type FetchImpl = typeof fetch;
type WeatherConfig = AppConfig["widgets"]["weather"];

export type CachedWeather = {
  updatedAt: string;
  staleAfter: string;
  location: string;
  temperature: number | null;
  condition: string;
  error?: string;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
};

export async function refreshWeather(config: WeatherConfig, fetchImpl: FetchImpl = fetch, timeoutMs = 10000): Promise<CachedWeather> {
  const updatedAt = new Date();
  const base = {
    updatedAt: updatedAt.toISOString(),
    staleAfter: new Date(updatedAt.getTime() + durationToMs(config.refreshInterval)).toISOString(),
    location: config.location
  };

  if (!config.enabled) {
    return { ...base, temperature: null, condition: "disabled", error: "Weather widget is disabled" };
  }

  if (config.latitude === undefined || config.longitude === undefined) {
    return { ...base, temperature: null, condition: "unknown", error: "Weather latitude and longitude are required" };
  }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(config.latitude));
    url.searchParams.set("longitude", String(config.longitude));
    url.searchParams.set("current", "temperature_2m,weather_code");
    url.searchParams.set("temperature_unit", config.units === "imperial" ? "fahrenheit" : "celsius");

    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      throw new Error(`Weather query failed with status ${response.status}`);
    }

    const body = (await response.json()) as OpenMeteoResponse;
    const temperature = body.current?.temperature_2m;
    return {
      ...base,
      temperature: Number.isFinite(temperature) ? Number(temperature) : null,
      condition: describeWeatherCode(body.current?.weather_code)
    };
  } catch (error) {
    return {
      ...base,
      temperature: null,
      condition: "unknown",
      error: error instanceof Error ? error.message : "Weather refresh failed"
    };
  }
}

function describeWeatherCode(code: number | undefined) {
  if (code === undefined) return "unknown";
  if (code === 0) return "clear";
  if ([1, 2, 3].includes(code)) return "partly cloudy";
  if ([45, 48].includes(code)) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "unknown";
}

function durationToMs(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  return amount * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] ?? 1);
}
