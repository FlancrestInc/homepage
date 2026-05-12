import { Folder, Globe, Image, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { searchIcons } from "../api";
import type { IconSearchResult } from "../types";

type IconPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

type IconMode = "catalog" | "url" | "local";

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IconSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const mode = useMemo(() => iconMode(value), [value]);

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
      searchIcons(trimmedQuery)
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
    if (nextMode === "url" && !isUrlIcon(value)) onChange("https://");
    if (nextMode === "local" && !isLocalIcon(value)) onChange("/");
    if (nextMode === "catalog" && (isUrlIcon(value) || isLocalIcon(value))) onChange("link");
  }

  return (
    <div className="icon-picker">
      <div className="icon-picker-top">
        <div className="icon-preview" aria-label="Icon preview">
          {isImageIcon(value) ? <img src={value} alt="" /> : <span>{value || "icon"}</span>}
        </div>
        <label className="manual-icon-field">
          Icon
          <input value={value} onChange={(event) => onChange(event.target.value)} />
        </label>
      </div>

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

      <label className="icon-search-field">
        <Search aria-hidden="true" size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search icons" />
      </label>

      <div className="icon-results-grid" aria-label="Icon search results">
        {results.map((icon) => (
          <button key={`${icon.source}:${icon.value}`} type="button" className={value === icon.value ? "active" : ""} onClick={() => onChange(icon.value)}>
            <span className="icon-result-preview">{icon.value}</span>
            <span className="icon-result-name">{icon.name}</span>
            <span className="icon-result-source">{icon.source === "simple-icons" ? "Simple Icons" : "MDI"}</span>
          </button>
        ))}
        {query.trim() && status === "loading" ? <p className="icon-picker-state">Searching...</p> : null}
        {query.trim() && status === "error" ? <p className="icon-picker-state">Search unavailable</p> : null}
        {query.trim() && status === "idle" && results.length === 0 ? <p className="icon-picker-state">No matches</p> : null}
      </div>
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
