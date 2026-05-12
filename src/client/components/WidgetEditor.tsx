import { Plus, Trash2 } from "lucide-react";
import type { AppConfig, MonitorServerConfig } from "../types";

type WidgetEditorProps = {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
};

const defaultServer: MonitorServerConfig = {
  name: "New server",
  enabled: true
};

export function WidgetEditor({ config, onChange }: WidgetEditorProps) {
  const widgets = config.widgets;
  const monitors = widgets.monitors;

  function updateWidgets(nextWidgets: AppConfig["widgets"]) {
    onChange({ ...config, widgets: nextWidgets });
  }

  function updateServer(index: number, server: MonitorServerConfig) {
    updateWidgets({
      ...widgets,
      monitors: {
        ...monitors,
        servers: monitors.servers.map((currentServer, serverIndex) => (serverIndex === index ? server : currentServer))
      }
    });
  }

  return (
    <div className="editor-stack">
      <fieldset className="editor-panel">
        <legend>Refresh</legend>
        <div className="form-grid">
          <label>
            Public refresh interval
            <input value={widgets.refreshInterval} onChange={(event) => updateWidgets({ ...widgets, refreshInterval: event.target.value })} placeholder="30s" />
          </label>
        </div>
      </fieldset>

      <fieldset className="editor-panel">
        <legend>Time</legend>
        <div className="form-grid">
          <label className="checkbox-row">
            <input type="checkbox" checked={widgets.time.enabled} onChange={(event) => updateWidgets({ ...widgets, time: { ...widgets.time, enabled: event.target.checked } })} />
            Enabled
          </label>
          <label>
            Format
            <input value={widgets.time.format} onChange={(event) => updateWidgets({ ...widgets, time: { ...widgets.time, format: event.target.value } })} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={widgets.time.showSeconds} onChange={(event) => updateWidgets({ ...widgets, time: { ...widgets.time, showSeconds: event.target.checked } })} />
            Show seconds
          </label>
          <label>
            Hour cycle
            <select value={widgets.time.hourCycle} onChange={(event) => updateWidgets({ ...widgets, time: { ...widgets.time, hourCycle: event.target.value as AppConfig["widgets"]["time"]["hourCycle"] } })}>
              <option value="12">12</option>
              <option value="24">24</option>
            </select>
          </label>
          <label>
            Timezone
            <input value={widgets.time.timezone ?? ""} onChange={(event) => updateWidgets({ ...widgets, time: { ...widgets.time, timezone: optionalText(event.target.value) } })} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={widgets.time.showTimezone} onChange={(event) => updateWidgets({ ...widgets, time: { ...widgets.time, showTimezone: event.target.checked } })} />
            Show timezone
          </label>
        </div>
      </fieldset>

      <fieldset className="editor-panel">
        <legend>Weather</legend>
        <div className="form-grid">
          <label className="checkbox-row">
            <input type="checkbox" checked={widgets.weather.enabled} onChange={(event) => updateWidgets({ ...widgets, weather: { ...widgets.weather, enabled: event.target.checked } })} />
            Enabled
          </label>
          <label>
            Provider
            <select value={widgets.weather.provider} onChange={(event) => updateWidgets({ ...widgets, weather: { ...widgets.weather, provider: event.target.value as AppConfig["widgets"]["weather"]["provider"] } })}>
              <option value="open-meteo">Open-Meteo</option>
            </select>
          </label>
          <label>
            Location
            <input value={widgets.weather.location} onChange={(event) => updateWidgets({ ...widgets, weather: { ...widgets.weather, location: event.target.value } })} />
          </label>
          <label>
            Latitude
            <input type="number" value={widgets.weather.latitude ?? ""} onChange={(event) => updateWidgets({ ...widgets, weather: { ...widgets.weather, latitude: optionalNumber(event.target.value) } })} />
          </label>
          <label>
            Longitude
            <input type="number" value={widgets.weather.longitude ?? ""} onChange={(event) => updateWidgets({ ...widgets, weather: { ...widgets.weather, longitude: optionalNumber(event.target.value) } })} />
          </label>
          <label>
            Units
            <select value={widgets.weather.units} onChange={(event) => updateWidgets({ ...widgets, weather: { ...widgets.weather, units: event.target.value as AppConfig["widgets"]["weather"]["units"] } })}>
              <option value="imperial">Imperial</option>
              <option value="metric">Metric</option>
            </select>
          </label>
          <label>
            Refresh interval
            <input value={widgets.weather.refreshInterval} onChange={(event) => updateWidgets({ ...widgets, weather: { ...widgets.weather, refreshInterval: event.target.value } })} placeholder="30m" />
          </label>
        </div>
      </fieldset>

      <fieldset className="editor-panel">
        <legend>Monitors</legend>
        <div className="form-grid">
          <label>
            Source
            <select value={monitors.source} onChange={(event) => updateWidgets({ ...widgets, monitors: { ...monitors, source: event.target.value as AppConfig["widgets"]["monitors"]["source"] } })}>
              <option value="prometheus">Prometheus</option>
              <option value="glances">Glances</option>
            </select>
          </label>
          <label>
            Prometheus URL
            <input value={monitors.prometheusUrl ?? ""} onChange={(event) => updateWidgets({ ...widgets, monitors: { ...monitors, prometheusUrl: optionalText(event.target.value) } })} />
          </label>
          <label>
            History window
            <input value={monitors.historyWindow} onChange={(event) => updateWidgets({ ...widgets, monitors: { ...monitors, historyWindow: event.target.value } })} />
          </label>
          <label>
            Sample interval
            <input value={monitors.sampleInterval} onChange={(event) => updateWidgets({ ...widgets, monitors: { ...monitors, sampleInterval: event.target.value } })} />
          </label>
          <label>
            Refresh interval
            <input value={monitors.refreshInterval} onChange={(event) => updateWidgets({ ...widgets, monitors: { ...monitors, refreshInterval: event.target.value } })} />
          </label>
        </div>
      </fieldset>

      <div className="editor-section-header">
        <h3>Servers</h3>
        <button
          className="icon-text-button"
          type="button"
          onClick={() => updateWidgets({ ...widgets, monitors: { ...monitors, servers: [...monitors.servers, defaultServer] } })}
          aria-label="Add monitor server"
        >
          <Plus aria-hidden="true" size={16} />
          <span>Add</span>
        </button>
      </div>

      {monitors.servers.map((server, index) => (
        <fieldset className="editor-panel" key={`${server.name}-${index}`}>
          <legend>{server.name || `Server ${index + 1}`}</legend>
          <div className="form-grid compact-form-grid">
            <label className="checkbox-row">
              <input type="checkbox" checked={server.enabled} onChange={(event) => updateServer(index, { ...server, enabled: event.target.checked })} />
              Enabled
            </label>
            <label>
              Name
              <input value={server.name} onChange={(event) => updateServer(index, { ...server, name: event.target.value })} />
            </label>
            <label>
              Source
              <select value={server.source ?? ""} onChange={(event) => updateServer(index, { ...server, source: optionalText(event.target.value) as MonitorServerConfig["source"] })}>
                <option value="">Default</option>
                <option value="prometheus">Prometheus</option>
                <option value="glances">Glances</option>
              </select>
            </label>
            <label>
              CPU query
              <input value={server.cpuQuery ?? ""} onChange={(event) => updateServer(index, { ...server, cpuQuery: optionalText(event.target.value) })} />
            </label>
            <label>
              RAM query
              <input value={server.ramQuery ?? ""} onChange={(event) => updateServer(index, { ...server, ramQuery: optionalText(event.target.value) })} />
            </label>
            <label>
              Glances URL
              <input value={server.glancesUrl ?? ""} onChange={(event) => updateServer(index, { ...server, glancesUrl: optionalText(event.target.value) })} />
            </label>
          </div>
          <div className="row-actions">
            <button type="button" onClick={() => updateWidgets({ ...widgets, monitors: { ...monitors, servers: monitors.servers.filter((_, serverIndex) => serverIndex !== index) } })} aria-label="Delete monitor server">
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function optionalText(value: string) {
  return value.trim() ? value : undefined;
}

function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}
