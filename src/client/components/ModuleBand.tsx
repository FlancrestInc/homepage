import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { executeModuleAction, getModuleDetails } from "../api";
import type { ModuleSummary } from "../types";

export function ModuleBand({ modules }: { modules: ModuleSummary[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  if (!modules.length) return null;
  const visible = modules.filter((module) => module.enabled || module.status !== "unknown");
  if (!visible.length) return null;
  return <section className="module-band" aria-label="Homelab status">
    <div className="module-band-heading"><div><h2>Homelab status</h2><p>Independent checks from configured services</p></div><span>{visible.filter((module) => module.status === "healthy").length}/{visible.length} healthy</span></div>
    <div className="module-cards">{visible.map((module) => <article className={`module-card module-${module.status}`} key={module.instanceId}>
      <button className="module-card-toggle" type="button" aria-expanded={expanded === module.instanceId} onClick={async () => { const next = expanded === module.instanceId ? null : module.instanceId; setExpanded(next); setError(null); if (next && details[next] === undefined) { try { const detail = await getModuleDetails(next); setDetails((current) => ({ ...current, [next]: detail })); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Details unavailable"); } } }}><span><strong>{module.name}</strong><small>{module.kind}</small></span><span className="module-status-label">{module.status}</span><ChevronDown size={16} className={expanded === module.instanceId ? "rotate" : ""} /></button>
      {expanded === module.instanceId ? <div className="module-card-details">{module.statuses.length ? module.statuses.map((status) => <div className="module-resource" key={status.resourceId}><div><strong>{status.resourceId}</strong><p>{status.summary}</p></div><span>{status.freshness}</span>{Object.entries(status.evidence).length ? <dl>{Object.entries(status.evidence).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl> : null}</div>) : <p>No check has completed yet.</p>}{details[module.instanceId] !== undefined ? <pre className="module-details-json">{JSON.stringify(details[module.instanceId], null, 2)}</pre> : null}{error ? <p className="editor-error">{error}</p> : null}<div className="module-card-actions"><button className="secondary-button" type="button" onClick={() => void executeModuleAction(module.instanceId, "refresh", { resourceId: "default" }).catch((actionError) => setError(actionError instanceof Error ? actionError.message : "Refresh failed"))}><RefreshCw size={14} />Refresh</button>{module.links.map((link) => <a className="secondary-button" href={link} key={link} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open</a>)}</div></div> : null}
    </article>)}</div>
  </section>;
}
