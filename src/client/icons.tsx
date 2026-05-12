import { useEffect, useState } from "react";

type IconSource = "mdi" | "simple-icons" | "image" | "text";

type ResolvedIcon = {
  source: IconSource;
  path?: string;
  color?: string;
};

type SimpleIcon = {
  title: string;
  slug: string;
  path: string;
  hex?: string;
};

let catalogPromise: Promise<{ simpleIcons: Map<string, SimpleIcon>; mdiIcons: Record<string, string> }> | null = null;

export function IconGlyph({ value, color, className = "rendered-icon" }: { value: string; color?: string; className?: string }) {
  const [icon, setIcon] = useState<ResolvedIcon>(() => resolveFast(value));

  useEffect(() => {
    let cancelled = false;
    setIcon(resolveFast(value));
    if (!needsCatalog(value)) return undefined;

    void loadCatalog().then((catalog) => {
      if (!cancelled) setIcon(resolveWithCatalog(value, catalog));
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

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

function resolveFast(value: string): ResolvedIcon {
  if (isImageIcon(value)) return { source: "image" };
  if (value.startsWith("mdi-")) return { source: "mdi" };
  if (value.startsWith("si-")) return { source: "simple-icons" };
  return { source: "text" };
}

function resolveWithCatalog(value: string, catalog: Awaited<ReturnType<typeof loadCatalog>>): ResolvedIcon {
  if (value.startsWith("si-")) {
    const icon = catalog.simpleIcons.get(value);
    return icon ? { source: "simple-icons", path: icon.path, color: icon.hex ? `#${icon.hex}` : undefined } : { source: "text" };
  }
  if (value.startsWith("mdi-")) {
    const path = catalog.mdiIcons[mdiExportName(value)];
    return typeof path === "string" ? { source: "mdi", path } : { source: "text" };
  }
  return resolveFast(value);
}

function loadCatalog() {
  catalogPromise ??= Promise.all([import("simple-icons"), import("@mdi/js")]).then(([simpleIcons, mdiIcons]) => ({
    simpleIcons: new Map(
      (Object.values(simpleIcons) as unknown[])
        .filter(isSimpleIcon)
        .map((icon) => [`si-${icon.slug}`, icon])
    ),
    mdiIcons: mdiIcons as unknown as Record<string, string>
  }));
  return catalogPromise;
}

function needsCatalog(value: string) {
  return value.startsWith("mdi-") || value.startsWith("si-");
}

function mdiExportName(value: string) {
  return value
    .split("-")
    .map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join("");
}

function fallbackText(value: string) {
  return value.replace(/^(mdi|si)-/, "").slice(0, 3).toUpperCase() || "ICO";
}

function isImageIcon(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("./") || value.startsWith("../");
}

function isSimpleIcon(value: unknown): value is SimpleIcon {
  if (!value || typeof value !== "object") return false;
  const icon = value as Partial<SimpleIcon>;
  return typeof icon.title === "string" && typeof icon.slug === "string" && typeof icon.path === "string";
}
