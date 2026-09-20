import type { StateStore } from "../db/state.js";
import type { AppEnv } from "../env.js";
import { resolveSecret } from "../security/secrets.js";
import type { ModuleInstance, ModuleStatusResponse, StatusResult } from "./types.js";
import { ModuleRegistry } from "./registry.js";

export type ModuleRunnerOptions = {
  onStatus?: (result: StatusResult) => Promise<void> | void;
  retryDelayMs?: number;
  concurrency?: number;
};

export class ModuleRunner {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly locks = new Set<string>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly semaphore: Semaphore;
  private stopped = false;

  constructor(private readonly state: StateStore, private readonly registry: ModuleRegistry, private readonly env: AppEnv, private readonly options: ModuleRunnerOptions = {}) {
    this.semaphore = new Semaphore(options.concurrency ?? 6);
  }

  async start() {
    this.stopped = false;
    await this.reload();
  }

  async reload() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    for (const instance of this.state.listInstances().filter((item) => item.enabled)) {
      this.schedule(instance, 0);
    }
  }

  stop() {
    this.stopped = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
  }

  async refresh(instanceId: string) {
    const instance = this.state.getInstance(instanceId);
    if (!instance?.enabled) return;
    await this.runInstance(instance);
  }

  private schedule(instance: ModuleInstance, delayMs: number) {
    if (this.stopped) return;
    const timer = setTimeout(() => {
      this.timers.delete(instance.instanceId);
      void this.runInstance(instance).finally(() => {
        const current = this.state.getInstance(instance.instanceId);
        if (current?.enabled && !this.stopped) this.schedule(current, current.intervalMs);
      });
    }, delayMs);
    this.timers.set(instance.instanceId, timer);
  }

  private async runInstance(instance: ModuleInstance) {
    if (this.locks.has(instance.instanceId)) return;
    const definition = this.registry.get(instance.kind);
    if (!definition) return;
    this.locks.add(instance.instanceId);
    const controller = new AbortController();
    this.controllers.set(instance.instanceId, controller);
    const timeout = setTimeout(() => controller.abort(), instance.timeoutMs);
    try {
      const release = await this.semaphore.acquire();
      try {
        const context = this.context(instance, controller);
        let response: ModuleStatusResponse | undefined;
        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            response = await definition.getStatus(context, instance);
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
            if (attempt === 0) await wait(this.options.retryDelayMs ?? 5000, controller.signal);
          }
        }
        if (!response) {
          response = { instanceId: instance.instanceId, status: "unknown", resources: [{ instanceId: instance.instanceId, resourceId: "default", status: "unknown", checkedAt: new Date().toISOString(), lastSuccessAt: null, staleAt: null, freshness: "never_succeeded", summary: errorMessage(lastError), fields: [], evidence: {}, error: errorMessage(lastError) }] };
        }
        for (const rawResult of response.resources.length ? response.resources : [fallbackResult(instance)]) {
          const result = this.mergeResult(instance, rawResult, Boolean(lastError));
          const failureCount = result.status === "healthy" || (result.status === "degraded" && result.freshness === "fresh" && !result.error) ? 0 : this.state.getFailureCount(instance.instanceId, result.resourceId) + 1;
          this.state.saveStatus(instance.instanceId, result, failureCount);
          await this.options.onStatus?.(result);
        }
      } finally {
        release();
      }
    } catch (error) {
      console.error(`Module check failed for ${instance.instanceId}:`, error);
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(instance.instanceId);
      this.locks.delete(instance.instanceId);
    }
  }

  private mergeResult(instance: ModuleInstance, raw: StatusResult, failed: boolean): StatusResult {
    const now = new Date();
    const checkedAt = raw.checkedAt || now.toISOString();
    const previous = this.state.getStatus(instance.instanceId, raw.resourceId);
    const successful = !failed && (raw.status === "healthy" || raw.status === "degraded");
    if (successful) {
      const lastSuccessAt = raw.lastSuccessAt ?? checkedAt;
      return { ...raw, instanceId: instance.instanceId, checkedAt, lastSuccessAt, staleAt: raw.staleAt ?? new Date(Date.parse(lastSuccessAt) + instance.intervalMs * instance.staleIntervals).toISOString(), freshness: "fresh" };
    }
    const staleAt = previous?.staleAt ?? raw.staleAt;
    const stillFresh = staleAt ? Date.parse(staleAt) > now.getTime() : false;
    if (previous && stillFresh) {
      return { ...previous, checkedAt, status: "degraded", freshness: "fresh", summary: raw.error ?? raw.summary ?? "Last check failed", error: raw.error ?? raw.summary };
    }
    return { ...raw, instanceId: instance.instanceId, checkedAt, status: raw.status === "down" ? "down" : "unknown", lastSuccessAt: previous?.lastSuccessAt ?? raw.lastSuccessAt ?? null, staleAt: staleAt ?? null, freshness: previous?.lastSuccessAt ? "stale" : "never_succeeded", fields: raw.fields.length ? raw.fields : previous?.fields ?? [], evidence: raw.evidence ?? previous?.evidence ?? {} };
  }

  private context(instance: ModuleInstance, controller: AbortController) {
    return {
      instanceId: instance.instanceId,
      config: instance.config,
      secretRefs: instance.secretRefs,
      signal: controller.signal,
      now: new Date(),
      resolveSecret: (reference: string) => resolveSecret(reference, this.env),
      request: (input: string | URL | Request, init: RequestInit = {}) => fetch(input, { ...init, signal: init.signal ?? controller.signal })
    };
  }
}

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly limit: number) {}
  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const grant = () => { this.active += 1; resolve(() => { this.active -= 1; this.queue.shift()?.(); }); };
      if (this.active < this.limit) grant(); else this.queue.push(grant);
    });
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true });
  });
}

function fallbackResult(instance: ModuleInstance): StatusResult { return { instanceId: instance.instanceId, resourceId: "default", status: "unknown", checkedAt: new Date().toISOString(), lastSuccessAt: null, staleAt: null, freshness: "never_succeeded", summary: "No resource status returned", fields: [], evidence: {} }; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Module check failed"; }
