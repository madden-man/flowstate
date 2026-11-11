// A stop's page (PLAN-MOUNTAIN.md section 6 and pass 6, R3): what the page under a sign shows that is not a drawing.
// Pure but for the two reads at the bottom, which go through flows.ts and store like every model. No UI.
//
// At rest, one list of up to six rows: what he ticked in past episodes of these flows first (newest episode first, in
// the order he ticked them, as whatHelped reads them), then one On row gathering every pick under this sign, then the
// rest in seed order. The walk (branch walk, model/walk.ts shortList) will replace the inside of restRows; its shape,
// a step the Tips rows can draw, stays.
//
// Safety stays (section 6): the 988 line, the doctor lines and the hand-offs. A hand-off that named a flow reads as
// the sign it now lands on ("If it's hot: the Throat chakra."). 3 a.m.'s rest line becomes a print line on its first
// step. At rest the page prints every line that is not a hand-off (a hand-off belongs to the step it leaves from).
import type { ChakraId } from './mountain';
import { chakraOf, flowsUnder, isChakraId } from './mountain';
import type { Episode, Flow, OnPick, Step, Tip, TipHelper } from '../db/schema';
import type { Read } from '../db/fields';
import { episodesOf, flows } from './flows';

/** The most rows the page lists at rest. */
export const REST_MOST = 6;

/** Rows that only mean something with a live episode, or on their own step: never in the rest list. */
const STEP_ONLY: TipHelper[] = ['journal', 'timer', 'person', 'prediction', 'five'];

/** A row that may stand in the rest list: a check to tick, not wise, not printed, not struck, not tied to its step. */
const restable = (t: Tip) => !t.wise && !t.print && !t.struck && !(t.helper && STEP_ONLY.includes(t.helper));

/** The id of the rest list's one On row. Not a stored tip: a tick on it at rest only draws. */
export const REST_ON_ID = 'rest-on';
/** The rest list's step id, per sign, so the rows reset when the sign changes. */
export const restStepId = (c: ChakraId) => `rest-${c}`;

/**
 * The rows at rest, as a step the Tips rows draw: up to REST_MOST tips, and the picks of every On row under the sign
 * (struck picks left out, the same title once), so the one On row's sheet offers them all.
 * episodes are the flows' episodes, any order; only ended ones count as past.
 */
export function restRows(chakra: ChakraId, fs: Pick<Flow, 'id' | 'steps'>[], episodes: Pick<Episode, 'flowId' | 'endedAt' | 'done'>[]): Step {
  const tips = fs.flatMap(f => f.steps.flatMap(s => s.tips.map(t => ({ t, s }))));
  const byId = new Map(tips.map(x => [x.t.id, x]));
  const ids = new Set(fs.map(f => f.id));

  // every pick of every On row under the sign, in seed order, one per title
  const picks: OnPick[] = [];
  const titles = new Set<string>();
  for (const { t, s } of tips) {
    if (t.helper !== 'on' || t.struck) continue;
    for (const p of s.picks ?? []) {
      if (p.struck || titles.has(p.title)) continue;
      titles.add(p.title);
      picks.push(p);
    }
  }
  const firstOn = tips.find(x => x.t.helper === 'on' && !x.t.struck)?.t;
  const onRow: Tip | undefined = firstOn && { id: REST_ON_ID, text: firstOn.text, short: firstOn.short, helper: 'on' };

  const out: Tip[] = [];
  const said = new Set<string>();
  let onPut = false;
  const put = (t: Tip) => {
    if (out.length >= REST_MOST) return;
    if (t.helper === 'on') {
      if (onPut || !onRow) return;
      onPut = true;
      out.push(onRow);
      return;
    }
    const words = t.text.trim().toLowerCase();
    if (said.has(words)) return;
    said.add(words);
    out.push(t);
  };

  // 1. ticked in past episodes: the newest ended episode first, each in the order he ticked
  const past = episodes.filter(e => ids.has(e.flowId) && e.endedAt !== undefined).sort((a, b) => b.endedAt! - a.endedAt!);
  for (const e of past) {
    for (const d of [...e.done].sort((a, b) => a.at - b.at)) {
      const x = byId.get(d.tipId);
      if (x && restable(x.t)) put(x.t);
    }
  }
  // 2. the On row, gathering every pick
  if (onRow && !onPut && out.length < REST_MOST) put(onRow);
  // 3. the rest, in seed order (the flows' order, their steps', their rows')
  for (const { t } of tips) if (restable(t)) put(t);

  return { id: restStepId(chakra), name: chakraOf(chakra).name, tips: out, picks };
}

// ---------------------------------------------------------------- safety

/** The page's id for a flow's rest line printed as a line (3 a.m.'s doctor line). */
export const restLineId = (flowId: string) => `${flowId}-rest-line`;

/** A hand-off line's words on a stop's page: "the Fight flow" reads as the sign it lands on, "the Throat chakra". A
 *  line he wrote without "the ... flow" is left as he wrote it. */
export function handOffWords(text: string, to: ChakraId | undefined): string {
  if (!to) return text;
  return text.replace(/\bthe\s+[^:;.]*?\s+flow\b/i, `the ${chakraOf(to).pageName}`);
}

/** Where each flow sits: its sign, or undefined (Energize, or one he has not placed). */
export type Homes = ReadonlyMap<string, ChakraId | undefined>;

/**
 * The lines printed on a stop's page, as tips PrintLines draws. With a step shown (flow and step): that step's printed
 * lines as the flow page printed them, and on a flow's first step its rest line. At rest: every printed line under the
 * sign that is not a hand-off, and every rest line. Hand-off words read as their sign (handOffWords).
 */
export function safetyLines(fs: Pick<Flow, 'id' | 'steps' | 'restLine'>[], homes: Homes, at?: { flowId: string; stepId: string }): Tip[] {
  const words = (t: Tip): Tip => (t.handoff ? { ...t, text: handOffWords(t.text, homes.get(t.handoff.flowId)) } : t);
  const rest = (f: Pick<Flow, 'id' | 'restLine'>): Tip[] => (f.restLine?.trim() ? [{ id: restLineId(f.id), text: f.restLine.trim(), print: true }] : []);
  if (at) {
    const f = fs.find(x => x.id === at.flowId);
    const i = f ? f.steps.findIndex(s => s.id === at.stepId) : -1;
    if (!f || i < 0) return [];
    const lines = f.steps[i].tips.filter(t => t.print && !t.struck).map(words);
    return i === 0 ? [...rest(f), ...lines] : lines;
  }
  const seen = new Set<string>();
  return fs.flatMap(f => [...rest(f), ...f.steps.flatMap(s => s.tips.filter(t => t.print && !t.struck && !t.handoff))])
    .filter(t => !seen.has(t.text) && !!seen.add(t.text));
}

// ---------------------------------------------------------------- reads

/** Every flow's sign, for hand-off words and for #/flow/:id choosing its page. */
export async function homes(): Promise<Map<string, ChakraId | undefined>> {
  return new Map((await flows()).map(f => [f.id, isChakraId(f.chakra) ? f.chakra : undefined]));
}

/** What a stop's page reads: the flows under the sign, every flow's sign, and the past episodes of those flows. */
export async function chakraPageData(chakra: ChakraId): Promise<{ flows: Read<Flow>[]; homes: Map<string, ChakraId | undefined>; episodes: Read<Episode>[] }> {
  const [under, h] = await Promise.all([flowsUnder(chakra), homes()]);
  const episodes = (await Promise.all(under.map(f => episodesOf(f.id)))).flat();
  return { flows: under, homes: h, episodes };
}
