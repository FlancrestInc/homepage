import * as mdiIcons from "@mdi/js";
import * as simpleIcons from "simple-icons";

export type IconSearchResult = {
  name: string;
  value: string;
  source: "simple-icons" | "mdi";
  path: string;
  color?: string;
};

type IndexedIcon = IconSearchResult & { searchable: string };

type SimpleIcon = {
  title: string;
  slug: string;
  path: string;
  hex?: string;
};

const mdiAliases = [
  { name: "Link", value: "mdi-link", exportName: "mdiLink" },
  { name: "Home", value: "mdi-home", exportName: "mdiHome" },
  { name: "GitHub", value: "mdi-github", exportName: "mdiGithub" },
  { name: "Server", value: "mdi-server", exportName: "mdiServer" },
  { name: "Docker", value: "mdi-docker", exportName: "mdiDocker" },
  { name: "Kubernetes", value: "mdi-kubernetes", exportName: "mdiKubernetes" },
  { name: "NAS", value: "mdi-nas", exportName: "mdiNas" },
  { name: "Router Wireless", value: "mdi-router-wireless", exportName: "mdiRouterWireless" },
  { name: "Cloud", value: "mdi-cloud", exportName: "mdiCloud" },
  { name: "Database", value: "mdi-database", exportName: "mdiDatabase" },
  { name: "Monitor Dashboard", value: "mdi-monitor-dashboard", exportName: "mdiMonitorDashboard" }
] as const;

const simpleIconIndex: IndexedIcon[] = (Object.values(simpleIcons) as unknown[])
  .filter(isSimpleIcon)
  .map((icon) => ({
    name: icon.title,
    value: `si-${icon.slug}`,
    source: "simple-icons" as const,
    path: icon.path,
    color: icon.hex ? `#${icon.hex}` : undefined,
    searchable: normalize(`${icon.title} ${icon.slug}`)
  }));

const mdiIconIndex: IndexedIcon[] = mdiAliases.flatMap((icon) => {
  const path = mdiIcons[icon.exportName];
  if (typeof path !== "string") return [];
  return [{
    name: icon.name,
    value: icon.value,
    source: "mdi" as const,
    path,
    searchable: normalize(`${icon.name} ${icon.value}`)
  }];
});

const iconIndex = [...simpleIconIndex, ...mdiIconIndex];

export function searchIcons(query: string) {
  return iconIndex
    .filter((icon) => icon.searchable.includes(query))
    .sort(sortIconResults(query))
    .slice(0, 36)
    .map(toPublicIcon);
}

export function findIcon(value: string) {
  const icon = iconIndex.find((candidate) => candidate.value === value);
  return icon ? toPublicIcon(icon) : undefined;
}

function toPublicIcon({ searchable: _searchable, ...icon }: IndexedIcon): IconSearchResult {
  return icon;
}

function isSimpleIcon(value: unknown): value is SimpleIcon {
  if (!value || typeof value !== "object") return false;
  const icon = value as Partial<SimpleIcon>;
  return typeof icon.title === "string" && typeof icon.slug === "string" && typeof icon.path === "string";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sortIconResults(query: string) {
  return (left: IndexedIcon, right: IndexedIcon) => {
    const leftExact = left.searchable === query || left.searchable.startsWith(`${query} `) ? 0 : 1;
    const rightExact = right.searchable === query || right.searchable.startsWith(`${query} `) ? 0 : 1;
    if (leftExact !== rightExact) return leftExact - rightExact;
    return left.name.localeCompare(right.name);
  };
}
