// Flows (PLAN-FLOWS.md sections 3.7 and 5): the flows in their order, their episodes, the marks the dot writes, the
// live episode the app opens on, and "last time". Every read and write goes through store, so sealing works. No UI.
// An episode is a clock, not a score: nothing here totals, counts or compares episodes (DESIGN.md rule 15).
import type { Episode, Flow, Step } from '../db/schema';
import { store, keyState, type Read } from '../db/fields';

const MIN = 60_000;

// ---------------------------------------------------------------- flows

/** Every flow, in its place on the list. */
export async function flows(): Promise<Read<Flow>[]> {
  return (await store.all('flows')).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export const flowById = (id: string) => store.get('flows', id);

/** A step by its place, 1 for the first (the deep link's number), or undefined. */
export const stepAt = (flow: Pick<Flow, 'steps'>, n: number): Step | undefined => (Number.isInteger(n) ? flow.steps[n - 1] : undefined);
/** A step's place, 1 for the first, 0 when it is not in the flow. */
export const placeOf = (flow: Pick<Flow, 'steps'>, stepId: string | undefined) => flow.steps.findIndex(s => s.id === stepId) + 1;

/** A step's usual span in milliseconds; a step with none is given an hour. */
export const spanOf = (step: Pick<Step, 'spanMin'> | undefined) => (step?.spanMin ?? 60) * MIN;

// ---------------------------------------------------------------- episodes

/** A flow's episodes, oldest first. */
export const episodesOf = (flowId: string) =>
  store.query('episodes', t => t.where('[flowId+startedAt]').between([flowId, -Infinity], [flowId, Infinity]));

/** The step the dot is on: the newest mark's. */
export const currentStepId = (e: Pick<Episode, 'marks'>) => e.marks.at(-1)?.stepId;
/** The last time the dot was touched. */
export const lastTouch = (e: Pick<Episode, 'marks' | 'startedAt'>) => e.marks.at(-1)?.at ?? e.startedAt;

/** The open episode of a flow, if there is one (the newest without an end). */
export async function liveEpisode(flowId: string): Promise<Read<Episode> | undefined> {
  return (await episodesOf(flowId)).filter(e => e.endedAt === undefined).at(-1);
}

/** The newest ended episode of a flow, for "last time". */
export async function lastEnded(flowId: string): Promise<Read<Episode> | undefined> {
  return (await episodesOf(flowId)).filter(e => e.endedAt !== undefined).sort((a, b) => a.endedAt! - b.endedAt!).at(-1);
}

/** The dot leaves rest: a new episode with its first mark. */
export async function startEpisode(flowId: string, stepIds: string[], at = Date.now()): Promise<Episode> {
  const e: Episode = {
    id: crypto.randomUUID(), flowId, startedAt: at, marks: stepIds.map(stepId => ({ stepId, at })), done: [],
  };
  await store.put('episodes', e);
  return e;
}

/** The dot reached these steps, in order. A step the dot is already on is not marked again. */
export async function markSteps(episodeId: string, stepIds: string[], at = Date.now()): Promise<Episode | undefined> {
  const e = await store.get('episodes', episodeId);
  if (!e || e.locked || e.endedAt !== undefined) return e;
  const marks = [...e.marks];
  for (const stepId of stepIds) if (marks.at(-1)?.stepId !== stepId) marks.push({ stepId, at });
  if (marks.length === e.marks.length) return e;
  const next = { ...e, marks };
  await store.put('episodes', next);
  return next;
}

/** The dot is back on the way out: the episode ends. */
export async function endEpisode(episodeId: string, at = Date.now()): Promise<Episode | undefined> {
  const e = await store.get('episodes', episodeId);
  if (!e || e.locked || e.endedAt !== undefined) return e;
  const next = { ...e, endedAt: at };
  await store.put('episodes', next);
  return next;
}

/**
 * Where the dot went in one gesture. visits are the steps it entered on the way, in order; to is where it settled:
 * a step id, or 'rest'. Starts the episode when the dot leaves rest, marks each step, ends it back on rest. A drag
 * that leaves rest and comes back to it with no episode open writes nothing (walking it calm is not an episode).
 */
export async function moveDot(flowId: string, visits: string[], to: string | 'rest', at = Date.now()): Promise<Episode | undefined> {
  const live = await liveEpisode(flowId);
  const steps = to === 'rest' ? visits : [...visits, to];
  if (!live) {
    if (to === 'rest' || !steps.length) return undefined;
    return startEpisode(flowId, dedupe(steps), at);
  }
  const marked = steps.length ? await markSteps(live.id, steps, at) : live;
  return to === 'rest' && marked ? endEpisode(marked.id, at) : marked;
}

const dedupe = (ids: string[]) => ids.filter((id, i) => id !== ids[i - 1]);

// ---------------------------------------------------------------- the next open (PLAN-FLOWS.md 3.7)

/** An episode left untouched past its flow's last step's usual span is over. */
export const isStale = (e: Pick<Episode, 'marks' | 'startedAt'>, flow: Pick<Flow, 'steps'>, now: number) =>
  now - lastTouch(e) > spanOf(flow.steps.at(-1));

/** Inside the usual span of the step the dot is on: the app opens on it. */
export const isFresh = (e: Pick<Episode, 'marks' | 'startedAt'>, flow: Pick<Flow, 'steps'>, now: number) =>
  now - lastTouch(e) <= spanOf(flow.steps.find(s => s.id === currentStepId(e)));

/**
 * The open: ends every stale episode (its end is its last touch, so "last time" never counts the hours nobody was
 * there), then returns the flow to open on, if an episode is live and inside its step's usual span. Locked, it
 * only reads (the ends wait for the next open).
 */
export async function onOpen(now = Date.now()): Promise<{ flowId: string; step: number } | null> {
  const fs = await flows();
  const open = (await store.all('episodes')).filter(e => e.endedAt === undefined);
  let pick: { flowId: string; step: number; at: number } | null = null;
  for (const e of open) {
    const flow = fs.find(f => f.id === e.flowId);
    if (!flow) continue;
    if (isStale(e, flow, now)) {
      if (keyState() !== 'locked') await endEpisode(e.id, lastTouch(e));
      continue;
    }
    if (isFresh(e, flow, now) && (!pick || lastTouch(e) > pick.at)) pick = { flowId: flow.id, step: placeOf(flow, currentStepId(e)), at: lastTouch(e) };
  }
  return pick && { flowId: pick.flowId, step: pick.step };
}

// ---------------------------------------------------------------- last time

/** "Last time": the day the newest ended episode began, and the minutes from its peak (or its start, for a flow
 *  with no peak step) to its end. minutes is undefined when the dot never reached the peak, or under a minute. */
export type LastTime = { at: number; minutes?: number; from: 'peak' | 'start' };

export function lastTimeOf(flow: Pick<Flow, 'steps'>, e: Pick<Episode, 'startedAt' | 'endedAt' | 'marks'>): LastTime | null {
  if (e.endedAt === undefined) return null;
  const peak = flow.steps.find(s => s.peak);
  if (!peak) { const m = Math.round((e.endedAt - e.startedAt) / MIN); return { at: e.startedAt, minutes: m >= 1 ? m : undefined, from: 'start' }; }
  const reached = e.marks.find(m => m.stepId === peak.id);
  // under a minute is no span: an episode that ran out untouched on the peak itself ends at its last touch
  const minutes = reached ? Math.round((e.endedAt - reached.at) / MIN) : 0;
  return { at: e.startedAt, minutes: minutes >= 1 ? minutes : undefined, from: 'peak' };
}

/** A span in words a person says: "48 minutes", "1 minute", "about 3 hours". */
export function spanWords(minutes: number): string {
  if (minutes < 120) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  return `about ${Math.round(minutes / 60)} hours`;
}

/** What the list and the page need about each flow: its live episode (the dot) and the newest ended one. */
export type FlowState = { flow: Read<Flow>; live?: Read<Episode>; last?: Read<Episode> };

export async function flowStates(): Promise<FlowState[]> {
  const fs = await flows();
  return Promise.all(fs.map(async flow => ({ flow, live: await liveEpisode(flow.id), last: await lastEnded(flow.id) })));
}

// ---------------------------------------------------------------- one episode, two flows (PLAN-FLOWS.md 3.7, F4)

/**
 * A printed line names another flow and is tapped: the episode here ends on the step the line is printed on (marked
 * there first if the dot was elsewhere), and one starts on that flow
 * with the dot on that step and `from` set to the one it left. With no episode open here (the page is only being
 * read) nothing is written and undefined comes back: the line then only opens the other flow's step, which reads.
 * If the other flow already has an episode open, the dot moves there instead and that episode keeps its own past.
 */
export async function handOff(
  fromEpisodeId: string, to: { flowId: string; stepId: string }, fromStepId?: string, at = Date.now(),
): Promise<Episode | undefined> {
  const was = await store.get('episodes', fromEpisodeId);
  if (!was || was.locked || was.endedAt !== undefined) return undefined;
  const from = fromStepId && currentStepId(was) !== fromStepId ? { ...was, marks: [...was.marks, { stepId: fromStepId, at }] } : was;
  const target = await store.get('flows', to.flowId);
  if (!target || !target.steps.some(s => s.id === to.stepId)) return undefined;
  const open = await liveEpisode(to.flowId);
  if (open) {
    await store.put('episodes', { ...from, endedAt: at });
    return markSteps(open.id, [to.stepId], at);
  }
  const next: Episode = { id: crypto.randomUUID(), flowId: to.flowId, startedAt: at, marks: [{ stepId: to.stepId, at }], done: [], from: from.id };
  await store.many({ episodes: [{ ...from, endedAt: at }, next] });
  return next;
}

/** One flow's part of a hand-off chain: the flow, the step it was on when it handed off (none for the last), its times. */
export type Leg = { episodeId: string; flowId: string; flow: string; step?: string; startedAt: number; endedAt?: number };
/** A chain of episodes joined by `from`, oldest first; it began with the first and ends with the last (open: no end). */
export type EpisodeSpan = { legs: Leg[]; startedAt: number; endedAt?: number };

/**
 * The whole span an episode belongs to: back along `from` to where it began, and on to any episode handed off from
 * it, so the journal link of any leg reads the whole chain ("Shame, I'm worthless, then Fight, 15:02 to 16:10").
 * A leg whose flow is gone or locked keeps no words.
 * F2's flowLinkOf (model/tips.ts) builds the journal page's link row (ui/flow/JournalLink.tsx) from it.
 */
export async function spanOfEpisode(episodeId: string): Promise<EpisodeSpan | undefined> {
  const all = await store.all('episodes');
  const byId = new Map(all.map(e => [e.id, e]));
  let first = byId.get(episodeId);
  if (!first) return undefined;
  const back = new Set([first.id]);
  while (first.from && byId.has(first.from) && !back.has(first.from)) { first = byId.get(first.from)!; back.add(first.id); }
  const chain = [first];
  const seen = new Set([first.id]);
  for (;;) {
    const last = chain.at(-1)!;
    const next = all.find(e => e.from === last.id && !seen.has(e.id));
    if (!next) break;
    seen.add(next.id);
    chain.push(next);
  }
  const fs = new Map((await store.all('flows')).map(f => [f.id, f]));
  const legs = chain.map((e, i): Leg => {
    const f = fs.get(e.flowId);
    const words = f && !f.locked;
    const step = i < chain.length - 1 && words ? f.steps.find(s => s.id === currentStepId(e))?.name : undefined;
    return { episodeId: e.id, flowId: e.flowId, flow: words ? f.name : '', step, startedAt: e.startedAt, endedAt: e.endedAt };
  });
  return { legs, startedAt: chain[0].startedAt, endedAt: chain.at(-1)!.endedAt };
}

/** The span in words: "Shame, I'm worthless, then Fight, 15:02 to 16:10" (to the end only once it has one). The clock
 *  times are the caller's (ui/date clockTime), so the model stays free of the page's formats. */
export function spanText(span: EpisodeSpan, clock: (ms: number) => string): string {
  const legs = span.legs.map(l => [l.flow, l.step].filter(Boolean).join(', ')).filter(Boolean).join(', then ');
  const when = `${clock(span.startedAt)}${span.endedAt !== undefined ? ` to ${clock(span.endedAt)}` : ''}`;
  return legs ? `${legs}, ${when}` : when;
}

/** Where a hand-off came from, for the link row at the top of the new page: the flow, the step it left, when. */
export type HandOffFrom = { flowId: string; flow: string; step: string; place: number; at: number };

export async function handedFrom(e: Pick<Episode, 'from'> | undefined): Promise<HandOffFrom | undefined> {
  if (!e?.from) return undefined;
  const prev = await store.get('episodes', e.from);
  if (!prev) return undefined;
  const f = await store.get('flows', prev.flowId);
  if (!f || f.locked) return undefined;
  const sid = currentStepId(prev), place = placeOf(f, sid);
  return { flowId: f.id, flow: f.name, step: place ? f.steps[place - 1].name : '', place, at: prev.endedAt ?? lastTouch(prev) };
}
