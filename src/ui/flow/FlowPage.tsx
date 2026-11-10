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
//
// The three (PLAN-ENERGIZE.md X2): on the flow named FIXATION_FLOW, at rest, ./Fixations takes the place of all of the
// rest page (the flow's line, the rest line, last time, what helped, carried notes, the ask, "+ step"), and the stream
// runs in the three hues there and on every step. Its sheet landing one in a slot sends the stream's ring out in that
// hue. Through the door the page at rest is the drawing alone, and the water ink: nothing comes from the fixations.
//
// Spark it (X5): the sheet's word names the ride and routes here, to the dot's step. While the live episode names a
// fixation the water runs in its one hue on every step (rule 30), and the step page is that fixation's card alone
// (Fixations.tsx FixationCard, not a button, its Next line open) and then the step's rows as they are. On this flow
// the said and "Usually:" paragraphs are not drawn in any light: the usualShort by the drawing (and in Still under
// it) says the step. A ride dragged off rest names nothing: no card, the three hues. Through the door: no card.
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
import { Stream } from '../parts/Stream';
import { pacesOf } from '../../model/pace';
import { FIXATION_FLOW, type Sparked } from '../../model/fixations';
import { FixationCard, Fixations, laneHues, useFixations, type Landed } from './Fixations';

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
  // the three (X2): Energize's rest page is the fixations, so it never asks there (asking marks the episode asked)
  const fixing = id === FIXATION_FLOW;
  const rideId = data && data !== 'none' ? data.live?.fixationId : undefined;
  const { fixed, reload } = useFixations(fixing && !doorOnly, rideId);
  const [asking, unask] = useAsk(data && data !== 'none' ? data.flow : undefined, data && data !== 'none' ? data.last : undefined,
    !fixing && !(step && Number(step) >= 1) && !(data && data !== 'none' && data.live), !!doorOnly);
  const [marks, setMarks] = useState<('didnt' | 'happened')[]>([]);
  // M5: the last landing on a detent, for the stream's ring (a new seq each time); X2: a fixation landing gives it a hue
  const [landing, setLanding] = useState<{ k: number; seq: number; hue?: number } | null>(null);
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
  if (data === 'none' || !data) return <Page label="Flow" back={{ word: 'Flow', href: '#/flow' }} keepSettings door={door} drawn={data !== null}><div class="fs-sheetof fs-rules" /></Page>;

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
  // the three (X2): the stream's lanes in their hues, and the rest page; through the door neither
  // X5: a ride Spark it named runs in its one hue (laneHues), only while that episode is live
  const ride = live && fixed?.ride && fixed.ride.id === live.fixationId ? fixed.ride : undefined;
  const hues = fixing && fixed ? laneHues({ ...fixed, ride }) : undefined;
  const sparked = (s: Sparked) => {
    const hue = fixed?.three.find(f => f?.id === s.episode.fixationId && !f?.locked)?.hue;
    setLanding(was => ({ k: s.step, seq: (was?.seq ?? 0) + 1, hue }));
    route(`/flow/${flow.id}/${s.step}`, true);
    setVersion(v => v + 1);
  };
  const landed = async (l?: Landed) => {
    await reload();
    if (l) setLanding(was => ({ k: at, seq: (was?.seq ?? 0) + 1, hue: l.hue }));
  };

  return (
    <Page label={flow.name} back={{ word: 'Flow', href: '#/flow' }} keepSettings door={door}>
      <div class="fs-sheetof fs-rules fs-flowpage" data-saved={writing ? 'false' : 'true'} data-showing={showing} data-door={doorOnly ? '' : undefined}>
        {!doorOnly && <HandOff live={live} />}
        <div class="fl-drawing" style={midStyle(flow.diagram)} data-own={own ? '' : undefined}>
          {wash > 0 && <Wash left={wash} />}
          {!doorOnly && !flow.locked && <Ghosts flowId={flow.id} diagram={flow.diagram} n={n} version={version} />}
          {/* M5: the stream, behind parts/Cycle and above the ghost rings; through the door too */}
          <Stream diagram={flow.diagram} paces={pacesOf(flow)} at={at} landing={landing} since={breath.held ? breath.since : null} hues={hues} />
          {!doorOnly && !flow.locked && <StampMarks flowId={flow.id} diagram={flow.diagram} n={n} version={version} onMarks={setMarks} />}
          <Cycle diagram={flow.diagram} stamps={marks} steps={flow.steps} at={at} showing={showing} live={(!!live || held > 0) && moved !== 0}
            disabled={!doorOnly && !!flow.locked} onRead={read} onMove={(v, to) => { setLanding(l => ({ k: to, seq: (l?.seq ?? 0) + 1 })); void move(v, to); }}
            halo={ringy && (onStep || breath.held) ? breath.since ?? 0 : false} held={breath.held} />
          <Clock from={onStep ? clockFrom(flow, live) : undefined} now={now} under={shown?.usualShort} holdable={ringy} breath={breath}
            awake={onStep && !!shown?.peak && !flow.quietClock} quiet={!!flow.quietClock} />
        </div>
        {shown ? (
          <section class="fl-step-page" aria-label={shown.name}>
            {ride && !doorOnly && <div class="fx-cards fx-riding"><FixationCard f={ride} now={now} ride /></div>}
            {shown.line && <p class="fl-line">{shown.line}</p>}
            {!doorOnly && <NoteAtStep flow={flow} step={shown} />}
            {!fixing && shown.said && <p class="fl-said fs-notstill">{shown.said}</p>}
            {!fixing && shown.usual && <p class="fl-usual fs-notstill">Usually: {shown.usual}</p>}
            {shown.usualShort && <p class="fl-usual fs-stillonly">{shown.usualShort}</p>}
            {(doorOnly || !flow.locked) && (
              <Tips step={shown} flowId={flow.id} flowTips={flow.steps.flatMap(s => s.tips)} live={live} still={still} now={now} door={doorOnly}
                onChanged={() => setVersion(v => v + 1)} />
            )}
          </section>
        ) : fixing ? (
          fixed && !doorOnly && <Fixations three={fixed.three} deck={fixed.deck} now={now} onChanged={landed} onSpark={sparked} />
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
        {!shown && sheets && !fixing && <AddStep flow={flow} onSaved={() => setVersion(v => v + 1)} />}
      </div>
      {shown && sheets && (
        <StepSheet flow={flow} step={shown} open={editing} onClose={() => setEditing(false)} onSaved={() => setVersion(v => v + 1)} />
      )}
    </Page>
  );
}
