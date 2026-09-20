import { Bell, CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { acknowledgeAttention } from "../api";
import type { AttentionEvent } from "../types";

export function AttentionPanel({ events, onAcknowledged }: { events: AttentionEvent[]; onAcknowledged: (eventId: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!events.length) return null;
  return <section className="attention-panel" aria-labelledby="attention-heading">
    <div className="attention-heading"><Bell aria-hidden="true" size={18} /><div><h2 id="attention-heading">Needs attention</h2><p>{events.length} active issue{events.length === 1 ? "" : "s"}</p></div></div>
    <div className="attention-list">{events.map((event) => <article className={`attention-item attention-${event.severity}`} key={event.eventId}>
      <div className="attention-item-content"><span className="status-pill">{event.severity}</span><h3>{event.title}</h3><p>{event.summary}</p><small>{event.instanceId} · {formatAge(event.openedAt)}</small></div>
      <div className="attention-item-actions"><button className="secondary-button" type="button" disabled={busy === event.eventId} onClick={async () => { setBusy(event.eventId); try { await acknowledgeAttention(event.eventId); onAcknowledged(event.eventId); } finally { setBusy(null); } }}><CheckCircle2 size={15} />Acknowledge</button>{event.link ? <a className="secondary-button" href={event.link} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open</a> : null}</div>
    </article>)}</div>
  </section>;
}

function formatAge(value: string) { const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60000)); return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`; }
