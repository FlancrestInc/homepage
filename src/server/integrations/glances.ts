export type GlancesSnapshot = {
  cpuPercent: number;
  ramPercent: number;
};

type FetchImpl = typeof fetch;

type GlancesCpuResponse = {
  total?: number;
};

type GlancesMemoryResponse = {
  percent?: number;
};

export async function queryGlancesCurrent(input: { baseUrl: string; timeoutMs?: number; fetchImpl?: FetchImpl }): Promise<GlancesSnapshot> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const requestInit = { signal: AbortSignal.timeout(input.timeoutMs ?? 10000) };
  const [cpuResponse, memoryResponse] = await fetchGlancesPair(input.baseUrl, "3", fetchImpl, requestInit);

  const responses = cpuResponse.status === 404 || memoryResponse.status === 404
    ? await fetchGlancesPair(input.baseUrl, "4", fetchImpl, requestInit)
    : [cpuResponse, memoryResponse] as const;

  if (!responses[0].ok) {
    throw new Error(`Glances CPU query failed with status ${responses[0].status}`);
  }
  if (!responses[1].ok) {
    throw new Error(`Glances memory query failed with status ${responses[1].status}`);
  }

  const cpu = (await responses[0].json()) as GlancesCpuResponse;
  const memory = (await responses[1].json()) as GlancesMemoryResponse;
  return {
    cpuPercent: requiredFinitePercent(cpu.total, "CPU"),
    ramPercent: requiredFinitePercent(memory.percent, "RAM")
  };
}

function requiredFinitePercent(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Glances ${label} percent is missing or invalid`);
  }
  return parsed;
}

function normalizedBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

async function fetchGlancesPair(baseUrl: string, version: "3" | "4", fetchImpl: FetchImpl, requestInit: RequestInit) {
  return Promise.all([
    fetchImpl(new URL(`api/${version}/cpu`, normalizedBaseUrl(baseUrl)), requestInit),
    fetchImpl(new URL(`api/${version}/mem`, normalizedBaseUrl(baseUrl)), requestInit)
  ]);
}
