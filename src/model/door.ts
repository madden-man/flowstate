// The door without the PIN (PLAN-FLOWS.md 3.7, F5): which routes the lock lets through when the door is on, what a
// flow reads as before the PIN, and the Right now rows. No UI, no writes.
//
// What the door can show. A flow's words are sealed (db/fields.ts flowSpec): locked, a row keeps only its ids, the
// diagram, helpers, spans, the peak and the struck flags. So before the PIN the door reads a flow's words from its
// seed (db/seed-flows.ts) by flow id and step id, in the stored step order: the seed revision, never his rewrite.
// A step or tip he added has no seed, so it shows no words; a struck seed tip stays hidden. A flow he made himself
// has no seed and no words before the PIN.
import type { Flow, Step } from '../db/schema';
import type { Read } from '../db/fields';
import { SEED_FLOWS } from '../db/seed-flows';
import { isChakraId } from './mountain';

/** The hashes the lock lets through with the door on: Right now, a flow's step, Meditate (PLAN-MEDITATE.md S3: it
 *  holds nothing private) and a sign's page (PLAN-TASKS.md section 7). Nothing else: #/flow/meditate/:step is no flow's step and stays behind the keypad. */
export function doorPasses(path: string, doorOn: boolean): boolean {
  if (!doorOn) return false;
  const p = path.split('?')[0].replace(/\/+$/, '');
  if (p === '/flow/now' || p === '/flow/meditate') return true;
  // a sign's page (PLAN-TASKS.md section 7): the place and the touches that write nothing
  const c = /^\/flow\/c\/([^/]+)$/.exec(p);
  if (c) return isChakraId(c[1]);
  const m = /^\/flow\/([^/]+)\/(\d+)$/.exec(p);
  // Research (PLAN-RESEARCH.md section 2) is never let through: its key and its questions are sealed under the PIN
  return !!m && m[1] !== 'now' && m[1] !== 'meditate' && m[1] !== 'research' && Number(m[2]) >= 1;
}

const blank = (st: Step): Step => ({ id: st.id, name: '', tips: [], spanMin: st.spanMin, peak: st.peak });

/** A flow as the door may show it: open rows as they are; a locked row with its seed's words laid back on. */
export function doorRead(flow: Read<Flow>): Read<Flow> {
  if (!flow.locked) return flow;
  const seed = SEED_FLOWS.find(f => f.id === flow.id);
  if (!seed) return { ...flow, steps: flow.steps.map(blank) };
  return {
    ...flow,
    name: seed.name,
    line: seed.line,
    steps: flow.steps.map(st => {
      const s = seed.steps.find(x => x.id === st.id);
      if (!s) return blank(st);
      const tips = st.tips
        .filter(t => !t.struck)
        .map(t => s.tips.find(x => x.id === t.id))
        .filter((t): t is NonNullable<typeof t> => !!t)
        // print and handoff (F3, F4) keep a printed line printed through the door, never a row
        .map(t => ({ id: t.id, text: t.text, short: t.short, helper: t.helper, wise: t.wise, print: t.print, handoff: t.handoff }));
      return { ...s, tips, spanMin: st.spanMin, peak: st.peak };
    }),
  };
}

/** One Right now row: his line for a step (or none), the flow and the step in print, and where it leads. */
export type NowRow = { flowId: string; flow: string; step: number; stepId: string; name: string; line?: string };

/** Every step of every flow, in flow order then step order. A step with neither a line nor a name is left out. */
export function nowRows(fs: Read<Flow>[]): NowRow[] {
  return fs.flatMap(f => f.steps.map((s, i) => ({ flowId: f.id, flow: f.name, step: i + 1, stepId: s.id, name: s.name, line: s.line || undefined })))
    .filter(r => r.line || r.name);
}
