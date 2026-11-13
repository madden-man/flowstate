// Research (PLAN-RESEARCH.md sections 2 and 4, package Q3): the three Claude calls. Two searchers look at once, one
// for each side, and file paper ids; a third conversation reads every filed abstract cold and rules each one. The
// loop is the app's own, one request a turn, so every finished turn can be stored and a run cut short picks up where
// it stopped.
//
// No model text leaves this file (section 1: "no model-written text anywhere"). A reply's text and thinking blocks
// live only in Trail.messages, which go back to the API unchanged and nowhere else. What is returned and emitted is
// ids, sides, tiers and the Paper records deps.search itself fetched.
//
// Types only from the SDK: the port is injected (client.ts builds the real one), so tests run on a scripted stub.
import type {
  BetaContentBlock, BetaMessage, BetaMessageParam, BetaTool, BetaToolResultBlockParam, BetaToolUseBlock,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { MessagesPort } from './client';
import { IndexError } from './indexes';
import {
  CAPS, type Paper, type Pick, type RunEvent, type RunResult, type RunSnapshot, type Search, type SearchArgs,
  type Side, type Trail,
} from './types';

export type { MessagesPort } from './client';

export interface RunDeps {
  port: MessagesPort;
  search: Search;
  onEvent(e: RunEvent): void;
  signal?: AbortSignal;
  openAlexKey?: string;
}

/** Section 4: one model for all three calls. */
export const MODEL = 'claude-opus-5-5';
/** A side may file a few more than CAPS.perSide before the check, so the check has something to lift; after it,
 *  at most CAPS.perSide a side stand (earliest filed first). */
export const FILE_CAP = 8;
const MAX_TOKENS = 16000;

// ---- the prompts and tools (byte-stable across turns: no dates, no question; the question rides in the first user
// message, so the cached prefix holds and the thinking blocks stay bound to an unchanged prefix) ----

const SIGNS = '+ means evidence that the answer to the question is yes, and − means evidence that it is no.';

const SIDE_LINE: Record<Side, string> = {
  for: 'Your side is +: you look for the strongest papers showing that the answer is yes. Another researcher, working apart from you, looks for the strongest papers showing that it is no.',
  against: 'Your side is −: you look for the strongest papers showing that the answer is no. Another researcher, working apart from you, looks for the strongest papers showing that it is yes.',
};

export function searcherPrompt(side: Side): string {
  return [
    'You are one of two researchers gathering peer reviewed evidence on a question that can be answered yes or no. ' + SIGNS,
    SIDE_LINE[side] + ' Afterwards a third reader goes through every paper filed, without knowing who filed it, and lifts any whose abstract does not support the side it was filed on.',
    'Answer only through the tools. Nothing you write outside a tool call is read or shown to anyone: the person who asked sees only the titles and abstracts of the papers you file, so the papers have to speak for themselves.',
    'How to work:',
    '- Search with search. Use Europe PMC (europepmc) for medicine, biology and psychology, and OpenAlex (openalex) for other fields. Try more than one phrasing of the question, and the other index when the first is thin.',
    '- Prefer meta-analyses and systematic reviews, then randomised trials, then other studies.',
    '- Search tier 1 (journal papers) first. Use tier 2 (preprints, conference papers, theses, reports) only when tier 1 has nothing for your side.',
    '- File a paper with file only if its abstract itself supports your side for this question. A null result is evidence that the answer is no. A mixed result is not evidence for either side, so do not file it.',
    '- Never file from memory. File only ids that a search in this conversation returned.',
    `- File the strongest few, up to ${CAPS.perSide}. Fewer is better than padding with weak ones. You have ${CAPS.searches} searches; when they are used or you have what the evidence holds, stop.`,
    '- If the question cannot be answered yes or no, call not_a_side_question and stop.',
  ].join('\n');
}

export const CHECKER_PROMPT = [
  'You check papers filed as evidence on a question that can be answered yes or no. ' + SIGNS,
  'Two researchers searched apart, one for each side. You are not told who filed which paper, and the order they are listed in means nothing.',
  'Rule every paper with rule: for if its abstract itself supports yes for this question, against if it supports no, neither if it does not bear on this question or its result is mixed. A null result is evidence for no. Judge from the abstract given, never from memory of the paper or the field; when unsure, rule neither, since a paper on the wrong side misleads more than a missing one.',
  'Answer only through the tools. Nothing you write outside a tool call is read or shown to anyone. Rule each paper once (several rule calls in one turn is best), then stop.',
].join('\n');

const strictObject = (properties: Record<string, unknown>): BetaTool.InputSchema => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});

export const SEARCHER_TOOLS: BetaTool[] = [
  {
    name: 'search',
    description: `Search a paper index. Returns up to ${CAPS.results} papers as JSON, each with id, title, abstract, journal, year, kind and tier, or an empty list. Tier 1 is journal papers; tier 2 is preprints, conference papers, book chapters, theses and reports.`,
    strict: true,
    input_schema: strictObject({
      query: { type: 'string', description: 'The search terms.' },
      index: { type: 'string', enum: ['europepmc', 'openalex'], description: 'europepmc for medicine, biology and psychology; openalex for every other field.' },
      tier: { type: 'integer', enum: [1, 2], description: '1 for journal papers; 2 only when tier 1 has nothing for your side.' },
    }),
  },
  {
    name: 'file',
    description: 'File one paper for your side, by the id a search returned.',
    strict: true,
    input_schema: strictObject({ id: { type: 'string', description: 'The paper id exactly as a search returned it.' } }),
  },
  {
    name: 'not_a_side_question',
    description: 'Say that the question cannot be answered yes or no. Ends your search.',
    strict: true,
    input_schema: strictObject({}),
  },
];

export const CHECKER_TOOLS: BetaTool[] = [
  {
    name: 'rule',
    description: 'Rule one paper: for (its abstract supports yes), against (it supports no) or neither.',
    strict: true,
    input_schema: strictObject({
      id: { type: 'string', description: 'The paper id exactly as listed.' },
      side: { type: 'string', enum: ['for', 'against', 'neither'] },
    }),
  },
];

/** The one request shape all three conversations send (section 4). No thinking config: it is adaptive and always on
 *  for this model. No tool_choice: forced choice is a 400 here, so auto stands and the prompt says tools only. */
export function request(system: string, tools: BetaTool[], messages: unknown[]): MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    tools,
    messages: [...messages] as BetaMessageParam[],
    output_config: { effort: 'high' },
    cache_control: { type: 'ephemeral' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

// ---- the run ----

type Why = NonNullable<RunResult['why']>;
type Halt = { state: 'refused' } | { state: 'stopped'; why: Why };

/** What a turn's tool calls come to: the results to send back, and the change to make once the turn is finished
 *  (nothing is changed or emitted before then, so a turn cut mid-search leaves no trace and is simply sent again). */
interface Handled { results: BetaToolResultBlockParam[]; apply(): RunEvent[]; end: boolean }

const newTrail = (): Trail => ({ messages: [], turns: 0, searches: 0, filed: [], done: false });
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const ok = (id: string, content: string): BetaToolResultBlockParam => ({ type: 'tool_result', tool_use_id: id, content });
const err = (id: string, content: string): BetaToolResultBlockParam => ({ type: 'tool_result', tool_use_id: id, content, is_error: true });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Read only what the schema allows from a tool call's parsed input; extra fields are never looked at. */
function searchArgs(input: unknown): SearchArgs | null {
  if (!isRecord(input)) return null;
  const { query, index, tier } = input;
  if (typeof query !== 'string' || !query.trim()) return null;
  if (index !== 'europepmc' && index !== 'openalex') return null;
  if (tier !== 1 && tier !== 2) return null;
  return { query, index, tier };
}
const idArg = (input: unknown): string | null => (isRecord(input) && typeof input.id === 'string' ? input.id : null);
function ruleArgs(input: unknown): { id: string; side: Side | 'neither' } | null {
  const id = idArg(input);
  if (id === null || !isRecord(input)) return null;
  const s = input.side;
  return s === 'for' || s === 'against' || s === 'neither' ? { id, side: s } : null;
}
/** Whether a tool call arrived whole: on max_tokens the last one may have been cut. */
function complete(c: BetaToolUseBlock): boolean {
  if (c.name === 'search') return searchArgs(c.input) !== null;
  if (c.name === 'file') return idArg(c.input) !== null;
  if (c.name === 'rule') return ruleArgs(c.input) !== null;
  return c.name === 'not_a_side_question' && isRecord(c.input);
}

/** The SDK's errors by name and status, most specific first (shared/error-codes.md). Duck-typed so this file needs
 *  no SDK runtime; the SDK sets each class's name explicitly, so minifying does not lose it. */
function whyOf(e: unknown): Why {
  const name = isRecord(e) ? e.name : undefined;
  const status = isRecord(e) ? e.status : undefined;
  if (name === 'AuthenticationError' || name === 'PermissionDeniedError' || status === 401 || status === 403) return 'key';
  // 402 is a billing or spend limit, which the page tells as a limit
  if (name === 'RateLimitError' || status === 429 || status === 402) return 'limit';
  if (name === 'APIConnectionTimeoutError' || name === 'APIConnectionError') return 'offline';
  return 'error';
}

/** Slim a Paper for the model: its own words whole (section 3: nothing reworded or cut), nothing it need not see. */
const forModel = (p: Paper) => ({ id: p.id, title: p.title, abstract: p.abstract, journal: p.journal ?? null, year: p.year ?? null, kind: p.kind, tier: p.tier });

const filedBy = (t: Trail, id: string) => t.filed.some(p => p.paperId === id);
/** Whether a trail's model called not_a_side_question (read from its tool calls, so a resumed run knows too). */
const saidNoSides = (t: Trail) => t.messages.some(m =>
  isRecord(m) && m.role === 'assistant' && Array.isArray(m.content)
  && (m.content as BetaContentBlock[]).some(b => b.type === 'tool_use' && b.name === 'not_a_side_question'));

export async function runInquiry(question: string, deps: RunDeps, resume?: RunSnapshot): Promise<RunResult> {
  const snap: RunSnapshot = resume ? plain(resume) : { for: newTrail(), against: newTrail(), known: {} };
  // Section 2's found order across both sides: one run-wide counter, derived from the picks already filed (so a
  // resumed run carries on from its snapshot with nothing extra stored), taken as each filed event goes out.
  let seq = 1 + Math.max(-1, ...snap.for.filed.map(p => p.seq), ...snap.against.filed.map(p => p.seq));
  // One controller for every request and search in the run: his signal ends it, and so does a refusal or failure
  // in either loop, so the other does not keep spending.
  const ctl = new AbortController();
  let halt: Halt | undefined;
  const stop = (h: Halt) => { if (!halt) halt = h; ctl.abort(); };
  const ended = () => stop({ state: 'stopped', why: 'ended' });
  if (deps.signal?.aborted) ended();
  deps.signal?.addEventListener('abort', ended);
  const emit = (e: RunEvent) => deps.onEvent(e);
  const snapshot = () => emit({ type: 'snapshot', snapshot: plain(snap) });

  /** One conversation, turn by turn from wherever its trail stands. */
  async function converse(trail: Trail, system: string, tools: BetaTool[], first: () => string,
    handle: (calls: BetaToolUseBlock[], cut: BetaToolUseBlock[]) => Promise<Handled>): Promise<void> {
    if (!trail.messages.length) trail.messages.push({ role: 'user', content: first() });
    while (!trail.done && !halt) {
      if (trail.turns >= CAPS.turns) { trail.done = true; snapshot(); break; }
      let reply: BetaMessage;
      let handled: Handled | undefined;
      try {
        reply = await deps.port.create(request(system, tools, trail.messages), { signal: ctl.signal });
        if (halt) return;
        // Check stop_reason before reading content: a refusal on the final response means the whole fallback
        // chain declined.
        if (reply.stop_reason === 'refusal') { stop({ state: 'refused' }); return; }
        const calls = reply.content.filter((b): b is BetaToolUseBlock => b.type === 'tool_use');
        if (reply.stop_reason === 'tool_use' || reply.stop_reason === 'max_tokens') {
          const whole = calls.filter(complete);
          // max_tokens with no whole tool call is a turn finished without tools; with some, they are answered and
          // the cut one gets an error result
          if (whole.length) handled = await handle(whole, calls.filter(c => !complete(c)));
        }
      } catch (e) {
        if (!halt) stop(deps.signal?.aborted ? { state: 'stopped', why: 'ended' } : { state: 'stopped', why: whyOf(e) });
        return;
      }
      if (halt) return;
      // The turn is finished: append the reply whole (thinking blocks included) and every result in one message.
      trail.messages.push({ role: 'assistant', content: reply.content });
      const events = handled ? handled.apply() : [];
      if (handled) trail.messages.push({ role: 'user', content: handled.results });
      trail.turns += 1;
      if (!handled || handled.end || trail.turns >= CAPS.turns) trail.done = true;
      for (const e of events) emit(e);
      snapshot();
    }
  }

  /** A searcher's tool calls, decided in order (the caps count as they go), searches run together. */
  const searcher = (side: Side) => async (calls: BetaToolUseBlock[], cut: BetaToolUseBlock[]): Promise<Handled> => {
    const trail = snap[side];
    let searches = trail.searches;
    // papers filed this turn, in call order; they become Picks (and take their seq) only when the turn is finished
    const fresh: Paper[] = [];
    const filed = () => [...trail.filed, ...fresh];
    const found: Paper[] = [];
    let end = false;
    const slots: Promise<BetaToolResultBlockParam>[] = calls.map(async c => {
      if (c.name === 'search') {
        const args = searchArgs(c.input)!;
        if (args.tier === 2 && filed().some(p => p.tier === 1)) {
          return err(c.id, 'Tier 2 is refused while your side has a journal paper filed. Search tier 1, or finish.');
        }
        if (searches >= CAPS.searches) return err(c.id, 'No searches are left. File what you have, then stop.');
        searches += 1;
        try {
          const papers = await deps.search(args, { signal: ctl.signal, openAlexKey: deps.openAlexKey });
          found.push(...papers);
          return ok(c.id, JSON.stringify(papers.map(forModel)));
        } catch (e) {
          // Q1's IndexError: the index did not answer, which the model hears as a failed search, not a crash
          if (!ctl.signal.aborted && e instanceof IndexError) {
            return err(c.id, `The index did not answer (${e.kind}). Try again, or try the other index.`);
          }
          throw e;
        }
      }
      if (c.name === 'file') {
        const id = idArg(c.input)!;
        if (!has(snap.known, id)) return err(c.id, 'That id is not one a search returned in this run. File only ids a search gave you.');
        const paper = snap.known[id];
        if (trail.filed.some(p => p.paperId === paper.id) || fresh.includes(paper)) return ok(c.id, 'Already filed.');
        if (filed().length >= FILE_CAP) return err(c.id, 'Your side has filed as many as it may. Stop now.');
        fresh.push(paper);
        return ok(c.id, 'Filed.');
      }
      if (c.name === 'not_a_side_question') { end = true; return ok(c.id, 'Noted. Your search is over.'); }
      return err(c.id, 'There is no such tool.');
    });
    const results = [...await Promise.all(slots), ...cut.map(c => err(c.id, 'This call was cut off before it was whole. Make it again.'))];
    return {
      results, end,
      apply: () => {
        trail.searches = searches;
        for (const p of found) snap.known[p.id] = p;
        return fresh.map((paper): RunEvent => {
          const pick: Pick = { paperId: paper.id, side, tier: paper.tier, seq: seq++ };
          trail.filed = [...trail.filed, pick];
          return { type: 'filed', pick, paper };
        });
      },
    };
  };

  /** Every distinct filed id, earliest first; the check sees them sorted by id so the order says nothing. */
  const filedIds = () => [...new Set(inOrder(snap).map(e => e.paperId))];

  async function look(side: Side) {
    const trail = snap[side];
    if (trail.done) return;
    emit({ type: 'looking', side, on: true });
    try {
      await converse(trail, searcherPrompt(side), SEARCHER_TOOLS, () => `The question: ${question}`, searcher(side));
    } finally {
      emit({ type: 'looking', side, on: false });
    }
  }

  async function check() {
    const ids = filedIds();
    if (!ids.length || snap.check?.done) return;
    snap.ruled ??= {};
    snap.check ??= newTrail();
    const allowed = new Set(ids);
    const first = () => {
      const papers = [...ids].sort().map(id => ({ id, title: snap.known[id].title, abstract: snap.known[id].abstract }));
      return `The question: ${question}\n\nThe papers:\n${JSON.stringify(papers)}`;
    };
    emit({ type: 'checking', on: true });
    try {
      await converse(snap.check, CHECKER_PROMPT, CHECKER_TOOLS, first, async (calls, cut) => {
        const rulings: [string, Side | 'neither'][] = [];
        const results = calls.map(c => {
          if (c.name !== 'rule') return err(c.id, 'There is no such tool.');
          const r = ruleArgs(c.input)!;
          if (!allowed.has(r.id)) return err(c.id, 'That id is not one of the papers listed.');
          rulings.push([r.id, r.side]);
          return ok(c.id, 'Ruled.');
        });
        return {
          results: [...results, ...cut.map(c => err(c.id, 'This call was cut off before it was whole. Make it again.'))],
          end: false,
          apply: () => {
            const events: RunEvent[] = [];
            for (const [id, to] of rulings) {
              // where the line stands now: its last ruling, or where it was filed
              const prior = snap.ruled![id];
              const was = prior === undefined ? (['for', 'against'] as const).filter(s => filedBy(snap[s], id)) : prior === 'neither' ? [] : [prior];
              snap.ruled![id] = to;
              const now = to === 'neither' ? [] : [to];
              if (was.length !== now.length || was.some((s, i) => s !== now[i])) events.push({ type: 'ruled', paperId: id, to });
            }
            return events;
          },
        };
      });
    } finally {
      emit({ type: 'checking', on: false });
    }
  }

  try {
    await Promise.all([look('for'), look('against')]);
    if (!halt && saidNoSides(snap.for) && saidNoSides(snap.against) && !filedIds().length) {
      return { state: 'no-sides', picks: [] };
    }
    if (!halt) await check();
    if (halt) return { state: halt.state, picks: settle(snap).map(bare), ...(halt.state === 'stopped' ? { why: halt.why } : {}) };
    // The check is done: five a side at most, earliest filed first, and a lower tier never on a side with a
    // journal paper (section 2). Anything this takes off the page is lifted.
    const before = settle(snap);
    const picks = trim(before);
    for (const id of new Set(before.map(p => p.paperId))) {
      const was = before.filter(p => p.paperId === id).map(p => p.side);
      const now = picks.filter(p => p.paperId === id).map(p => p.side);
      if (now.length !== was.length) emit({ type: 'ruled', paperId: id, to: now.length === 1 ? now[0] : 'neither' });
    }
    return { state: 'done', picks };
  } finally {
    deps.signal?.removeEventListener('abort', ended);
  }
}

// ---- settling the sides ----

/** Every pick on both sides in the order it was filed (section 2: the lines stay in the order they were found). */
const inOrder = (snap: RunSnapshot): Pick[] => [...snap.for.filed, ...snap.against.filed].sort((a, b) => a.seq - b.seq);

/** The picks as the check left them: a ruled paper stands where it was ruled (or is gone, for neither), one the
 *  check never ruled stays where it was filed. */
function settle(snap: RunSnapshot): Pick[] {
  const ranked = inOrder(snap);
  const out: Pick[] = [];
  const seen = new Set<string>();
  for (const p of ranked) {
    const r = snap.ruled?.[p.paperId];
    if (r === undefined) { out.push(p); continue; }
    if (r === 'neither' || seen.has(p.paperId)) continue;
    seen.add(p.paperId);
    out.push({ ...p, side: r });
  }
  return out.map(bare);
}

function trim(picks: Pick[]): Pick[] {
  const keep = new Set<Pick>();
  for (const side of ['for', 'against'] as const) {
    const mine = picks.filter(p => p.side === side);
    const journal = mine.some(p => p.tier === 1);
    mine.filter(p => !journal || p.tier === 1).slice(0, CAPS.perSide).forEach(p => keep.add(p));
  }
  return picks.filter(p => keep.has(p)).map(bare);
}

const bare = ({ paperId, side, tier, seq }: Pick): Pick => ({ paperId, side, tier, seq });
