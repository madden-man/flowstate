// Package Q3 (PLAN-RESEARCH.md section 4): the hand loop against a scripted stub port. No key, no network: each
// conversation (+, − and the check) is told apart by its system prompt and given canned replies in order, and
// every request it was sent is recorded.
import { describe, it, expect } from 'vitest';
import type { BetaMessage, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { runInquiry, CHECKER_PROMPT, FILE_CAP, MODEL, searcherPrompt, type MessagesPort } from '../../src/research/agents';
import { IndexError } from '../../src/research/indexes';
import { CAPS, type Paper, type Pick, type RunEvent, type RunSnapshot, type SearchArgs, type Side } from '../../src/research/types';

type Key = Side | 'check';
type Block = Record<string, unknown>;
type Reply = BetaMessage | (() => BetaMessage | Promise<BetaMessage>);

let seq = 0;
const reply = (content: Block[], stop_reason: string = content.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn'): BetaMessage => ({
  id: `msg_${++seq}`, type: 'message', role: 'assistant', model: MODEL, content, stop_reason, stop_sequence: null,
  stop_details: null, container: null, context_management: null, diagnostics: null,
  usage: { input_tokens: 1, output_tokens: 1 },
}) as unknown as BetaMessage;
const tu = (name: string, input: Record<string, unknown>, id = `tu_${++seq}`): Block => ({ type: 'tool_use', id, name, input });
const text = (t: string): Block => ({ type: 'text', text: t, citations: null });
const think = (t: string): Block => ({ type: 'thinking', thinking: t, signature: `sig-${t}` });
const done = () => reply([text('That is all.')]);

const paper = (id: string, tier: 1 | 2 = 1): Paper => ({
  id, title: `Title of ${id}`, abstract: [{ head: 'Results', text: `Abstract of ${id}.` }], journal: 'The Journal',
  year: 2020, kind: tier === 1 ? 'Meta-analysis' : 'Preprint, not peer reviewed', tier, url: `https://doi.org/${id}`,
  source: 'europepmc', fetchedAt: 0,
});

/** Papers by query: a search for "q:a,b" returns papers a and b (tier from the args). */
function fakeSearch(log: SearchArgs[] = []) {
  return async (args: SearchArgs) => {
    log.push(args);
    const ids = args.query.startsWith('q:') ? args.query.slice(2).split(',') : [];
    return ids.map(id => paper(id, args.tier));
  };
}

function stub(script: Partial<Record<Key, Reply[]>>) {
  const sent: Record<Key, MessageCreateParamsNonStreaming[]> = { for: [], against: [], check: [] };
  const left: Record<Key, Reply[]> = { for: [...(script.for ?? [])], against: [...(script.against ?? [])], check: [...(script.check ?? [])] };
  const keyOf = (p: MessageCreateParamsNonStreaming): Key =>
    p.system === CHECKER_PROMPT ? 'check' : p.system === searcherPrompt('for') ? 'for' : 'against';
  const port: MessagesPort = {
    async create(params) {
      const k = keyOf(params);
      sent[k].push(JSON.parse(JSON.stringify(params)));
      const next = left[k].shift() ?? done;
      return typeof next === 'function' ? next() : next;
    },
  };
  return { port, sent };
}

async function run(script: Partial<Record<Key, Reply[]>>, opts: { resume?: RunSnapshot; signal?: AbortSignal; onEvent?: (e: RunEvent) => void; search?: ReturnType<typeof fakeSearch>; question?: string } = {}) {
  const s = stub(script);
  const events: RunEvent[] = [];
  const result = await runInquiry(opts.question ?? 'Does walking help sleep?', {
    port: s.port, search: opts.search ?? fakeSearch(), signal: opts.signal,
    onEvent: e => { events.push(e); opts.onEvent?.(e); },
  }, opts.resume);
  const snapshots = events.filter((e): e is Extract<RunEvent, { type: 'snapshot' }> => e.type === 'snapshot').map(e => e.snapshot);
  return { ...s, events, result, snapshots, last: snapshots[snapshots.length - 1] };
}

/** The tool results the app sent back for a conversation's turn n (1-based), from the request after it. */
const resultsAfter = (sent: MessageCreateParamsNonStreaming[], n: number) => {
  const msgs = sent[n].messages;
  const m = msgs[msgs.length - 1];
  return m.content as unknown as { tool_use_id: string; content: string; is_error?: boolean }[];
};
const filed = (events: RunEvent[]) => events.filter(e => e.type === 'filed').map(e => (e as Extract<RunEvent, { type: 'filed' }>).pick);
const ruled = (events: RunEvent[]) => events.filter(e => e.type === 'ruled');
/** Picks without their seq, where the test is about sides, not the order two concurrent loops happened to commit in. */
const nos = (ps: Pick[]) => ps.map(({ paperId, side, tier }) => ({ paperId, side, tier }));
const noSeq = <T extends { picks: Pick[] }>(r: T) => ({ ...r, picks: nos(r.picks) });

describe('runInquiry: the request', () => {
  it('sends Opus 5.5 at high effort with the fallback beta, top level caching, strict tools and nothing forced', async () => {
    const { sent } = await run({ for: [reply([tu('search', { query: 'q:a', index: 'europepmc', tier: 1 })])] });
    const all = [...sent.for, ...sent.against];
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const p of all) {
      expect(p.model).toBe('claude-opus-5-5');
      expect(p.max_tokens).toBe(16000);
      expect(p.output_config).toEqual({ effort: 'high' });
      expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
      expect(p.fallbacks).toBe('default');
      expect(p.cache_control).toEqual({ type: 'ephemeral' });
      expect(p).not.toHaveProperty('tool_choice');
      expect(p).not.toHaveProperty('temperature');
      expect(p).not.toHaveProperty('top_p');
      expect(p).not.toHaveProperty('top_k');
      expect(p).not.toHaveProperty('stream');
      if ('thinking' in p) expect(p.thinking).toEqual({ type: 'adaptive' });
      expect(p.tools!.map(t => (t as { name: string }).name)).toEqual(['search', 'file', 'not_a_side_question']);
      for (const t of p.tools as { strict?: boolean; input_schema: { additionalProperties?: boolean; properties: object; required: string[] } }[]) {
        expect(t.strict).toBe(true);
        expect(t.input_schema.additionalProperties).toBe(false);
        expect(t.input_schema.required.sort()).toEqual(Object.keys(t.input_schema.properties).sort());
      }
    }
    // the question rides in the first user message; system and tools are the same bytes every turn
    expect(sent.for[0].messages[0]).toEqual({ role: 'user', content: 'The question: Does walking help sleep?' });
    expect(JSON.stringify(sent.for[1].system)).toBe(JSON.stringify(sent.for[0].system));
    expect(JSON.stringify(sent.for[1].tools)).toBe(JSON.stringify(sent.for[0].tools));
    expect(sent.for[0].system).not.toContain('walking');
    // file takes no side: the side is the agent's own
    const file = sent.for[0].tools!.find(t => (t as { name: string }).name === 'file') as { input_schema: { properties: object } };
    expect(Object.keys(file.input_schema.properties)).toEqual(['id']);
  });

  it('gives the check one strict tool, rule, and its own prompt', async () => {
    const { sent } = await run({
      for: [reply([tu('search', { query: 'q:a', index: 'europepmc', tier: 1 })]), reply([tu('file', { id: 'a' })])],
    });
    expect(sent.check).toHaveLength(1);
    const p = sent.check[0];
    expect(p.system).toBe(CHECKER_PROMPT);
    expect(p.model).toBe('claude-opus-5-5');
    expect(p.fallbacks).toBe('default');
    expect(p.tools!.map(t => (t as { name: string }).name)).toEqual(['rule']);
    expect((p.tools![0] as { strict?: boolean }).strict).toBe(true);
  });
});

describe('runInquiry: searching and filing', () => {
  it('refuses an id no search returned', async () => {
    const { sent, events, result } = await run({ for: [reply([tu('file', { id: 'doi:10.1/invented' }, 'f1')])] });
    const r = resultsAfter(sent.for, 1);
    expect(r).toEqual([expect.objectContaining({ tool_use_id: 'f1', is_error: true })]);
    expect(filed(events)).toEqual([]);
    expect(result).toEqual({ state: 'done', picks: [] });
  });

  it('lets no model text out: text, thinking and invented input fields stay in the messages', async () => {
    const secret = ['SECRET-TEXT', 'SECRET-THINK', 'SECRET-FIELD', 'SECRET-SIDE', 'SECRET-TITLE'];
    const { events, result, sent } = await run({
      for: [
        reply([think('SECRET-THINK'), text('SECRET-TEXT one'), tu('search', { query: 'q:a', index: 'europepmc', tier: 1 })]),
        reply([text('SECRET-TEXT two'), tu('file', { id: 'a', side: 'SECRET-SIDE', note: 'SECRET-FIELD', title: 'SECRET-TITLE', tier: 3 })]),
      ],
      check: [reply([text('SECRET-TEXT three'), tu('rule', { id: 'a', side: 'for', why: 'SECRET-FIELD' })])],
    });
    expect(filed(events)).toEqual([{ paperId: 'a', side: 'for', tier: 1, seq: 0 }]);
    const out = JSON.stringify({ result, events: events.map(e => e.type === 'snapshot' ? { ...e.snapshot, for: 0, against: 0, check: 0 } : e) });
    for (const s of secret) expect(out).not.toContain(s);
    // the filed paper is the index's record, whole
    const f = events.find(e => e.type === 'filed') as Extract<RunEvent, { type: 'filed' }>;
    expect(f.paper).toEqual(paper('a'));
    // and the text did go back to the API
    expect(JSON.stringify(sent.for[1].messages)).toContain('SECRET-TEXT one');
  });

  it('answers the ninth search with no searches left', async () => {
    const log: SearchArgs[] = [];
    const calls = Array.from({ length: 9 }, (_, i) => tu('search', { query: `q:p${i}`, index: 'openalex', tier: 1 }, `s${i}`));
    const { sent, snapshots } = await run({ for: [reply(calls)] }, { search: fakeSearch(log) });
    const r = resultsAfter(sent.for, 1);
    expect(r).toHaveLength(9);
    expect(r.slice(0, 8).every(x => !x.is_error)).toBe(true);
    expect(r[8]).toMatchObject({ tool_use_id: 's8', is_error: true });
    expect(r[8].content).toMatch(/no searches are left/i);
    expect(log.filter(a => a.index === 'openalex')).toHaveLength(CAPS.searches);
    expect(snapshots[snapshots.length - 1].for.searches).toBe(CAPS.searches);
  });

  it('carries the search count across turns', async () => {
    const s = (i: number) => tu('search', { query: `q:x${i}`, index: 'europepmc', tier: 1 }, `x${i}`);
    const { sent } = await run({ for: [reply([s(0), s(1), s(2), s(3), s(4)]), reply([s(5), s(6), s(7)]), reply([s(8)])] });
    expect(resultsAfter(sent.for, 2).every(x => !x.is_error)).toBe(true);
    expect(resultsAfter(sent.for, 3)[0].is_error).toBe(true);
  });

  it('refuses a tier 2 search once the side has a tier 1 paper filed', async () => {
    const log: SearchArgs[] = [];
    const { sent } = await run({
      for: [
        reply([tu('search', { query: 'q:pre', index: 'europepmc', tier: 2 }, 'a1')]),
        reply([tu('search', { query: 'q:j', index: 'europepmc', tier: 1 })]),
        reply([tu('file', { id: 'j' })]),
        reply([tu('search', { query: 'q:pre2', index: 'europepmc', tier: 2 }, 'a4')]),
      ],
    }, { search: fakeSearch(log) });
    expect(resultsAfter(sent.for, 1)[0].is_error).toBeFalsy();
    expect(resultsAfter(sent.for, 4)[0]).toMatchObject({ tool_use_id: 'a4', is_error: true });
    expect(log.map(a => a.query)).toEqual(['q:pre', 'q:j']);
  });

  it('turns an IndexError into an error result, not a crash', async () => {
    const search = async () => { throw new IndexError('offline', 'europepmc'); };
    const { sent, result } = await run({ for: [reply([tu('search', { query: 'q:a', index: 'europepmc', tier: 1 }, 'e1')])] }, { search: search as never });
    expect(resultsAfter(sent.for, 1)[0]).toMatchObject({ tool_use_id: 'e1', is_error: true });
    expect(resultsAfter(sent.for, 1)[0].content).toMatch(/index did not answer/);
    expect(result.state).toBe('done');
  });

  it('answers parallel tool calls in one user message, in order', async () => {
    const { sent } = await run({
      for: [
        reply([tu('search', { query: 'q:a', index: 'europepmc', tier: 1 }, 'p1'), tu('search', { query: 'q:b', index: 'openalex', tier: 1 }, 'p2')]),
        reply([tu('file', { id: 'a' }, 'p3'), tu('file', { id: 'b' }, 'p4'), tu('file', { id: 'nope' }, 'p5')]),
      ],
    });
    const m = sent.for[1].messages;
    expect(m).toHaveLength(3);
    expect(m[2].role).toBe('user');
    expect((m[2].content as { tool_use_id: string }[]).map(r => r.tool_use_id)).toEqual(['p1', 'p2']);
    const r = resultsAfter(sent.for, 2);
    expect(r.map(x => [x.tool_use_id, !!x.is_error])).toEqual([['p3', false], ['p4', false], ['p5', true]]);
    // the search results are the papers as JSON, abstract whole
    const papers = JSON.parse((m[2].content as { content: string }[])[0].content);
    expect(papers).toEqual([{ id: 'a', title: 'Title of a', abstract: [{ head: 'Results', text: 'Abstract of a.' }], journal: 'The Journal', year: 2020, kind: 'Meta-analysis', tier: 1 }]);
  });

  it('passes thinking blocks back unchanged and only ever appends', async () => {
    const t1 = [think('first'), { type: 'redacted_thinking', data: 'opaque==' }, tu('search', { query: 'q:a', index: 'europepmc', tier: 1 })];
    const t2 = [think('second'), tu('file', { id: 'a' })];
    const { sent } = await run({ for: [reply(t1), reply(t2)] });
    expect(sent.for[1].messages[1]).toEqual({ role: 'assistant', content: t1 });
    expect(sent.for[2].messages[3]).toEqual({ role: 'assistant', content: t2 });
    for (let i = 1; i < sent.for.length; i++) expect(sent.for[i].messages.slice(0, sent.for[i - 1].messages.length)).toEqual(sent.for[i - 1].messages);
  });

  it('refuses filing past the pre-check cap', async () => {
    const ids = Array.from({ length: FILE_CAP + 1 }, (_, i) => `k${i}`);
    const { sent, events } = await run({
      for: [reply([tu('search', { query: `q:${ids.join(',')}`, index: 'europepmc', tier: 1 })]), reply(ids.map(id => tu('file', { id })))],
    });
    expect(filed(events)).toHaveLength(FILE_CAP);
    expect(resultsAfter(sent.for, 2)[FILE_CAP].is_error).toBe(true);
  });

  it('ends a loop at the turn cap', async () => {
    const turns = Array.from({ length: CAPS.turns + 3 }, () => reply([tu('file', { id: 'none' })]));
    const { sent } = await run({ for: turns });
    expect(sent.for).toHaveLength(CAPS.turns);
  });

  it('treats max_tokens with no whole tool call as a finished turn without tools', async () => {
    const { sent, result } = await run({ for: [reply([text('cut'), tu('search', { query: 'q:a' })], 'max_tokens'), reply([tu('file', { id: 'x' })])] });
    expect(sent.for).toHaveLength(1);
    expect(result.state).toBe('done');
  });

  it('answers the whole calls of a max_tokens turn and errors the cut one', async () => {
    const { sent } = await run({ for: [reply([tu('search', { query: 'q:a', index: 'europepmc', tier: 1 }, 'w'), tu('search', { query: 'q:b' }, 'c')], 'max_tokens')] });
    expect(resultsAfter(sent.for, 1).map(x => [x.tool_use_id, !!x.is_error])).toEqual([['w', false], ['c', true]]);
  });

  it('numbers picks across both sides in the order they were filed', async () => {
    // against files y only after for has filed x; for files z only after against has filed y
    let xFiled!: () => void, yFiled!: () => void;
    const afterX = new Promise<void>(r => { xFiled = r; });
    const afterY = new Promise<void>(r => { yFiled = r; });
    const { events, result } = await run({
      for: [...findAndFile(['x']), async () => { await afterY; return reply([tu('search', { query: 'q:z', index: 'europepmc', tier: 1 })]); }, reply([tu('file', { id: 'z' })])],
      against: [async () => { await afterX; return reply([tu('search', { query: 'q:y', index: 'europepmc', tier: 1 })]); }, reply([tu('file', { id: 'y' })])],
    }, { onEvent: e => { if (e.type === 'filed') (e.pick.paperId === 'x' ? xFiled : yFiled)(); } });
    expect(filed(events)).toEqual([
      { paperId: 'x', side: 'for', tier: 1, seq: 0 },
      { paperId: 'y', side: 'against', tier: 1, seq: 1 },
      { paperId: 'z', side: 'for', tier: 1, seq: 2 },
    ]);
    expect(result.picks).toEqual(filed(events));
  });

  it('emits looking on and off for each side', async () => {
    const { events } = await run({});
    const looks = events.filter(e => e.type === 'looking');
    expect(looks).toContainEqual({ type: 'looking', side: 'for', on: true });
    expect(looks).toContainEqual({ type: 'looking', side: 'for', on: false });
    expect(looks).toContainEqual({ type: 'looking', side: 'against', on: true });
    expect(looks).toContainEqual({ type: 'looking', side: 'against', on: false });
  });
});

const findAndFile = (ids: string[], tier: 1 | 2 = 1) => [
  reply([tu('search', { query: `q:${ids.join(',')}`, index: 'europepmc', tier })]),
  reply(ids.map(id => tu('file', { id }))),
];

describe('runInquiry: the check', () => {
  it('settles one paper filed by both agents, and sees no hint of who filed what', async () => {
    const { sent, events, result } = await run({
      for: findAndFile(['shared', 'b']),
      against: findAndFile(['shared']),
      check: [reply([tu('rule', { id: 'shared', side: 'for' }), tu('rule', { id: 'b', side: 'for' })])],
    });
    expect(ruled(events)).toEqual([{ type: 'ruled', paperId: 'shared', to: 'for' }]);
    expect(nos(result.picks)).toEqual([{ paperId: 'shared', side: 'for', tier: 1 }, { paperId: 'b', side: 'for', tier: 1 }]);
    const first = sent.check[0].messages[0].content as string;
    expect(first).toContain('The question: Does walking help sleep?');
    expect(first).not.toMatch(/\bfor\b|against|\+|−/);
    const listed = JSON.parse(first.slice(first.indexOf('['))) as { id: string }[];
    expect(listed.map(p => p.id)).toEqual(['b', 'shared']);
    expect(Object.keys(listed[0])).toEqual(['id', 'title', 'abstract']);
  });

  it('lifts a paper ruled neither and moves one ruled the other way', async () => {
    const { events, result } = await run({
      for: findAndFile(['a', 'b', 'c']),
      check: [reply([tu('rule', { id: 'a', side: 'neither' })]), reply([tu('rule', { id: 'b', side: 'against' }), tu('rule', { id: 'c', side: 'for' })])],
    });
    expect(ruled(events)).toEqual([{ type: 'ruled', paperId: 'a', to: 'neither' }, { type: 'ruled', paperId: 'b', to: 'against' }]);
    expect(nos(result.picks)).toEqual([{ paperId: 'b', side: 'against', tier: 1 }, { paperId: 'c', side: 'for', tier: 1 }]);
  });

  it('emits checking on and off around the check, after both sides stop looking', async () => {
    const { events } = await run({ for: findAndFile(['a']) });
    const order = events.filter(e => e.type === 'looking' || e.type === 'checking').map(e => JSON.stringify(e));
    const on = order.indexOf(JSON.stringify({ type: 'checking', on: true }));
    expect(on).toBe(4);
    expect(order[5]).toBe(JSON.stringify({ type: 'checking', on: false }));
    expect(order).toHaveLength(6);
  });

  it('emits no checking when nothing was filed', async () => {
    const { events } = await run({});
    expect(events.some(e => e.type === 'checking')).toBe(false);
  });

  it('refuses a ruling on a paper not filed', async () => {
    const { sent, result } = await run({
      for: [reply([tu('search', { query: 'q:a,z', index: 'europepmc', tier: 1 })]), reply([tu('file', { id: 'a' })])],
      check: [reply([tu('rule', { id: 'z', side: 'for' }, 'r1')])],
    });
    expect(resultsAfter(sent.check, 1)[0]).toMatchObject({ tool_use_id: 'r1', is_error: true });
    expect(nos(result.picks)).toEqual([{ paperId: 'a', side: 'for', tier: 1 }]);
  });

  it('keeps five a side, the earliest filed, and lifts the rest', async () => {
    const ids = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
    const { events, result } = await run({ for: findAndFile(ids), against: findAndFile(['g0', 'g1']) });
    expect(result.picks.filter(p => p.side === 'for').map(p => p.paperId)).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
    expect(result.picks.filter(p => p.side === 'against').map(p => p.paperId)).toEqual(['g0', 'g1']);
    expect(ruled(events)).toEqual([{ type: 'ruled', paperId: 'f5', to: 'neither' }, { type: 'ruled', paperId: 'f6', to: 'neither' }]);
    // in found order
    expect(result.picks.map(p => p.seq)).toEqual([...result.picks.map(p => p.seq)].sort((a, b) => a - b));
  });

  it('keeps a lower tier off a side that has a journal paper', async () => {
    const { result } = await run({
      for: [...findAndFile(['pre'], 2), reply([tu('search', { query: 'q:j', index: 'europepmc', tier: 1 })]), reply([tu('file', { id: 'j' })])],
    });
    expect(nos(result.picks)).toEqual([{ paperId: 'j', side: 'for', tier: 1 }]);
  });
});

describe('runInquiry: how a run ends', () => {
  it('is no-sides when both agents say so and nothing is filed', async () => {
    const { result, sent } = await run({ for: [reply([tu('not_a_side_question', {})])], against: [reply([tu('not_a_side_question', {})])] }, { question: 'What is the best diet?' });
    expect(result).toEqual({ state: 'no-sides', picks: [] });
    expect(sent.for).toHaveLength(1);
    expect(sent.check).toHaveLength(0);
  });

  it('is done, not no-sides, when only one agent says so', async () => {
    const { result } = await run({ for: [reply([tu('not_a_side_question', {})])], against: findAndFile(['a']) });
    expect(result.state).toBe('done');
    expect(nos(result.picks)).toEqual([{ paperId: 'a', side: 'against', tier: 1 }]);
  });

  it('is refused when a reply stops on refusal, and the other side stops too', async () => {
    let released!: () => void;
    const slow = () => new Promise<BetaMessage>(r => { released = () => r(reply([tu('search', { query: 'q:late', index: 'europepmc', tier: 1 })])); });
    const p = run({ for: [reply([], 'refusal')], against: [slow] });
    await new Promise(r => setTimeout(r, 0));
    released();
    const { result, sent } = await p;
    expect(result.state).toBe('refused');
    expect(sent.against).toHaveLength(1);
    expect(sent.check).toHaveLength(0);
  });

  it('is refused when the check refuses, keeping the picks', async () => {
    const { result } = await run({ for: findAndFile(['a']), check: [reply([], 'refusal')] });
    expect(noSeq(result)).toEqual({ state: 'refused', picks: [{ paperId: 'a', side: 'for', tier: 1 }] });
  });

  const cases: [string, object, string][] = [
    ['AuthenticationError', { name: 'AuthenticationError', status: 401 }, 'key'],
    ['PermissionDeniedError', { name: 'PermissionDeniedError', status: 403 }, 'key'],
    ['RateLimitError', { name: 'RateLimitError', status: 429 }, 'limit'],
    ['a billing error', { name: 'APIError', status: 402 }, 'limit'],
    ['APIConnectionError', { name: 'APIConnectionError', status: undefined }, 'offline'],
    ['APIConnectionTimeoutError', { name: 'APIConnectionTimeoutError', status: undefined }, 'offline'],
    ['InternalServerError', { name: 'InternalServerError', status: 500 }, 'error'],
    ['OverloadedError', { name: 'OverloadedError', status: 529 }, 'error'],
    ['a plain Error', { name: 'Error' }, 'error'],
  ];
  for (const [label, shape, why] of cases) {
    it(`stops with why ${why} on ${label}, keeping what was filed`, async () => {
      const boom = () => { throw Object.assign(new Error(label), shape); };
      const { result, last } = await run({ for: [...findAndFile(['a']), boom] });
      expect(noSeq(result)).toEqual({ state: 'stopped', why, picks: [{ paperId: 'a', side: 'for', tier: 1 }] });
      expect(last.for.turns).toBe(2);
      expect(last.for.done).toBe(false);
    });
  }

  it('stops with why ended on the abort signal, mid request', async () => {
    const ctl = new AbortController();
    const hang = () => new Promise<BetaMessage>((_, reject) => {
      ctl.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'APIUserAbortError' })));
      setTimeout(() => ctl.abort(), 0);
    });
    const { result, last } = await run({ for: [...findAndFile(['a']), hang] }, { signal: ctl.signal });
    expect(noSeq(result)).toEqual({ state: 'stopped', why: 'ended', picks: [{ paperId: 'a', side: 'for', tier: 1 }] });
    expect(last.for.turns).toBe(2);
  });

  it('sends nothing when the signal is already aborted', async () => {
    const ctl = new AbortController();
    ctl.abort();
    const { result, sent } = await run({}, { signal: ctl.signal });
    expect(noSeq(result)).toEqual({ state: 'stopped', why: 'ended', picks: [] });
    expect(sent.for.length + sent.against.length).toBe(0);
  });
});

describe('runInquiry: resume', () => {
  const s = (q: string) => reply([tu('search', { query: q, index: 'europepmc', tier: 1 })]);
  const script = [s('q:a'), reply([tu('file', { id: 'a' })]), s('q:b'), reply([think('four'), tu('file', { id: 'b' })]), s('q:c'), reply([tu('file', { id: 'c' })])];
  // one set of replies (one set of tool ids) for every run, so the requests compare byte for byte
  const forScript = () => [...script];

  it('cut after turn four picks up at turn five with the whole history and repeats nothing', async () => {
    const ctl = new AbortController();
    const first = await run({ for: forScript(), against: [reply([tu('not_a_side_question', {})])] }, {
      signal: ctl.signal,
      onEvent: e => { if (e.type === 'snapshot' && e.snapshot.for.turns === 4) ctl.abort(); },
    });
    expect(first.result).toMatchObject({ state: 'stopped', why: 'ended' });
    expect(first.sent.for).toHaveLength(4);
    const stored = first.last;
    expect(stored.for.turns).toBe(4);
    expect(stored.against.done).toBe(true);
    expect(filed(first.events).map(p => p.paperId)).toEqual(['a', 'b']);
    // the snapshot is plain JSON
    expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);

    // what a full uncut run sends at turn five, for comparison
    const whole = await run({ for: forScript(), against: [reply([tu('not_a_side_question', {})])] });

    const searchLog: SearchArgs[] = [];
    const again = await run({ for: forScript().slice(4) }, { resume: stored, search: fakeSearch(searchLog) });
    // turns five and six, then the closing turn that calls no tool
    expect(again.sent.for).toHaveLength(3);
    expect(again.sent.against).toHaveLength(0);
    expect(again.sent.for[0].messages).toEqual(stored.for.messages);
    expect(again.sent.for[0].messages).toHaveLength(9);
    expect(JSON.stringify(again.sent.for[0].messages)).toBe(JSON.stringify(whole.sent.for[4].messages));
    expect(searchLog.map(a => a.query)).toEqual(['q:c']);
    expect(filed(again.events).map(p => p.paperId)).toEqual(['c']);
    expect(again.events.filter(e => e.type === 'looking').map(e => (e as { side: Side }).side)).toEqual(['for', 'for']);
    expect(again.last.for.turns).toBe(7);
    expect(again.last.for.searches).toBe(3);
    // the run-wide counter carries on from the snapshot: c is the third pick of the run, not the first of the resume
    expect(again.result).toEqual({ state: 'done', picks: [{ paperId: 'a', side: 'for', tier: 1, seq: 0 }, { paperId: 'b', side: 'for', tier: 1, seq: 1 }, { paperId: 'c', side: 'for', tier: 1, seq: 2 }] });
    expect(filed(again.events)[0].seq).toBe(2);
    // the caller's snapshot is not changed under it
    expect(stored.for.turns).toBe(4);
  });

  it('resumes the check where it stopped, keeping its rulings', async () => {
    const ctl = new AbortController();
    const check = [reply([tu('rule', { id: 'a', side: 'neither' })]), () => { ctl.abort(); return reply([tu('rule', { id: 'b', side: 'against' })]); }];
    const first = await run({ for: findAndFile(['a', 'b']), check }, { signal: ctl.signal });
    expect(first.result.state).toBe('stopped');
    expect(nos(first.result.picks)).toEqual([{ paperId: 'b', side: 'for', tier: 1 }]);
    const again = await run({ check: [reply([tu('rule', { id: 'b', side: 'against' })])] }, { resume: first.last });
    expect(again.sent.for).toHaveLength(0);
    expect(again.sent.check).toHaveLength(2);
    expect(again.sent.check[0].messages).toHaveLength(3);
    expect(ruled(again.events)).toEqual([{ type: 'ruled', paperId: 'b', to: 'against' }]);
    expect(again.events.filter(e => e.type === 'checking')).toEqual([{ type: 'checking', on: true }, { type: 'checking', on: false }]);
    expect(nos(again.result.picks)).toEqual([{ paperId: 'b', side: 'against', tier: 1 }]);
  });
});
