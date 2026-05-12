import { Folder, Globe, Image, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { searchIcons } from "../api";
import { canRecolorIcon, defaultIconColor, IconGlyph } from "../icons";
import type { IconSearchResult } from "../types";

type IconPickerProps = {
  value: string;
  color?: string;
  onChange: (value: string) => void;
  onColorChange: (value: string | undefined) => void;
};

type IconMode = "catalog" | "url" | "local";

export function IconPicker({ value, color, onChange, onColorChange }: IconPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IconSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const inferredMode = useMemo(() => iconMode(value), [value]);
  const [mode, setMode] = useState<IconMode>(inferredMode);

  useEffect(() => {
    if (value) setMode(inferredMode);
  }, [inferredMode, value]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    const timeout = window.setTimeout(() => {
      searchIcons(trimmedQuery, controller.signal)
        .then((icons) => {
          if (!controller.signal.aborted) {
            setResults(icons);
            setStatus("idle");
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults([]);
            setStatus("error");
          }
        });
    }, 160);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  function updateMode(nextMode: IconMode) {
    setMode(nextMode);
    if (value) return;
    if (nextMode === "url") onChange("https://");
    if (nextMode === "local") onChange("/");
    if (nextMode === "catalog") onChange("link");
  }

  return (
    <div className="icon-picker">
      <div className="icon-picker-top">
        <div className="icon-preview" aria-label="Icon preview">
          <IconGlyph value={value} color={color} />
        </div>
        <label className="manual-icon-field">
          Icon
          <input value={value} onChange={(event) => onChange(event.target.value)} />
        </label>
      </div>

      {canRecolorIcon(value) ? (
        <label className="manual-icon-field">
          Icon color
          <span className="color-input-row">
            <input type="color" value={safeColor(color ?? defaultIconColor(value))} onChange={(event) => onColorChange(event.target.value)} aria-label="Icon color swatch" />
            <input value={color ?? ""} onChange={(event) => onColorChange(optionalText(event.target.value))} placeholder={defaultIconColor(value)} />
          </span>
        </label>
      ) : null}

      <div className="icon-mode-tabs" aria-label="Icon entry mode">
        <button type="button" className={mode === "catalog" ? "active" : ""} onClick={() => updateMode("catalog")}>
          <Image aria-hidden="true" size={15} />
          <span>Icon</span>
        </button>
        <button type="button" className={mode === "url" ? "active" : ""} onClick={() => updateMode("url")}>
          <Globe aria-hidden="true" size={15} />
          <span>URL</span>
        </button>
        <button type="button" className={mode === "local" ? "active" : ""} onClick={() => updateMode("local")}>
          <Folder aria-hidden="true" size={15} />
          <span>Path</span>
        </button>
      </div>

      {mode === "catalog" ? (
        <>
          <label className="icon-search-field">
            <Search aria-hidden="true" size={15} />
            <input aria-label="Search icons" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search icons" />
          </label>

          <div className="icon-results-grid" aria-label="Icon search results">
            {results.map((icon) => (
              <button
                key={`${icon.source}:${icon.value}`}
                type="button"
                className={value === icon.value ? "active" : ""}
                aria-label={`Select ${icon.name} from ${icon.source === "simple-icons" ? "Simple Icons" : "MDI"}`}
                onClick={() => {
                  onChange(icon.value);
                  if (!color) onColorChange(defaultIconColor(icon.value));
                }}
              >
                <span className="icon-result-preview">
                  <IconGlyph value={icon.value} color={color} />
                </span>
                <span className="icon-result-name">{icon.name}</span>
                <span className="icon-result-source">{icon.source === "simple-icons" ? "Simple Icons" : "MDI"}</span>
              </button>
            ))}
            {query.trim() && status === "loading" ? <p className="icon-picker-state">Searching...</p> : null}
            {query.trim() && status === "error" ? <p className="icon-picker-state">Search unavailable</p> : null}
            {query.trim() && status === "idle" && results.length === 0 ? <p className="icon-picker-state">No matches</p> : null}
          </div>
        </>
      ) : (
        <label className="manual-icon-field">
          {mode === "url" ? "Icon image URL" : "Icon image path"}
          <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={mode === "url" ? "https://example.com/icon.png" : "/icons/example.png"} />
        </label>
      )}
    </div>
  );
}

function iconMode(value: string): IconMode {
  if (isUrlIcon(value)) return "url";
  if (isLocalIcon(value)) return "local";
  return "catalog";
}

function isImageIcon(value: string) {
  return isUrlIcon(value) || isLocalIcon(value);
}

function isUrlIcon(value: string) {
  return /^https?:\/\//i.test(value);
}

function isLocalIcon(value: string) {
  return value.startsWith("/") || value.startsWith("./") || value.startsWith("../");
}

function safeColor(value: string) {
  return /^#[\dA-Fa-f]{6}$/.test(value) ? value : "#eef5ff";
}

function optionalText(value: string) {
  return value.trim() ? value : undefined;
}
