import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { appConfigSchema, type AppConfig } from "./schema.js";

async function exists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  if (!(await exists(configPath))) {
    return appConfigSchema.parse({});
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = raw.trim() ? YAML.parse(raw) : {};
  return appConfigSchema.parse(parsed);
}

export async function saveConfig(configPath: string, value: unknown): Promise<AppConfig> {
  const parsed = appConfigSchema.parse(value);
  const dir = path.dirname(configPath);
  await mkdir(dir, { recursive: true });
  const uniqueSuffix = `${new Date().toISOString().replace(/[:.]/g, "-")}.${randomUUID()}`;

  if (await exists(configPath)) {
    await copyFile(configPath, path.join(dir, `${path.basename(configPath)}.backup.${uniqueSuffix}`));
  }

  const tempPath = path.join(dir, `${path.basename(configPath)}.${process.pid}.${uniqueSuffix}.tmp`);
  await writeFile(tempPath, YAML.stringify(parsed), "utf8");
  await rename(tempPath, configPath);
  return parsed;
}
