// A stop's page (PLAN-MOUNTAIN.md section 6 and pass 6, R3): #/flow/c/:chakra, and #/flow/:id and #/flow/:id/:step for
// any flow that sits under a sign, with that flow's drawing in view. Top to bottom: the plate (a close view of this
// stop's place on the mountain, ./chakra/Plate.tsx), one print line ("Root · feeling safe"), the gate (parts/Gate,
// written on release), how it gets blocked (the drawings, no flow name anywhere, ./chakra/Drawing.tsx), the rows, the
// printed safety lines, Edit. Under the plate the page is paper as before.
//
// The rows: with the dot on a step, or a step word tapped, that step's rows as Tips draws them (his own line, the said
// paragraph, "Usually", the words under the clock, the wise lines and the note to the next one leave the page; the data
// keeps them). At rest: one list of up to six (model/chakra-page.ts restRows), ticks there only drawn (walk it once).
// Safety stays: the 988 line, the doctor lines, the hand-offs (which read as the sign they land on), and 3 a.m.'s rest
// line printed on its first step (model/chakra-page.ts safetyLines).
//
// Which drawing is in front: the one the route names; else the one with an episode open; else none, and the page is at
// rest. A move on any drawing routes to that flow's step (replace, as FlowPage does), so the door, Right now, hand-offs
// and the app opening on a live episode all land here unchanged.
//
// FlowRoute is the one component the router renders for all three routes, so moving the dot from #/flow/c/root to
// #/flow/panic/1 keeps this page (preact-iso remounts only when the component changes). A flow with no sign (Energize,
// or one he made and left on its own) keeps the old FlowPage.
//
// Still (rule 13): no gate, no percent, no hue, no ghost rings or stamps, the sign open in the line colour, slow water.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Gate } from '../parts/Gate';
import { Redirect } from '../route';
import { FlowPage } from './FlowPage';
import { Tips } from './Tips';
import { PrintLines } from './PrintLines';
import { followHandOff } from './HandOff';
import { StepSheet, AddStep, tickSheet } from './StepSheet';
import { useNow } from './breath';
import { Plate } from './chakra/Plate';
import { Drawing } from './chakra/Drawing';
import { FromRow } from './chakra/From';
import { readGuard } from './chakra/fresh';
import { dataVersion } from '../sheets';
import { light } from '../light';
import type { Episode, Flow, Reading, Tip } from '../../db/schema';
import { gateState } from '../lock/pin';
import type { Read } from '../../db/fields';
import {
  CHAKRA_IDS, chakraOf, isChakraId, isStale, latestReadings, reach, spring, writeReading, type ChakraId,
} from '../../model/mountain';
import { chakraPageData, restRows, safetyLines } from '../../model/chakra-page';
import { currentStepId, flowById, lastEnded, liveEpisode, moveDot, placeOf, stepAt } from '../../model/flows';
import { isUnnamed } from '../../model/flow-make';
import './chakra/chakra.css';

/** Where each flow sits, as last read: so #/flow/:id knows its page without waiting on the database a second time. */
const known = new Map<string, ChakraId | null>();

/** The router's one component for #/flow/c/:chakra, #/flow/:id and #/flow/:id/:step. */
export function FlowRoute({ id, step, chakra }: { id?: string; step?: string; chakra?: string }) {
  const [, setRead] = useState(0);
  const home = chakra !== undefined ? (isChakraId(chakra) ? chakra : null) : id !== undefined ? known.get(id) : null;
  useEffect(() => {
    if (chakra !== undefined || id === undefined) return;
    let on = true;
    void flowById(id).then(f => {
      const c = f && isChakraId(f.chakra) ? f.chakra : null;
      if (known.get(id) !== c) { known.set(id, c); if (on) setRead(k => k + 1); }
    });
    return () => { on = false; };
  }, [id, chakra, dataVersion.value]);
  // #/flow/c with no sign is the mountain itself
  if ((chakra !== undefined && !home) || (id === 'c' && chakra === undefined)) return <Redirect to="/flow" />;
  if (home === undefined) return <Page label="Flow" back={{ word: 'Flow', href: '#/flow' }} keepSettings drawn={false}><div class="fs-sheetof fs-rules" /></Page>;
  // another sign is another page: a hand-off to it opens it afresh
  if (home) return <ChakraPage key={home} chakra={home} focus={chakra !== undefined ? undefined : id} step={step} />;
  return <FlowPage id={id!} step={step} />;
}

type Item = { flow: Read<Flow>; live?: Read<Episode>; last?: Read<Episode> };
type Loaded = {
  items: Item[]; homes: Map<string, ChakraId | undefined>; episodes: Read<Episode>[];
  readings: { mountain?: Reading; gates: Partial<Record<ChakraId, Reading>> };
};

export function ChakraPage({ chakra, focus, step }: { chakra: ChakraId; focus?: string; step?: string }) {
  const { route } = useLocation();
  const c = chakraOf(chakra);
  const [data, setData] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const [moved, setMoved] = useState<{ flowId: string; to: number } | null>(null);
  const [writing, setWriting] = useState(0);
  /** A read applies only if it is the newest and no write began after it started (./chakra/fresh.ts). */
  const guard = useMemo(readGuard, []);
  /** A hand-off to another drawing on this page asks for that drawing to come into view; nothing else here scrolls. */
  const bring = useRef(false);
  const [gateLive, setGateLive] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  /** The drawings opened on this visit: the first, whichever was in front, and any he tapped open. The rest stay folded,
   *  so a sign with two drawings (Root) is one drawing and a small second until he asks for it. */
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const now = useNow();
  const scrolled = useRef<string | undefined>(undefined);
  const page = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let on = true;
    const fresh = guard.read();
    (async () => {
      const [d, readings] = await Promise.all([chakraPageData(chakra), latestReadings()]);
      for (const [fid, h] of d.homes) known.set(fid, h ?? null);
      const items = await Promise.all(d.flows.map(async flow => ({ flow, live: await liveEpisode(flow.id), last: await lastEnded(flow.id) })));
      // a read that began before a move's write must not put the dot back where it was (FlowPage, F4): it is dropped,
      // and the read the write's own end asks for draws the page
      if (on && fresh()) { setData({ items, homes: d.homes, episodes: d.episodes, readings }); setMoved(null); }
    })();
    return () => { on = false; };
  }, [chakra, version, dataVersion.value]);

  // the drawing the route named comes into view when the page opens on it (#/flow/whatif/2 from outside), or when a
  // hand-off on this page goes to another drawing on it. A move or a step read here names its own drawing first
  // (scrolled), so the page never moves under the thumb that moved the dot (finding 4).
  useEffect(() => {
    if (!data || !focus || scrolled.current === focus) return;
    const first = scrolled.current === undefined, asked = bring.current;
    scrolled.current = focus;
    bring.current = false;
    if (!first && !asked) return;
    const el = page.current?.querySelector<HTMLElement>(`.ck-drawing[data-flow="${CSS.escape(focus)}"]`);
    if (el && el !== page.current?.querySelector('.ck-drawing')) el.scrollIntoView({ block: first ? 'center' : 'nearest' });
  }, [data, focus]);

  const back = { word: 'Flow', href: '#/flow' };
  if (!data) return <Page label={c.pageName} back={back} keepSettings drawn={false}><div class="fs-sheetof fs-rules ck-page" /></Page>;

  const { items, homes, episodes, readings } = data;
  const still = light.value === 'still';
  const placeNow = (it: Item) => (moved?.flowId === it.flow.id ? moved.to : it.live ? placeOf(it.flow, currentStepId(it.live)) : 0);
  const front = items.find(it => it.flow.id === focus) ?? items.find(it => it.live && placeNow(it) > 0);
  const asked = step ? Number(step) : 0;
  const frontAt = front ? placeNow(front) : 0;
  const showing = front ? (asked >= 1 && asked <= front.flow.steps.length ? asked : frontAt) : 0;
  const shown = front ? stepAt(front.flow, showing) : undefined;

  // the gate: as stored, or live under the finger; what reaches it from above is the spring and every gate above
  const i = CHAKRA_IDS.indexOf(chakra);
  const stored = readings.gates[chakra];
  const gate = gateLive ?? stored?.value ?? 0;
  const gates = CHAKRA_IDS.map(id => readings.gates[id]?.value ?? 0);
  const d = readings.mountain?.value ?? 0;
  const above = i === 0 ? spring(d) : reach(d, gates)[i - 1];

  const move = async (it: Item, visits: number[], to: number) => {
    const f = it.flow;
    keep(front?.flow.id, f.id);
    setMoved({ flowId: f.id, to });
    scrolled.current = f.id;
    const done = guard.write();
    route(to ? `/flow/${f.id}/${to}` : `/flow/${f.id}`, true);
    setWriting(w => w + 1);
    try {
      await moveDot(f.id, visits.map(k => f.steps[k - 1].id), to ? f.steps[to - 1].id : 'rest');
    } finally {
      done();
      setWriting(w => w - 1);
      setVersion(v => v + 1);
    }
  };
  const commitGate = async (v: number) => {
    setGateLive(v);
    const done = guard.write();
    // locked again under the thumb (LockedError): nothing is written, and the gate goes back to what was kept
    try { await writeReading(chakra, v); } catch { /* the PIN first */ } finally { done(); }
    const readings2 = await latestReadings().catch(() => null);
    if (readings2) setData(was => (was ? { ...was, readings: readings2 } : was));
    setGateLive(null);
    // a page read dropped while this wrote is read again
    setVersion(k => k + 1);
  };

  const live = front?.live;
  const isOpen = (it: Item, k: number) => k === 0 || it === front || !!it.live || opened.has(it.flow.id);
  // what was in front stays open when something else comes in front (a move, a read, a hand-off)
  const keep = (...ids: (string | undefined)[]) => setOpened(o => (ids.every(x => !x || o.has(x)) ? o : new Set([...o, ...ids.filter((x): x is string => !!x)])));
  // a hand-off: written, then the page read again (the episode it started is on a drawing this page may already show);
  // to another drawing here it stays this page, with that drawing brought into view, and no turn (a replace)
  const handOff = async (t: Tip, stepId: string) => {
    const here = !!t.handoff && homes.get(t.handoff.flowId) === chakra;
    keep(front?.flow.id, here ? t.handoff?.flowId : undefined);
    const done = guard.write();
    setWriting(w => w + 1);
    try {
      await followHandOff(t, stepId, live, to => { if (here) bring.current = true; route(to, here); });
    } finally {
      done();
      setWriting(w => w - 1);
      setVersion(v => v + 1);
    }
  };
  const sheets = !!front && !front.flow.locked;
  const rest = restRows(chakra, items.map(it => it.flow), episodes);
  const lines = safetyLines(items.map(it => it.flow), homes, front && shown ? { flowId: front.flow.id, stepId: shown.id } : undefined);
  // the wise lines leave the page with the copy (section 6); Tips draws everything else as it does today
  const rows = shown && { ...shown, tips: shown.tips.filter(t => !t.wise) };

  return (
    <Page label={c.pageName} back={back} keepSettings>
      <div ref={page} class="fs-sheetof fs-rules fs-flowpage ck-page" data-chakra={chakra} data-saved={writing ? 'false' : 'true'}
        data-front={front?.flow.id} data-showing={showing} data-gating={gateLive !== null ? '' : undefined}>
        <Plate chakra={chakra} gate={still ? 0 : gate} above={still ? 1 : above} />
        <p class="ck-gloss">{c.gloss}</p>
        <Gate value={gate} hue={c.hue} label={c.name} stale={!!stored && isStale(stored, now)}
          disabled={gateState() === 'locked'} onInput={setGateLive} onCancel={() => setGateLive(null)} onCommit={v => void commitGate(v)} />
        {live && <FromRow live={live} homes={homes} page={{ chakra, order: items.map(x => x.flow.id), front: front!.flow.id }} />}
        {items.map((it, k) => {
          const at = placeNow(it);
          if (!isOpen(it, k)) {
            return <Drawing key={it.flow.id} flow={it.flow} at={at} showing={0} focused={false} onStep={false} moving={false} version={version} now={now}
              onRead={() => {}} onMove={() => {}} folded onOpen={() => setOpened(o => new Set([...o, it.flow.id]))} />;
          }
          const isFront = it === front;
          const sh = isFront ? showing : at;
          return (
            <Drawing key={it.flow.id} flow={it.flow} live={it.live} at={at} showing={sh} focused={isFront}
              onStep={!!it.live && moved === null && sh > 0 && sh === at} moving={moved?.flowId === it.flow.id}
              version={version} now={now}
              onRead={k => { keep(front?.flow.id, it.flow.id); scrolled.current = it.flow.id; route(`/flow/${it.flow.id}/${k}`, true); }} onMove={(v, to) => void move(it, v, to)} />
          );
        })}
        {front && rows ? (
          <section class="fl-step-page ck-rows" aria-label={rows.name}>
            {!front.flow.locked && (
              <Tips key={`${front.flow.id}-${rows.id}`} step={rows} flowId={front.flow.id} flowTips={front.flow.steps.flatMap(s => s.tips)}
                live={live} still={still} now={now} onChanged={() => setVersion(v => v + 1)} />
            )}
          </section>
        ) : (
          <section class="fl-step-page ck-rows" aria-label="At rest">
            <Tips key={rest.id} step={rest} flowTips={[]} still={still} now={now} onChanged={() => setVersion(v => v + 1)} />
          </section>
        )}
        <PrintLines step={{ tips: lines }}
          onHandOff={shown ? t => void handOff(t, shown.id) : undefined} />
        {shown && sheets && !live && (
          <p class="fl-edit fs-notstill"><button type="button" class="fs-word" onClick={() => { tickSheet(); setEditing(true); }}>Edit</button></p>
        )}
        {!shown && front && !front.flow.locked && front.flow.steps.some(isUnnamed) && <AddStep flow={front.flow} onSaved={() => setVersion(v => v + 1)} />}
      </div>
      {front && shown && sheets && (
        <StepSheet flow={front.flow} step={shown} open={editing} onClose={() => setEditing(false)} onSaved={() => setVersion(v => v + 1)} />
      )}
    </Page>
  );
}
