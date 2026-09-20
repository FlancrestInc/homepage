import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type SshProfile = "host-metrics-readonly" | "mount-state-readonly";

export async function runFixedSsh(input: { alias: string; profile: SshProfile; timeoutMs?: number }) {
  const allowlist = parseAllowlist(process.env.COCKPIT_SSH_ALLOWLIST);
  const host = allowlist.get(input.alias);
  if (!host) throw new Error("ssh_alias_not_allowed");
  const command = input.profile === "host-metrics-readonly" ? "uname -srm && uptime" : "findmnt -o TARGET,FSTYPE,OPTIONS -rn";
  const result = await execFileAsync("ssh", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", host, command], { timeout: input.timeoutMs ?? 5000, maxBuffer: 32 * 1024 });
  return { output: result.stdout.slice(0, 32 * 1024), profile: input.profile, alias: input.alias };
}

function parseAllowlist(value: string | undefined) {
  return new Map((value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [alias, host] = entry.split("=");
    return [alias, host] as const;
  }));
}
