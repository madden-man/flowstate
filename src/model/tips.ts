// What to do at each step (PLAN-FLOWS.md section 6, F2): the tips ticked on an episode, the Five lines, the return
// time, the journal link, the clock in the middle of the drawing, "what helped", and the step sheet's edits. Every
// read and write goes through store, so sealing works. No UI. Nothing here counts or compares episodes (rule 15):
// the clock is minutes since this episode's own peak, and "what helped" is the last episode's ticks, as words.
import type { Episode, Flow, OnPick, Page, PageMusic, Step, Tip } from '../db/schema';
import { store, type Read } from '../db/fields';
import { todayLinked } from './pages';
import { currentStepId, episodesOf, spanOfEpisode } from './flows';
import { albumUriOf } from '../db/seed/picks';

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

/** The On sheet (PLAN-PICKS.md P1): a line ticked writes episodes.on and ticks the On row; un-ticked (pick null), both
 *  go. One pick on at a time: ticking another replaces it. */
export async function setOn(episodeId: string, tipId: string, pick: Pick<OnPick, 'id' | 'title'> | null, at = Date.now()): Promise<Episode | undefined> {
  const e = await liveRow(episodeId);
  if (!e) return undefined;
  const had = e.done.some(d => d.tipId === tipId);
  const done = pick ? (had ? e.done : [...e.done, { tipId, at }]) : e.done.filter(d => d.tipId !== tipId);
  const next: Episode = { ...e, done, on: pick ? { pickId: pick.id, title: pick.title, at } : undefined };
  await store.put('episodes', next);
  return next;
}

/** A cover on the On sheet that Spotify said yes to (P1): episodes.music is the album, and the On row is ticked. */
export async function setOnAlbum(episodeId: string, tipId: string, music: Omit<PageMusic, 'coverId'>, at = Date.now()): Promise<Episode | undefined> {
  const e = await liveRow(episodeId);
  if (!e) return undefined;
  const done = e.done.some(d => d.tipId === tipId) ? e.done : [...e.done, { tipId, at }];
  const next: Episode = { ...e, done, music: { albumUri: music.albumUri, album: music.album, artist: music.artist } };
  await store.put('episodes', next);
  return next;
}

/** The picks a step's On sheet offers (P1): struck ones never (they stay in the step sheet, rule 10). */
export const livePicks = (step: Pick<Step, 'picks'>): OnPick[] => (step.picks ?? []).filter(p => !p.struck);

/** The line an On row reads once a line is put on ("An album, or the TV: New Girl"): the episode's pick, when it is one
 *  of this step's. */
export function onTitle(step: Pick<Step, 'picks'>, e: Pick<Episode, 'on'> | undefined): string | undefined {
  return e?.on && step.picks?.some(p => p.id === e.on!.pickId) ? e.on.title : undefined;
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
 *  named or not (an unnamed one reads as the slot to fill), and always: past the cap it is added at the end. A Sit
 *  row (S3) is not counted against the cap and keeps its place. */
export function shownTips(step: Pick<Step, 'tips'>, still: boolean): Tip[] {
  // F4: in Still the Still row has nothing left to do, so it goes (the 3 a.m. mock: "already in Still, which is why
  // it is absent"); on Shutdown and 3 a.m. it is the first row in Day and Night
  const rows = step.tips.filter(t => !t.struck && !t.print && !(still && t.helper === 'still'));
  // Meditate S3: a Sit row rides on top of the cap like the person row, but in its own place among the rows, so a
  // step already at six (Panic "Under the skin", Energize "Landing") keeps all six and gains it
  const capped = new Set(rows.filter(t => t.helper !== 'sit').slice(0, still ? 3 : 6));
  const shown = rows.filter(t => t.helper === 'sit' || capped.has(t));
  // Still hides the person's number, never the row (PLAN-FLOWS.md 3.7): a person row past the cap still shows
  return [...shown, ...rows.filter(t => t.helper === 'person' && !shown.includes(t))];
}

/** A tip's words: the short form in Still, where there is one. */
export const tipText = (t: Pick<Tip, 'text' | 'short'>, still: boolean) => (still && t.short ? t.short : t.text);

/** "What helped": the tips ticked in an episode, in the order they were ticked, short where there is a short form.
 *  Words only; a tip since deleted from the flow is left out. An On row (PLAN-PICKS.md P2) names the pick put on: the
 *  line ticked, else the album played from its sheet, else its own words. */
export function whatHelped(flow: Pick<Flow, 'steps'>, e: Pick<Episode, 'done' | 'on' | 'music'> | undefined): string[] {
  if (!e) return [];
  const byId = new Map(flow.steps.flatMap(s => s.tips.map(t => [t.id, [t, s] as const] as const)));
  return [...e.done].sort((a, b) => a.at - b.at).flatMap(d => {
    const [t, s] = byId.get(d.tipId) ?? [];
    if (!t || !s || t.wise) return [];
    if (t.helper === 'on') {
      const picked = onTitle(s, e) ?? (s.picks ?? []).find(p => p.kind === 'album' && albumUriOf(p) === e.music?.albumUri)?.title;
      if (picked) return [picked];
    }
    return [t.short ?? t.text];
  });
}

/** What was put on at this step last time (P2), so it comes first next time: the newest episode of the flow, this one
 *  aside, that put on one of the step's picks (a line ticked, or an album played from its sheet). No number says so. */
export async function lastOn(flowId: string, step: Pick<Step, 'picks'>, exceptId?: string): Promise<string | undefined> {
  const picks = step.picks ?? [];
  if (!picks.length) return undefined;
  const es = (await episodesOf(flowId)).filter(e => e.id !== exceptId && !e.locked).reverse();
  for (const e of es) {
    const line = e.on && picks.find(p => p.id === e.on!.pickId);
    if (line) return line.id;
    const album = e.music && picks.find(p => p.kind === 'album' && albumUriOf(p) === e.music!.albumUri);
    if (album) return album.id;
  }
  return undefined;
}

/** The picks with the one put on last time first; the rest keep his order. */
export const lastFirst = (picks: OnPick[], last: string | undefined): OnPick[] => {
  const k = last ? picks.findIndex(p => p.id === last) : -1;
  return k <= 0 ? picks : [picks[k], ...picks.slice(0, k), ...picks.slice(k + 1)];
};

// ---------------------------------------------------------------- the journal link (the Journal helper)

/** Today's page, linked to the episode both ways: page.flow on the page, pageId on the episode (pages.ts todayLinked,
 *  which the page after a sit shares). */
export async function linkToday(episodeId: string, now = Date.now()): Promise<Read<Page> | undefined> {
  const e = await liveRow(episodeId);
  if (!e) return undefined;
  const page = await todayLinked({ flow: { episodeId } }, now);
  await store.many({ pages: [page], episodes: [{ ...e, pageId: page.id }] });
  return page;
}

/** What a journal page linked to an episode shows: the flow, when it began (and ended), and the step, now if live. */
export type FlowLinkRow = { href: string; flow: string; startedAt: number; endedAt?: number; step: string; live: boolean };

export async function flowLinkOf(page: Pick<Page, 'flow'>): Promise<FlowLinkRow | undefined> {
  if (!page.flow) return undefined;
  // F4 (one episode, two flows, 3.7): the link reads the whole hand-off chain the episode belongs to, "Shame, I'm
  // worthless, then Fight", from its first start to its last end, and leads to where the chain is now
  const span = await spanOfEpisode(page.flow.episodeId);
  const e = span && await store.get('episodes', span.legs.at(-1)!.episodeId);
  if (!span || !e) return undefined;
  const flow = await store.get('flows', e.flowId);
  if (!flow || flow.locked) return undefined;
  const sid = currentStepId(e);
  const n = flow.steps.findIndex(s => s.id === sid) + 1;
  const live = e.endedAt === undefined;
  const legs = span.legs.map(l => [l.flow, l.step].filter(Boolean).join(', ')).filter(Boolean).join(', then ');
  return {
    href: live && n ? `#/flow/${flow.id}/${n}` : `#/flow/${flow.id}`,
    flow: legs || flow.name, startedAt: span.startedAt, endedAt: span.endedAt, step: n ? flow.steps[n - 1].name : '', live,
  };
}

// ---------------------------------------------------------------- the step sheet

/** The words of a step the sheet edits: P2 adds the On row's picks and the line its sheet prints. */
export type StepDraft = Pick<Step, 'name' | 'line' | 'said' | 'usual' | 'tips' | 'picks' | 'onLine'>;

const same = (a: StepDraft, b: StepDraft) => JSON.stringify([a.name, a.line ?? '', a.said ?? '', a.usual ?? '', a.tips, a.picks ?? [], a.onLine ?? ''])
  === JSON.stringify([b.name, b.line ?? '', b.said ?? '', b.usual ?? '', b.tips, b.picks ?? [], b.onLine ?? '']);

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
  // P2: a pick with no title is dropped, like a tip with no words; a blank printed line is no printed line
  const picks = (draft.picks ?? flow.steps[i].picks)?.filter(p => p.title.trim()).map(p => ({ ...p, title: p.title.trim() }));
  if (picks?.length || flow.steps[i].picks) step.picks = picks;
  else delete step.picks;
  const onLine = clean(draft.onLine === undefined ? flow.steps[i].onLine : draft.onLine);
  if (onLine) step.onLine = onLine;
  else delete step.onLine;
  const steps = flow.steps.map((s, k) => (k === i ? step : s));
  const next: Flow = { ...flow, steps, updatedAt: now, revisions: [...flow.revisions, { at: now, name: flow.name, steps: structuredClone(steps) }] };
  await store.put('flows', next);
  return next;
}

/** A new tip for the sheet's "+ thing". */
export const newTip = (): Tip => ({ id: crypto.randomUUID(), text: '' });

/** A new line for the On block's "+ line" (P2): a title he writes and its kind, a show until he says otherwise. */
export const newLine = (): OnPick => ({ id: crypto.randomUUID(), kind: 'show', title: '' });
/** An album for "+ album", as the ♪ grid gave it: its title, its artist, its Spotify id. */
export const albumPick = (a: Pick<PageMusic, 'albumUri' | 'album' | 'artist'>): OnPick =>
  ({ id: crypto.randomUUID(), kind: 'album', title: a.album, by: a.artist, albumId: a.albumUri.replace(/^spotify:album:/, '') });

/** One tip (or one pick, P2) moved to place `to` in the list. */
export function moveTip<T extends { id: string }>(tips: T[], id: string, to: number): T[] {
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
  // P2: the printed line and the picks' titles are a step's words too, so a rewrite or a strike shows here
  const words = (s: Step | undefined) => (s ? [s.name, s.line, s.said, s.usual, ...s.tips.filter(t => !t.struck).map(t => t.text),
    s.onLine, ...(s.picks ?? []).filter(p => !p.struck).map(p => p.title)]
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
  for (const p of (now.picks ?? []).filter(x => x.struck && !seen.has(x.title))) {
    const first = revs.find(r => r.steps.find(s => s.id === stepId)?.picks?.some(x => x.id === p.id && x.struck));
    out.push({ text: p.title, at: first?.at ?? revs.at(-1)?.at ?? 0 });
  }
  return out.sort((a, b) => b.at - a.at);
}
