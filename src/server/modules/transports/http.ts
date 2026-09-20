import type { ConnectorContext } from "../types.js";
import { connect } from "node:tls";

export type HttpCheck = {
  ok: boolean;
  status: number;
  latencyMs: number;
  url: string;
  finalUrl: string;
  evidence: Record<string, string | number | boolean | null>;
};

export type TlsCertificateCheck = {
  checked: boolean;
  validTo: string | null;
  daysRemaining: number | null;
  expired: boolean;
};

export async function checkHttp(context: ConnectorContext, input: { url: string; expectedStatuses?: number[]; timeoutMs?: number; headers?: Record<string, string>; verifyTls?: boolean; maxRedirects?: number }): Promise<HttpCheck> {
  if (input.verifyTls === false) throw new Error("verify_tls_cannot_be_disabled");
  const expected = input.expectedStatuses?.length ? input.expectedStatuses : [200, 204, 301, 302, 304, 401, 403];
  const started = Date.now();
  let current = new URL(input.url);
  let headers = { ...(input.headers ?? {}) };
  for (let redirect = 0; redirect <= (input.maxRedirects ?? 5); redirect += 1) {
    const response = await fetchWithTimeout(current, { headers, redirect: "manual", signal: context.signal }, input.timeoutMs ?? 5000);
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirect === (input.maxRedirects ?? 5)) throw new Error("too_many_redirects");
      const next = new URL(location, current);
      if (next.host !== current.host) {
        headers = Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== "authorization"));
      }
      current = next;
      continue;
    }
    return {
      ok: expected.includes(response.status),
      status: response.status,
      latencyMs: Date.now() - started,
      url: input.url,
      finalUrl: current.toString(),
      evidence: { statusCode: response.status, latencyMs: Date.now() - started, finalHost: current.host, finalPath: `${current.pathname}${current.search ? "?…" : ""}` }
    };
  }
  throw new Error("http_check_failed");
}

export async function checkTlsCertificate(context: ConnectorContext, value: string, timeoutMs = 5000): Promise<TlsCertificateCheck> {
  const target = new URL(value);
  if (target.protocol !== "https:") return { checked: false, validTo: null, daysRemaining: null, expired: false };

  return new Promise((resolve, reject) => {
    const socket = connect({
      host: target.hostname,
      port: Number(target.port) || 443,
      servername: target.hostname,
      rejectUnauthorized: true
    });
    let settled = false;
    const timer = setTimeout(() => finishError(new Error("tls_timeout")), timeoutMs);
    const onAbort = () => finishError(new Error("tls_check_aborted"));
    context.signal.addEventListener("abort", onAbort, { once: true });

    socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate();
      const validTo = typeof certificate.valid_to === "string" ? new Date(certificate.valid_to) : undefined;
      if (!validTo || !Number.isFinite(validTo.getTime())) {
        finishError(new Error("tls_certificate_metadata_missing"));
        return;
      }
      finish({ checked: true, validTo: validTo.toISOString(), daysRemaining: Math.floor((validTo.getTime() - Date.now()) / 86_400_000), expired: validTo.getTime() < Date.now() });
    });
    socket.once("error", () => finishError(new Error("tls_certificate_check_failed")));

    function finish(result: TlsCertificateCheck) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal.removeEventListener("abort", onAbort);
      socket.destroy();
      resolve(result);
    }

    function finishError(error: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal.removeEventListener("abort", onAbort);
      socket.destroy();
      reject(error);
    }
  });
}

async function fetchWithTimeout(url: URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  init.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("http_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", onAbort);
  }
}
