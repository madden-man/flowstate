// A stop's page (PLAN-MOUNTAIN.md section 6 and pass 6, R3): what the page under a sign shows that is not a drawing.
// Pure but for the two reads at the bottom, which go through flows.ts and store like every model. No UI.
//
// At rest, one list of up to six rows: what he ticked in past episodes of these flows first (newest episode first, in
// the order he ticked them, as whatHelped reads them), then one On row gathering every pick under this sign, then the
// rest in seed order. No row twice: not the same words or nearly (sameRow), and one row per helper (one Ring row). The walk (branch walk, model/walk.ts shortList) will replace the inside of restRows; its shape,
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
import { DEPRESS } from '../db/seed/depress';

/** The most rows the page lists at rest. */
export const REST_MOST = 6;

/** Rows that only mean something with a live episode, or on their own step: never in the rest list. */
const STEP_ONLY: TipHelper[] = ['journal', 'timer', 'person', 'prediction', 'five'];

/** A row that may stand in the rest list: a check to tick, not wise, not printed, not struck, not tied to its step. */
const restable = (t: Tip) => !t.wise && !t.print && !t.struck && !(t.helper && STEP_ONLY.includes(t.helper));

/** Words too common to tell two rows apart. */
const COMMON = new Set(['the', 'and', 'your', 'you', 'with', 'for', 'then', 'into', 'from', 'that', 'this', 'than', 'any', 'one', 'a', 'an', 'or', 'on', 'in', 'of', 'to', 'it', 'is', 'if', 'at', 'as', 'by']);
/** A row's telling words: lower case, no punctuation, no common words. */
export const tellingWords = (text: string) =>
  new Set(text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !COMMON.has(w)));
/** Two rows say the same thing when three in four of the shorter one's telling words are in the other
 *  ("Cold water on your face" and "Cold water on your wrists and face"). */
export function sameRow(a: string, b: string): boolean {
  const x = tellingWords(a), y = tellingWords(b);
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  if (small.size < 2) return a.trim().toLowerCase() === b.trim().toLowerCase();
  let shared = 0;
  for (const w of small) if (big.has(w)) shared++;
  return shared / small.size >= 0.75;
}

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
  const helpers = new Set<TipHelper>();
  let onPut = false;
  const put = (t: Tip) => {
    if (out.length >= REST_MOST) return;
    if (t.helper === 'on') {
      if (onPut || !onRow) return;
      onPut = true;
      out.push(onRow);
      return;
    }
    // the same words, or nearly (two drawings under one sign often share a row), and one row per helper (one Ring)
    if (t.helper && helpers.has(t.helper)) return;
    if (out.some(o => sameRow(o.text, t.text))) return;
    if (t.helper) helpers.add(t.helper);
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

/** A hand-off line's words on a stop's page: "the Fight flow" reads as the sign it lands on, "the Throat chakra". When
 *  the flow it names is another drawing on this same page (What if to Panic, both under Root), naming the sign would
 *  point at the page he is on, so it reads as "the other steps here" (the drawings left the page, 2026-11-11). A line
 *  he wrote without "the ... flow" is left as he wrote it. */
export function handOffWords(text: string, to: ChakraId | undefined, here?: 'above' | 'below'): string {
  if (!to) return text;
  return text.replace(/\bthe\s+[^:;.]*?\s+flow\b/i, here ? 'the other steps here' : `the ${chakraOf(to).pageName}`);
}

/** Where each flow sits: its sign, or undefined (Energize, or one he has not placed). */
export type Homes = ReadonlyMap<string, ChakraId | undefined>;

/**
 * The lines printed on a stop's page, as tips PrintLines draws. With a step shown (flow and step): that step's printed
 * lines as the flow page printed them, and on a flow's first step its rest line. At rest: every printed line under the
 * sign that is not a hand-off, and every rest line. Hand-off words read as their sign (handOffWords).
 */
export function safetyLines(fs: Pick<Flow, 'id' | 'steps' | 'restLine'>[], homes: Homes, at?: { flowId: string; stepId: string }): Tip[] {
  const order = fs.map(f => f.id);
  const words = (t: Tip): Tip => {
    if (!t.handoff) return t;
    // another drawing on this page: say where it is on the page, not which sign
    const from = at ? order.indexOf(at.flowId) : -1, to = order.indexOf(t.handoff.flowId);
    const here = from >= 0 && to >= 0 && to !== from ? (to < from ? 'above' : 'below') : undefined;
    return { ...t, text: handOffWords(t.text, homes.get(t.handoff.flowId), here) };
  };
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

// ---------------------------------------------------------------- the safety line (PLAN-TASKS.md section 2)

/** The signs whose page prints the 988 line, with Call and Text, in every light. */
export const SAFE_SIGNS: readonly ChakraId[] = ['heart', 'root'];

/** The 988 line, as the seed already words it (Depress's last step), so the app writes nothing new. */
export const LINE_988: string = DEPRESS.steps.flatMap(s => s.tips).find(t => t.id === 'depress-4-988')!.text;

/** A printed line that is the 988 line (his copy of it, or the seed's). */
export const is988 = (t: Pick<Tip, 'text'>) => /\b988\b/.test(t.text);

/**
 * The page's own 988 line (SAFE_SIGNS), and the lines it prints besides. At rest the page's line stands for any 988
 * line among the flows' lines, so it is printed once. With a step shown that prints its own 988 line, the step keeps
 * it where it is and the page prints only Call and Text under it.
 */
export function safetyFoot(chakra: ChakraId, lines: Tip[], stepShown: boolean): { line?: string; links: boolean; lines: Tip[] } {
  if (!SAFE_SIGNS.includes(chakra)) return { links: false, lines };
  if (stepShown && lines.some(is988)) return { links: true, lines };
  return { line: LINE_988, links: true, lines: lines.filter(t => !is988(t)) };
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
