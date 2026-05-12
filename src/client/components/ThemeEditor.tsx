import type { AppConfig } from "../types";

type ThemeEditorProps = {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
};

export function ThemeEditor({ config, onChange }: ThemeEditorProps) {
  const theme = config.theme;

  return (
    <div className="editor-stack">
      <fieldset className="editor-panel">
        <legend>Appearance</legend>
        <div className="form-grid">
          <label>
            Mode
            <select value={theme.mode} onChange={(event) => onChange({ ...config, theme: { ...theme, mode: event.target.value as AppConfig["theme"]["mode"] } })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
          <label>
            Accent color
            <span className="color-input-row">
              <input type="color" value={theme.accentColor} onChange={(event) => onChange({ ...config, theme: { ...theme, accentColor: event.target.value } })} aria-label="Accent color swatch" />
              <input value={theme.accentColor} onChange={(event) => onChange({ ...config, theme: { ...theme, accentColor: event.target.value } })} />
            </span>
          </label>
          <label>
            Background type
            <select value={theme.background.type} onChange={(event) => onChange({ ...config, theme: { ...theme, background: { ...theme.background, type: event.target.value as AppConfig["theme"]["background"]["type"] } } })}>
              <option value="color">Color</option>
              <option value="image">Image</option>
            </select>
          </label>
          <label>
            Background {theme.background.type === "image" ? "image" : "color"}
            <span className="color-input-row">
              {theme.background.type === "color" ? (
                <input type="color" value={safeColor(theme.background.value)} onChange={(event) => onChange({ ...config, theme: { ...theme, background: { ...theme.background, value: event.target.value } } })} aria-label="Background color swatch" />
              ) : null}
              <input value={theme.background.value} onChange={(event) => onChange({ ...config, theme: { ...theme, background: { ...theme.background, value: event.target.value } } })} />
            </span>
          </label>
          <label>
            Editor button corner
            <select value={config.layout.editorButton} onChange={(event) => onChange({ ...config, layout: { ...config.layout, editorButton: event.target.value as AppConfig["layout"]["editorButton"] } })}>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </select>
          </label>
        </div>
      </fieldset>
    </div>
  );
}

function safeColor(value: string) {
  return /^#[\dA-Fa-f]{6}$/.test(value) ? value : "#1d2a3b";
}
