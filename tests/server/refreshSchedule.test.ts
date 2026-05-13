import { expect, test } from "vitest";
import { durationToMs, refreshRetryDelayMs } from "../../src/client/refreshSchedule";

test("durationToMs parses homepage duration strings", () => {
  expect(durationToMs("30s")).toBe(30000);
  expect(durationToMs("5m")).toBe(300000);
  expect(durationToMs("2h")).toBe(7200000);
  expect(durationToMs("invalid")).toBe(30000);
});

test("refreshRetryDelayMs backs off after failures and caps at five minutes", () => {
  expect(refreshRetryDelayMs(30000, 0)).toBe(30000);
  expect(refreshRetryDelayMs(30000, 1)).toBe(60000);
  expect(refreshRetryDelayMs(30000, 2)).toBe(120000);
  expect(refreshRetryDelayMs(30000, 4)).toBe(300000);
  expect(refreshRetryDelayMs(30000, 8)).toBe(300000);
});
