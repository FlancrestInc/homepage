import type { ConnectorContext } from "../modules/types.js";

export async function sendNtfy(context: ConnectorContext, serverUrl: string, topic: string, title: string, message: string) {
  const response = await context.request(`${serverUrl.replace(/\/$/, "")}/${encodeURIComponent(topic)}`, { method: "POST", headers: { "Title": title, "Content-Type": "text/plain" }, body: message });
  if (!response.ok) throw new Error(`ntfy returned HTTP ${response.status}`);
}
