import type { CockpitSnapshot } from "../types";
import { AttentionPanel } from "./AttentionPanel";
import { ModuleBand } from "./ModuleBand";

export function CockpitBand({ snapshot, onAcknowledged }: { snapshot: CockpitSnapshot; onAcknowledged: (eventId: string) => void }) {
  return <div className="cockpit-band"><AttentionPanel events={snapshot.attention} onAcknowledged={onAcknowledged} /><ModuleBand modules={snapshot.modules} /></div>;
}
