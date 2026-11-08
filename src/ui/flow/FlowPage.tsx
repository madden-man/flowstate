// A flow's page (PLAN-FLOWS.md sections 4 and 6, F1): #/flow/:id and #/flow/:id/:step. The drawing (parts/Cycle) with
// the dot where you are; under it, on the rules and left like a page: the step's own line in italic serif (Tommy's),
// what the page says in print grey serif, and "Usually: ..." in print. At rest: the flow's line and one "last time"
// line. In Still (rule 13, "no counts, states"): the drawing, the line and the step's words-only usual; no said
// line, no last time, no number anywhere.
//
// Walk it once (3.7): a tap on a step word only reads that step; an episode starts when the dot is dragged off rest.
//
// doorOnly (F5, the door without the PIN, 3.7): the journal is locked and the lock let this page through. The flow
// reads as its seed (model/door.ts doorRead), the dot moves in memory only (ui/flow/door.ts doorDot) and nothing is
// written until the PIN; "last time" stays behind the PIN, and the header's moon and Flow word ask for it. Anything
// added under the step (F2's tip rows, the clock, the journal link; F6's notes and ghost rings) reads doorOnly too:
// behind the PIN go kept lines, notes, "last time", ghost rings, the journal link, the Edit word and every write.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Cycle } from '../parts/Cycle';
import { midStyle } from '../parts/cycle/index';
import { PrintLines } from './PrintLines';
import { HandOff, followHandOff } from './HandOff';
import { dataVersion } from '../sheets';
import { shortDate } from '../date';
import type { Episode, Flow } from '../../db/schema';
import type { Read } from '../../db/fields';
import { doorRead } from '../../model/door';
import { doorDot, askPin } from './door';
import {
  flowById, liveEpisode, lastEnded, moveDot, placeOf, currentStepId, stepAt, lastTimeOf, spanWords, spanOf,
} from '../../model/flows';
import { clockFrom, washLeft, whatHelped } from '../../model/tips';
import { light } from '../light';
import { Tips } from './Tips';
import { Clock, Wash } from './Clock';
import { StepSheet, AddStep, tickSheet } from './StepSheet';
import { useBreath, useNow } from './breath';
import { Ghosts } from './Ghosts';
import { AskNote, NoteAtStep, RestCarried, useAsk } from './Notes';
import { StampMarks } from './Stamps';

type Loaded = { flow: Read<Flow>; live?: Read<Episode>; last?: Read<Episode> } | 'none';

export function FlowPage({ id, step, doorOnly }: { id: string; step?: string; doorOnly?: boolean }) {
  const { route } = useLocation();
  const [data, setData] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  // the dot drawn at once where it was let go; the write follows (rule 20)
  const [moved, setMoved] = useState<number | null>(null);
  const [writing, setWriting] = useState(0);
  /** Moves whose write has not landed yet (a ref, so a read resolving mid-write sees it at once). */
  const inFlight = useRef(0);
  // F2: the minute the clock redraws on, the breath a held thumb runs, the step sheet
  const now = useNow();
  const breath = useBreath();
  const [editing, setEditing] = useState(false);
  // F6: the question to the next one of you (asked once per ended episode), and whether his own stamps are drawn
  const [asking, unask] = useAsk(data && data !== 'none' ? data.flow : undefined, data && data !== 'none' ? data.last : undefined,
    !(step && Number(step) >= 1) && !(data && data !== 'none' && data.live), !!doorOnly);
  const [marks, setMarks] = useState<('didnt' | 'happened')[]>([]);
  const own = marks.length > 0;

  useEffect(() => {
    let on = true;
    (async () => {
      const stored = await flowById(id);
      if (!stored) return on && setData('none');
      const flow = doorOnly ? doorRead(stored) : stored;
      const [live, last] = await Promise.all([liveEpisode(id), doorOnly ? undefined : lastEnded(id)]);
      // F4: a read that began before a move's write must not put the dot back where it was; the write's own read follows
      if (on && !inFlight.current) { setData({ flow, live, last }); setMoved(null); }
    })();
    return () => { on = false; };
  }, [id, version, dataVersion.value]);

  const door = doorOnly ? { ask: askPin } : undefined;
  if (data === 'none' || !data) return <Page label="Flow" back={{ word: 'Flow', href: '#/flow' }} keepSettings door={door}><div class="fs-sheetof fs-rules" /></Page>;

  const { flow, live, last } = data;
  const n = flow.steps.length;
  const held = doorOnly && doorDot.value?.flowId === flow.id ? placeOf(flow, doorDot.value.stepId) : 0;
  const at = moved ?? (held || (live ? placeOf(flow, currentStepId(live)) : 0));
  const asked = step ? Number(step) : 0;
  const showing = asked >= 1 && asked <= n ? asked : at;
  const shown = stepAt(flow, showing);

  const read = (k: number) => route(`/flow/${flow.id}/${k}`, true);
  const move = async (visits: number[], to: number) => {
    if (doorOnly) {
      // through the door the dot is held in memory; the PIN writes it. Back on rest it lets go (and the page stays,
      // since #/flow/:id alone is behind the PIN).
      doorDot.value = to ? { flowId: flow.id, stepId: flow.steps[to - 1].id } : null;
      setMoved(to || null);
      if (to) route(`/flow/${flow.id}/${to}`, true);
      return;
    }
    setMoved(to);
    route(to ? `/flow/${flow.id}/${to}` : `/flow/${flow.id}`, true);
    setWriting(w => w + 1);
    inFlight.current++;
    try {
      await moveDot(flow.id, visits.map(k => flow.steps[k - 1].id), to ? flow.steps[to - 1].id : 'rest');
    } finally {
      inFlight.current--;
      setWriting(w => w - 1);
      setVersion(v => v + 1);
    }
  };

  const lt = !doorOnly && last && lastTimeOf(flow, last);
  // F2: the dot is on the step the page shows, in a live episode: the clock, the halo, the wake lock at the peak, the wash
  const still = light.value === 'still';
  const onStep = !!live && moved === null && showing > 0 && showing === at;
  const mark = onStep ? live.marks.filter(m => m.stepId === shown?.id).at(-1) : undefined;
  const ringy = !!shown?.tips.some(t => t.helper === 'ring' && !t.struck) && (doorOnly || !flow.locked);
  const wash = onStep && showing === n && mark ? washLeft(mark.at, spanOf(shown), now) : 0;
  // through the door "what helped", like "last time", stays behind the PIN
  const helped = !doorOnly && last ? whatHelped(flow, last) : [];
  // the step sheet (F2) edits a step read at rest, and "+ step" opens it empty; neither comes through the door
  const sheets = !doorOnly && !flow.locked;

  return (
    <Page label={flow.name} back={{ word: 'Flow', href: '#/flow' }} keepSettings door={door}>
      <div class="fs-sheetof fs-rules fs-flowpage" data-saved={writing ? 'false' : 'true'} data-showing={showing} data-door={doorOnly ? '' : undefined}>
        {!doorOnly && <HandOff live={live} />}
        <div class="fl-drawing" style={midStyle(flow.diagram)} data-own={own ? '' : undefined}>
          {wash > 0 && <Wash left={wash} />}
          {!doorOnly && !flow.locked && <Ghosts flowId={flow.id} diagram={flow.diagram} n={n} version={version} />}
          {!doorOnly && !flow.locked && <StampMarks flowId={flow.id} diagram={flow.diagram} n={n} version={version} onMarks={setMarks} />}
          <Cycle diagram={flow.diagram} stamps={marks} steps={flow.steps} at={at} showing={showing} live={(!!live || held > 0) && moved !== 0}
            disabled={!doorOnly && !!flow.locked} onRead={read} onMove={(v, to) => void move(v, to)}
            halo={ringy && (onStep || breath.held) ? breath.since ?? 0 : false} held={breath.held} />
          <Clock from={onStep ? clockFrom(flow, live) : undefined} now={now} under={shown?.usualShort} holdable={ringy} breath={breath}
            awake={onStep && !!shown?.peak && !flow.quietClock} quiet={!!flow.quietClock} />
        </div>
        {shown ? (
          <section class="fl-step-page" aria-label={shown.name}>
            {shown.line && <p class="fl-line">{shown.line}</p>}
            {!doorOnly && <NoteAtStep flow={flow} step={shown} />}
            {shown.said && <p class="fl-said fs-notstill">{shown.said}</p>}
            {shown.usual && <p class="fl-usual fs-notstill">Usually: {shown.usual}</p>}
            {shown.usualShort && <p class="fl-usual fs-stillonly">{shown.usualShort}</p>}
            {(doorOnly || !flow.locked) && (
              <Tips step={shown} flowId={flow.id} flowTips={flow.steps.flatMap(s => s.tips)} live={live} still={still} now={now} door={doorOnly}
                onChanged={() => setVersion(v => v + 1)} />
            )}
          </section>
        ) : (
          <section class="fl-step-page" aria-label="At rest">
            {flow.line && <p class="fl-line">{flow.line}</p>}
            {asking && last?.id === asking && <AskNote flow={flow} episode={last} onDone={unask} />}
            {flow.restLine && <p class="fl-said fl-print">{flow.restLine}</p>}
            {lt && (
              <p class="fl-last fs-notstill">
                Last time · {shortDate(new Date(lt.at))}
                {lt.minutes !== undefined && ` · ${spanWords(lt.minutes)} from the ${lt.from} to clear`}
              </p>
            )}
            {helped.length > 0 && <p class="fl-helped fs-notstill"><small>What helped</small> {helped.join(', ')}</p>}
            {!doorOnly && <RestCarried flow={flow} last={last} asking={!!asking} />}
          </section>
        )}
        {shown && <PrintLines step={shown} onHandOff={t => void followHandOff(t, shown.id, live, to => route(to), doorOnly)} />}
        {shown && sheets && !live && <p class="fl-edit fs-notstill"><button type="button" class="fs-word" onClick={() => { tickSheet(); setEditing(true); }}>Edit</button></p>}
        {!shown && sheets && <AddStep flow={flow} onSaved={() => setVersion(v => v + 1)} />}
      </div>
      {shown && sheets && (
        <StepSheet flow={flow} step={shown} open={editing} onClose={() => setEditing(false)} onSaved={() => setVersion(v => v + 1)} />
      )}
    </Page>
  );
}
