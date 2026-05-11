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
  const [cpuResponse, memoryResponse] = await Promise.all([
    fetchImpl(new URL("/api/3/cpu", normalizedBaseUrl(input.baseUrl)), requestInit),
    fetchImpl(new URL("/api/3/mem", normalizedBaseUrl(input.baseUrl)), requestInit)
  ]);

  if (!cpuResponse.ok) {
    throw new Error(`Glances CPU query failed with status ${cpuResponse.status}`);
  }
  if (!memoryResponse.ok) {
    throw new Error(`Glances memory query failed with status ${memoryResponse.status}`);
  }

  const cpu = (await cpuResponse.json()) as GlancesCpuResponse;
  const memory = (await memoryResponse.json()) as GlancesMemoryResponse;
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
