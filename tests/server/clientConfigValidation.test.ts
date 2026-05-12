import { expect, test } from "vitest";
import { validateRawConfigShape } from "../../src/client/configValidation";

test("validateRawConfigShape rejects empty objects", () => {
  expect(validateRawConfigShape({})).toEqual({
    ok: false,
    message: "Raw config is missing required object: theme"
  });
});

test("validateRawConfigShape rejects bookmark entries without required fields", () => {
  expect(validateRawConfigShape({ ...validRawConfig, bookmarks: [{}] })).toEqual({
    ok: false,
    message: "Raw config field bookmarks[0].name must be a string."
  });
});

const validRawConfig = {
  theme: {
    mode: "dark",
    accentColor: "#72a6ff",
    background: {
      type: "color",
      value: "#1d2a3b"
    }
  },
  layout: {
    editorButton: "bottom-right",
    groups: []
  },
  bookmarks: [],
  widgets: {
    refreshInterval: "30s",
    time: {
      enabled: true,
      format: "MMM d, yyyy h:mm a",
      showSeconds: false,
      hourCycle: "12",
      showTimezone: false
    },
    weather: {
      enabled: false,
      provider: "open-meteo",
      location: "Pleasant Grove, UT",
      units: "imperial",
      refreshInterval: "30m"
    },
    monitors: {
      source: "prometheus",
      historyWindow: "6h",
      sampleInterval: "5m",
      refreshInterval: "5m",
      servers: []
    }
  },
  healthChecks: {
    defaultInterval: "5m",
    timeout: "5s"
  }
};
