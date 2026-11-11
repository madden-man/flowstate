// Flow is the mountain (PLAN-MOUNTAIN.md, R1): one drawing in place of the list, a night plate lit by its own water,
// seven signs down one stream to a sea where Meditate and Energize float (ui/flow/Mountain.tsx). The eight flows that
// are ways of getting stuck are reached through their sign (#/flow/c/<chakra>, R3); every #/flow/<id> still opens a
// flow's page, so the door, Right now and hand-offs keep working. Under the plate, on the page's rules: the morning
// after a worry (StampAsk, F6), Right now (F5), a row for each flow he made himself that has no sign yet (so nothing
// of his is out of reach until "+ flow" asks which sign it goes under, plan section 6), and "+ flow" (F3). The door
// keeps its own list (DoorRows).
import { useEffect, useState } from 'preact/hooks';
import { Page } from '../parts/Page';
import { Cycle } from '../parts/Cycle';
import { NewFlow } from './NewFlow';
import { StampAsk } from './Stamps';
import { Mountain } from './Mountain';
import { shapeOf } from '../parts/cycle/index';
import { dataVersion } from '../sheets';
import { flowStates, placeOf, currentStepId, type FlowState } from '../../model/flows';
import { FIXATION_FLOW } from '../../model/fixations';

export function Flow() {
  const [own, setOwn] = useState<FlowState[] | null>(null);
  // a flow just made through "+ flow" (R5): read again. Make routes to the new flow's page, but a second navigation
  // inside that turn (back to #/flow before the turn has drawn) lands on this same page, never unmounted, so without
  // this its list would stay as it was read before the flow existed.
  const [made, setMade] = useState(0);
  useEffect(() => {
    let live = true;
    flowStates().then(r => { if (live) setOwn(r.filter(s => !s.flow.chakra && s.flow.id !== FIXATION_FLOW)); }).catch(() => { if (live) setOwn([]); });
    return () => { live = false; };
  }, [dataVersion.value, made]);

  return (
    <Page label="Flow" drawn={own !== null}>
      <div class="fs-sheetof fs-rules fs-flows">
        <Mountain />
        <StampAsk />
        {/* Right now (F5): his own step lines across every flow, the door's page */}
        <a class="fs-row fs-list-row fl-flow fl-now" href="#/flow/now">
          <span class="fs-list-line">Right now</span>
          <small class="fs-list-meta">Your lines; tap the one that fits</small>
        </a>
        {own?.map(({ flow, live }) => (
          <a key={flow.id} class="fs-row fs-list-row fl-flow" href={`#/flow/${flow.id}`} data-live={live ? 'true' : undefined}>
            <span class="fs-list-line">{flow.name}</span>
            <small class="fs-list-meta">{shapeOf(flow.diagram).title}</small>
            <span class="fl-mini" aria-hidden="true" data-travel="fs-drawing">
              <Cycle small diagram={flow.diagram} steps={flow.steps} at={live ? placeOf(flow, currentStepId(live)) : 0} />
            </span>
          </a>
        ))}
        {/* "+ flow" comes last (F3). */}
        <NewFlow onMade={() => setMade(k => k + 1)} />
      </div>
    </Page>
  );
}
