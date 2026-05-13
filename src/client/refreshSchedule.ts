const maxRefreshRetryDelayMs = 5 * 60 * 1000;

export function durationToMs(value: string) {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 30000;
  const amount = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  return amount * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] ?? 1000);
}

export function refreshRetryDelayMs(baseDelayMs: number, consecutiveFailures: number) {
  if (consecutiveFailures <= 0) return baseDelayMs;
  return Math.min(maxRefreshRetryDelayMs, baseDelayMs * 2 ** consecutiveFailures);
}
