// A stop's page (PLAN-MOUNTAIN.md section 6 and pass 6, R3): #/flow/c/:chakra. Top to bottom: the plate (a close view
// of this stop's place on the mountain, ./chakra/Plate.tsx), one print line ("Root · feeling safe"), the gate
// (parts/Gate, written on release), the Blockers, the shelf, the three questions, the printed safety lines.
//
// The place is the page (PLAN-TASKS.md T1): the plate is twelve rules tall with the sign's touch words printed on it
// (./chakra/Touches.tsx, every tap through ./chakra/touch.ts onTouch), and under it a paper foot: the gloss, the gate,
// what blocks the sign (./chakra/Blockers.tsx, PLAN-BLOCKERS.md K3), the sign's shelf, its three questions
// (./chakra/Asks.tsx, rule 37), the printed lines and, on Heart and Root, the 988 line with Call and Text.
//
// One thing at rest, always (PLAN-BLOCKERS.md decision 10): no flow is ever in front here. A flow under a sign has its
// own page again (FlowPage, with its drawing), reached by a tap on its Blockers row; a live episode, Right now,
// hand-offs and the door land there, and its way back is the sign it was opened from (./chakra/Blockers.tsx backSignOf).
// Safety stays at rest: the 988 line, the doctor lines and 3 a.m.'s rest line (model/chakra-page.ts safetyLines).
//
// FlowRoute is the one component the router renders for #/flow/c/:chakra, #/flow/:id and #/flow/:id/:step: a sign
// goes to its page, every flow to FlowPage.
//
// Still (rule 13): no gate, no percent, no hue, the sign open in the line colour, slow water, the Blockers' names only.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Page } from '../parts/Page';
import { Gate } from '../parts/Gate';
import { Redirect } from '../route';
import { FlowPage } from './FlowPage';
import { PrintLines } from './PrintLines';
import { askPin } from './door';
import { useNow } from './breath';
import { Plate } from './chakra/Plate';
import { Touches } from './chakra/Touches';
import { SignShelf } from './chakra/SignShelf';
import { Asks, Ground } from './chakra/Asks';
import { Blockers, lastSign } from './chakra/Blockers';
import { readGuard } from './chakra/fresh';
import { asks, settle } from './chakra/surge';
import { dataVersion } from '../sheets';
import { light } from '../light';
import type { Flow, Reading } from '../../db/schema';
import { gateState } from '../lock/pin';
import type { Read } from '../../db/fields';
import {
  CHAKRA_IDS, chakraOf, isChakraId, isStale, latestReadings, reach, spring, writeReading, type ChakraId,
} from '../../model/mountain';
import { chakraPageData, safetyFoot, safetyLines } from '../../model/chakra-page';
import './chakra/chakra.css';

/** The router's one component for #/flow/c/:chakra, #/flow/:id and #/flow/:id/:step. */
export function FlowRoute({ id, step, chakra }: { id?: string; step?: string; chakra?: string }) {
  // #/flow/c with no sign, or one that is not a sign, is the mountain itself
  if (chakra !== undefined) return isChakraId(chakra) ? <ChakraPage key={chakra} chakra={chakra} /> : <Redirect to="/flow" />;
  if (id === undefined || id === 'c') return <Redirect to="/flow" />;
  return <FlowPage key={id} id={id} step={step} />;
}

/** The 988 line and its Call and Text (PLAN-TASKS.md section 2), printed on Heart and Root in every light. */
function SafeLine({ line, links }: { line?: string; links: boolean }) {
  if (!links) return null;
  return (
    <div class="ck-safe">
      {line && <p class="ck-safe-line">{line}</p>}
      <p class="ck-safe-links"><a class="ck-safe-link" href="tel:988">Call 988</a><a class="ck-safe-link" href="sms:988">Text 988</a></p>
    </div>
  );
}

/** A sign's page through the door, without the PIN (PLAN-TASKS.md section 7): the place, the gloss, the touches that
 *  happen in the place and write nothing (door: true), the sign's grounding question as print (PLAN-SIGN-LINES.md
 *  section 5: no word of his in it; no tap, the journal is locked; gone in Still), and the 988 line. No gate, no shelf, no flow: what he set and
 *  what he wrote stay behind the PIN, so the plate is drawn open, as in Still. The way back asks for the PIN. */
export function DoorChakraPage({ chakra }: { chakra: string }) {
  if (!isChakraId(chakra)) return <Redirect to="/flow/now" />;
  const c = chakraOf(chakra);
  const still = light.value === 'still';
  const foot = safetyFoot(chakra, [], false);
  return (
    <Page label={c.pageName} back={{ word: 'Flow', href: '#/flow' }} door={{ ask: askPin }}>
      <div class="fs-sheetof fs-rules fs-flowpage ck-page" data-chakra={chakra} data-door="">
        <Plate chakra={chakra} gate={0} above={1}>
          <Touches chakra={chakra} door still={still} />
        </Plate>
        <p class="ck-gloss">{c.gloss}</p>
        <Ground chakra={chakra} />
        <SafeLine line={foot.line} links={foot.links} />
      </div>
    </Page>
  );
}

type Loaded = {
  flows: Read<Flow>[]; homes: Map<string, ChakraId | undefined>;
  readings: { mountain?: Reading; gates: Partial<Record<ChakraId, Reading>> };
};

export function ChakraPage({ chakra }: { chakra: ChakraId }) {
  const c = chakraOf(chakra);
  const [data, setData] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  /** A read applies only if it is the newest and no write began after it started (./chakra/fresh.ts). */
  const guard = useMemo(readGuard, []);
  const [gateLive, setGateLive] = useState<number | null>(null);
  const now = useNow();
  // a flow's page opened from here goes back here (FlowPage, ./chakra/Blockers.tsx backSignOf)
  useEffect(() => { lastSign.value = chakra; }, [chakra]);

  useEffect(() => {
    let on = true;
    const fresh = guard.read();
    (async () => {
      const [d, readings] = await Promise.all([chakraPageData(chakra), latestReadings()]);
      if (on && fresh()) setData({ flows: d.flows, homes: d.homes, readings });
    })();
    return () => { on = false; };
  }, [chakra, version, dataVersion.value]);

  // no Settings on a sign's header: its name is there ("Solar plexus chakra"), so the way back takes Settings' place,
  // as on a question page; Settings is on the mountain, one tap back
  const back = { word: 'Flow', href: '#/flow' };
  if (!data) return <Page label={c.pageName} back={back} drawn={false}><div class="fs-sheetof fs-rules ck-page" /></Page>;

  const { flows, homes, readings } = data;
  const still = light.value === 'still';

  // the gate: as stored, or live under the finger; what reaches it from above is the spring and every gate above
  const i = CHAKRA_IDS.indexOf(chakra);
  const stored = readings.gates[chakra];
  const gate = gateLive ?? stored?.value ?? 0;
  const gates = CHAKRA_IDS.map(id => readings.gates[id]?.value ?? 0);
  const d = readings.mountain?.value ?? 0;
  const above = i === 0 ? spring(d) : reach(d, gates)[i - 1];

  const commitGate = async (v: number) => {
    setGateLive(v);
    settle(chakra);
    const done = guard.write();
    // locked again under the thumb (LockedError): nothing is written, and the gate goes back to what was kept
    try { await writeReading(chakra, v); } catch { /* the PIN first */ } finally { done(); }
    const readings2 = await latestReadings().catch(() => null);
    if (readings2) setData(was => (was ? { ...was, readings: readings2 } : was));
    setGateLive(null);
    // a page read dropped while this wrote is read again
    setVersion(k => k + 1);
  };

  // at rest, always (PLAN-BLOCKERS.md decision 10): every printed line under the sign that is not a hand-off
  const foot = safetyFoot(chakra, safetyLines(flows, homes), false);

  return (
    <Page label={c.pageName} back={back}>
      <div class="fs-sheetof fs-rules fs-flowpage ck-page" data-chakra={chakra} data-gating={gateLive !== null ? '' : undefined}>
        <Plate chakra={chakra} gate={still ? 0 : gate} above={still ? 1 : above}>
          <Touches chakra={chakra} still={still} />
        </Plate>
        <p class="ck-gloss">{c.gloss}</p>
        {/* a surge makes the gate ask afresh (./chakra/surge.ts): drawn anew, so a touch before it does not hide the dash */}
        <Gate key={asks(chakra) ? 'asks' : 'rests'} value={gate} hue={c.hue} label={c.name} stale={(!!stored && isStale(stored, now)) || asks(chakra)}
          disabled={gateState() === 'locked'} onInput={setGateLive} onCancel={() => setGateLive(null)} onCommit={v => void commitGate(v)} />
        {/* what shuts it (PLAN-BLOCKERS.md decision 8): the flows under the sign, a tap opening each one's own page */}
        <Blockers chakra={chakra} />
        {/* the sign's music shelf (PLAN-TASKS.md T5): renders nothing while locked */}
        <SignShelf chakra={chakra} />
        {/* its three questions (DESIGN.md rule 37): a tap opens today's page on one; nothing while locked or in Still */}
        <Asks chakra={chakra} />
        <PrintLines step={{ tips: foot.lines }} />
        <SafeLine line={foot.line} links={foot.links} />
      </div>
    </Page>
  );
}
