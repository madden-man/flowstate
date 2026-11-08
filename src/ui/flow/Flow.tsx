// Flow is your flows (PLAN-FLOWS.md sections 4 and 6, F1): one row per flow in its order, the name on the rule, its
// drawn shape small in print at the right, and under the name the shape's name and "last time" in print. A flow
// with an episode open carries the dot on its little drawing. No counts anywhere (DESIGN.md rule 15); Still keeps
// the rows and drops "last time" (rule 13).
import { useEffect, useState } from 'preact/hooks';
import { Page } from '../parts/Page';
import { Cycle } from '../parts/Cycle';
import { shapeOf } from '../parts/cycle/index';
import { dataVersion } from '../sheets';
import { shortDate } from '../date';
import { flowStates, placeOf, currentStepId, type FlowState } from '../../model/flows';

export function Flow() {
  const [rows, setRows] = useState<FlowState[] | null>(null);
  useEffect(() => {
    let live = true;
    flowStates().then(r => { if (live) setRows(r); });
    return () => { live = false; };
  }, [dataVersion.value]);

  return (
    <Page label="Flow">
      <div class="fs-sheetof fs-rules fs-flows">
        {/* Right now (F5, #/flow/now) takes the first row here: his own step lines across every flow. */}
        {rows?.map(({ flow, live, last }) => (
          <a key={flow.id} class="fs-row fs-list-row fl-flow" href={`#/flow/${flow.id}`} data-live={live ? 'true' : undefined}>
            <span class="fs-list-line">{flow.name}</span>
            <small class="fs-list-meta">
              {shapeOf(flow.diagram).title}
              {last && <span class="fs-notstill"> · last time {shortDate(new Date(last.startedAt))}</span>}
            </small>
            <span class="fl-mini" aria-hidden="true">
              <Cycle small diagram={flow.diagram} steps={flow.steps} at={live ? placeOf(flow, currentStepId(live)) : 0} />
            </span>
          </a>
        ))}
        {/* "+ flow" comes last (F3). */}
      </div>
    </Page>
  );
}
