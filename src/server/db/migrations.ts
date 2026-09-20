import type { DatabaseSync } from "node:sqlite";

export class DatabaseMigrationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DatabaseMigrationError";
  }
}

const migrations: Array<[number, string]> = [
  [1, `
    CREATE TABLE IF NOT EXISTS module_instances (
      instance_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      config_json TEXT NOT NULL DEFAULT '{}',
      secret_refs_json TEXT NOT NULL DEFAULT '{}',
      config_version INTEGER NOT NULL DEFAULT 1,
      interval_ms INTEGER NOT NULL DEFAULT 60000,
      timeout_ms INTEGER NOT NULL DEFAULT 5000,
      stale_intervals INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS module_status (
      instance_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      status_json TEXT NOT NULL,
      failure_count INTEGER NOT NULL DEFAULT 0,
      checked_at TEXT NOT NULL,
      last_success_at TEXT,
      stale_at TEXT,
      PRIMARY KEY (instance_id, resource_id),
      FOREIGN KEY (instance_id) REFERENCES module_instances(instance_id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS test_bindings (
      test_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attention_events (
      event_id TEXT PRIMARY KEY,
      event_key TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      condition_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      state TEXT NOT NULL,
      event_json TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      acknowledged_at TEXT,
      acknowledged_by TEXT,
      recovered_at TEXT
    );
    CREATE INDEX IF NOT EXISTS attention_event_key_idx ON attention_events(event_key, state);
    CREATE TABLE IF NOT EXISTS actions (
      action_id TEXT PRIMARY KEY,
      idempotency_scope TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      identity TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      config_version INTEGER NOT NULL,
      request_fingerprint TEXT NOT NULL,
      result_json TEXT,
      error TEXT,
      confirmation_token_hash TEXT,
      confirmation_expires_at TEXT,
      confirmation_used_at TEXT,
      UNIQUE(idempotency_scope, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS actions_target_idx ON actions(instance_id, resource_id, action, status);
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      transport_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      status TEXT NOT NULL,
      sent_at TEXT,
      error TEXT,
      PRIMARY KEY (transport_id, event_id, phase)
    );
  `]
];

export function applyMigrations(db: DatabaseSync) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const [version, sql] of migrations) {
    const applied = db.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(version) as { version?: number } | undefined;
    if (applied) continue;
    try {
      db.exec("BEGIN IMMEDIATE");
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* preserve the migration error */ }
      throw new DatabaseMigrationError(`Failed to apply database migration ${version}`, error);
    }
  }
}
