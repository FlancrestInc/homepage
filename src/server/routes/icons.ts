import type { FastifyInstance } from "fastify";
import * as mdiIcons from "@mdi/js";
import * as simpleIcons from "simple-icons";

type IconSearchResult = {
  name: string;
  value: string;
  source: "simple-icons" | "mdi";
};

type SimpleIcon = {
  title: string;
  slug: string;
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

const simpleIconIndex = (Object.values(simpleIcons) as unknown[])
  .filter(isSimpleIcon)
  .map((icon) => ({
    name: icon.title,
    value: `si-${icon.slug}`,
    source: "simple-icons" as const,
    searchable: normalize(`${icon.title} ${icon.slug}`)
  }));

const mdiIconIndex = mdiAliases
  .filter((icon) => typeof mdiIcons[icon.exportName] === "string")
  .map((icon) => ({
    name: icon.name,
    value: icon.value,
    source: "mdi" as const,
    searchable: normalize(`${icon.name} ${icon.value}`)
  }));

export async function registerIconRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string | string[] } }>("/api/icons", async (request) => {
    const query = normalize(firstQueryValue(request.query.q));
    if (!query) return { icons: [] };

    return {
      icons: [...simpleIconIndex, ...mdiIconIndex]
        .filter((icon) => icon.searchable.includes(query))
        .sort(sortIconResults(query))
        .slice(0, 36)
        .map(({ name, value, source }) => ({ name, value, source }))
    };
  });
}

function isSimpleIcon(value: unknown): value is SimpleIcon {
  if (!value || typeof value !== "object") return false;
  const icon = value as Partial<SimpleIcon>;
  return typeof icon.title === "string" && typeof icon.slug === "string";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function sortIconResults(query: string) {
  return (left: IconSearchResult & { searchable: string }, right: IconSearchResult & { searchable: string }) => {
    const leftExact = left.searchable === query || left.searchable.startsWith(`${query} `) ? 0 : 1;
    const rightExact = right.searchable === query || right.searchable.startsWith(`${query} `) ? 0 : 1;
    if (leftExact !== rightExact) return leftExact - rightExact;
    return left.name.localeCompare(right.name);
  };
}
