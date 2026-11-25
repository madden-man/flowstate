// The bridge function (PLAN-WORLDS.md section 5, W2) against a fake driver: the token, the two databases and the
// `bridge_` prefix, newest rev wins, a resend changes nothing, and every input is checked.
import { describe, it, expect, beforeEach } from 'vitest';
import { handle, coll, authorised, Confined } from '../../netlify/lib/bridge';
import { BRIDGE_PATH, BATCH_MAX, CLIP_MAX_BYTES, ENVELOPE_MAX_BYTES, type Envelope } from '../../src/bridge/protocol';
import { FakeMongo } from './fake-mongo';

const TOKEN = 'a-long-random-token';
const BASE = `https://flowstate.example${BRIDGE_PATH}`;
let mongo: FakeMongo;
let connects = 0;
const deps = (env: { BRIDGE_TOKEN?: string; BRIDGE_MONGODB_URI?: string } = { BRIDGE_TOKEN: TOKEN, BRIDGE_MONGODB_URI: 'mongodb://fake' }) =>
  ({ env, client: async () => { connects++; return mongo; }, now: () => 1_700_000_000_000 });

const get = (q: string, token: string | null = TOKEN) =>
  new Request(`${BASE}?${q}`, { headers: token === null ? {} : { authorization: `Bearer ${token}` } });
const post = (q: string, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }, token: string | null = TOKEN) =>
  new Request(`${BASE}?${q}`, {
    method: 'POST',
    headers: { ...headers, ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
    body: body instanceof Uint8Array ? (body as Uint8Array<ArrayBuffer>) : JSON.stringify(body),
  });
const read = async (r: Response) => ({ status: r.status, body: await r.json(), cache: r.headers.get('cache-control') });

const env = (o: Partial<Envelope> = {}): Envelope => ({ world: 'eastwinds', table: 'messages', id: 'm1', rev: 10, row: { id: 'm1', text: 'She keeps it for a year', kept: true }, ...o } as Envelope);

beforeEach(() => {
  mongo = new FakeMongo();
  connects = 0;
  mongo.seed('novel_companion', 'bridge_worlds', [{ _id: 'eastwinds', name: 'East Winds', kind: 'novel' }]);
  mongo.seed('music_companion', 'bridge_worlds', [{ _id: 'songbook', name: 'Songbook', kind: 'songs' }]);
  mongo.seed('novel_companion', 'bridge_down', [{ _id: 'eastwinds', stamp: 's1', pocket: { kind: 'novel', characters: [], places: [], chapters: [], events: [], questions: [] } }]);
  mongo.touched = [];
});

describe('the token', () => {
  it('no bearer, a wrong one, or none set on the site: 401, and the database is never reached', async () => {
    for (const [req, d] of [
      [get('op=worlds', null), deps()],
      [get('op=worlds', 'wrong'), deps()],
      [get('op=worlds', `${TOKEN}x`), deps()],
      [get('op=worlds', ''), deps()],
      [get('op=worlds'), deps({ BRIDGE_MONGODB_URI: 'mongodb://fake' })],
      [get('op=worlds'), deps({ BRIDGE_TOKEN: '', BRIDGE_MONGODB_URI: 'mongodb://fake' })],
      [post('op=up', { world: 'eastwinds', envelopes: [env()] }, undefined, 'wrong'), deps()],
      [post('op=clip&world=songbook&take=t1&rev=1', new Uint8Array(4), { 'content-type': 'audio/mp4' }, null), deps()],
    ] as const) {
      const r = await read(await handle(req, d));
      expect(r.status).toBe(401);
      expect(r.cache).toBe('no-store');
    }
    expect(connects).toBe(0);
    expect(mongo.touched).toEqual([]);
  });
  it('compares in constant time over digests, so a different length is just a mismatch', () => {
    const r = (a: string) => new Request(BASE, { headers: { authorization: a } });
    expect(authorised(r(`Bearer ${TOKEN}`), TOKEN)).toBe(true);
    expect(authorised(r(`bearer ${TOKEN}`), TOKEN)).toBe(true);
    expect(authorised(r(TOKEN), TOKEN)).toBe(false);
    expect(authorised(r('Bearer x'), TOKEN)).toBe(false);
    expect(authorised(r(`Bearer ${TOKEN}`), undefined)).toBe(false);
  });
});

describe('confinement', () => {
  it('coll() refuses any other database, any name without the prefix, and clips outside music_companion', () => {
    expect(() => coll(mongo, 'admin' as never, 'bridge_up')).toThrow(Confined);
    expect(() => coll(mongo, 'novel_companion', 'characters' as never)).toThrow(Confined);
    expect(() => coll(mongo, 'novel_companion', 'bridge_other' as never)).toThrow(Confined);
    expect(() => coll(mongo, 'novel_companion', 'bridge_clips')).toThrow(Confined);
    expect(() => coll(mongo, 'music_companion', 'bridge_clips')).not.toThrow();
  });
  it('a whole session of every op touches only bridge_ collections of the two databases', async () => {
    await handle(get('op=worlds'), deps());
    await handle(get('op=pocket&world=eastwinds'), deps());
    await handle(post('op=up', { world: 'eastwinds', envelopes: [env()] }), deps());
    await handle(post('op=up', { world: 'songbook', envelopes: [env({ world: 'songbook', table: 'songs', id: 's1', row: { id: 's1', title: 'Low tide' } })] }), deps());
    await handle(post('op=clip&world=eastwinds&take=t1&rev=1', new Uint8Array(8), { 'content-type': 'audio/mp4' }), deps());
    expect(mongo.touched.length).toBeGreaterThan(0);
    for (const t of mongo.touched) {
      expect(['novel_companion', 'music_companion']).toContain(t.db);
      expect(t.coll.startsWith('bridge_')).toBe(true);
    }
  });
  it('a world\'s envelopes go to its own database only: a novel to novel_companion, Songbook to music_companion', async () => {
    await handle(post('op=up', { world: 'eastwinds', envelopes: [env()] }), deps());
    await handle(post('op=up', { world: 'songbook', envelopes: [env({ world: 'songbook', id: 'm2', row: { id: 'm2', text: 'hm' } })] }), deps());
    expect([...mongo.rows('novel_companion', 'bridge_up').keys()]).toEqual(['eastwinds:messages:m1']);
    expect([...mongo.rows('music_companion', 'bridge_up').keys()]).toEqual(['songbook:messages:m2']);
    expect(mongo.touched.filter(t => t.op === 'insertOne' || t.op === 'updateOne').every(t => t.coll === 'bridge_up')).toBe(true);
  });
  it('a registry row in the wrong database for its kind is no world: listed nowhere, written nowhere', async () => {
    mongo.seed('music_companion', 'bridge_worlds', [{ _id: 'stray', name: 'Stray', kind: 'novel' }]);
    const w = await read(await handle(get('op=worlds'), deps()));
    expect(w.body.worlds).toEqual([{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }, { id: 'songbook', name: 'Songbook', kind: 'songs' }]);
    const r = await read(await handle(post('op=up', { world: 'stray', envelopes: [env({ world: 'stray' })] }), deps()));
    expect(r.status).toBe(404);
    expect(mongo.rows('music_companion', 'bridge_up').size + mongo.rows('novel_companion', 'bridge_up').size).toBe(0);
  });
  it('a world id claimed by both databases is refused rather than guessed', async () => {
    mongo.seed('music_companion', 'bridge_worlds', [{ _id: 'eastwinds', name: 'Twin', kind: 'songs' }]);
    expect((await handle(post('op=up', { world: 'eastwinds', envelopes: [env()] }), deps())).status).toBe(404);
  });
});

describe('the pocket', () => {
  it('answers the pocket with its stamp, then "unchanged" when the phone already has that stamp', async () => {
    const a = await read(await handle(get('op=pocket&world=eastwinds'), deps()));
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ world: 'eastwinds', stamp: 's1', pocket: { kind: 'novel' } });
    const b = await read(await handle(get('op=pocket&world=eastwinds&stamp=s1'), deps()));
    expect(b.body).toEqual({ world: 'eastwinds', stamp: 's1', unchanged: true });
    expect(b.cache).toBe('no-store');
    const c = await read(await handle(get('op=pocket&world=eastwinds&stamp=s0'), deps()));
    expect(c.body.pocket).toBeTruthy();
  });
  it('an unknown world, a world with no pocket yet, or a bad id', async () => {
    expect((await handle(get('op=pocket&world=nowhere'), deps())).status).toBe(404);
    expect((await handle(get('op=pocket&world=songbook'), deps())).status).toBe(404);
    expect((await handle(get('op=pocket&world=East%20Winds'), deps())).status).toBe(400);
    expect((await handle(get('op=pocket&world=eastwinds&stamp=%24where'), deps())).status).toBe(400);
  });
});

describe('up', () => {
  const up = async (envelopes: unknown[], world = 'eastwinds') => read(await handle(post('op=up', { world, envelopes }), deps()));
  const stored = () => mongo.rows('novel_companion', 'bridge_up').get('eastwinds:messages:m1');

  it('stores an envelope and acknowledges it', async () => {
    const r = await up([env()]);
    expect(r.body.acks).toEqual([{ table: 'messages', id: 'm1', rev: 10, result: 'stored' }]);
    expect(stored()).toMatchObject({ world: 'eastwinds', table: 'messages', id: 'm1', rev: 10, deleted: false, row: { text: 'She keeps it for a year' } });
  });
  it('newest rev wins: an older rev is acknowledged as older and changes nothing', async () => {
    await up([env({ rev: 20, row: { id: 'm1', text: 'second' } })]);
    const r = await up([env({ rev: 10, row: { id: 'm1', text: 'first' } })]);
    expect(r.body.acks[0].result).toBe('older');
    expect(stored()!.row).toEqual({ id: 'm1', text: 'second' });
    await up([env({ rev: 30, row: { id: 'm1', text: 'third' } })]);
    expect(stored()!.row).toEqual({ id: 'm1', text: 'third' });
  });
  it('a resend of the same rev is "same" and rewrites nothing', async () => {
    await up([env()]);
    const before = mongo.touched.filter(t => t.op === 'updateOne' || t.op === 'insertOne').length;
    const r = await up([env()]);
    expect(r.body.acks[0].result).toBe('same');
    expect(stored()!.rev).toBe(10);
    expect(mongo.rows('novel_companion', 'bridge_up').size).toBe(1);
    // the second try did attempt a guarded write, and it matched nothing
    expect(mongo.touched.filter(t => t.op === 'updateOne' || t.op === 'insertOne').length - before).toBe(2);
  });
  it('a delete carries no row and replaces the row it is newer than', async () => {
    await up([env()]);
    const r = await up([{ world: 'eastwinds', table: 'messages', id: 'm1', rev: 11, deleted: true }]);
    expect(r.body.acks[0].result).toBe('stored');
    expect(stored()).toMatchObject({ deleted: true, row: null, rev: 11 });
  });
  it('acks each envelope in order, refusing the bad ones by name and storing the rest', async () => {
    const r = await up([
      env({ id: 'a', row: { id: 'a' } }),
      env({ table: 'values' as never, id: 'v', row: { id: 'v' } }),
      env({ table: 'voices' as never, id: 'c:1', row: { id: 'c:1' } }),
      env({ world: 'songbook', id: 'b', row: { id: 'b' } }),
      env({ id: 'bad id!', row: { id: 'bad id!' } }),
      env({ id: 'c', rev: 0, row: { id: 'c' } }),
      env({ id: 'd', rev: 1.5, row: { id: 'd' } }),
      env({ id: 'e', row: { id: 'other' } }),
      env({ id: 'f', row: { id: 'f', text: 'x'.repeat(ENVELOPE_MAX_BYTES) } }),
      { ...env({ id: 'g' }), deleted: true },
      { ...env({ id: 'h', row: { id: 'h' } }), extra: 1 },
      env({ id: 'i', row: { id: 'i' } }),
    ]);
    expect(r.body.acks.map((a: { id: string; result: string; reason?: string }) => [a.id, a.result, a.reason])).toEqual([
      ['a', 'stored', undefined], ['v', 'refused', 'table'], ['c:1', 'refused', 'table'], ['b', 'refused', 'world'],
      ['bad id!', 'refused', 'id'], ['c', 'refused', 'rev'], ['d', 'refused', 'rev'], ['e', 'refused', 'row id'],
      ['f', 'refused', 'size'], ['g', 'refused', 'row on a delete'], ['h', 'refused', 'field'], ['i', 'stored', undefined],
    ]);
    expect([...mongo.rows('novel_companion', 'bridge_up').keys()]).toEqual(['eastwinds:messages:a', 'eastwinds:messages:i']);
  });
  it('refuses a whole batch that is not JSON, too long, too large, or for a world it does not know', async () => {
    const bad = async (body: unknown, h?: Record<string, string>) => (await handle(post('op=up', body, h), deps())).status;
    expect(await bad({ world: 'eastwinds', envelopes: Array.from({ length: BATCH_MAX + 1 }, (_, i) => env({ id: `m${i}`, row: { id: `m${i}` } })) })).toBe(400);
    expect(await bad({ world: 'eastwinds', envelopes: 'no' })).toBe(400);
    expect(await bad({ world: '../admin', envelopes: [] })).toBe(400);
    expect(await bad({ world: 'nowhere', envelopes: [env({ world: 'nowhere' })] })).toBe(404);
    expect(await bad(new TextEncoder().encode('{not json'))).toBe(400);
    expect(await bad(new TextEncoder().encode(JSON.stringify({ world: 'eastwinds', envelopes: [], pad: 'x'.repeat(1024 * 1024) })))).toBe(413);
    expect(mongo.rows('novel_companion', 'bridge_up').size).toBe(0);
  });
});

describe('clips (W6 sends them; the shape and the guard are here now)', () => {
  it('keeps audio in music_companion.bridge_clips, newest rev wins, whatever the world\'s kind', async () => {
    const r = await read(await handle(post('op=clip&world=eastwinds&take=t1&rev=2', new Uint8Array([1, 2, 3]), { 'content-type': 'audio/mp4' }), deps()));
    expect(r.body).toEqual({ take: 't1', result: 'stored' });
    expect(mongo.rows('music_companion', 'bridge_clips').get('eastwinds:t1')).toMatchObject({ take: 't1', rev: 2, type: 'audio/mp4', bytes: 3 });
    expect(mongo.rows('novel_companion', 'bridge_clips').size).toBe(0);
    const again = await read(await handle(post('op=clip&world=eastwinds&take=t1&rev=1', new Uint8Array([9]), { 'content-type': 'audio/mp4' }), deps()));
    expect(again.body.result).toBe('older');
  });
  it('refuses what is not audio, what is too large, and bad ids', async () => {
    const st = async (q: string, body: Uint8Array, type = 'audio/mp4') => (await handle(post(q, body, { 'content-type': type }), deps())).status;
    expect(await st('op=clip&world=songbook&take=t1&rev=1', new Uint8Array(4), 'text/html')).toBe(415);
    expect(await st('op=clip&world=songbook&take=t1&rev=1', new Uint8Array(CLIP_MAX_BYTES + 1))).toBe(413);
    expect(await st('op=clip&world=songbook&take=t%2F1&rev=1', new Uint8Array(4))).toBe(400);
    expect(await st('op=clip&world=songbook&take=t1&rev=0', new Uint8Array(4))).toBe(400);
    expect(await st('op=clip&world=nowhere&take=t1&rev=1', new Uint8Array(4))).toBe(404);
  });
});

describe('everything else', () => {
  it('an unknown op is 400, another method 405, and no Atlas string means 503 after the token', async () => {
    expect((await handle(get('op=drop'), deps())).status).toBe(400);
    expect((await handle(new Request(`${BASE}?op=up`, { method: 'DELETE', headers: { authorization: `Bearer ${TOKEN}` } }), deps())).status).toBe(405);
    expect((await handle(get('op=worlds'), deps({ BRIDGE_TOKEN: TOKEN }))).status).toBe(503);
    expect(connects).toBe(0);
  });
});
