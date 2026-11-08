// What to do at each step (PLAN-FLOWS.md section 6, F2): the tips ticked on an episode, the Five lines, the return
// time, the journal link, the clock in the middle of the drawing, "what helped", and the step sheet's edits. Every
// read and write goes through store, so sealing works. No UI. Nothing here counts or compares episodes (rule 15):
// the clock is minutes since this episode's own peak, and "what helped" is the last episode's ticks, as words.
import type { Episode, Flow, Page, Step, Tip } from '../db/schema';
import { store, type Read } from '../db/fields';
import { newPage, today } from './pages';
import { currentStepId } from './flows';

const MIN = 60_000;

// ---------------------------------------------------------------- the episode's own writes

/** A live episode, or undefined when it has ended, is locked or is gone (a tick at rest only draws). */
async function liveRow(episodeId: string): Promise<Read<Episode> | undefined> {
  const e = await store.get('episodes', episodeId);
  return e && !e.locked && e.endedAt === undefined ? e : undefined;
}

/** A tip ticked (on) or un-ticked (off) on a live episode. Ticking twice keeps the first time. */
export async function setDone(episodeId: string, tipId: string, on: boolean, at = Date.now()): Promise<Episode | undefined> {
  const e = await liveRow(episodeId);
  if (!e) return undefined;
  const had = e.done.some(d => d.tipId === tipId);
  if (on === had) return e;
  const done = on ? [...e.done, { tipId, at }] : e.done.filter(d => d.tipId !== tipId);
  const next = { ...e, done };
  await store.put('episodes', next);
  return next;
}

/** The ids ticked on an episode. */
export const doneIds = (e: Pick<Episode, 'done'> | undefined) => new Set(e?.done.map(d => d.tipId) ?? []);

/** The Five helper's lines, kept on the episode (sealed), never on the journal. Empty lines at the end are dropped. */
export async function setLines(episodeId: string, lines: string[]): Promise<Episode | undefined> {
  const e = await liveRow(episodeId);
  if (!e) return undefined;
  const kept = [...lines];
  while (kept.length && !kept.at(-1)!.trim()) kept.pop();
  const next = { ...e, lines: kept.length ? kept : undefined };
  await store.put('episodes', next);
  return next;
}

// ---------------------------------------------------------------- the return time (the Timer helper)

/** The least a return time can be: twenty minutes (PLAN-FLOWS.md 3.4, Fight: twenty minutes is the clinical minimum). */
export const RETURN_MIN_MS = 20 * MIN;
/** The most: a day. */
export const RETURN_MAX_MS = 24 * 60 * MIN;

/** The earliest return, rounded up to the next five minutes, so the clock time is one a person says. */
export function earliestReturn(now: number): number {
  const d = new Date(now + RETURN_MIN_MS);
  const m = d.getMinutes(), up = (5 - (m % 5)) % 5;
  d.setMinutes(m + up, 0, 0);
  return d.getTime();
}

/** A clock time ("22:30") picked for the return, as the next such time 20 minutes to 24 hours away. A time inside the
 *  first twenty minutes is too soon: it becomes the earliest. */
export function returnFor(hhmm: string, now: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return earliestReturn(now);
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  let t = d.getTime();
  while (t < now) t += 24 * 60 * MIN;
  if (t - now < RETURN_MIN_MS) return earliestReturn(now);
  return Math.min(t, now + RETURN_MAX_MS);
}

export async function setReturnAt(episodeId: string, at: number | undefined): Promise<Episode | undefined> {
  const e = await liveRow(episodeId);
  if (!e) return undefined;
  const next = { ...e, returnAt: at };
  await store.put('episodes', next);
  return next;
}

/** What the page says about the return time: before it, "back at"; twenty minutes after it was set, "slower now?";
 *  at it, "ready?" (PLAN-FLOWS.md 3.4 and 3.7, "Softened"). Never a notification: the page says it when it is open.
 *  setAt is when the timer row was ticked. */
export type ReturnPhase = 'waiting' | 'slower' | 'ready';
export function returnPhase(returnAt: number, setAt: number | undefined, now: number): ReturnPhase {
  if (now >= returnAt) return 'ready';
  if (setAt !== undefined && now - setAt >= RETURN_MIN_MS) return 'slower';
  return 'waiting';
}

// ---------------------------------------------------------------- the clock in the middle

/** Where the clock counts from: the peak mark if the dot reached the peak, else the episode's start. */
export function clockFrom(flow: Pick<Flow, 'steps'>, e: Pick<Episode, 'startedAt' | 'marks'>): number {
  const peak = flow.steps.find(s => s.peak);
  const mark = peak && e.marks.find(m => m.stepId === peak.id);
  return mark?.at ?? e.startedAt;
}

/** Whole minutes since the clock's start (never below zero). */
export const clockMinutes = (from: number, now: number) => Math.max(0, Math.floor((now - from) / MIN));

/** The clock in Day and Night: "6 minutes in". */
export function clockWords(minutes: number): string {
  if (minutes < 1) return 'under a minute in';
  if (minutes < 120) return `${minutes} minute${minutes === 1 ? '' : 's'} in`;
  return `about ${Math.round(minutes / 60)} hours in`;
}

/** The clock in Still: words only, no digit (rule 13). */
export function clockStill(minutes: number): string {
  if (minutes < 10) return 'a few minutes in';
  if (minutes < 60) return 'a while in';
  return 'an hour or more in';
}

/** The wash under the last step: ink at its strongest when the dot reaches the step, gone by the end of the step's
 *  usual span. A number from 0 to 1, the share of the wash left. */
export function washLeft(markedAt: number, spanMs: number, now: number): number {
  if (spanMs <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (now - markedAt) / spanMs));
}

// ---------------------------------------------------------------- what the page shows

/** The tip rows a step shows: struck ones never (they stay in the step sheet, rule 10), not a print line (F3's
 *  PrintLines prints those under the rows, never as a check); at most six, three in Still. A person row (F6) shows
 *  named or not (an unnamed one reads as the slot to fill), and always: past the cap it is added at the end. */
export function shownTips(step: Pick<Step, 'tips'>, still: boolean): Tip[] {
  const rows = step.tips.filter(t => !t.struck && !t.print);
  const shown = rows.slice(0, still ? 3 : 6);
  // Still hides the person's number, never the row (PLAN-FLOWS.md 3.7): a person row past the cap still shows
  return [...shown, ...rows.filter(t => t.helper === 'person' && !shown.includes(t))];
}

/** A tip's words: the short form in Still, where there is one. */
export const tipText = (t: Pick<Tip, 'text' | 'short'>, still: boolean) => (still && t.short ? t.short : t.text);

/** "What helped": the tips ticked in an episode, in the order they were ticked, short where there is a short form.
 *  Words only; a tip since deleted from the flow is left out. */
export function whatHelped(flow: Pick<Flow, 'steps'>, e: Pick<Episode, 'done'> | undefined): string[] {
  if (!e) return [];
  const byId = new Map(flow.steps.flatMap(s => s.tips.map(t => [t.id, t] as const)));
  return [...e.done].sort((a, b) => a.at - b.at).flatMap(d => {
    const t = byId.get(d.tipId);
    return t && !t.wise ? [t.short ?? t.text] : [];
  });
}

// ---------------------------------------------------------------- the journal link (the Journal helper)

/** Today's page, linked to the episode both ways: page.flow on the page, pageId on the episode. A day with no page
 *  yet gets an empty one (nothing written: it stays off every list until a word is, like any fresh page). */
export async function linkToday(episodeId: string, now = Date.now()): Promise<Read<Page> | undefined> {
  const e = await liveRow(episodeId);
  if (!e) return undefined;
  const t = await today(new Date(now));
  const page: Read<Page> = t.page ? { ...t.page, flow: { episodeId }, updatedAt: now } : newPage('entry', now, { flow: { episodeId } });
  await store.many({ pages: [page], episodes: [{ ...e, pageId: page.id }] });
  return page;
}

/** What a journal page linked to an episode shows: the flow, when it began (and ended), and the step, now if live. */
export type FlowLinkRow = { href: string; flow: string; startedAt: number; endedAt?: number; step: string; live: boolean };

export async function flowLinkOf(page: Pick<Page, 'flow'>): Promise<FlowLinkRow | undefined> {
  if (!page.flow) return undefined;
  const e = await store.get('episodes', page.flow.episodeId);
  if (!e) return undefined;
  const flow = await store.get('flows', e.flowId);
  if (!flow || flow.locked) return undefined;
  const sid = currentStepId(e);
  const n = flow.steps.findIndex(s => s.id === sid) + 1;
  const live = e.endedAt === undefined;
  return {
    href: live && n ? `#/flow/${flow.id}/${n}` : `#/flow/${flow.id}`,
    flow: flow.name, startedAt: e.startedAt, endedAt: e.endedAt, step: n ? flow.steps[n - 1].name : '', live,
  };
}

// ---------------------------------------------------------------- the step sheet

/** The words of a step the sheet edits. */
export type StepDraft = Pick<Step, 'name' | 'line' | 'said' | 'usual' | 'tips'>;

const same = (a: StepDraft, b: StepDraft) => JSON.stringify([a.name, a.line ?? '', a.said ?? '', a.usual ?? '', a.tips])
  === JSON.stringify([b.name, b.line ?? '', b.said ?? '', b.usual ?? '', b.tips]);

/** Saves a step's words. The new version of the flow joins its revisions (the first revision is the seed text, so the
 *  list is every version, oldest first, and the newest is what the page shows). An unchanged draft writes nothing. */
export async function saveStep(flowId: string, stepId: string, draft: StepDraft, now = Date.now()): Promise<Flow | undefined> {
  const flow = await store.get('flows', flowId);
  if (!flow || flow.locked) return undefined;
  const i = flow.steps.findIndex(s => s.id === stepId);
  if (i < 0 || same(flow.steps[i], draft)) return flow;
  const clean = (s?: string) => (s?.trim() ? s.trim() : undefined);
  const step: Step = {
    ...flow.steps[i], name: draft.name.trim() || flow.steps[i].name, line: clean(draft.line), said: clean(draft.said), usual: clean(draft.usual),
    tips: draft.tips.filter(t => t.text.trim()).map(t => ({ ...t, text: t.text.trim() })),
  };
  const steps = flow.steps.map((s, k) => (k === i ? step : s));
  const next: Flow = { ...flow, steps, updatedAt: now, revisions: [...flow.revisions, { at: now, name: flow.name, steps: structuredClone(steps) }] };
  await store.put('flows', next);
  return next;
}

/** A new tip for the sheet's "+ thing". */
export const newTip = (): Tip => ({ id: crypto.randomUUID(), text: '' });

/** One tip moved to place `to` in the list. */
export function moveTip(tips: Tip[], id: string, to: number): Tip[] {
  const from = tips.findIndex(t => t.id === id);
  if (from < 0) return tips;
  const out = [...tips];
  const [t] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, t);
  return out;
}

/** Earlier words of one step (rule 10: struck through, never hidden): every earlier version of its name, line, said,
 *  usual and each tip's text that the newest no longer says, and every struck tip, with the day it was replaced or
 *  struck. Newest first. */
export type Earlier = { text: string; at: number };
export function earlierOf(flow: Pick<Flow, 'revisions' | 'steps'>, stepId: string): Earlier[] {
  const now = flow.steps.find(s => s.id === stepId);
  if (!now) return [];
  const words = (s: Step | undefined) => (s ? [s.name, s.line, s.said, s.usual, ...s.tips.filter(t => !t.struck).map(t => t.text)]
    .filter((w): w is string => !!w?.trim()) : []);
  const current = new Set(words(now));
  const seen = new Set<string>();
  const out: Earlier[] = [];
  const revs = flow.revisions;
  for (let k = 0; k < revs.length - 1; k++) {
    const replacedAt = revs[k + 1].at;
    for (const w of words(revs[k].steps.find(s => s.id === stepId))) {
      if (current.has(w) || seen.has(w)) continue;
      seen.add(w);
      out.push({ text: w, at: replacedAt });
    }
  }
  // a struck tip is an earlier word too: struck on the day of the first version that has it struck
  for (const t of now.tips.filter(x => x.struck && !seen.has(x.text))) {
    const first = revs.find(r => r.steps.find(s => s.id === stepId)?.tips.some(x => x.id === t.id && x.struck));
    out.push({ text: t.text, at: first?.at ?? revs.at(-1)?.at ?? 0 });
  }
  return out.sort((a, b) => b.at - a.at);
}
