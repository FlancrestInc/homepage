# Bookmarks Homepage

A fast, self-hosted bookmarks homepage with a server-backed configuration editor, cached widgets, monitor history, scheduled health checks, and an optional homelab cockpit.

The app is designed to keep bookmarks available even when weather, Prometheus, Glances, or health-check targets are slow or unavailable. Browsers load one cached public snapshot, then open tabs poll the app for refreshed cached data.

## Docker

Build and run locally:

```bash
docker build -t bookmarks-homepage:local .
docker run --rm -p 3000:3000 \
  -e HOMEPAGE_AUTH_USER=admin \
  -e HOMEPAGE_AUTH_PASSWORD=change-me \
  -v "$(pwd)/config:/config" bookmarks-homepage:local
```

Or use the compose example:

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d
```

The Compose example uses one `/data` volume for `homepage.yml`, the cockpit SQLite state, and runtime caches. Existing deployments using `/config/homepage.yml` remain supported; the cockpit database is created beside that file unless `COCKPIT_DATA_DIR` or `COCKPIT_DB_PATH` is set. Use the in-page editor to write shared settings back to the homepage file so changes persist across browsers and machines.

## Configuration

On first start, the server creates `/config/homepage.yml` from the built-in defaults if the file does not already exist. A fuller starting point is available in `config.example.yml`.

Useful environment variables:

- `PORT`: HTTP port inside the container, default `3000`.
- `HOMEPAGE_CONFIG_DIR`: directory for config and cache files, default `/config`.
- `HOMEPAGE_CONFIG_PATH`: explicit config file path.
- `HOMEPAGE_CACHE_DIR`: explicit cache directory path.
- `HOMEPAGE_STATIC_DIR`: static client build directory, default `dist/client`.
- `HOMEPAGE_AUTH_USER` and `HOMEPAGE_AUTH_PASSWORD`: enable built-in HTTP Basic authentication.
- `COCKPIT_DATA_DIR` and `COCKPIT_DB_PATH`: choose the SQLite state location; the explicit database path wins.
- `COCKPIT_TRUST_PROXY`, `COCKPIT_PUBLIC_ORIGIN`, `COCKPIT_TRUSTED_PROXY_CIDRS`, and `COCKPIT_IDENTITY_HEADER`: enable verified reverse-proxy identity for module setup, acknowledgements, and actions.
- `COCKPIT_ALLOWED_SECRET_REFS`: comma-separated `env:NAME` or `docker:NAME` references allowed for connector secrets.
- `COCKPIT_DOCKER_SECRETS_DIR`: Docker secret directory, default `/run/secrets`.
- `COCKPIT_SSH_ALLOWLIST`: comma-separated `alias=host` entries for the fixed read-only SSH collectors.

## Deployment Notes

Access control is required. The Docker examples enable built-in HTTP Basic authentication through `HOMEPAGE_AUTH_USER` and `HOMEPAGE_AUTH_PASSWORD`; replace the example password before use. Alternatively, put the app behind an authenticated reverse proxy such as Cloudflare Zero Trust and omit the built-in credentials. The health endpoint remains available without credentials for container probes.

Server monitors are Prometheus-first. Configure `widgets.monitors.prometheusUrl`, `cpuQuery`, and `ramQuery` when your Prometheus stack already has the metrics. Glances remains available per monitor by setting the monitor source to `glances` and providing `glancesUrl`.

Open Settings → Services to configure the v1 cockpit modules. It supports host, storage, service, public-route, ntfy, and Apprise connectors. Modules are disabled until they pass a connection test; status is collected on the server and presented in the attention panel and expandable status cards. Secrets are entered as references such as `env:MY_TOKEN` or `docker:my-token`, never as literal values.

State-changing settings and module operations require either built-in Basic Auth or a verified proxy identity. When using Cloudflare Access, set `COCKPIT_TRUST_PROXY=true`, the public origin, the proxy CIDRs, and the identity header, and do not publish the container directly outside that proxy.

Bookmark status checks run on the backend schedule and are cached separately from config. Each bookmark can use the main link, an optional custom health URL and method, or health checks can be disabled for services that should not be probed.

The browser address bar behavior is intentionally outside the core web app. Browsers generally do not allow a served page to clear and focus the address bar; handle that separately with browser new-tab settings or an extension.
