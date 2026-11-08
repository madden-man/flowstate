// Carried forward (PLAN-FLOWS.md 3.7 "His own words, carried forward" and "Across flows and after", section 6 row
// F6): the note to the next one of you, the ghost rings, one person written when calm, and his own stamps on the
// What if curve. Every read and write goes through store, so sealing works (fields.ts: notes' text, the person on a
// tip, the prediction's text). No UI. Nothing here totals or counts episodes (DESIGN.md rule 15): the ghost rings
// are a drawing of past episodes, and the stamps are his marks, each one drawn, none summed.
import type { Episode, Flow, FlowNote, Page, Step, Tip } from '../db/schema';
import { store, type Read } from '../db/fields';
import { messagesOf, firstLine } from './pages';
import { episodesOf } from './flows';
import { saveStep, earliestReturn } from './tips';

// ---------------------------------------------------------------- a note to the next one of you

/** The page asks once per episode: the newest ended one, never asked before, ended before this page was opened (so
 *  dragging the dot back onto rest does not ask in the same breath; the question is for the next open, "the
 *  morning after"), in Day and Night only (Still never asks, rule 13), never through the door (F5). */
export function asksFor(
  last: Pick<Episode, 'endedAt' | 'asked'> | undefined, openedAt: number, o: { still: boolean; door: boolean; locked: boolean },
): boolean {
  return !!last && last.endedAt !== undefined && last.endedAt <= openedAt && last.asked === undefined && !o.still && !o.door && !o.locked;
}

/** Asked: the question is never printed again for this episode. */
export async function markAsked(episodeId: string, at = Date.now()): Promise<void> {
  const e = await store.get('episodes', episodeId);
  if (!e || e.locked || e.asked !== undefined) return;
  await store.put('episodes', { ...e, asked: at });
}

/** The step a note lands on unless he picks another: the step the episode spent longest on (the time from its mark to
 *  the next mark, or to the end), the peak on a tie, else the first step the dot reached. */
export function noteStepOf(flow: Pick<Flow, 'steps'>, e: Pick<Episode, 'marks' | 'endedAt' | 'startedAt'>): string | undefined {
  const spent = new Map<string, number>();
  e.marks.forEach((m, i) => {
    const until = e.marks[i + 1]?.at ?? e.endedAt ?? m.at;
    spent.set(m.stepId, (spent.get(m.stepId) ?? 0) + Math.max(0, until - m.at));
  });
  const peak = flow.steps.find(s => s.peak)?.id;
  let best: string | undefined, most = -1;
  for (const s of flow.steps) {
    const t = spent.get(s.id);
    if (t === undefined) continue;
    if (t > most || (t === most && s.id === peak)) { best = s.id; most = t; }
  }
  return best ?? peak ?? flow.steps[0]?.id;
}

/** The note written for one episode (the question writes at most one per episode). */
export const noteOf = (flow: Pick<Flow, 'notes'>, episodeId: string) => flow.notes?.find(n => n.episodeId === episodeId);

/** Writes the episode's note: its words and the step it shows at. Words cleared take the note away again (it is the
 *  draft being written, not a note kept: a kept note is struck, never deleted, rule 10). */
export async function writeNote(flowId: string, episodeId: string, stepId: string, text: string, at = Date.now()): Promise<Read<Flow> | undefined> {
  const flow = await store.get('flows', flowId);
  if (!flow || flow.locked) return undefined;
  const notes = flow.notes ?? [];
  const had = notes.find(n => n.episodeId === episodeId);
  const words = text.trim() ? text : '';
  let next: FlowNote[];
  if (!words) next = notes.filter(n => n !== had);
  else if (had) next = notes.map(n => (n === had ? { ...n, text: words, stepId } : n));
  else next = [...notes, { id: crypto.randomUUID(), stepId, text: words, at, episodeId }];
  const row = { ...flow, notes: next.length ? next : undefined };
  await store.put('flows', row);
  return row;
}

/** A note moved to another step (the chips under the question). */
export async function moveNote(flowId: string, episodeId: string, stepId: string): Promise<void> {
  const flow = await store.get('flows', flowId);
  const had = flow && !flow.locked ? noteOf(flow, episodeId) : undefined;
  if (!flow || !had || had.stepId === stepId) return;
  await store.put('flows', { ...flow, notes: flow.notes!.map(n => (n === had ? { ...n, stepId } : n)) });
}

/** Struck in the step sheet's Earlier (rule 10): it stays, struck through, and leaves the page. */
export async function strikeNote(flowId: string, noteId: string, at = Date.now()): Promise<void> {
  const flow = await store.get('flows', flowId);
  if (!flow || flow.locked || !flow.notes?.some(n => n.id === noteId && n.struck === undefined)) return;
  await store.put('flows', { ...flow, notes: flow.notes.map(n => (n.id === noteId ? { ...n, struck: at } : n)) });
}

/** A step's notes, newest first, struck ones included (Earlier draws them struck). */
export const notesAt = (flow: Pick<Flow, 'notes'>, stepId: string): FlowNote[] =>
  (flow.notes ?? []).filter(n => n.stepId === stepId && n.text.trim()).sort((a, b) => b.at - a.at);

/** The note the page shows above a step's said line: the newest one not struck. */
export const noteShownAt = (flow: Pick<Flow, 'notes'>, stepId: string): FlowNote | undefined =>
  notesAt(flow, stepId).find(n => n.struck === undefined);

/** The page an episode was written on (the Journal helper's link): its id, kind and first line, for the row at rest. */
export async function pageOfEpisode(e: Pick<Episode, 'pageId'> | undefined): Promise<{ page: Read<Page>; line: string } | undefined> {
  if (!e?.pageId) return undefined;
  const page = await store.get('pages', e.pageId);
  if (!page || page.locked) return undefined;
  const line = firstLine(page, await messagesOf(page.id));
  return line ? { page, line } : undefined;
}

// ---------------------------------------------------------------- ghost rings

/** The most rings drawn. Past this the oldest are simply not drawn, so the page never fills: the drawing says "every
 *  time before, this ended", and a dozen closed rings already say it. Nothing prints how many there are (rule 15). */
export const GHOSTS_MAX = 12;

/** The ended episodes the ghost rings draw, newest first (the newest is the innermost ring), at most GHOSTS_MAX. */
export function ghostsOf(episodes: Pick<Episode, 'id' | 'endedAt' | 'startedAt'>[]): string[] {
  return episodes.filter(e => e.endedAt !== undefined).sort((a, b) => b.startedAt - a.startedAt).slice(0, GHOSTS_MAX).map(e => e.id);
}

/** How much larger ring k (0 the innermost) is than the live drawing, about its centre. A closed shape (the ring)
 *  steps out a little further each time, like the mock (5 then 4 units on a radius of 72); an open shape steps less,
 *  so a wide slope stays on the page. */
export function ghostScale(k: number, closed: boolean): number {
  return closed ? 1 + (5 + 4 * k) / 72 : 1 + 0.03 + 0.022 * k;
}

export async function ghostEpisodes(flowId: string): Promise<string[]> {
  return ghostsOf(await episodesOf(flowId));
}

// ---------------------------------------------------------------- one person, written when calm

/** The text's placeholder in the person sheet: an example, never saved as his words. */
export const PERSON_EXAMPLE = 'Hard hour. Can you talk to me about anything for ten minutes?';

/** A person row has a name, or it reads as a slot to fill when calm. */
export const hasPerson = (t: Pick<Tip, 'person'>) => !!t.person?.name.trim();

/** The row's words: "Text Ali", or the slot to fill. */
export const personRowText = (t: Pick<Tip, 'person'>) => (hasPerson(t) ? `Text ${t.person!.name.trim()}` : 'Someone, written when calm');

/** The text with {time} filled from the return time ("I'm going. Back at 19:40."): the episode's own, else the
 *  earliest the Timer would give now. The clock reads as ui/date.ts clockTime does ("19:40"). */
const hhmm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function fillTime(text: string, returnAt: number | undefined, now = Date.now()): string {
  if (!text.includes('{time}')) return text;
  return text.replaceAll('{time}', hhmm(returnAt ?? earliestReturn(now)));
}

/** The Messages link: sms:<number>?&body=<text>. iOS reads "&body=" and Android "?body=", and "?&body=" carries both.
 *  A navigation he completes: nothing is sent until he sends it (rule 22). No number opens Messages on the body. */
export function smsHref(tel: string | undefined, body: string): string {
  const to = (tel ?? '').replace(/[^\d+]/g, '');
  return `sms:${to}?&body=${encodeURIComponent(body)}`;
}

export type Person = NonNullable<Tip['person']>;

/** The person on one tip, written from the page's sheet (the step sheet keeps its own draft and saves on close). */
export async function savePerson(flowId: string, stepId: string, tipId: string, person: Person, now = Date.now()): Promise<Read<Flow> | undefined> {
  const flow = await store.get('flows', flowId);
  const step = flow?.steps.find(s => s.id === stepId);
  if (!flow || flow.locked || !step) return undefined;
  const tips = step.tips.map(t => (t.id === tipId ? { ...t, person: cleanPerson(person) } : t));
  return saveStep(flowId, stepId, { name: step.name, line: step.line, said: step.said, usual: step.usual, tips } satisfies Pick<Step, 'name' | 'line' | 'said' | 'usual' | 'tips'>, now);
}

/** Trimmed, with an empty number dropped. */
export function cleanPerson(p: Person): Person {
  const tel = p.tel?.trim();
  return { name: p.name.trim(), text: p.text.trim(), ...(tel ? { tel } : {}) };
}

// ---------------------------------------------------------------- your own stamps (the What if curve)

/** The worry written as a prediction (the prediction helper), on the live episode, sealed. Cleared words take it off. */
export async function setPrediction(episodeId: string, text: string, at = Date.now()): Promise<Episode | undefined> {
  const e = await store.get('episodes', episodeId);
  if (!e || e.locked || e.endedAt !== undefined) return undefined;
  const next: Episode = { ...e, prediction: text.trim() ? { text, at: e.prediction?.at ?? at } : undefined };
  await store.put('episodes', next);
  return next;
}

/** One tap the morning after: the outcome is his, and it is never asked again. */
export async function setOutcome(episodeId: string, outcome: 'didnt' | 'happened'): Promise<void> {
  const e = await store.get('episodes', episodeId);
  if (!e || e.locked || !e.prediction || e.prediction.outcome) return;
  await store.put('episodes', { ...e, prediction: { ...e.prediction, outcome } });
}

const dayOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** The prediction the Flow list asks about: written on an earlier day than today, not marked yet; the oldest first,
 *  so they come one at a time. */
export async function stampDue(now = Date.now()): Promise<{ episode: Read<Episode>; flow: Read<Flow> } | undefined> {
  const today = dayOf(now);
  const due = (await store.all('episodes'))
    .filter(e => !e.locked && e.prediction?.text.trim() && !e.prediction.outcome && dayOf(e.prediction.at) < today)
    .sort((a, b) => a.prediction!.at - b.prediction!.at);
  for (const e of due) {
    const flow = await store.get('flows', e.flowId);
    if (flow && !flow.locked) return { episode: e, flow };
  }
  return undefined;
}

/** "Yesterday's worry", or the day it was written. */
export function stampWhen(at: number, now = Date.now()): { yesterday: boolean; at: number } {
  return { yesterday: dayOf(now) - dayOf(at) <= 26 * 3_600_000, at };
}

/** His marks on a flow, oldest first: one per outcome, drawn as a check (didn't happen) or a cross (happened). */
export async function stampsOf(flowId: string): Promise<('didnt' | 'happened')[]> {
  return (await episodesOf(flowId))
    .filter(e => e.prediction?.outcome)
    .sort((a, b) => a.prediction!.at - b.prediction!.at)
    .map(e => e.prediction!.outcome!);
}
