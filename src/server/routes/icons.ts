import type { FastifyInstance } from "fastify";
import { findIcon, searchIcons } from "../integrations/icons.js";

export async function registerIconRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string | string[]; value?: string | string[] } }>("/api/icons", async (request) => {
    const value = firstQueryValue(request.query.value);
    if (value) {
      const icon = findIcon(value);
      return { icons: icon ? [icon] : [] };
    }

    const query = normalize(firstQueryValue(request.query.q));
    return { icons: query ? searchIcons(query) : [] };
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
