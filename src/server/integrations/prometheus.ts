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
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
};

type PrometheusRangeResponse = {
  status?: string;
  data?: unknown;
  error?: string;
};

export async function queryPrometheusRange(input: PrometheusRangeInput): Promise<MetricPoint[]> {
  const url = serviceUrl(input.baseUrl, "api/v1/query_range");
  url.searchParams.set("query", input.query);
  url.searchParams.set("start", String(input.start));
  url.searchParams.set("end", String(input.end));
  url.searchParams.set("step", input.step);

  const response = await (input.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(input.timeoutMs ?? 10000) });
  if (!response.ok) {
    throw new Error(`Prometheus query failed with status ${response.status}`);
  }

  const body = (await response.json()) as PrometheusRangeResponse;
  if (body.status !== "success") {
    throw new Error(body.error ?? "Prometheus query failed");
  }
  if (!isPrometheusData(body.data)) {
    throw new Error("Malformed Prometheus response: data.result must be an array");
  }

  const result = body.data.result;
  if (result.length === 0) {
    return [];
  }

  const series = result[0];
  if (!series || !Array.isArray(series.values)) {
    throw new Error("Malformed Prometheus response: result values must be an array");
  }

  return series.values.map((sample, index) => {
    if (!Array.isArray(sample) || sample.length < 2) {
      throw new Error(`Malformed Prometheus sample at index ${index}`);
    }
    const timestamp = Number(sample[0]);
    const value = Number(sample[1]);
    if (!Number.isFinite(timestamp)) {
      throw new Error(`Malformed Prometheus timestamp at index ${index}`);
    }
    if (!Number.isFinite(value)) {
      throw new Error(`Malformed Prometheus value at index ${index}`);
    }
    return {
      timestamp: new Date(timestamp * 1000).toISOString(),
      value
    };
  });
}

function isPrometheusData(value: unknown): value is { result: Array<{ values?: unknown[] }> } {
  return typeof value === "object" && value !== null && "result" in value && Array.isArray(value.result);
}

function serviceUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}
