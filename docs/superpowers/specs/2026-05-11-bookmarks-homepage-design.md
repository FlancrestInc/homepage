# Bookmarks Homepage Design

Date: 2026-05-11

## Goal

Build a lightweight standalone replacement for Homepage for use as a browser new-tab page. The app should keep the current icon-grid bookmark experience, add an integrated configuration editor, and provide a small set of glanceable widgets without letting widgets slow down or destabilize bookmark access.

Primary principles:

- Speed: bookmarks render as quickly as possible on every new tab.
- Reliability: bookmarks remain usable even when weather, monitors, status checks, or external services fail.
- Single-page desktop view: all content should fit without scrolling on normal desktop windows; mobile may scroll.
- Consistency: bookmark and group placement should remain stable between page loads unless the user changes layout/config.

## Scope

In scope:

- Standalone Dockerized app.
- Homepage-like bookmark groups and icon buttons.
- Built-in side-drawer configuration editor.
- Local server-side config file persistence.
- Theme/style configuration.
- Time and weather widgets.
- Server monitor widgets with CPU/RAM history line graphs.
- Prometheus-first monitor history with Glances fallback.
- Scheduled bookmark health checks with status outlines.
- Live refresh for open tabs using cached backend data.

Out of scope for the first implementation:

- Browser address-bar clearing/focus. Normal webpages cannot reliably control the browser address bar for security reasons. This should be handled separately, likely with a browser extension or browser-specific new-tab configuration.
- Built-in authentication. Deployment assumes external access control such as Cloudflare Zero Trust.
- Reimplementing Homepage's broader service/widget catalog.

## Runtime Architecture

The app will run as a single Docker container with three responsibilities:

1. Serve the frontend and static assets.
2. Provide a small local API for config editing and cached widget/status data.
3. Run background jobs for weather refreshes, monitor snapshots, and bookmark health checks.

The homepage render path is static-first:

1. Browser loads the frontend app shell.
2. App immediately loads a small cached public snapshot containing bookmarks, groups, layout, theme, and latest widget/status values.
3. Bookmarks render first from that snapshot.
4. Widgets render only from cached values.
5. After initial render, the frontend periodically asks the local API for refreshed cached widget/status snapshots.

The browser must not call Prometheus, Glances, weather providers, or service health endpoints directly during page load. Slow or flaky dependencies are handled by backend background jobs.

Time is updated locally in the browser after load. Weather, monitor graphs, and bookmark statuses are refreshed in open tabs by polling the app API for already-cached backend snapshots.

## Persistence

Configuration is stored in a local file mounted into the container, for example:

- `/config/homepage.yml`

The API validates config changes and saves them atomically:

1. Validate edited config.
2. Write to a temporary file.
3. Rename into place.
4. Keep a timestamped backup of the previous config.
5. Reject invalid saves without replacing the active config.

Runtime cache files are separate from the canonical config. Cache files store generated public snapshots, widget data, monitor history, weather data, and bookmark health results.

## Layout

The default layout follows the approved "Direction A" mockup:

- A compact widget band at the top.
- Widget row 1 contains date/time and weather.
- Widget row 2 contains server monitor cards.
- Widget row 3 is optional and appears when additional monitors need to wrap.
- Bookmark groups fill the rest of the page.
- A small editor button sits in a bottom corner, defaulting to bottom-right.

Bookmark layout rules:

- Groups render in configured order.
- Bookmarks render in configured order within each group.
- Groups use compact icon grids.
- Group sizing adapts to bookmark count and available space.
- Optional layout hints can control preferred group width, column count, or placement.
- Desktop layout should avoid scrolling where practical; mobile may scroll.

Bookmark buttons:

- Show the configured icon by default.
- Show the configured name on hover/focus.
- Use a subtle status outline.
- Use a pulsing red outline for down services.
- Allow per-bookmark health checks to be disabled.

## Configuration Editor

The editor is a side drawer opened from the bottom-corner button. It overlays the homepage so changes can be made without leaving the page context.

Editor sections:

- Bookmarks and groups.
- Widgets: time, weather, monitors.
- Theme/style.
- Health-check defaults.
- Import/export/raw config.

Bookmark fields:

- Name.
- Group.
- Icon.
- Link.
- Optional health-check URL.
- Health-check method.
- Optional headers.
- Expected status codes.
- Check interval override.
- Disable health check.

Icon support should preserve Homepage familiarity:

- Homepage-style icon strings.
- Searchable MDI icon picker.
- Searchable Simple Icons picker.
- Manual icon string input.
- URL icons.
- Local file/path icons.
- Preview before save.

The editor writes through the local API to the server-side config file. No app-level authentication is required.

## Widgets

### Time

The time widget runs client-side after initial render. Config controls:

- Date visibility.
- Time format.
- Seconds visibility.
- 12/24-hour mode.
- Timezone and timezone label behavior.

### Weather

Weather is backend-cached. Config controls:

- Provider.
- Location.
- Units.
- Display style.
- Refresh interval.

If weather data is missing or stale, the widget should degrade quietly and never block bookmarks.

### Server Monitors

Server monitors use Prometheus first because the user's Prometheus stack already collects historical metrics. This avoids making the homepage app a new time-series collector.

Each monitor defines:

- Server name.
- Source, defaulting to Prometheus.
- CPU percent-used query.
- RAM percent-used query.
- Optional disk/current-value queries.
- Enabled/disabled state.
- Optional card density/layout settings.

Monitor cards display:

- Server name.
- Current CPU percent used.
- Current RAM percent used.
- Cached CPU/RAM history as line graphs.
- "Stats as of" timestamp.

Global monitor settings:

- Prometheus base URL.
- Default history window.
- Default sample interval.
- Default refresh interval for cache updates.

Glances remains a fallback source for monitors that are not represented in Prometheus. If Glances history is needed, the backend scheduler can sample Glances on a configured interval and write the app's own cache.

## Bookmark Health Checks

Health checks are performed by backend background jobs, not by the browser.

Default behavior:

- Check the bookmark's main link.
- Use the global default interval.
- Use global timeout and expected status defaults.

Per-bookmark overrides:

- Custom health-check URL.
- HTTP method.
- Headers.
- Expected status codes.
- Check interval.
- Disable health check.

Health results are cached separately from config. The frontend periodically refreshes cached health status while a tab is open.

## Theming

The editor should support:

- Light/dark mode.
- Theme colors.
- Accent color.
- Background color.
- Background image.
- Bookmark button styling.
- Widget styling.

Theme settings must preserve readability and avoid layout shift. Visual changes should be reflected by preview where practical.

## Failure Modes

Bookmarks are the priority path.

- Missing widget cache: render bookmarks and show empty/stale widgets.
- Failed weather refresh: keep previous good weather snapshot with stale metadata.
- Failed Prometheus/Glances refresh: keep previous monitor snapshot with stale metadata.
- Failed health check job: keep previous status and expose error metadata.
- Invalid config save: reject the save, keep current config active, and show validation errors in the editor.
- Broken icon URL: show fallback icon/initial without blocking layout.

Snapshots should include:

- `updatedAt`.
- `staleAfter`.
- Optional error metadata.

## Proposed Config Shape

YAML is the preferred canonical format because it is human-readable and editor-friendly.

Example:

```yaml
theme:
  mode: dark
  accentColor: "#72a6ff"
  background:
    type: color
    value: "#1d2a3b"

layout:
  editorButton: bottom-right
  groups:
    - name: Common
      order: 1
    - name: Self-Hosting
      order: 2

bookmarks:
  - name: Grafana
    group: Self-Hosting
    icon: si-grafana
    url: https://grafana.example.com
    health:
      mode: default

widgets:
  time:
    enabled: true
    format: "MMM d, yyyy h:mm a"
  weather:
    enabled: true
    provider: open-meteo
    location: Pleasant Grove, UT
    units: imperial
  monitors:
    source: prometheus
    historyWindow: 6h
    sampleInterval: 5m
    servers:
      - name: Barnabas
        cpuQuery: '100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle", instance="barnabas"}[5m])) * 100)'
        ramQuery: '(1 - (node_memory_MemAvailable_bytes{instance="barnabas"} / node_memory_MemTotal_bytes{instance="barnabas"})) * 100'

healthChecks:
  defaultInterval: 5m
  timeout: 5s
```

## Testing Strategy

Testing should protect the fast and reliable new-tab workflow:

- Config validation.
- Atomic save and backup behavior.
- Bookmark/group ordering.
- Public snapshot generation.
- Health-check scheduling and overrides.
- Prometheus query/cache behavior with mocked responses.
- Glances fallback behavior with mocked responses.
- Weather cache behavior with mocked responses.
- UI rendering when widget data is missing, stale, or failed.
- Editor save flows.
- Responsive layout checks for desktop and mobile.

Implementation should include visual verification with screenshots for the main desktop layout, the editor drawer, and mobile behavior.

## Open Implementation Decisions

These should be resolved during implementation planning:

- Backend/frontend stack choice.
- Exact config schema validation library.
- Exact icon package/source strategy for MDI and Simple Icons.
- Whether initial release supports JSON import/export or only YAML.
- Default weather provider.
- Default Prometheus query templates.
