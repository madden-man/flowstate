// Research's page controller (PLAN-RESEARCH.md sections 2 and 4, Q4): asking, a run on its way, and the lines the page
// draws. No UI. The run outlives the page that began it (a turn to a paper's page, another tab), so it lives here, in
// one signal by question id, and the page only reads it. Every finished turn is written through the store before the
// next is sent (agents.ts emits a snapshot; this writes it), so a run cut short is picked up where it stopped when the
// page is opened again.
//
// No model text reaches this file: agents.ts hands over ids, sides and the Paper records the indexes fetched, and a
// line here is a pick and its paper. The only words a page prints are the question, the paper's own, and fixed print.
import { signal } from '@preact/signals';
import type { MessagesPort } from './client';
import { runInquiry } from './agents';
import { IndexError, search as indexSearch } from './indexes';
import { getInquiry, getPapers, putInquiry, putPapers, researchKey } from './store';
import type { Inquiry, Paper, Pick, RunEvent, RunResult, RunSnapshot, Search, Side } from './types';

/** One line on the page: a paper filed on a side, in found order. lifted: the check took it off (or the run's end
 *  trimmed it); the page lifts it over --t-ui and then draws it no more. */
export type Line = Pick & { paper: Paper; lifted?: boolean };

/** Why a run did not go on, beyond RunResult's why: no key saved, or an index that would not answer (its kind). */
export type Trouble = IndexError['kind'];

/** A run as the page sees it, in this session. state is the inquiry's as the run has it. */
export interface Live {
  id: string;
  state: Inquiry['state'];
  /** The run is going now: the agents are being asked (the chips' dots may breathe, Stop is offered). */
  on: boolean;
  looking: Record<Side, boolean>;
  checking: boolean;
  lines: Line[];
  why?: RunResult['why'];
  /** The last index failure seen in this run (the agents heard it as a failed search and went on). */
  trouble?: Trouble;
}

/** Every run begun or picked up in this session, by question id. A finished one stays, so the page never reads a
 *  stale row and takes it for a run to resume. */
export const live = signal<Record<string, Live>>({});

/** How a run reaches the API and the indexes. The real ones by default; tests and the walkthrough put stubs here. */
export interface RunDeps { makePort?: (key: string) => MessagesPort | Promise<MessagesPort>; search?: Search }
let deps: RunDeps = {};
export function setRunDeps(d: RunDeps): void { deps = d; }

const controllers = new Map<string, AbortController>();

const set = (id: string, change: (l: Live) => Live) => {
  const was = live.peek()[id];
  if (was) live.value = { ...live.peek(), [id]: change(was) };
};

/** The lines a stored question shows: its picks in found order, each with its paper (a pick whose paper is not kept is
 *  left out). */
export async function linesOfPicks(picks: Pick[]): Promise<Line[]> {
  const papers = new Map((await getPapers([...new Set(picks.map(p => p.paperId))])).map(p => [p.id, p]));
  return [...picks].sort((a, b) => a.seq - b.seq).flatMap(p => {
    const paper = papers.get(p.paperId);
    return paper ? [{ paperId: p.paperId, side: p.side, tier: p.tier, seq: p.seq, paper }] : [];
  });
}

/** The lines a run's snapshot holds so far: filed in found order, the check's rulings laid on (a paper ruled neither
 *  is gone; one ruled to a side stands there once). */
export function linesOfSnapshot(snap: RunSnapshot): Line[] {
  const filed = [...snap.for.filed, ...snap.against.filed].sort((a, b) => a.seq - b.seq);
  const out: Line[] = [];
  const seen = new Set<string>();
  for (const p of filed) {
    const paper = snap.known[p.paperId];
    if (!paper) continue;
    const r = snap.ruled?.[p.paperId];
    if (r === 'neither') continue;
    if (r !== undefined) {
      if (seen.has(p.paperId)) continue;
      seen.add(p.paperId);
      out.push({ ...p, side: r, paper });
    } else out.push({ ...p, paper });
  }
  return out;
}

/** The picks the page stands on now: the lines not lifted. */
const picksOf = (lines: Line[]): Pick[] => lines.filter(l => !l.lifted).map(({ paperId, side, tier, seq }) => ({ paperId, side, tier, seq }));

/** A new question, written and running; the page it opens on begins the run. Nothing is sent here. */
export async function ask(question: string, now = Date.now()): Promise<Inquiry> {
  const q = question.replace(/\s+/g, ' ').trim();
  if (!q) throw new Error('No question');
  const inquiry: Inquiry = { id: crypto.randomUUID(), askedAt: now, question: q, state: 'running', picks: [] };
  await putInquiry(inquiry);
  return inquiry;
}

/** Ask again (section 2): what the question held is kept under earlier, shown struck, and it runs fresh. */
export async function askAgain(id: string, now = Date.now()): Promise<Inquiry | undefined> {
  const was = await getInquiry(id);
  if (!was || was.state === 'running') return was;
  const { runs: _r, why: _w, ...rest } = was;
  const earlier = was.picks.length ? [...(was.earlier ?? []), { askedAt: was.askedAt, picks: was.picks }] : was.earlier;
  const next: Inquiry = { ...rest, askedAt: now, state: 'running', picks: [], ...(earlier?.length ? { earlier } : {}) };
  await putInquiry(next);
  const { [id]: _gone, ...others } = live.peek();
  live.value = others;
  return next;
}

/** Lifts one earlier asking's struck lines (rule 10: kept until he lifts them). */
export async function liftEarlier(id: string, index: number): Promise<void> {
  const was = await getInquiry(id);
  if (!was?.earlier?.[index]) return;
  const earlier = was.earlier.filter((_, i) => i !== index);
  const { earlier: _e, ...rest } = was;
  await putInquiry(earlier.length ? { ...rest, earlier } : rest);
}

/** Ends a run he is watching: what was filed is kept, the state is stopped (why: ended). */
export function stopRun(id: string): void { controllers.get(id)?.abort(); }

/** Whether a run is on in this session for that question. */
export const running = (id: string) => controllers.has(id);

/**
 * Begins the run for a question that is running (a new one, or one cut short: it picks up from its stored runs), unless
 * one is already on for it. With no key saved, nothing is sent and the live state says so (why stays undefined, state
 * running, the page prints where the key goes). Resolves when the run has ended and its last write is in.
 */
export async function startRun(inquiry: Inquiry): Promise<void> {
  const id = inquiry.id;
  if (controllers.has(id) || inquiry.state !== 'running') return;
  const ctl = new AbortController();
  controllers.set(id, ctl);
  const resumed = inquiry.runs ? linesOfSnapshot(inquiry.runs) : [];
  live.value = { ...live.peek(), [id]: { id, state: 'running', on: true, looking: { for: false, against: false }, checking: false, lines: resumed } };
  try {
    const key = await researchKey();
    if (!key) { live.value = (({ [id]: _gone, ...rest }) => rest)(live.peek()); return; }
    const port = await (deps.makePort ?? (await import('./client')).makePort)(key.key);
    const find = deps.search ?? indexSearch;
    let row: Inquiry = { ...inquiry, why: undefined };
    let writes: Promise<unknown> = Promise.resolve();
    const write = (next: Inquiry) => { row = next; writes = writes.then(() => putInquiry(next)).catch(() => undefined); };
    const lines = () => live.peek()[id]?.lines ?? [];
    const search: Search = async (args, opts) => {
      try { return await find(args, opts); } catch (e) {
        if (e instanceof IndexError) set(id, l => ({ ...l, trouble: e.kind }));
        throw e;
      }
    };
    const onEvent = (e: RunEvent) => {
      if (e.type === 'looking') set(id, l => ({ ...l, looking: { ...l.looking, [e.side]: e.on } }));
      else if (e.type === 'checking') set(id, l => ({ ...l, checking: e.on }));
      else if (e.type === 'filed') {
        writes = writes.then(() => putPapers([e.paper])).catch(() => undefined);
        set(id, l => ({ ...l, lines: [...l.lines, { ...e.pick, paper: e.paper }].sort((a, b) => a.seq - b.seq) }));
      } else if (e.type === 'ruled') {
        set(id, l => {
          let first = true;
          return {
            ...l,
            lines: l.lines.map(x => {
              if (x.paperId !== e.paperId || x.lifted) return x;
              if (e.to === 'neither' || !first) return { ...x, lifted: true };
              first = false;
              return { ...x, side: e.to };
            }),
          };
        });
      } else if (e.type === 'snapshot') {
        write({ ...row, runs: e.snapshot, picks: picksOf(lines()) });
      }
    };
    const result = await runInquiry(inquiry.question, { port, search, onEvent, signal: ctl.signal, openAlexKey: key.openAlexKey }, inquiry.runs);
    const { runs: _r, why: _w, ...rest } = row;
    if (result.state === 'stopped' && result.why === 'offline') {
      // cut off by the connection: kept running with its runs, so opening the page again goes on from there
      write({ ...row, why: 'offline' });
    } else {
      write({ ...rest, state: result.state, picks: result.picks, ...(result.why ? { why: result.why } : {}) });
    }
    await writes;
    set(id, l => ({ ...l, state: result.state === 'stopped' && result.why === 'offline' ? 'running' : result.state, why: result.why, on: false, looking: { for: false, against: false }, checking: false }));
  } catch {
    // the store locked under the run, or the SDK would not load: what was written stands, and the page reads it
    set(id, l => ({ ...l, state: 'stopped', why: 'error', on: false, looking: { for: false, against: false }, checking: false }));
  } finally {
    controllers.delete(id);
  }
}
