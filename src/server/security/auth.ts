import type { FastifyRequest } from "fastify";
import type { AppEnv } from "../env.js";

export function readIdentity(request: FastifyRequest, env: AppEnv): string | undefined {
  if (!env.trustProxy || !isTrustedProxy(request.ip, env.trustedProxyCidrs ?? [])) return undefined;
  const value = request.headers[(env.identityHeader ?? "cf-access-authenticated-user-email").toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function requireWriteIdentity(request: FastifyRequest, env: AppEnv): string {
  const proxyIdentity = readIdentity(request, env);
  if (env.trustProxy) {
    if (!proxyIdentity || !env.publicOrigin || request.headers.origin !== env.publicOrigin) throw new AuthError("forbidden", 403);
    return proxyIdentity;
  }
  if (env.basicAuth && request.headers.authorization) return `basic:${env.basicAuth.username}`;
  throw new AuthError("unauthorized", 401);
}

export function isTrustedProxy(address: string | undefined, cidrs: string[]) {
  if (!address) return false;
  if (cidrs.includes(address) || cidrs.includes("*")) return true;
  const normalized = address.replace(/^::ffff:/, "");
  return cidrs.some((cidr) => inIpv4Cidr(normalized, cidr));
}

export class AuthError extends Error {
  constructor(public readonly code: "unauthorized" | "forbidden", public readonly statusCode: 401 | 403) {
    super(code);
  }
}

function inIpv4Cidr(address: string, cidr: string) {
  const [base, bitsText] = cidr.split("/");
  if (!base || !bitsText || !address.includes(".")) return false;
  const bits = Number(bitsText);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const toInt = (value: string) => value.split(".").reduce((result, part) => (result << 8) + Number(part), 0) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (toInt(address) & mask) === (toInt(base) & mask);
}
