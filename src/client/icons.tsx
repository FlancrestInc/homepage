import { useEffect, useState } from "react";

type IconSource = "mdi" | "simple-icons" | "image" | "text";

type ResolvedIcon = {
  source: IconSource;
  path?: string;
  color?: string;
};

const iconPathPromises = new Map<string, Promise<{ path: string; color?: string } | undefined>>();

export function IconGlyph({
  value,
  path,
  color,
  defaultColor,
  className = "rendered-icon"
}: {
  value: string;
  path?: string;
  color?: string;
  defaultColor?: string;
  className?: string;
}) {
  const [icon, setIcon] = useState<ResolvedIcon>(() => resolveIcon(value, path, defaultColor));

  useEffect(() => {
    let cancelled = false;
    setIcon(resolveIcon(value, path, defaultColor));
    if (path || !needsCatalog(value)) return undefined;

    void loadIcon(value).then((loadedIcon) => {
      if (!cancelled) {
        setIcon(loadedIcon ? { source: sourceForValue(value), ...loadedIcon } : resolveIcon(value));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [defaultColor, path, value]);

  if (icon.source === "image") {
    return <img className={className} src={value} alt="" />;
  }

  if (icon.path) {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={icon.path} fill={color || icon.color || "currentColor"} />
      </svg>
    );
  }

  return <span className="icon-text-fallback">{fallbackText(value)}</span>;
}

export function canRecolorIcon(value: string) {
  return value.startsWith("mdi-") || value.startsWith("si-");
}

export function defaultIconColor(_value: string) {
  return "#eef5ff";
}

function resolveIcon(value: string, path?: string, defaultColor?: string): ResolvedIcon {
  if (isImageIcon(value)) return { source: "image" };
  if (path) return { source: sourceForValue(value), path, color: defaultColor };
  if (value.startsWith("mdi-")) return { source: "mdi" };
  if (value.startsWith("si-")) return { source: "simple-icons" };
  return { source: "text" };
}

function loadIcon(value: string) {
  const existing = iconPathPromises.get(value);
  if (existing) return existing;

  const promise = fetch(`/api/icons?value=${encodeURIComponent(value)}`)
    .then(async (response) => {
      if (!response.ok) return undefined;
      const body = (await response.json()) as { icons?: Array<{ path?: unknown; color?: unknown }> };
      const icon = body.icons?.[0];
      return typeof icon?.path === "string"
        ? { path: icon.path, color: typeof icon.color === "string" ? icon.color : undefined }
        : undefined;
    })
    .catch(() => undefined);

  iconPathPromises.set(value, promise);
  return promise;
}

function sourceForValue(value: string): "mdi" | "simple-icons" {
  return value.startsWith("mdi-") ? "mdi" : "simple-icons";
}

function needsCatalog(value: string) {
  return value.startsWith("mdi-") || value.startsWith("si-");
}

function fallbackText(value: string) {
  return value.replace(/^(mdi|si)-/, "").slice(0, 3).toUpperCase() || "ICO";
}

function isImageIcon(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("./") || value.startsWith("../");
}
