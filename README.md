# Bookmarks Homepage

A fast, self-hosted bookmarks homepage with a server-backed configuration editor, cached widgets, monitor history, and scheduled bookmark health checks.

The app is designed to keep bookmarks available even when weather, Prometheus, Glances, or health-check targets are slow or unavailable. Browsers load one cached public snapshot, then open tabs poll the app for refreshed cached data.

## Docker

Build and run locally:

```bash
docker build -t bookmarks-homepage:local .
docker run --rm -p 3000:3000 -v "$(pwd)/config:/config" bookmarks-homepage:local
```

Or use the compose example:

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d
```

The `/config` volume stores `homepage.yml` and runtime cache files. Use the in-page editor to write shared settings back to that file so changes persist across browsers and machines.

## Configuration

On first start, the server creates `/config/homepage.yml` from the built-in defaults if the file does not already exist. A fuller starting point is available in `config.example.yml`.

Useful environment variables:

- `PORT`: HTTP port inside the container, default `3000`.
- `HOMEPAGE_CONFIG_DIR`: directory for config and cache files, default `/config`.
- `HOMEPAGE_CONFIG_PATH`: explicit config file path.
- `HOMEPAGE_CACHE_DIR`: explicit cache directory path.
- `HOMEPAGE_STATIC_DIR`: static client build directory, default `dist/client`.

## Deployment Notes

This app does not include authentication. It assumes access is controlled by your network or a proxy such as Cloudflare Zero Trust.

Server monitors are Prometheus-first. Configure `widgets.monitors.prometheusUrl`, `cpuQuery`, and `ramQuery` when your Prometheus stack already has the metrics. Glances remains available per monitor by setting the monitor source to `glances` and providing `glancesUrl`.

Bookmark status checks run on the backend schedule and are cached separately from config. Each bookmark can use the main link, an optional custom health URL and method, or health checks can be disabled for services that should not be probed.

The browser address bar behavior is intentionally outside the core web app. Browsers generally do not allow a served page to clear and focus the address bar; handle that separately with browser new-tab settings or an extension.
