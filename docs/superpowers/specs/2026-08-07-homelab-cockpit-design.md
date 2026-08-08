# Homelab Cockpit Design

Date: 2026-08-07
Status: Approved for implementation planning
Starting point: `github.com/FlancrestInc/homepage`

## Goal

Turn the existing bookmarks homepage into a personal homelab cockpit. The cockpit keeps the fast bookmark experience as its default state, then adds a compact operational summary that expands into service details, safe controls, alerts, and direct links.

The first release must cover the known Flancrest network and remain easy to run as one Docker container. Future capabilities must be addable as standardized in-repository modules without creating a second orchestration platform.

## User and operating context

The primary user is the homelab operator checking the cockpit from a desktop browser, with a usable phone view for quick checks. The operator wants an answer to “what needs my attention?” before reading service details or opening logs.

The cockpit is protected by Cloudflare Access or another private-network boundary. It does not add a second login system in v1.

## Product principles

- Bookmarks remain useful when every integration is unavailable.
- Attention items are visible only when there is an actionable problem.
- Details and controls are progressive: glanceable first, expandable second.
- Existing services remain the source of truth. The cockpit observes and calls them; it does not replace them.
- One connector failure cannot block the rest of the page.
- Secrets are supplied by Docker secrets or environment variables, never stored as plaintext application data.
- New modules use one contract and common persistence, alerting, and action handling.
- No arbitrary runtime plugins, Docker socket, host filesystem mount, or new agent fleet is required for v1.

## Scope

### V1 first-class modules

#### Hosts

- Gospel
- Barnabas
- Mettool
- Bubblecrab
- Stormeagle
- Frostwalrus

Each host module reports reachability, last successful check, available CPU/RAM data, and a direct host link when one exists. Host data comes from configured existing APIs, Prometheus/Glances, or a fixed SSH adapter when necessary.

#### Storage

- Eddy mounts and shares
- Barnabas mounts and shares

Storage modules report mounted state, read/write state when detectable, capacity, free space, last successful check, and stale-data conditions. They may emit attention events and support refresh/retry/acknowledge actions. They do not repair or remount storage automatically in v1.

#### Services

- Hermes
- FlanCommand
- Disc Steward
- Workspace
- Jellyfin
- Paperless
- Frigate
- Open WebUI
- Home Assistant

Each service can configure a base URL, health endpoint, optional API integration, secret references, timeout, stale threshold, and direct service link. Details and actions are shown only when the connector supports them.

#### Public routes

The public-route module checks configured Cloudflare/public URLs for reachability, status code, latency, and TLS certificate validity/expiry where available. It provides route links and attention events. Account-level Cloudflare API inventory is not required for v1.

#### Existing homepage

The existing bookmark groups, icons, links, theme, and editor remain available. First-class modules may also be exposed as bookmark links. Unconnected services remain ordinary bookmarks.

### Future modules

The module contract must support, but v1 does not implement:

- security and homelab audit results and recommendations
- broader homelab health scoring
- Hermes/Telegram workflow notifications
- Disc Steward completion, stalled-job, and failed-review events
- FileFlows/Jellyfin processing events
- mount recovery/failure workflows
- media pipeline job and recovery views
- Paperless/photo/music share relationships
- backup and disaster-recovery inventory and restore procedures
- mDNS discovery, host/IP/interface inventory, and topology graphs

These are separate modules or module groups, not hidden requirements inside the v1 connectors.

## Main cockpit experience

The page has two states:

### Healthy default

- Existing bookmarks remain the main visual content.
- A compact information band shows hosts, mounts, services, and public routes.
- The attention region is hidden when there are no open actionable events.
- Sections expand inline or in a detail panel without navigating away.
- Each section can expose service links, metrics, recent checks, and supported controls.

### Attention state

- A conditional attention region appears above the information band.
- It groups open issues by severity and shows owner module, resource, evidence, age, and next action.
- Each item links to the relevant detail view or service.
- Acknowledge removes an issue from the active list but keeps it in history.
- Recovery closes the issue and sends a recovery notification when a notification transport is enabled.

The page remains useful at phone widths. Desktop is the primary layout; cards stack and detail panels become full-width on small screens.

## Architecture

Keep the fork’s current single-container architecture:

- Fastify serves the API and built frontend.
- React renders the cockpit.
- A backend scheduler performs connector checks.
- SQLite stores connector configuration, runtime state, events, acknowledgements, action records, and notification delivery state.
- The existing homepage YAML remains the canonical source for bookmarks, theme, and layout.
- A cached public snapshot keeps the browser render path fast.

The persistent volume is mounted at `/data`. `HOMEPAGE_CONFIG_PATH` and `HOMEPAGE_CACHE_DIR` remain supported, so an existing deployment using `/config/homepage.yml` can keep that path while adding the SQLite database beside it. A fresh Compose example uses `/data/homepage.yml`, `/data/cockpit.db`, and `/data/cache/`.

Path precedence is explicit: `COCKPIT_DB_PATH` wins; otherwise the database is `${COCKPIT_DATA_DIR}/cockpit.db` when `COCKPIT_DATA_DIR` is set; otherwise it is next to `HOMEPAGE_CONFIG_PATH`. `HOMEPAGE_CACHE_DIR` controls the cache independently. The example container sets `COCKPIT_DATA_DIR=/data` and mounts one writable volume at `/data`.

The browser never calls Prometheus, Glances, service APIs, SSH, or public routes directly.

```text
React browser
  -> cached public snapshot API
  -> Fastify module/action APIs
  -> module runner
  -> existing service APIs, Prometheus/Glances, SSH, and public URLs

module results
  -> SQLite state and event history
  -> attention aggregator
  -> ntfy/Apprise dispatcher
  -> cached public snapshot
```

The implementation should reuse the fork’s existing `App`, `BookmarkGrid`, editor, Fastify route registration, cache, scheduler, Dockerfile, and test setup. The current weather/monitor widget path becomes the first generalized module-snapshot path instead of a separate architecture.

## Module contract

Modules are in-repository adapters. They are registered in code and are not downloaded or executed dynamically.

Each module definition provides:

```ts
{
  kind,
  name,
  category,
  version,
  setupSchema,
  secretRefs,
  testConnection(config),
  getStatus(config),
  getDetails?(config),
  actions?,
  events?,
  links?,
  dependencies?
}
```

The runner calls definitions with one consistent context:

```ts
type ConnectorContext = {
  instanceId: string;
  signal: AbortSignal;
  now: Date;
  resolveSecret(ref: string): Promise<string>;
  request: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type SetupField = {
  key: string;
  type: "text" | "url" | "number" | "boolean" | "select" | "secretRef";
  required: boolean;
  options?: string[];
};
type SetupSchema = { fields: SetupField[] };
type ActionDefinition = { id: string; label: string; requiresConfirmation: boolean; inputSchema?: SetupSchema };
type EventDefinition = {
  id: string;
  severity: "warning" | "critical";
  title: string;
  openWhen: "status_not_healthy" | "field_error" | "threshold" | "custom";
  field?: string;
  threshold?: number;
  nextAction?: string;
  reminderInterval?: string;
};
type LinkDefinition = { id: string; label: string; url: string };
type DependencyDefinition = { type: "host" | "mount" | "route" | "service"; instanceId: string; resourceId?: string };

type ModuleDefinition = {
  kind: string;
  name: string;
  version: string;
  setupSchema: SetupSchema;
  secretFields: string[];
  actions: ActionDefinition[];
  events: EventDefinition[];
  links: LinkDefinition[];
  dependencies: DependencyDefinition[];
  testConnection(context: ConnectorContext, config: unknown, secretRefs: Record<string, string>): Promise<TestResult>;
  getStatus(context: ConnectorContext, resourceId: string, config: unknown, secretRefs: Record<string, string>): Promise<StatusResult>;
  getDetails?(context: ConnectorContext, resourceId: string, config: unknown, secretRefs: Record<string, string>): Promise<JsonValue>;
  executeAction?(context: ConnectorContext, action: string, resourceId: string, input: JsonValue, config: unknown, secretRefs: Record<string, string>): Promise<ActionResult>;
};
```

`testConnection` receives the same config and secret-reference shape as the API. It is never allowed to write module state. `executeAction` is called only after the common action gate has checked identity, confirmation, idempotency, and capability.

Definitions are reusable code. A configured network object is a `ModuleInstance`:

```ts
type ModuleInstance = {
  instanceId: string;
  kind: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  secretRefs: Record<string, string>;
  resources: Array<{ resourceId: string; name: string }>;
};

type TestResult = {
  ok: boolean;
  status: ModuleStatus;
  message: string;
  evidence: Record<string, string | number | boolean | null>;
  testId: string;
  configFingerprint: string;
  expiresAt: string;
};

type ActionResult = {
  status: "succeeded" | "failed" | "pending";
  message: string;
  evidence?: Record<string, string | number | boolean | null>;
};
```

One definition can have many instances. For example, `route.public` can have `route.public:jellyfin` and `route.public:flancommand`, and `storage.barnabas` can contain multiple configured mount resources. The user chooses the instance name in the setup wizard. `kind` identifies code; `instanceId` identifies the configured resource.

The concrete v1 connector inputs are intentionally small:

| Module family | Required setup | Default collection | V1 actions | V1 events |
| --- | --- | --- | --- | --- |
| Host | name, health URL or metrics source, optional direct link | HTTP reachability; optional Prometheus/Glances CPU/RAM; fixed read-only SSH collector when selected | refresh, acknowledge; restart only when the adapter has a reviewed existing API | unreachable, stale metrics |
| Storage | host, mount/share identifier, source (`http`, `prometheus`, or fixed read-only `ssh`), optional capacity path/query | mounted/read-write state and capacity from the selected existing source | refresh, retry, acknowledge | unavailable, read-only, capacity threshold, stale data |
| Service | base URL, health URL, expected statuses, optional API and secret references | HTTP health check | refresh, acknowledge, retry, and connector-specific restart when supported | health failure, stale status |
| Public route | public URL, expected statuses, optional certificate check | HTTP status, latency, and TLS metadata | refresh, acknowledge | route failure, certificate warning |
| Notification transport | ntfy topic or Apprise URL reference | delivery test and delivery result | test delivery, enable/disable | delivery failure |

URLs, hostnames, mount identifiers, Prometheus queries, and SSH target names are entered through the setup wizard because they are network-specific. No hostname or path is hard-coded into the module implementation. Generic HTTP service modules are sufficient until a service-specific API is configured.

Stable kinds use lowercase dotted names: `host`, `storage`, `service`, `route.public`, `notify.ntfy`, and `notify.apprise`. The seeded v1 instance IDs are `host:gospel`, `host:barnabas`, `host:mettool`, `host:bubblecrab`, `host:stormeagle`, `host:frostwalrus`, `storage:eddy`, `storage:barnabas`, `service:hermes`, `service:flancommand`, `service:disc-steward`, `service:workspace`, `service:jellyfin`, `service:paperless`, `service:frigate`, `service:open-webui`, `service:home-assistant`, `notify.ntfy`, and `notify.apprise`. Public-route instances are user-named instances of `route.public`. Disabled instances are not scheduled, do not emit attention events, and remain visible in setup as disabled.

Transport rules are fixed and shared:

- HTTP checks use `GET` by default, a configured expected-status list, a five-second default timeout, normal certificate verification, and at most five redirects. Redirect targets are recorded only as host/path metadata; authorization headers are not forwarded across hosts.
- Prometheus metrics require a base URL and one query per metric. Each query must return one numeric sample for the configured resource; zero, many, or non-numeric samples produce a field-level error.
- Glances metrics reuse the fork’s existing `src/server/integrations/glances.ts` adapter and configured `glancesUrl`; its tested response mapping remains the single source of truth. Missing numeric fields are reported as partial data.
- SSH uses a configured host alias from the server-side allowlist and a fixed command profile (`host-metrics-readonly` or `mount-state-readonly`). The wizard never accepts a command string.
- TLS verification cannot be disabled through the v1 setup wizard.

### Required behavior

- `setupSchema` drives the UI wizard and validates non-secret settings.
- `secretRefs` names Docker secret or environment-variable references. Values are resolved only on the server.
- `testConnection` proves the configured endpoint and credentials work without enabling polling.
- `getStatus` returns normalized health and evidence.
- `getDetails` is optional and returns module-specific metrics, queues, or dependency information.
- `actions` declares supported operations, confirmation level, and expected result shape.
- `events` declares conditions that open, remind, and recover attention items.
- `links` supplies direct service URLs.
- `dependencies` names related hosts, mounts, routes, and services.

The shared runner supplies timeout, retry, backoff, stale handling, logging, persistence, and redaction. A connector may use HTTP, an existing metrics endpoint, or a fixed reviewed SSH operation. It must not accept arbitrary shell commands from configuration or the browser.

Normalized status values are:

```ts
type ModuleStatus = "healthy" | "degraded" | "down" | "unknown";

type StatusResult = {
  instanceId: string;
  resourceId: string;
  status: ModuleStatus;
  checkedAt: string;
  lastSuccessAt: string | null;
  staleAt: string | null;
  freshness: "fresh" | "stale" | "never_succeeded";
  summary: string;
  fields: Array<{
    key: string;
    status: "healthy" | "degraded" | "unknown";
    value: string | number | boolean | null;
    error?: string;
  }>;
  evidence: Record<string, string | number | boolean | null>;
  error?: string;
};

type ModuleStatusResponse = {
  instanceId: string;
  status: ModuleStatus;
  resources: StatusResult[];
};
```

All connector errors are converted into this shape. `staleAt` is calculated from the last successful check plus the configured stale interval. A failed poll does not immediately erase the last good fields; it increments the persisted failure count, marks the result degraded while the cached result is fresh, and marks it stale after `staleAt`. A malformed response, missing metric, or invalid value is an error for that field and cannot make the whole module look healthy. `never_succeeded` is used until the first successful check.

## Server API

The cockpit exposes common endpoints rather than ad-hoc routes for each module:

```text
GET  /api/modules
POST /api/modules/test
POST /api/modules
PUT  /api/modules/:instanceId/config
GET  /api/modules/:instanceId/status
GET  /api/modules/:instanceId/details
POST /api/modules/:instanceId/actions/:action/prepare
POST /api/modules/:instanceId/actions/:action
GET  /api/actions/:actionId
GET  /api/attention
POST /api/attention/:eventId/acknowledge
GET  /api/events
```

Common request and response rules:

- `GET /api/modules` returns definitions plus instance state, never secret values.
- `POST /api/modules/test` accepts `{ kind, instanceId, config, secretRefs }`, does not persist module state, and returns `TestResult` with a ten-minute `testId` and config fingerprint. The server-side fingerprint covers normalized config, secret-reference names, and one-way digests of resolved secret values; it never exposes the values.
- `POST /api/modules` creates an instance only when it receives an unexpired `testId` whose fingerprint matches the submitted `{ kind, instanceId, config, secretRefs }`; `PUT /api/modules/:instanceId/config` uses the same test binding before enabling or changing a connector.
- `GET /api/modules/:instanceId/status` returns `ModuleStatusResponse` with one `StatusResult` per resource.
- `GET /api/modules/:instanceId/details` returns module-defined details or `409 details_unavailable` when the connector has no detail capability.
- `POST .../prepare` returns a short-lived confirmation token only for actions that require confirmation. Non-confirming actions skip preparation.
- `POST .../:action` accepts `{ resourceId, input, confirmationToken }`, requires an `Idempotency-Key` header, and returns `{ accepted, actionId, status, message }`. Repeating the same idempotency key returns the original action result without executing twice.
- `GET /api/actions/:actionId` returns the persisted action state, including `pending`, `succeeded`, or `failed`.
- `POST /api/attention/:eventId/acknowledge` requires an `Idempotency-Key`, records the acknowledgement in the action audit table, and returns the updated event state.
- Disabled modules return their saved redacted configuration state but have no status result until enabled and tested.
- Validation failures use `{ error: "invalid_request", issues: [...] }`; missing modules use `404 module_not_found`; unavailable capabilities use `409 capability_unavailable`.
- Secret values, raw authorization headers, and full SSH command output are never included in responses.

Existing bookmark/config and public-snapshot APIs remain compatible where practical. The UI setup wizard calls the module endpoints; normal page rendering consumes a single cached snapshot.

Compatibility is additive in v1:

- `/api/public-snapshot` keeps the fork’s existing `generatedAt`, `theme`, `layout`, `widgets`, and `groups` fields.
- New `modules`, `attention`, and `eventsSummary` fields are added without removing existing widget fields.
- `/api/config` continues to read and write the existing homepage YAML shape. Module configuration uses the new module endpoints and SQLite.
- Existing weather and monitor jobs continue to work until an explicit later migration replaces them with modules; an empty module database does not disable them.
- Existing cache files remain readable. New snapshots use versioned filenames and an atomic replace; an old cache is a valid fallback but is never interpreted as a new module result.
- A database read failure uses the last complete atomic public snapshot as a read-only fallback. If no snapshot exists, the server renders bookmarks and an empty module/attention state with degraded application health. A successful YAML write invalidates the public snapshot by changing its config fingerprint.

## Persistence and secrets

SQLite stores:

- module enablement and non-secret configuration
- normalized status snapshots
- detail snapshots where useful
- open and historical attention events
- notification delivery state and reminder timestamps
- action audit records
- schema/version migrations

The existing YAML file continues to store homepage bookmarks, theme, and layout. The application must not write secret values into YAML or SQLite.

Connector setup accepts Docker secret/environment-variable references and clearly tells the operator what needs to be supplied. The setup wizard tests the reference without displaying or logging its value.

Secret references have one of these forms:

```text
env:NAME
docker:NAME
```

`NAME` is an environment variable name matching `[A-Z][A-Z0-9_]{0,127}` or a Docker secret name matching `[A-Za-z0-9_.-]{1,128}` with no path separators. The module definition declares allowed secret field names, and production requires `COCKPIT_ALLOWED_SECRET_REFS` to list the exact permitted `env:NAME` and `docker:NAME` references. The server accepts only these prefixes, rejects literal secret fields and unknown references, resolves them only during a connector call, and returns `secret_missing` without naming the secret value when resolution fails. ntfy topics, Apprise URLs, URL userinfo, and URL query credentials are secret fields and must use references rather than literal values.

Redaction applies before persistence, logging, public snapshots, setup responses, detail responses, notifications, and action results. It removes configured secret values, authorization headers, query-string credentials, and raw SSH output. Evidence fields are allowlisted by connector; connectors cannot place arbitrary response bodies into the snapshot.

On startup, the database schema is migrated in a transaction before scheduled checks begin. A missing database is created. A migration failure leaves the existing YAML bookmark page and editor view available in read-only mode, reports a degraded application health result, disables config saves/module writes/actions, and exposes the migration error without secrets. Restarting after the volume is repaired retries the migration. Existing YAML and cache files are not moved or overwritten automatically.

## Attention and notification behavior

An event lifecycle is:

```text
healthy -> open -> acknowledged -> recovered
```

`acknowledged` is an operator state, not a recovery state. A still-failing condition may remain acknowledged in history while the active list reflects the configured acknowledgement behavior.

An attention event has this normalized shape:

```ts
type AttentionEvent = {
  eventId: string;
  eventKey: string;
  instanceId: string;
  resourceId: string;
  conditionId: string;
  severity: "warning" | "critical";
  state: "open" | "acknowledged" | "recovered";
  title: string;
  summary: string;
  evidence: Record<string, string | number | boolean | null>;
  openedAt: string;
  lastSeenAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  recoveredAt?: string;
  nextAction?: { label: string; action: string };
};
```

`eventKey` is the stable tuple `instanceId + resourceId + conditionId`. `eventId` identifies one incident and changes after recovery, so a later failure creates a new incident while preserving the same event key.

The default state rules are:

- two consecutive failed evaluations open an event after a connector has had at least one successful check
- one successful evaluation recovers an open event
- a still-failing acknowledged event stays out of the active list until it recovers; acknowledgement suppresses reminders but does not change the underlying status
- a never-successful connector remains setup-error/unknown in the UI and does not send operational notifications until its first successful check
- a default reminder is sent after one hour and then every six hours while open and not acknowledged; each module may override those intervals
- a recovery notification is sent once per event instance, including after an acknowledged event recovers

These defaults prevent a single transient poll failure or a flapping service from producing repeated alerts.

Notifications use ntfy and/or Apprise in v1:

- send on an issue transition to open
- send reminders while an issue remains open and unacknowledged
- send on recovery
- deduplicate by `transportId + eventId + phase`; recovery creates a new incident ID after a later failure, so a new open notification is not suppressed
- include age, evidence, and cockpit/service links
- never notify on every failed poll

The notification dispatcher is transport-neutral so Hermes/Telegram can be added later without changing module event producers.

## Actions and safety

Actions are capability-based. The UI renders only actions returned by the configured module.

V1 supports, where the existing service exposes them:

- retry
- refresh
- acknowledge
- restart

Restart requires explicit confirmation. Every action records the trusted external identity, module, target, action, request time, result, and error details safe for display. The cockpit does not expose arbitrary shell execution, Docker control, host filesystem access, or automatic mount repair in v1.

Confirming an action creates a short-lived, single-use token bound to the trusted identity, instance, resource, action, and current connector configuration version. The database stores only a hash of the token, and it expires after five minutes. Idempotency keys are scoped to `identity + instanceId + resourceId + action`; reusing a key with a different request body returns `409 idempotency_conflict`, while an exact replay returns the original result without re-executing the external operation. A per-resource action lock prevents concurrent execution of the same action. If the process crashes or an external call times out after dispatch, the action becomes `unknown` and is not retried automatically. Restart is disabled by default per instance and must be explicitly enabled in its connector configuration.

The deployment trusts an identity header only when `COCKPIT_TRUST_PROXY=true`, `COCKPIT_PUBLIC_ORIGIN` is set, and the request source is in `COCKPIT_TRUSTED_PROXY_CIDRS`. The header name is configured by `COCKPIT_IDENTITY_HEADER` and defaults to the Cloudflare Access identity header. The reverse proxy must strip that header from incoming client requests and add its verified value; the container must not be directly published outside the trusted network. All state-changing requests require a trusted identity and a same-origin `Origin` header matching `COCKPIT_PUBLIC_ORIGIN`; the API does not enable cross-origin writes. If either check fails, setup writes, acknowledgements, notifications, and actions are rejected. There is no role hierarchy in v1: any identity admitted by the protected route may use the enabled safe actions. Error strings and audit fields pass through a redaction helper before logging or persistence.

## Failure behavior

- Bookmarks render when all integrations fail.
- A failed check preserves the last good result and marks it stale.
- A connector with no successful check is `unknown`, never healthy by default.
- Each connector has an independent timeout.
- Defaults are a 60-second poll interval, 5-second request timeout, stale after 180 seconds from the last successful check, and a six-check global concurrency cap. Modules may override interval from 15 seconds to 24 hours, timeout from 1 to 30 seconds, and stale threshold from one to 24 intervals. Elapsed `staleAt` is authoritative; missed-interval counts only control failure/open thresholds.
- Polling uses one retry after five seconds and then waits for the next scheduled check. A malformed response or missing metric produces a degraded/unknown field rather than an exception that stops the scheduler.
- Fixed SSH collectors use non-interactive connections, configured host allowlists, read-only command allowlists, and bounded output/timeouts. User-supplied commands are rejected.
- The scheduler permits one active check per instance, aborts in-flight requests on shutdown, persists failure counters and last-success timestamps, and resumes from those values after restart.
- Manual refreshes use the same global concurrency cap and per-instance lock. When the scheduler is stopped, wall-clock freshness still moves to stale, but no new events or notifications are emitted until a check runs.
- Public snapshots are built from one SQLite read transaction and published with an atomic file replace, so the browser sees either the previous complete snapshot or the next complete snapshot.
- One connector cannot block another connector or the public snapshot.
- Action failures show the returned reason and remain auditable.
- Notification failures do not change the underlying service status or block the UI.
- Invalid setup leaves the previous working configuration active.

## Setup and deployment

The production artifact remains one Docker container with one persistent `/data` volume. It needs network access to configured services and routes, but no host mounts, Docker socket, or agent installation.

First-run flow:

1. Start the container with the existing Compose pattern.
2. Open it through Cloudflare Access or a private network.
3. See the existing bookmarks immediately.
4. Open **Connect services**.
5. Select a module and complete its setup wizard.
6. Test the connection.
7. Save and enable it.
8. Configure ntfy and/or Apprise using the same flow.

The example Compose deployment must document the `/data` volume, network requirements, secret references, health check, external-auth assumption, trusted proxy CIDRs, public origin, and the rule that the app port is not directly exposed when proxy identity trust is enabled.

## Verification

Unit and API tests must cover:

- module setup validation and connection tests
- status normalization and stale handling
- event open/reminder/recovery behavior
- notification deduplication
- action capability and confirmation rules
- action audit records
- SQLite persistence and migrations
- public snapshot isolation when a connector fails

Playwright coverage must verify:

- bookmarks-first loading
- hidden attention region when healthy
- visible attention region when an issue opens
- expandable details and direct links
- action confirmation and result feedback
- desktop and phone layouts
- setup wizard validation and connection failure feedback

The build must also verify a clean Docker startup with an empty data volume and a seeded existing homepage config.

Fixtures must include a healthy response, timeout, HTTP 500, malformed JSON, missing metric, stale cached result, action timeout, duplicate notification, recovery, and migration from a database-free existing homepage. Notification tests use fake ntfy/Apprise transports and assert exact open/reminder/recovery counts.

Security fixtures must include a valid proxy identity, an untrusted identity header, a request from an untrusted proxy CIDR, missing trusted identity, wrong-origin write, missing/unknown secret reference, literal secret rejection, secret leakage attempts in evidence and URLs, confirmation-token replay, concurrent action requests, idempotency-key replay/conflict, and an action crash/timeout after dispatch. Multi-instance fixtures must cover two public routes, two storage resources, disabled instances, and a never-successful instance. Scheduler fixtures must cover overlapping intervals, manual refresh contention, shutdown cancellation, persisted failure counters, scheduler-stop freshness, recovery followed by a new failure, and atomic snapshot replacement. Migration fixtures must cover a failed migration with the bookmark editor in read-only mode and a later successful retry.

## Incremental delivery

1. Preserve the fork baseline and establish migrations, module instances, auth/CSRF checks, secret resolution, redaction, snapshot publication, and API error seams.
2. Ship one vertical pilot slice: one generic host connector, one storage connector, and one generic service connector through setup, status, details, attention, and tests.
3. Add the remaining host, storage, service, and public-route instances using the proven connector definitions.
4. Add capability-based actions, confirmation tokens, idempotency, and action audit records.
5. Add ntfy/Apprise delivery and reminder/recovery handling.
6. Add setup documentation, Docker verification, and desktop/mobile end-to-end coverage.

Future features should be shipped as separate module slices using the same contract. Media pipelines, backup inventory, topology discovery, audits, and Hermes/Telegram workflows should not be pulled into the v1 implementation merely because the contract supports them.

## Acceptance criteria

The design is ready for implementation when:

- a fresh container still behaves like the existing bookmarks homepage before connectors are configured
- each v1 module can be connected through a wizard and tested independently
- the cockpit hides attention content when healthy and shows actionable open events when unhealthy
- stale and unknown states are visible and never misreported as healthy
- supported safe actions are capability-driven and audited
- ntfy/Apprise notify on transitions, reminders, and recovery without poll spam
- secrets remain outside SQLite and YAML
- one failing service cannot block the page or other modules
- the container runs without Docker socket, host mounts, sidecars, or agents
- a contract conformance test proves a new module can register setup, status, optional details, actions, events, links, and dependencies without adding bespoke persistence or notification code
