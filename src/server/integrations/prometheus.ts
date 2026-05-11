export type MetricPoint = {
  timestamp: string;
  value: number;
};

type FetchImpl = typeof fetch;

export type PrometheusRangeInput = {
  baseUrl: string;
  query: string;
  start: number;
  end: number;
  step: string;
  fetchImpl?: FetchImpl;
};

type PrometheusRangeResponse = {
  status?: string;
  data?: {
    result?: Array<{
      values?: Array<[number | string, string]>;
    }>;
  };
  error?: string;
};

export async function queryPrometheusRange(input: PrometheusRangeInput): Promise<MetricPoint[]> {
  const url = new URL("/api/v1/query_range", normalizedBaseUrl(input.baseUrl));
  url.searchParams.set("query", input.query);
  url.searchParams.set("start", String(input.start));
  url.searchParams.set("end", String(input.end));
  url.searchParams.set("step", input.step);

  const response = await (input.fetchImpl ?? fetch)(url);
  if (!response.ok) {
    throw new Error(`Prometheus query failed with status ${response.status}`);
  }

  const body = (await response.json()) as PrometheusRangeResponse;
  if (body.status !== "success") {
    throw new Error(body.error ?? "Prometheus query failed");
  }

  return (body.data?.result?.[0]?.values ?? [])
    .map(([timestamp, value]) => ({
      timestamp: localIsoTimestamp(Number(timestamp)),
      value: Number(value)
    }))
    .filter((point) => Number.isFinite(point.value));
}

function localIsoTimestamp(timestampSeconds: number) {
  const date = new Date(timestampSeconds * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
}

function normalizedBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
