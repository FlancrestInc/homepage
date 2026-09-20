import type { ConnectorContext } from "../modules/types.js";

export async function sendApprise(context: ConnectorContext, endpoint: string, title: string, message: string) {
  const response = await context.request(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, body: message }) });
  if (!response.ok) throw new Error(`Apprise returned HTTP ${response.status}`);
}
