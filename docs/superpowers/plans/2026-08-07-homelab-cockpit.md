# Homelab Cockpit Implementation Plan

> **For agentic workers:** REQUIRED: Use @superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the forked bookmarks homepage into a single-container homelab cockpit with modular service setup, attention summaries, safe actions, SQLite state, and ntfy/Apprise notifications.

**Architecture:** Keep Fastify, React, the existing YAML homepage config, cached public snapshot, scheduler, and Docker deployment. Add a small in-repository module registry, Node 24 built-in SQLite state, a shared connector runner, attention/event handling, and capability-gated actions. Build one complete host/storage/service pilot slice before registering the remaining v1 instances.

**Tech Stack:** TypeScript, Node.js 24 `node:sqlite`, Fastify, React, Vite, Vitest, Playwright, Zod, YAML, Docker Compose, Prometheus/Glances adapters already in the fork.

**Spec:** `docs/superpowers/specs/2026-08-07-homelab-cockpit-design.md`

**Working checkout:** `/home/ryan/projects/FlanCockpit/app`

---

## File structure

### Shared server platform

- `src/server/env.ts` — runtime paths, proxy trust, origin, and secret-ref settings.
- `src/server/db/database.ts` — open/close `node:sqlite` database and run migrations.
- `src/server/db/migrations.ts` — ordered SQLite schema migrations and seeded disabled instance catalog.
- `src/server/db/state.ts` — focused persistence helpers for instances, statuses, attention events, actions, tests, and notifications.
- `src/server/security/auth.ts` — trusted proxy identity and same-origin write checks.
- `src/server/security/secrets.ts` — strict `env:`/`docker:` reference validation and resolution.
- `src/server/security/redaction.ts` — remove secrets and unsafe response data from logs, snapshots, notifications, and API responses.
- `src/server/security/fingerprint.ts` — canonical config/secret digest used by setup-test bindings.
- `src/server/modules/types.ts` — JSON-safe definitions, instances, resources, statuses, events, actions, and API types.
- `src/server/modules/validation.ts` — runtime Zod validation for JSON-safe module setup/action/detail payloads.
- `src/server/modules/registry.ts` — module definition registry.
- `src/server/modules/runner.ts` — per-instance checks, global concurrency, retries, freshness, and persisted results.

### Module integrations

- `src/server/modules/transports/http.ts` — bounded HTTP checks with expected statuses, redirect, and TLS rules.
- `src/server/modules/transports/ssh.ts` — fixed read-only host/mount command profiles and host allowlist.
- `src/server/modules/definitions/host.ts` — host reachability and optional Prometheus/Glances/SSH metrics.
- `src/server/modules/definitions/storage.ts` — mount/share state and capacity resources.
- `src/server/modules/definitions/service.ts` — generic service health and optional service actions.
- `src/server/modules/definitions/publicRoute.ts` — public URL and TLS route health.
- `src/server/modules/definitions/ntfy.ts` — definition for the ntfy notification connector.
- `src/server/modules/definitions/apprise.ts` — definition for the Apprise notification connector.
- `src/server/integrations/prometheus.ts` — extend the existing Prometheus adapter with one-value queries while preserving range queries.
- `src/server/integrations/glances.ts` — reuse the existing current-metrics adapter and tested response mapping.

### Attention, actions, and notifications

- `src/server/attention/aggregator.ts` — event transitions, deduplication, acknowledgement, and attention summary.
- `src/server/attention/definitions.ts` — normalized condition definitions and event payloads.
- `src/server/actions/actionService.ts` — confirmation tokens, idempotency, locks, execution, and results.
- `src/server/notifications/dispatcher.ts` — open/reminder/recovery delivery and delivery deduplication.
- `src/server/notifications/ntfy.ts` — ntfy transport.
- `src/server/notifications/apprise.ts` — Apprise transport.

### API and snapshot

- `src/server/routes/modules.ts` — module definitions, setup test, instance config, status, and details routes.
- `src/server/routes/actions.ts` — action preparation, execution, result, and acknowledgement routes.
- `src/server/routes/public.ts` — additive module/attention snapshot fields with legacy fields preserved.
- `src/server/cache/publicSnapshot.ts` — build the stable browser snapshot from YAML and SQLite state.
- `src/server/index.ts` — initialize database/registry/routes and close resources safely.
- `src/server/jobs/scheduler.ts` — retain legacy jobs and schedule module checks without overlap.

### Client

- `src/client/types.ts` — public module, status, event, action, and setup types.
- `src/client/api.ts` — snapshot, module, setup, action, and notification API calls.
- `src/client/App.tsx` — render attention-first cockpit and preserve bookmark/editor behavior.
- `src/client/components/AttentionPanel.tsx` — conditional needs-attention region.
- `src/client/components/ModuleBand.tsx` — glanceable host/storage/service/route cards.
- `src/client/components/ModuleDetail.tsx` — expandable details, links, evidence, and controls.
- `src/client/components/ModuleSetupWizard.tsx` — definition-driven setup/test/save flow.
- `src/client/components/ActionConfirmation.tsx` — confirmation and result state for restart and other gated actions.
- `src/client/components/EditorDrawer.tsx` — add access to module setup without breaking existing tabs.
- `src/client/styles.css` — attention state, cards, details, controls, focus states, and mobile layout.

### Tests and deployment

- `tests/server/env.test.ts` — environment path and proxy/secret settings.
- `tests/server/db.test.ts` — migrations, persistence, restart, and migration failure mode.
- `tests/server/security.test.ts` — auth, CSRF, secret refs, fingerprints, and redaction.
- `tests/server/modules/types.test.ts` — module contract and JSON-safe validation.
- `tests/server/modules/runner.test.ts` — scheduling, locks, retries, stale state, and restart behavior.
- `tests/server/modules/definitions.test.ts` — host/storage/service/route connector fixtures.
- `tests/server/integrations.test.ts` — Prometheus, Glances, HTTP, and SSH transport fixtures.
- `tests/server/attention.test.ts` — event lifecycle and active summary.
- `tests/server/actions.test.ts` — confirmation, idempotency, timeout, and audit behavior.
- `tests/server/notifications.test.ts` — ntfy/Apprise delivery and deduplication.
- `tests/server/routes/modules.test.ts` — setup/status/details API contracts.
- `tests/server/routes/actions.test.ts` — write authorization and action APIs.
- `tests/e2e/cockpit.spec.ts` — healthy/attention/expanded/detail states.
- `tests/e2e/module-setup.spec.ts` — setup wizard and validation states.
- `tests/e2e/homepage-layout.spec.ts` — extend existing fixtures with additive snapshot fields.
- `Dockerfile` — Node 24 runtime and built-in SQLite compatibility.
- `docker-compose.example.yml` — `/data` volume, network, secret references, and proxy settings.
- `README.md` — installation, setup wizard, proxy trust, secret refs, and module addition guide.
- `config.example.yml` — preserve the existing homepage example and add cockpit-related notes only where YAML remains relevant.
- `package.json` / `package-lock.json` — Node 24 engine/type metadata; no SQLite dependency.

## Chunk 1: Shared platform seams

### Task 1: Pin the runtime and add SQLite environment configuration

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `Dockerfile`
- Modify: `src/server/env.ts`
- Create: `tests/server/env.test.ts`
- Modify: `tests/server/routes.test.ts`
- Modify: `tests/server/icons.test.ts`
- Modify: `tests/server/jobs.test.ts`

- [ ] **Step 1: Write failing environment tests**

Test that `readEnv()` returns:

- an unset `COCKPIT_DATA_DIR` so existing `/config` deployments derive the database beside `HOMEPAGE_CONFIG_PATH`.
- `COCKPIT_DB_PATH` taking precedence over all derived paths.
- a derived database path under `COCKPIT_DATA_DIR` when set.
- a derived database path beside `HOMEPAGE_CONFIG_PATH` for existing `/config` deployments when `COCKPIT_DATA_DIR` is absent.
- `HOMEPAGE_CONFIG_PATH` and `HOMEPAGE_CACHE_DIR` remaining independent.
- `COCKPIT_PUBLIC_ORIGIN`, `COCKPIT_TRUST_PROXY`, `COCKPIT_TRUSTED_PROXY_CIDRS`, `COCKPIT_IDENTITY_HEADER`, and `COCKPIT_ALLOWED_SECRET_REFS` being parsed without exposing values.
- the identity header defaulting to the Cloudflare Access header when unset.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/server/env.test.ts`

Expected: FAIL because the new `AppEnv` fields do not exist.

- [ ] **Step 3: Implement the smallest runtime change**

Update `AppEnv` and `readEnv()` in `src/server/env.ts`. Keep `COCKPIT_DATA_DIR` optional: the fresh Compose file sets it to `/data`, while an existing deployment without it derives the database beside `HOMEPAGE_CONFIG_PATH`. Parse booleans and comma-separated lists with explicit defaults. Do not read secret values in `readEnv()`; only preserve allowed reference names. Update existing test environment builders in `tests/server/routes.test.ts`, `tests/server/icons.test.ts`, and `tests/server/jobs.test.ts` with the new non-secret fields.

Update `package.json` to require Node `>=24` and update `@types/node` to the Node 24 line. Update `Dockerfile` build and runtime stages from `node:22-alpine` to `node:24-alpine`.

- [ ] **Step 4: Run the focused test and build**

Run: `npm test -- tests/server/env.test.ts tests/server/routes.test.ts tests/server/icons.test.ts tests/server/jobs.test.ts && npm run lint && npm run build`

Expected: PASS, TypeScript compilation succeeds, and both client/server build outputs are created.

- [ ] **Step 5: Commit the runtime seam**

```bash
git add package.json package-lock.json Dockerfile src/server/env.ts tests/server/env.test.ts tests/server/routes.test.ts tests/server/icons.test.ts tests/server/jobs.test.ts
git commit -m "chore: prepare cockpit runtime"
```

### Task 2: Add the SQLite schema and state repository

**Files:**
- Create: `src/server/db/database.ts`
- Create: `src/server/db/migrations.ts`
- Create: `src/server/db/state.ts`
- Create: `src/server/security/redaction.ts`
- Create: `tests/server/db.test.ts`

- [ ] **Step 1: Write migration and state tests**

Cover:

- creating a database in a temporary directory;
- creating the migration table and all required tables: `module_instances`, `module_status`, `test_bindings`, `attention_events`, `actions`, and `notification_deliveries`;
- storing/retrieving two resources under one module instance;
- configuration-version CRUD and ten-minute test-binding expiry;
- persisting status failure counts and last-success times across a reopen;
- preserving last-successful fields/evidence through a failed poll and marking them stale only after `staleAt`;
- storing only redacted JSON fields in action/event records through the persistence write boundary;
- unique notification delivery keys and idempotent action keys;
- migration rollback when a migration statement fails, including `DatabaseMigrationError`, a closed handle, and no partial schema;
- status-writer redaction preventing raw connector evidence from entering SQLite;
- action records retaining trusted identity, instance/resource target, request time, request fingerprint, and `unknown` outcomes;
- idempotent rerunning of already-applied migrations.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/server/db.test.ts`

Expected: FAIL because the database modules do not exist.

- [ ] **Step 3: Implement the database boundary**

Use `node:sqlite` `DatabaseSync`. Set SQLite busy timeout, foreign keys, and WAL mode. Apply numbered migrations in one transaction. Store JSON configuration/details/evidence in text columns, with stable IDs and timestamps as ISO strings. A migration failure throws a typed `DatabaseMigrationError`, closes the handle, and guarantees no partially applied migration; Task 13 converts that error into application read-only mode.

Implement state helpers for:

- module instance CRUD and configuration version;
- per-resource status and failure counters;
- ten-minute test bindings with config/secret fingerprints;
- attention event open/acknowledge/recover queries;
- action records containing trusted actor, instance/resource target, action, request time, request fingerprint, `idempotency_scope`, `idempotency_key`, `confirmation_token_hash`, `confirmation_expires_at`, `confirmation_used_at`, current `config_version`, status including `unknown`, and results, with a unique `(idempotency_scope, idempotency_key)` constraint;
- notification delivery keys and results.

Implement `src/server/security/redaction.ts` with a small `redactForPersistence()` boundary that accepts only JSON-safe values and configured sensitive values. Call it inside state writers for action/event/status JSON; later tasks reuse the same helper for API, snapshot, log, and notification outputs.

`openDatabase()` must return a closeable handle. State writers must call the persistence boundary’s redaction helper before writing action/event/status JSON; callers cannot write raw connector responses directly.


- [ ] **Step 4: Expose a closeable database handle**

Export `openDatabase(env)` and a small typed state interface. Do not wire Fastify routes, scheduler, or migration-failure read-only behavior in this task; those owners are Tasks 8 and 13. Keep `buildApp({ startJobs: false })` unchanged until the application wiring task.

- [ ] **Step 5: Run database tests**

Run: `npm test -- tests/server/db.test.ts`

Expected: PASS; application wiring remains owned by later route/startup tasks.

- [ ] **Step 6: Commit the database seam**

```bash
git add src/server/db src/server/security/redaction.ts tests/server/db.test.ts
git commit -m "feat: add cockpit sqlite state"
```

### Task 3: Define shared module, security, and contract types

**Files:**
- Create: `src/server/modules/types.ts`
- Create: `src/server/modules/validation.ts`
- Create: `src/server/security/auth.ts`
- Create: `src/server/security/secrets.ts`
- Modify: `src/server/security/redaction.ts`
- Create: `src/server/security/fingerprint.ts`
- Create: `tests/server/security.test.ts`
- Create: `tests/server/modules/types.test.ts`

- [ ] **Step 1: Write contract and security tests**

Test:

- runtime Zod schemas reject functions, symbols, raw `undefined`, arbitrary response bodies, and non-JSON detail/evidence values.
- `env:NAME` and `docker:NAME` obey the documented name grammar.
- literal secret values, unknown references, and references outside `COCKPIT_ALLOWED_SECRET_REFS` are rejected.
- missing env/Docker secrets return `secret_missing` without the secret name’s value.
- `secretRefs` keys match the definition’s declared `secretFields` exactly.
- fingerprints are stable for object key order and change when config or resolved secret digests change.
- fingerprints also change when `kind`, `instanceId`, or secret-reference names change.
- `ConnectorContext` and each definition’s declared `secretFields` are present and runtime-valid.
- the auth helper accepts a valid `COCKPIT_TRUST_PROXY=true` request from an exact trusted CIDR with the configured identity and origin, rejects missing/incorrect values, and distinguishes read from write checks.
- redaction removes secret values, authorization headers, URL userinfo/query credentials, and raw SSH output from nested JSON.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- tests/server/security.test.ts tests/server/modules/types.test.ts`

Expected: FAIL because the shared types and security helpers do not exist.

- [ ] **Step 3: Implement the shared JSON contract and parse points**

Define `ModuleDefinition`, `ModuleInstance`, resource, setup-schema, `StatusResult`, `ModuleStatusResponse`, `AttentionEvent`, `TestResult`, `ActionDefinition`, `ActionResult`, API error, and public-snapshot types. Add Zod runtime schemas in `validation.ts` for setup values, action inputs, evidence, and details, and export parse functions for Task 8 routes. The runner will call the status-result parser before its `onStatus` callback in Task 4. Keep module detail/evidence payloads JSON-safe and allowlisted.

- [ ] **Step 4: Implement proxy and origin checks**

In `auth.ts`, accept identity for writes only when `COCKPIT_TRUST_PROXY=true`, the request source matches `COCKPIT_TRUSTED_PROXY_CIDRS`, the configured identity header is present, and the request `Origin` exactly matches `COCKPIT_PUBLIC_ORIGIN`. Reads do not require an `Origin` header. Reject cross-origin writes and keep reads available when the application is in read-only mode.

- [ ] **Step 5: Implement secret references, fingerprints, and output redaction**

Resolve `env:` and `docker:` references only during server-side connector calls. Hash normalized `kind`, `instanceId`, config, secret-reference names, and one-way secret digests for test binding. Extend the Task 2 persistence redaction helper to cover logs, snapshots, notifications, and API responses.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/server/security.test.ts tests/server/modules/types.test.ts && npm run lint`

Expected: PASS and no secret value appears in test output.

```bash
git add src/server/modules/types.ts src/server/modules/validation.ts src/server/security tests/server/security.test.ts tests/server/modules/types.test.ts
git commit -m "feat: define cockpit module contract"
```

### Task 4: Build the module registry and runner

**Files:**
- Create: `src/server/modules/registry.ts`
- Create: `src/server/modules/runner.ts`
- Create: `tests/server/modules/runner.test.ts`
- Modify: `src/server/jobs/scheduler.ts`

- [ ] **Step 1: Write runner tests**

Use fake module definitions and a fake clock to test:

- one check per instance at a time;
- six-check global concurrency cap;
- manual refresh using the same lock/cap;
- one retry after five seconds;
- persisted failure counter and last success after restart;
- fresh, stale, and never-successful status transitions;
- shutdown aborting in-flight requests;
- no scheduler work for disabled instances;
- malformed connector results becoming field errors instead of killing the scheduler.
- injected `onStatus` receiving exactly one final normalized result after a failure-then-retry sequence, not the non-counting initial retry attempt.
- exact preservation of prior `fields` and `evidence` across a failed poll before `staleAt`, followed by stale metadata after `staleAt`.
- two resources under one instance remain isolated by `(instanceId, resourceId)` in status persistence and callbacks.
- interval bounds of 15 seconds to 24 hours, timeout bounds of 1 to 30 seconds, and stale threshold bounds of 1 to 24 intervals.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/server/modules/runner.test.ts`

Expected: FAIL because the registry and runner do not exist.

- [ ] **Step 3: Implement the registry**

Register module definitions by `kind`. Add a lookup that returns a `404 module_not_found`-compatible error for unknown kinds. Keep registration in code; do not add a dynamic plugin loader.

- [ ] **Step 4: Implement runner scheduling and persistence**

Load enabled instances from SQLite, call `getStatus()` with an `AbortSignal`, and normalize timeout, thrown-error, and parse-failure results into `unknown`/`degraded` `StatusResult` values with redacted error evidence. On a failed poll, retain the previous successful fields/evidence, update failure/freshness metadata, and only replace those fields after a successful check. Persist complete per-resource results and failure counters, then invoke an injected `onStatus(result)` callback exactly once per scheduled evaluation, after the final retry outcome. The retry attempt does not independently increment failure/open thresholds. Task 6 supplies the attention implementation; the runner only depends on the callback type. Use a simple semaphore with six slots and an instance lock map. Persist `checkedAt`, `lastSuccessAt`, `staleAt`, and failure count so restart does not reset alert timing.

Use the spec defaults: 60-second poll interval, five-second timeout, one retry after five seconds, stale at 180 seconds by default, bounded module overrides, and elapsed `staleAt` as the authoritative freshness value. Manual refresh uses the same semaphore and instance lock.

- [ ] **Step 5: Attach the runner to the existing scheduler**

Keep weather, monitor, and bookmark health jobs intact. Add a module runner interval with no overlap. On shutdown, stop scheduling and abort active module checks.

- [ ] **Step 6: Run the focused suite and commit**

Run: `npm test -- tests/server/modules/runner.test.ts tests/server/jobs.test.ts`

Expected: PASS; legacy scheduler tests remain green.

```bash
git add src/server/modules/registry.ts src/server/modules/runner.ts src/server/jobs/scheduler.ts tests/server/modules/runner.test.ts
git commit -m "feat: add modular connector runner"
```

## Chunk 2: Pilot connectors, attention, and API

### Task 5: Add shared connector transports and the pilot definitions

**Files:**
- Create: `src/server/modules/transports/http.ts`
- Create: `src/server/modules/transports/ssh.ts`
- Create: `src/server/modules/definitions/host.ts`
- Create: `src/server/modules/definitions/storage.ts`
- Create: `src/server/modules/definitions/service.ts`
- Create: `src/server/modules/definitions/publicRoute.ts`
- Modify: `src/server/integrations/prometheus.ts`
- Modify: `src/server/integrations/glances.ts`
- Create: `tests/server/modules/definitions.test.ts`
- Create: `tests/server/integrations.test.ts`

- [ ] **Step 1: Write transport and definition tests**

Use mocked `fetch` and SSH runners to cover expected HTTP statuses, the five-second timeout, five-redirect limit, redirect host/path-only evidence, authorization stripping on cross-host redirects, TLS failure, rejection of `verifyTls: false`, and redacted redirect metadata. Cover bounded SSH output and timeout, the two allowed profiles succeeding with an allowed alias, and rejection of user-supplied commands, unknown aliases, and unknown profiles. Add malformed JSON and non-2xx fixtures.

In `tests/server/integrations.test.ts`, cover Prometheus query results with one, zero, many, and non-numeric samples, plus the fork’s Glances v3/v4 mappings and missing-field degradation. In `tests/server/modules/definitions.test.ts`, assert that each of the four definitions exposes its setup schema, `secretFields`, actions, events, links, and dependencies; `testConnection` has no state writes; hosts/services/routes use one `default` resource; storage exposes two configured resources; and results include generic host health, service health/restart capability, and public-route latency/status/TLS evidence.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/server/modules/definitions.test.ts`

Expected: FAIL because the new definitions and transports do not exist.

- [ ] **Step 3: Implement HTTP and SSH boundaries**

Implement `checkHttp()` with the documented timeout, expected-status, redirect, TLS, and safe-evidence rules. Reject disabled TLS verification, cap redirects and response bytes, strip authorization when a redirect changes host, and retain only redacted host/path metadata. Implement fixed SSH profiles `host-metrics-readonly` and `mount-state-readonly` with non-interactive timeout-bounded execution, bounded output, and server-side allowlists. Do not expose command strings in setup or API payloads.

- [ ] **Step 4: Extend existing metrics adapters minimally**

Add a single numeric Prometheus query helper without changing the existing range-history behavior. Keep the existing Glances response parser and expose it through the module transport boundary.

- [ ] **Step 5: Implement the four definitions**

Use the shared setup schema and status contract. Host/service/public-route instances use one `default` resource. Storage instances expose configured resource IDs. Return `unknown` when there is no evidence, `degraded` for partial metrics, and `down` for a confirmed failed health source.

- [ ] **Step 6: Run tests and commit the pilot connector layer**

Run: `npm test -- tests/server/modules/definitions.test.ts tests/server/integrations.test.ts && npm run lint`

Expected: PASS, including the owned Prometheus/Glances adapter fixtures.

```bash
git add src/server/modules src/server/integrations/prometheus.ts src/server/integrations/glances.ts tests/server/modules/definitions.test.ts tests/server/integrations.test.ts
git commit -m "feat: add pilot cockpit connectors"
```

### Task 6: Add attention event aggregation

**Files:**
- Create: `src/server/attention/definitions.ts`
- Create: `src/server/attention/aggregator.ts`
- Create: `tests/server/attention.test.ts`

- [ ] **Step 1: Write event lifecycle tests**

Cover:

- two failures opening one event after a successful baseline;
- one success recovering it;
- a new `eventId` after recovery and later failure;
- stable `eventKey` for the same instance/resource/condition;
- warning versus critical severity;
- acknowledgement removing an item from active attention without changing status;
- acknowledgement suppressing reminders but allowing recovery notification;
- never-successful instances staying setup-error/unknown without operational notifications;
- stale status producing the correct condition and evidence.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/server/attention.test.ts`

Expected: FAIL because event aggregation does not exist.

- [ ] **Step 3: Implement condition definitions and transitions**

Normalize module condition definitions into `status_not_healthy`, `field_error`, `threshold`, or `custom` checks. Build `eventKey` from instance/resource/condition and create a new event row for each incident. Persist open, acknowledged, and recovered timestamps.

- [ ] **Step 4: Implement the active summary**

Return only unacknowledged open events, sorted critical-first then oldest-first, with owner, resource, evidence, age, next action, and direct link metadata. Return an empty list when healthy so the UI can hide the region.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- tests/server/attention.test.ts`

Expected: PASS.

```bash
git add src/server/attention tests/server/attention.test.ts
git commit -m "feat: aggregate cockpit attention events"
```

### Task 7: Add ntfy/Apprise notification delivery

**Files:**
- Create: `src/server/notifications/dispatcher.ts`
- Create: `src/server/notifications/ntfy.ts`
- Create: `src/server/notifications/apprise.ts`
- Create: `src/server/modules/definitions/ntfy.ts`
- Create: `src/server/modules/definitions/apprise.ts`
- Create: `tests/server/notifications.test.ts`
- Modify: `src/server/attention/aggregator.ts`
- Modify: `src/server/jobs/scheduler.ts`
- Modify: `src/server/modules/registry.ts`

- [ ] **Step 1: Write notification tests**

Use a fake clock, fake transports, and a fresh dispatcher instance to assert open sends once per transport/event/phase; reminders at exactly one hour and every six hours only while unacknowledged; recovery once even after acknowledgement; and a new open after recovery. Reload persisted delivery state to prove process restart does not duplicate any phase. Add ntfy and Apprise timeout/non-2xx fixtures, safe evidence/link assertions without secret query data, and delivery failures that do not alter module status. Route-level setup binding and trusted-identity coverage belongs to Task 8.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/server/notifications.test.ts`

Expected: FAIL because the dispatcher and transports do not exist.

- [ ] **Step 3: Implement the transport adapters**

Resolve the configured secret reference only at send time. Build minimal ntfy HTTP requests and Apprise requests using the configured reference. Treat non-2xx responses and timeouts as delivery failures with redacted messages.

- [ ] **Step 4: Implement notification definitions and delivery state**

Define ordinary `notify.ntfy` and `notify.apprise` modules with setup schemas, endpoint secret fields, links, dependencies, a non-persisting `testConnection`, and an explicit `test_delivery` action. Register them with the common module registry. Their setup, test, save, enable, and config-update flow uses the generic routes in Task 8: `POST /api/modules/test`, `POST /api/modules`, and `PUT /api/modules/:instanceId/config`, including the ten-minute fingerprint binding. Store `transportId + eventId + phase` delivery keys and make repeated delivery attempts idempotent.

- [ ] **Step 5: Connect the dispatcher to event transitions**

Call it from `src/server/attention/aggregator.ts` after a committed event transition. Run reminder evaluation from `src/server/jobs/scheduler.ts` with the fake-clock boundary covered by the tests, and reload persisted delivery state before sending so process restart cannot duplicate deliveries. Keep transition writes and delivery-state writes recoverable if delivery itself fails.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/server/notifications.test.ts tests/server/attention.test.ts`

Expected: PASS.

```bash
git add src/server/notifications src/server/modules/definitions/ntfy.ts src/server/modules/definitions/apprise.ts src/server/attention/aggregator.ts src/server/jobs/scheduler.ts src/server/modules/registry.ts tests/server/notifications.test.ts
git commit -m "feat: add ntfy and apprise alerts"
```

### Task 8: Add module setup, status, details, and action API routes

**Files:**
- Create: `src/server/routes/modules.ts`
- Create: `src/server/routes/actions.ts`
- Create: `src/server/actions/actionService.ts`
- Create: `tests/server/routes/modules.test.ts`
- Create: `tests/server/routes/actions.test.ts`
- Create: `tests/server/actions.test.ts`
- Modify: `src/server/index.ts`

- [ ] **Step 1: Write route and action tests**

Cover the exact common routes: `GET /api/modules`, `POST /api/modules/test`, `POST /api/modules`, `PUT /api/modules/:instanceId/config`, `GET /api/modules/:instanceId/status`, `GET /api/modules/:instanceId/details`, `GET /api/attention`, `GET /api/events`, `POST /api/modules/:instanceId/actions/:action/prepare`, `POST /api/modules/:instanceId/actions/:action`, `GET /api/actions/:actionId`, and `POST /api/attention/:eventId/acknowledge`.

Assert that listing definitions and configured/disabled instances never returns secret values. Exercise both `notify.ntfy` and `notify.apprise` through the generic `POST /api/modules/test` -> `POST /api/modules` -> `PUT /api/modules/:instanceId/config` flow: a valid ten-minute binding creates/enables and updates the instance, testing does not persist, and missing/expired/mismatched bindings fail. Cover disabling an instance stopping checks, status/details returning instance/resource data, active attention versus event history, and persisted action results.

Use a fixed error matrix: `400` with `{ error: "invalid_request", issues: [...] }` for malformed JSON/schema; `401` with `{ error: "unauthorized" }` for missing trusted identity; `403` with `{ error: "forbidden" }` for an untrusted proxy or wrong origin; `404` with `{ error: "module_not_found" }` for an unknown kind or instance and `{ error: "action_unknown" }` for an unknown action; and `409` with the named error code for `details_unavailable`, `capability_unavailable`, `confirmation_required`, and `idempotency_conflict`. Assert these codes/statuses and that no response contains secret values.

Cover trusted-proxy and same-origin checks on `POST /api/modules/test`, `POST /api/modules`, and `PUT /api/modules/:instanceId/config`, plus action and acknowledgement writes. Cover `test_delivery` on both notification kinds with a trusted identity and reject it without one. Cover prepare/execute confirmation tokens bound to trusted identity, instance, resource, action, and current config version; five-minute expiry; single use; wrong-target rejection; and replay rejection. Cover idempotency exact replay, conflicting replay, and the exact scope `identity + instanceId + resourceId + action`; per-resource lock; timeout-to-unknown; process restart after dispatch marking the action `unknown` without replay; and persisted action result.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- tests/server/routes/modules.test.ts tests/server/routes/actions.test.ts tests/server/actions.test.ts`

Expected: FAIL because the routes and action service do not exist.

- [ ] **Step 3: Implement the action service**

Validate action capability and JSON input schema, enforce trusted identity/origin, create hashed one-use confirmation tokens, scope idempotency, serialize per-resource actions, execute the connector, redact results, and persist `succeeded`, `failed`, `pending`, or `unknown` outcomes. Mark in-flight actions `unknown` on restart rather than replaying them.

- [ ] **Step 4: Implement module routes**

Register `GET /api/modules`, `POST /api/modules/test`, `POST /api/modules`, `PUT /api/modules/:instanceId/config`, `GET /api/modules/:instanceId/status`, and `GET /api/modules/:instanceId/details`. Register `GET /api/attention` for active unacknowledged events and `GET /api/events` for bounded event history. Apply trusted-proxy and same-origin checks to all module writes, require the matching ten-minute test binding for create/config writes, keep testConnection side-effect-free, emit the exact status/error codes above, and never return secret values.

- [ ] **Step 5: Implement action and acknowledgement routes**

Register `POST /api/modules/:instanceId/actions/:action/prepare`, `POST /api/modules/:instanceId/actions/:action`, `GET /api/actions/:actionId`, and `POST /api/attention/:eventId/acknowledge`. Require `Idempotency-Key` on every state-changing action and acknowledgement, bind and expire confirmation tokens as specified, persist audit records and results, and return `confirmation_required`, `capability_unavailable`, `idempotency_conflict`, and `action_unknown` consistently with the exact error matrix above.

- [ ] **Step 6: Run tests and commit the pilot backend**

Run: `npm test -- tests/server/routes/modules.test.ts tests/server/routes/actions.test.ts tests/server/actions.test.ts && npm run lint`

Expected: PASS.

```bash
git add src/server/routes/modules.ts src/server/routes/actions.ts src/server/actions src/server/index.ts tests/server/routes/modules.test.ts tests/server/routes/actions.test.ts tests/server/actions.test.ts
git commit -m "feat: expose cockpit module APIs"
```

## Chunk 3: Snapshot and cockpit UI

### Task 9: Extend the cached public snapshot without breaking the homepage

**Files:**
- Modify: `src/server/cache/publicSnapshot.ts`
- Modify: `src/server/routes/public.ts`
- Modify: `src/server/index.ts`
- Modify: `src/client/types.ts`
- Modify: `src/client/api.ts`
- Create: `tests/server/publicSnapshotCockpit.test.ts`
- Modify: `tests/server/routes.test.ts`
- Modify: `tests/server/clientApi.test.ts`

- [ ] **Step 1: Write additive snapshot tests**

Assert that the snapshot retains `generatedAt`, `theme`, `layout`, `widgets`, and `groups`, and adds `modules`, `attention`, and `eventsSummary`. Cover healthy empty attention, one warning, one critical item, stale status, disabled instances, multiple resources, and a deterministic database fallback: return the last complete atomic cockpit snapshot, return a degraded bookmarks-only snapshot when no cockpit snapshot exists, and keep legacy weather/monitor cache data isolated from connector failures.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/server/publicSnapshotCockpit.test.ts tests/server/routes.test.ts`

Expected: FAIL because the new snapshot fields do not exist.

- [ ] **Step 3: Build the server snapshot**

Read one consistent state view from SQLite, build the complete additive snapshot in memory, and publish it only after all fields are complete. Combine it with the existing YAML/cache inputs and apply redaction. On a failed database read, return the last complete cockpit snapshot; if none exists, return only the bookmarks and legacy fields available from YAML/cache plus an explicit degraded/read-only marker. Keep legacy weather/monitor data unchanged and never mix a partial module read into the published snapshot.

- [ ] **Step 4: Add client types and API helpers**

Add typed `getModules()`, `getAttention()`, `getEvents()`, `testModule()`, `saveModule()`, `getModuleDetails()`, `prepareAction()`, `executeAction()`, `getAction()`, `acknowledgeAttention()`, and notification setup/test helpers. Extend `tests/server/clientApi.test.ts` with call-contract assertions for payloads, returned `testId`, matching config binding, `Idempotency-Key` on every state-changing helper, specified error codes/issues, and redacted responses with no secret leakage.

- [ ] **Step 5: Run the focused suite and commit**

Run: `npm test -- tests/server/publicSnapshotCockpit.test.ts tests/server/routes.test.ts tests/server/clientApi.test.ts && npm run lint`

Expected: PASS.

```bash
git add src/server/cache/publicSnapshot.ts src/server/routes/public.ts src/server/index.ts src/client/types.ts src/client/api.ts tests/server/publicSnapshotCockpit.test.ts tests/server/routes.test.ts tests/server/clientApi.test.ts
git commit -m "feat: add cockpit snapshot API"
```

### Task 10: Render the attention-first cockpit

**Files:**
- Create: `src/client/components/AttentionPanel.tsx`
- Create: `src/client/components/ModuleBand.tsx`
- Create: `src/client/components/ModuleDetail.tsx`
- Create: `tests/e2e/cockpit.spec.ts`
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/WidgetBand.tsx`
- Modify: `src/client/styles.css`

- [ ] **Step 1: Write stable Playwright fixtures**

Define fixture snapshots and assertions for a healthy state with no attention region; critical-before-warning attention grouping; rows showing module, resource, evidence, age, next action, and acknowledgement; compact host/storage/service/route cards; expanded details with evidence and links; and stale/unknown status text. Include deterministic desktop and phone checks for stacked full-width details, no horizontal clipping, visible focus, keyboard activation, `aria-expanded`, status text beyond color, and reduced-motion behavior.

- [ ] **Step 2: Run the focused browser test and verify failure**

Run: `npm run test:e2e -- tests/e2e/cockpit.spec.ts`

Expected: FAIL because the attention panel and module cards do not exist.

- [ ] **Step 3: Run the existing browser suite before UI edits**

Run: `npm run test:e2e -- tests/e2e/homepage-layout.spec.ts`

Expected: PASS on the fork baseline.

- [ ] **Step 4: Implement the healthy and attention states**

Render `AttentionPanel` only when the snapshot has unacknowledged events. Render `ModuleBand` after it and before the bookmark groups. Keep the existing time/weather/monitor `WidgetBand` available as legacy content, but do not let it displace bookmarks or block the module summary.

- [ ] **Step 5: Implement expandable details**

Use native buttons/details semantics where practical. Opening a card loads details once, shows loading/error/stale states, lists direct links, and renders only capability-declared controls. Preserve the bookmark editor and icon behavior.

- [ ] **Step 6: Add responsive and accessibility styles**

Add visible focus states, status text beyond color, `aria-expanded`, `aria-live` for new attention items, minimum touch targets, stacked phone layout, and compact desktop cards. Keep motion optional and respect `prefers-reduced-motion`; the browser fixtures must assert the focus, keyboard, ARIA, viewport, clipping, and reduced-motion behavior rather than only checking classes.

- [ ] **Step 7: Run browser checks and commit**

Run: `npm run lint && npm run test:e2e -- tests/e2e/cockpit.spec.ts tests/e2e/homepage-layout.spec.ts`

Expected: PASS with existing bookmark layout preserved.

```bash
git add src/client/App.tsx src/client/components/AttentionPanel.tsx src/client/components/ModuleBand.tsx src/client/components/ModuleDetail.tsx src/client/components/WidgetBand.tsx src/client/styles.css tests/e2e/cockpit.spec.ts
git commit -m "feat: add attention-first cockpit view"
```

### Task 11: Add the setup wizard and safe action UI

**Files:**
- Create: `src/client/components/ModuleSetupWizard.tsx`
- Create: `src/client/components/ActionConfirmation.tsx`
- Modify: `src/client/components/EditorDrawer.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/api.ts`
- Modify: `src/client/types.ts`
- Modify: `src/client/styles.css`
- Create: `tests/e2e/module-setup.spec.ts`

- [ ] **Step 1: Write setup and action browser tests**

Mock API responses and cover:

- opening Connect services from the existing editor/settings affordance;
- choosing a definition and entering endpoint/config values;
- validation before test;
- failed test preserving the previous saved state;
- successful test enabling save only with the matching unexpired `testId`;
- changing any tested config forcing a new connection test before save;
- secret reference fields never echoing values;
- `invalid_request`, `unauthorized`, and `forbidden` responses preserving the saved state and showing redacted feedback;
- disabled instances remaining visible;
- confirmation for restart;
- action pending, success, failure, and unknown-after-timeout feedback;
- acknowledgement removing an item from the active panel;
- unsupported actions absent from the UI, non-confirming actions skipping prepare, and authorization/capability/confirmation failures leaving the UI state unchanged;
- both ntfy and Apprise using the same generic test/save/update flow.

- [ ] **Step 2: Run the new browser test and verify failure**

Run: `npm run test:e2e -- tests/e2e/module-setup.spec.ts`

Expected: FAIL because the setup wizard does not exist.

- [ ] **Step 3: Implement definition-driven setup**

Render fields from `SetupSchema`, validate locally, call `POST /api/modules/test`, retain the returned unexpired `testId` and fingerprint, invalidate it after any relevant config change, and require the matching binding before save. Show redacted `invalid_request`, `unauthorized`, and `forbidden` feedback and retain the old configuration on failed test or save.

- [ ] **Step 4: Implement details and action controls**

Use only the module’s declared `actions`; call prepare only for confirming actions, execute with a fresh idempotency key, poll `GET /api/actions/:actionId` for pending results, and refresh the affected snapshot/resource after completion. Keep unsupported-action, authorization, capability, and confirmation failures from mutating visible UI state.

- [ ] **Step 5: Implement notification setup**

Expose ntfy and Apprise as connector definitions with secret-reference fields and a delivery-test button. Drive both through the same test/save/config-update binding flow, and do not render literal topic/URL values after save.

- [ ] **Step 6: Run browser and type checks, then commit**

Run: `npm run lint && npm run test:e2e -- tests/e2e/module-setup.spec.ts tests/e2e/editor.spec.ts`

Expected: PASS; existing bookmark/theme/widget editor tests remain green.

```bash
git add src/client/components/ModuleSetupWizard.tsx src/client/components/ActionConfirmation.tsx src/client/components/EditorDrawer.tsx src/client/App.tsx src/client/api.ts src/client/types.ts src/client/styles.css tests/e2e/module-setup.spec.ts
git commit -m "feat: add module setup and actions UI"
```

## Chunk 4: V1 registrations, deployment, and release verification

### Task 12: Register all v1 host, storage, service, and route instances

**Files:**
- Modify: `src/server/db/migrations.ts`
- Modify: `src/server/modules/registry.ts`
- Modify: `src/server/modules/definitions/host.ts`
- Modify: `src/server/modules/definitions/storage.ts`
- Modify: `src/server/modules/definitions/service.ts`
- Modify: `src/server/modules/definitions/publicRoute.ts`
- Create: `tests/server/modules/v1Instances.test.ts`
- Modify: `config.example.yml`

- [ ] **Step 1: Write registration tests**

Assert the registry exposes the `host`, `storage`, `service`, `route.public`, `notify.ntfy`, and `notify.apprise` kinds. Assert migrations seed exactly these disabled, independently configurable IDs: `host:gospel`, `host:barnabas`, `host:mettool`, `host:bubblecrab`, `host:stormeagle`, `host:frostwalrus`, `storage:eddy`, `storage:barnabas`, `service:hermes`, `service:flancommand`, `service:disc-steward`, `service:workspace`, `service:jellyfin`, `service:paperless`, `service:frigate`, `service:open-webui`, `service:home-assistant`, `notify.ntfy`, and `notify.apprise`. Assert public routes are user-named rather than pre-seeded.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/server/modules/v1Instances.test.ts`

Expected: FAIL until the complete v1 catalog is registered.

- [ ] **Step 3: Seed disabled instances without network assumptions**

Add those six hosts, two storage instances, nine named services, and both notification instances as disabled SQLite records with empty resources/config. Do not hard-code hostnames, IPs, mount paths, endpoints, or credentials. The setup wizard fills them in.

- [ ] **Step 4: Register definitions and resource defaults**

Ensure host/service instances have a `default` resource after setup, storage accepts multiple configured resources, and every status/event/action uses the instance/resource IDs. Keep public routes as user-created `route.public` instances.

- [ ] **Step 5: Document the starting configuration**

Add comments to `config.example.yml` pointing operators to the module setup wizard. Do not put service credentials, secret values, or assumed network addresses in the example.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/server/modules/v1Instances.test.ts tests/server/modules/definitions.test.ts && npm run lint`

Expected: PASS.

```bash
git add src/server/db/migrations.ts src/server/modules src/server/modules/definitions tests/server/modules/v1Instances.test.ts config.example.yml
git commit -m "feat: register homelab cockpit modules"
```

### Task 13: Finish public snapshot compatibility and Docker deployment

**Files:**
- Modify: `src/server/routes/public.ts`
- Modify: `src/server/cache/publicSnapshot.ts`
- Modify: `src/server/jobs/scheduler.ts`
- Modify: `src/server/index.ts`
- Modify: `Dockerfile`
- Modify: `docker-compose.example.yml`
- Modify: `README.md`
- Create: `tests/server/startup.test.ts`

- [ ] **Step 1: Write startup and compatibility tests**

Cover a clean empty `/data` volume, an existing `/config/homepage.yml`, a failed SQLite migration, a failed database read with last snapshot fallback, and a YAML save invalidating the snapshot fingerprint. During failed migration, assert scheduler checks do not start, YAML reads and the editor remain available, all YAML/module/action writes are rejected as read-only, and a later process start retries migration. Verify legacy weather/monitor jobs remain available.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/server/startup.test.ts tests/server/publicSnapshot.test.ts tests/server/routes.test.ts`

Expected: FAIL until startup/fallback behavior is wired.

- [ ] **Step 3: Implement additive snapshot and startup behavior**

Keep existing snapshot fields and add module/attention fields. Make `buildApp()` start in read-only degraded mode when migrations fail, keep bookmarks/editor view available, prevent scheduler checks from starting, reject YAML/module/action writes, and retry migration on the next process start.

- [ ] **Step 4: Update the container and Compose example**

Use Node 24 in all Docker stages. Mount one writable `/data` volume, set `COCKPIT_DATA_DIR=/data`, add the health check, and expose port 3000 only to the attached reverse-proxy network with `expose`, not a published host `ports` entry. Document a separate local-only override for direct port testing with `COCKPIT_TRUST_PROXY=false`; never publish the app port while proxy identity trust is enabled. Do not add Docker socket or host mounts.

- [ ] **Step 5: Update README installation and module guide**

Document:

- build/run commands;
- `/data` and existing `/config` compatibility;
- Cloudflare Access/private proxy requirements;
- `COCKPIT_PUBLIC_ORIGIN`, proxy CIDRs, identity header, and allowed secret refs;
- setup wizard flow;
- ntfy/Apprise references;
- one-page module addition checklist with definition, setup fields, status/resources, events, actions, links, dependencies, tests, and registration.

- [ ] **Step 6: Run build and commit**

Run: `npm run lint && npm run build && npm test -- tests/server/startup.test.ts tests/server/publicSnapshot.test.ts tests/server/routes.test.ts`

Expected: PASS and both `dist/` and `dist-server/` build successfully.

```bash
git add src/server/routes/public.ts src/server/cache/publicSnapshot.ts src/server/jobs/scheduler.ts src/server/index.ts Dockerfile docker-compose.example.yml README.md tests/server/startup.test.ts
git commit -m "docs: document cockpit deployment"
```

### Task 14: Add end-to-end release verification

**Files:**
- Modify: `tests/e2e/cockpit.spec.ts`
- Modify: `tests/e2e/module-setup.spec.ts`
- Modify: `tests/e2e/homepage-layout.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json` only if a dedicated verification script is needed.

- [ ] **Step 1: Write browser fixtures and assertions**

Use mocked `/api/public-snapshot`, module, details, and action endpoints to verify:

- bookmarks-first healthy default;
- no attention region when healthy;
- critical and warning attention rows when unhealthy;
- expandable details and direct service links;
- action confirmation and result feedback;
- setup wizard connection failure/success;
- desktop layout at `1365x768`;
- phone layout with stacked cards and no horizontal clipping;
- keyboard navigation and visible focus.

- [ ] **Step 2: Run the focused browser suite**

Run: `npm run test:e2e -- tests/e2e/cockpit.spec.ts tests/e2e/homepage-layout.spec.ts tests/e2e/module-setup.spec.ts`

Expected: PASS in desktop and mobile projects.

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
npm run lint
npm run build
npm test
npm run test:e2e
git diff --check
git status --short
```

Expected: all commands pass; `git status --short` contains only intentional final changes.

- [ ] **Step 4: Run a clean Docker verification**

Run:

```bash
set -euo pipefail
docker build -t bookmarks-homepage:cockpit .
check_dir="$(mktemp -d /tmp/flancockpit-docker-check.XXXXXX)"
empty_data="$check_dir/empty-data"
seeded_data="$check_dir/seeded-data"
seeded_config="$check_dir/config"
mkdir -p "$empty_data" "$seeded_data" "$seeded_config"
cp config.example.yml "$seeded_config/homepage.yml"
empty_name="flan-cockpit-check-empty-$$"
seeded_name="flan-cockpit-check-seeded-$$"
cleanup() {
  docker rm -f "$empty_name" "$seeded_name" >/dev/null 2>&1 || true
  rm -rf "$check_dir"
}
trap cleanup EXIT
check_container() {
  local name="$1" data_dir="$2" config_dir="${3:-}"
  local -a mounts=(-v "$data_dir:/data")
  if [[ -n "$config_dir" ]]; then mounts+=(-v "$config_dir:/config:ro"); fi
  docker run -d --name "$name" -p 0:3000 \
    -e COCKPIT_TRUST_PROXY=false -e COCKPIT_DATA_DIR=/data \
    "${mounts[@]}" bookmarks-homepage:cockpit >/dev/null
  local port
  port="$(docker port "$name" 3000/tcp | awk -F: '{print $NF}')"
  curl -fsS "http://127.0.0.1:$port/api/health"
}
check_container "$empty_name" "$empty_data"
check_container "$seeded_name" "$seeded_data" "$seeded_config"
```

Expected: both health checks return `{"ok":true}` or the documented degraded/read-only shape; one starts with an empty `/data` volume, one starts with the seeded `/config/homepage.yml`, and the trap removes both containers and temporary data even when a check fails.

- [ ] **Step 5: Commit the verification coverage**

```bash
git add tests/e2e/cockpit.spec.ts tests/e2e/module-setup.spec.ts tests/e2e/homepage-layout.spec.ts playwright.config.ts package.json
git commit -m "test: verify homelab cockpit flows"
```

## Execution notes

- Implement one task at a time and keep each commit small.
- Do not add future media, backup, topology, or audit modules during v1 work.
- Do not replace the existing homepage YAML or legacy widget APIs while additive compatibility is still under test.
- Do not expose secret values in fixtures, logs, snapshots, or documentation.
- Re-run the focused test after every task, then the full suite at the end.
- If a service-specific API is unavailable, ship the generic health connector and direct link; do not invent an integration protocol.
