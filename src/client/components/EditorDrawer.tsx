import { AlertCircle, Check, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getConfig, saveConfig } from "../api";
import { validateRawConfigShape } from "../configValidation";
import type { AppConfig } from "../types";
import { BookmarkEditor } from "./BookmarkEditor";
import { ThemeEditor } from "./ThemeEditor";
import { WidgetEditor } from "./WidgetEditor";

type EditorDrawerProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

type TabId = "bookmarks" | "widgets" | "theme" | "health" | "raw";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "bookmarks", label: "Bookmarks" },
  { id: "widgets", label: "Widgets" },
  { id: "theme", label: "Theme" },
  { id: "health", label: "Health" },
  { id: "raw", label: "Raw Config" }
];

export function EditorDrawer({ open, onClose, onSaved }: EditorDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("bookmarks");
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [rawConfig, setRawConfig] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRawError(null);
    setActiveTab("bookmarks");

    async function loadEditableConfig() {
      try {
        const config = await getConfig();
        if (cancelled) return;
        setDraft(config);
        setRawConfig(formatConfig(config));
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEditableConfig();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const firstFocusable = getFocusableElements(dialogRef.current)[0];
    firstFocusable?.focus();
  }, [open, loading]);

  const tabPanel = useMemo(() => {
    if (!draft) return null;

    if (activeTab === "bookmarks") return <BookmarkEditor config={draft} onChange={handleDraftChange} />;
    if (activeTab === "widgets") return <WidgetEditor config={draft} onChange={handleDraftChange} />;
    if (activeTab === "theme") return <ThemeEditor config={draft} onChange={handleDraftChange} />;
    if (activeTab === "health") {
      return (
        <div className="editor-stack">
          <fieldset className="editor-panel">
            <legend>Health checks</legend>
            <div className="form-grid">
              <label>
                Default interval
                <input value={draft.healthChecks.defaultInterval} onChange={(event) => handleDraftChange({ ...draft, healthChecks: { ...draft.healthChecks, defaultInterval: event.target.value } })} placeholder="5m" />
              </label>
              <label>
                Timeout
                <input value={draft.healthChecks.timeout} onChange={(event) => handleDraftChange({ ...draft, healthChecks: { ...draft.healthChecks, timeout: event.target.value } })} placeholder="5s" />
              </label>
            </div>
          </fieldset>
        </div>
      );
    }
    return (
      <label className="raw-config-label">
        Raw configuration
        <textarea value={rawConfig} onChange={(event) => handleRawConfigChange(event.target.value)} spellCheck={false} />
      </label>
    );
  }, [activeTab, draft, rawConfig]);

  if (!open) return null;

  function handleDraftChange(nextDraft: AppConfig) {
    setDraft(nextDraft);
    setRawError(null);
    if (activeTab !== "raw") {
      setRawConfig(formatConfig(nextDraft));
    }
  }

  function handleRawConfigChange(value: string) {
    setRawConfig(value);
    try {
      const parsedConfig = JSON.parse(value) as unknown;
      const validation = validateRawConfigShape(parsedConfig);
      if (!validation.ok) {
        setRawError(validation.message);
        return;
      }
      setDraft(validation.config);
      setRawError(null);
      setError(null);
    } catch (parseError) {
      setRawError(`Raw config is not valid JSON: ${errorMessage(parseError)}`);
    }
  }

  async function handleSave() {
    if (!draft) return;
    if (rawError) return;

    const nextConfig = draft;

    setSaving(true);
    setError(null);
    try {
      await saveConfig(nextConfig);
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusableElements = getFocusableElements(dialogRef.current);
    if (!focusableElements.length) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div className="drawer-backdrop">
      <div className="editor-drawer" role="dialog" aria-modal="true" aria-label="Settings" ref={dialogRef} onKeyDown={handleKeyDown}>
        <header className="drawer-header">
          <div>
            <h2>Settings</h2>
            <p>Edit homepage configuration</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="drawer-tabs" role="tablist" aria-label="Settings sections">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        <section className="drawer-body" role="tabpanel" aria-label={tabs.find((tab) => tab.id === activeTab)?.label}>
          {loading ? <p className="drawer-state">Loading configuration</p> : tabPanel}
        </section>

        {rawError || error ? (
          <p className="editor-error" role="alert">
            <AlertCircle aria-hidden="true" size={16} />
            <span>{rawError ?? error}</span>
          </p>
        ) : null}

        <footer className="drawer-footer">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={handleSave} disabled={!draft || Boolean(rawError) || loading || saving}>
            {saving ? <Check aria-hidden="true" size={16} /> : <Save aria-hidden="true" size={16} />}
            <span>{saving ? "Saving" : "Save"}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatConfig(config: AppConfig) {
  return JSON.stringify(config, null, 2);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Config request failed";
}

function getFocusableElements(element: HTMLElement) {
  return Array.from(
    element.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((focusableElement) => !focusableElement.hasAttribute("hidden") && focusableElement.offsetParent !== null);
}
