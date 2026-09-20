import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { AppEnv } from "../env.js";
import { applyMigrations } from "./migrations.js";
import { createStateStore, type StateStore } from "./state.js";

export type CockpitDatabase = StateStore & { db: DatabaseSync };

export async function openDatabase(env: AppEnv): Promise<CockpitDatabase> {
  const dbPath = env.dbPath ?? path.join(env.dataDir ?? path.dirname(env.configPath), "cockpit.db");
  await mkdir(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    applyMigrations(db);
    return createStateStore(db);
  } catch (error) {
    db.close();
    throw error;
  }
}
