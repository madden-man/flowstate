// Right now (PLAN-FLOWS.md 3.7, F5): #/flow/now, the Flow list's first row and the door's page. His own step lines
// across every flow, in flow order, one to a row in italic, the flow and the step in print under each ("Too much
// coming in at once." / Panic · Overstimulated). A step with no line shows its name in print only. Recognising his
// own sentence is easier than naming the flow at the worst moment.
//
// A tap puts the dot on that step and opens it: unlocked, the dot moves at once (moveDot: an episode starts, or the
// live one gains the mark); through the door (doorOnly) the dot is held in memory and the PIN writes it. Either way
// the route that follows is a plain #/flow/:id/:step, which on its own only reads (walk it once).
import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { JSX } from 'preact';
import { Page } from '../parts/Page';
import { dataVersion } from '../sheets';
import { flows, moveDot } from '../../model/flows';
import { doorRead, nowRows, type NowRow } from '../../model/door';
import { doorDot, askPin } from './door';
import './door.css';

export function Now({ doorOnly }: { doorOnly?: boolean }) {
  const { route } = useLocation();
  const [rows, setRows] = useState<NowRow[] | null>(null);
  useEffect(() => {
    let on = true;
    flows().then(fs => { if (on) setRows(nowRows(doorOnly ? fs.map(doorRead) : fs)); });
    return () => { on = false; };
  }, [dataVersion.value, doorOnly]);

  const open = async (e: JSX.TargetedMouseEvent<HTMLAnchorElement>, r: NowRow) => {
    e.preventDefault();
    if (doorOnly) doorDot.value = { flowId: r.flowId, stepId: r.stepId };
    else await moveDot(r.flowId, [], r.stepId);
    route(`/flow/${r.flowId}/${r.step}`);
  };

  return (
    <Page label="Right now" back={{ word: 'Flow', href: '#/flow' }} keepSettings door={doorOnly ? { ask: askPin } : undefined}>
      <div class="fs-sheetof fs-rules fs-flows fl-nowlist">
        {rows?.map(r => (
          <a key={`${r.flowId} ${r.stepId}`} class={`fs-row fs-list-row fl-flow${r.line ? ' fl-now' : ' fl-noline'}`}
            href={`#/flow/${r.flowId}/${r.step}`} onClick={e => void open(e, r)}>
            {r.line && <span class="fs-list-line">{r.line}</span>}
            <small class="fs-list-meta">{r.flow ? `${r.flow} · ${r.name}` : r.name}</small>
          </a>
        ))}
      </div>
    </Page>
  );
}
