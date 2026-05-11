import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, saveConfig } from "../../src/server/config/store";

async function tempConfigPath() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "homepage-config-"));
  return path.join(dir, "homepage.yml");
}

describe("config store", () => {
  it("creates a default config when the config file is missing", async () => {
    const configPath = await tempConfigPath();
    const config = await loadConfig(configPath);
    expect(config.theme.mode).toBe("dark");
    expect(config.layout.editorButton).toBe("bottom-right");
    expect(config.bookmarks).toEqual([]);
  });

  it("returns a fresh default config for each missing file load", async () => {
    const configPath = await tempConfigPath();
    const firstConfig = await loadConfig(configPath);
    firstConfig.theme.mode = "light";
    firstConfig.layout.groups.push({ name: "Mutated", order: 99 });

    const secondConfig = await loadConfig(configPath);

    expect(secondConfig.theme.mode).toBe("dark");
    expect(secondConfig.layout.groups).toEqual([]);
  });

  it("loads valid yaml config", async () => {
    const configPath = await tempConfigPath();
    await writeFile(configPath, [
      "theme:",
      "  mode: light",
      "bookmarks:",
      "  - name: Grafana",
      "    group: Self-Hosting",
      "    icon: si-grafana",
      "    url: https://grafana.example.com"
    ].join("\n"));
    const config = await loadConfig(configPath);
    expect(config.theme.mode).toBe("light");
    expect(config.bookmarks[0]?.name).toBe("Grafana");
  });

  it("rejects invalid config saves and leaves the current file unchanged", async () => {
    const configPath = await tempConfigPath();
    await writeFile(configPath, "theme:\n  mode: dark\nbookmarks: []\n");
    await expect(saveConfig(configPath, { theme: { mode: "sepia" } })).rejects.toThrow();
    await expect(readFile(configPath, "utf8")).resolves.toContain("mode: dark");
  });

  it("atomically saves valid config and creates a backup", async () => {
    const configPath = await tempConfigPath();
    await writeFile(configPath, "theme:\n  mode: dark\nbookmarks: []\n");
    const nextConfig = await saveConfig(configPath, {
      theme: { mode: "light" },
      bookmarks: [{ name: "GitHub", group: "Development", icon: "si-github", url: "https://github.com" }]
    });
    expect(nextConfig.theme.mode).toBe("light");
    expect(await readFile(configPath, "utf8")).toContain("mode: light");
    const files = await readdir(path.dirname(configPath));
    const backupFile = files.find((file) => file.startsWith("homepage.yml.backup."));
    expect(backupFile).toBeDefined();
    await expect(readFile(path.join(path.dirname(configPath), backupFile ?? ""), "utf8")).resolves.toContain("mode: dark");
  });
});
