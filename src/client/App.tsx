import { Settings } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { getPublicSnapshot } from "./api";
import { BookmarkGrid } from "./components/BookmarkGrid";
import { EditorDrawer } from "./components/EditorDrawer";
import { WidgetBand } from "./components/WidgetBand";
import { durationToMs, refreshRetryDelayMs } from "./refreshSchedule";
import type { PublicSnapshot } from "./types";

export function App() {
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSnapshot() {
      try {
        const nextSnapshot = await getPublicSnapshot();
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError));
        }
      }
    }

    void loadInitialSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!snapshot) return undefined;

    let cancelled = false;
    let timeoutId: number | undefined;
    let consecutiveFailures = 0;
    const baseDelayMs = durationToMs(snapshot.widgets.refreshInterval);

    function scheduleNextRefresh() {
      timeoutId = window.setTimeout(refreshSnapshot, refreshRetryDelayMs(baseDelayMs, consecutiveFailures));
    }

    async function refreshSnapshot() {
      try {
        const refreshedSnapshot = await getPublicSnapshot();
        if (!cancelled) {
          setSnapshot(refreshedSnapshot);
          setError(null);
          consecutiveFailures = 0;
        }
      } catch (refreshError) {
        if (!cancelled) {
          consecutiveFailures += 1;
          setError(errorMessage(refreshError));
        }
      } finally {
        if (!cancelled) scheduleNextRefresh();
      }
    }

    scheduleNextRefresh();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [snapshot?.widgets.refreshInterval]);

  const shellStyle = useMemo(() => {
    if (!snapshot) return undefined;
    const mode = resolveThemeMode(snapshot.theme.mode);
    const palette = mode === "light" ? lightPalette : darkPalette;
    const hasVideoBackground = isVideoBackground(snapshot.theme.background);
    return {
      "--accent-color": snapshot.theme.accentColor,
      "--page-background": hasVideoBackground ? palette.pageBackground : pageBackground(snapshot.theme.background, palette.pageBackground),
      "--panel-background": palette.panelBackground,
      "--panel-border": palette.panelBorder,
      "--muted-text": palette.mutedText,
      "--soft-text": palette.softText,
      "--primary-text": palette.primaryText,
      "--control-background": palette.controlBackground,
      "--tooltip-background": palette.tooltipBackground,
      colorScheme: mode
    } as CSSProperties;
  }, [snapshot]);

  if (!snapshot) {
    return (
      <main className="app-shell loading-shell">
        <p>{error ?? "Loading homepage"}</p>
      </main>
    );
  }

  return (
    <main className="app-shell" style={shellStyle}>
      <BackgroundMedia background={snapshot.theme.background} />
      <WidgetBand
        generatedAt={snapshot.generatedAt}
        time={snapshot.widgets.time}
        weather={snapshot.widgets.weather}
        monitors={snapshot.widgets.monitors}
      />
      <BookmarkGrid groups={snapshot.groups} />
      {error ? <p className="refresh-error">Refresh failed: {error}</p> : null}
      <button className={`settings-button ${snapshot.layout.editorButton}`} type="button" aria-label="Open settings" onClick={() => setEditorOpen(true)}>
        <Settings aria-hidden="true" size={18} strokeWidth={2} />
      </button>
      <EditorDrawer open={editorOpen} onClose={() => setEditorOpen(false)} onSaved={reloadSnapshot} />
    </main>
  );

  async function reloadSnapshot() {
    const nextSnapshot = await getPublicSnapshot();
    setSnapshot(nextSnapshot);
    setError(null);
  }
}

function BackgroundMedia({ background }: { background: PublicSnapshot["theme"]["background"] }) {
  if (!isVideoBackground(background)) return null;

  return (
    <video className={`background-media background-media-${background.style}`} src={background.value} autoPlay muted loop playsInline aria-hidden="true" />
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Snapshot request failed";
}

const darkPalette = {
  pageBackground: "#1d2a3b",
  panelBackground: "rgba(12, 20, 32, 0.72)",
  panelBorder: "rgba(203, 217, 242, 0.14)",
  mutedText: "#9fb0c9",
  softText: "#c8d5ea",
  primaryText: "#f7fbff",
  controlBackground: "rgba(5, 10, 18, 0.58)",
  tooltipBackground: "rgba(8, 14, 24, 0.96)"
};

const lightPalette = {
  pageBackground: "#edf3fb",
  panelBackground: "rgba(255, 255, 255, 0.78)",
  panelBorder: "rgba(69, 85, 112, 0.18)",
  mutedText: "#58687f",
  softText: "#314056",
  primaryText: "#142033",
  controlBackground: "rgba(255, 255, 255, 0.78)",
  tooltipBackground: "rgba(20, 32, 51, 0.94)"
};

function resolveThemeMode(mode: PublicSnapshot["theme"]["mode"]) {
  if (mode !== "system") return mode;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function pageBackground(background: PublicSnapshot["theme"]["background"], fallbackColor: string) {
  if (background.type === "color") return background.value || fallbackColor;

  const image = `url("${background.value}")`;
  if (background.style === "tile") return `${fallbackColor} ${image} left top / auto repeat fixed`;
  if (background.style === "contain") return `${fallbackColor} ${image} center / contain no-repeat fixed`;
  if (background.style === "stretch") return `${fallbackColor} ${image} center / 100% 100% no-repeat fixed`;
  if (background.style === "center") return `${fallbackColor} ${image} center / auto no-repeat fixed`;
  return `${fallbackColor} ${image} center / cover no-repeat fixed`;
}

function isVideoBackground(background: PublicSnapshot["theme"]["background"]) {
  if (background.type !== "image") return false;
  return /\.(webm|mp4|ogg|ogv)(?:[?#].*)?$/i.test(background.value);
}
