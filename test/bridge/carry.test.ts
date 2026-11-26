// Carrying (PLAN-WORLDS.md section 5, W2): opt-in twice over (a token AND a world worn), the registry onto home's row,
// the pocket fetched only when its stamp moved and kept sealed on home's row, the token sealed, nothing while locked.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store, don, doff, home, book, setKey, lock, handed } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { defaultSettings } from '../../src/db/seed';
import { newCouncil, speak } from '../../src/model/council';
import { carry, carryNow, carryOnOpen, saveBridgeToken, removeBridgeToken, bridgeToken, carriedAt, startCarry, carryOnHide } from '../../src/model/carry';
import { BRIDGE_PATH, type Ack, type Envelope, type NovelPocket } from '../../src/bridge/protocol';
import { freshDB } from '../db/helpers';

const POCKET: NovelPocket = {
  kind: 'novel', places: [], chapters: [], events: [],
  characters: [{ id: 'dawn', fullName: 'Dawn Li', firstName: 'Dawn', familyColour: '#d04040' }],
  questions: [{ id: 'q1', question: 'Does the river freeze?', state: 'open', changedAt: 1 }],
};

/** The function as the phone sees it: the registry, one pocket at stamp s1, and acks for every envelope. */
function site() {
  const calls: string[] = [];
  const up: Envelope[] = [];
  const fetcher = (async (u: RequestInfo | URL, init?: RequestInit) => {
    const url = String(u);
    calls.push(url);
    expect(url.startsWith(`${BRIDGE_PATH}?`)).toBe(true);
    const op = new URLSearchParams(url.split('?')[1]).get('op');
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (op === 'worlds') return json({ worlds: [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }, { id: 'songbook', name: 'Songbook', kind: 'songs' }] });
    if (op === 'pocket') {
      const stamp = new URLSearchParams(url.split('?')[1]).get('stamp');
      return json(stamp === 's1' ? { world: 'eastwinds', stamp: 's1', unchanged: true } : { world: 'eastwinds', stamp: 's1', pocket: POCKET });
    }
    const body = JSON.parse(String(init!.body)) as { envelopes: Envelope[] };
    up.push(...body.envelopes);
    return json({ acks: body.envelopes.map((e): Ack => ({ table: e.table, id: e.id, rev: e.rev, result: 'stored' })) });
  }) as typeof fetch;
  return { calls, up, fetcher };
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  await freshDB();
  await store.put('settings', defaultSettings());
  await removeBridgeToken();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
  fetchSpy.mockImplementation(() => { throw new Error('no real request in a unit test'); });
});

describe('opt-in: a token AND a world worn', () => {
  it('a world worn but no token: nothing is asked for, whatever is written', async () => {
    const s = site();
    await don('eastwinds');
    const c = await newCouncil();
    await speak(c.id, 'no token yet');
    expect(await carry({ worlds: 'worn', fetcher: s.fetcher })).toBe('idle');
    expect(await carryNow(s.fetcher)).toBe('idle');
    expect(s.calls).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('a token but his own pages worn: opening asks for nothing; only Carry now and saving ask for the registry', async () => {
    const s = site();
    await saveBridgeToken('  tok  ', s.fetcher);
    expect(s.calls).toEqual([`${BRIDGE_PATH}?op=worlds`]);
    const c = await newCouncil();
    await speak(c.id, 'his own council never leaves');
    expect(await carryOnOpen(s.fetcher)).toBe('idle');
    expect(s.calls).toHaveLength(1);
    expect(await carryNow(s.fetcher)).toBe('idle');
    expect(s.calls).toEqual([`${BRIDGE_PATH}?op=worlds`, `${BRIDGE_PATH}?op=worlds`]);
    expect(s.up).toEqual([]);
    expect(await home().outbox.count()).toBe(0);
  });
  it('a token and a world worn: up, then the pocket; the registry lands on home\'s row', async () => {
    const s = site();
    await saveBridgeToken('tok', s.fetcher);
    await don('eastwinds');
    const c = await newCouncil();
    const m = await speak(c.id, 'Dawn would not have said that');
    expect(await carryOnOpen(s.fetcher)).toBe('carried');
    expect(s.up.map(e => [e.table, e.id])).toEqual([['pages', c.id], ['messages', m.id]]);
    expect(await book().outbox.count()).toBe(0);
    expect((await store.get('settings', 'app'))!.worlds).toEqual([{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }, { id: 'songbook', name: 'Songbook', kind: 'songs' }]);
    expect(await home().settings.get('app')).toMatchObject({ worlds: expect.any(Array) });
    expect(await store.get('voices', 'c:dawn')).toMatchObject({ name: 'Dawn Li' });
    expect(carriedAt.value).toBeGreaterThan(0);
    const b = (await store.get('settings', 'app'))!.bridge!;
    expect(b).toMatchObject({ token: 'tok', pocket: { world: 'eastwinds', stamp: 's1' } });
    expect(b.upAt).toBe(carriedAt.value);
    // a second opening: the pocket's stamp has not moved, so it is not written again
    await carryOnOpen(s.fetcher);
    expect(s.calls.filter(c => c.includes('op=pocket')).at(-1)).toContain('stamp=s1');
  });
  it('donning fetches the pocket for that world, and a write settling sends it up, once startCarry listens', async () => {
    const s = site();
    fetchSpy.mockImplementation(s.fetcher as never);
    const stop = startCarry();
    try {
      await saveBridgeToken('tok');
      await don('eastwinds');
      await vi.waitFor(() => expect(s.calls.some(c => c.includes('op=pocket&world=eastwinds'))).toBe(true));
      await vi.waitFor(async () => expect(await store.get('voices', 'c:dawn')).toBeTruthy());
      const c = await newCouncil();
      await speak(c.id, 'settles, then goes');
      await vi.waitFor(() => expect(s.up.map(e => e.id)).toContain(c.id), { timeout: 4000 });
      await doff();
    } finally { stop(); }
  });
  it('the registry keeps a world\'s spine hue', async () => {
    const s = site();
    await store.put('settings', { ...(await store.get('settings', 'app'))!, worlds: [{ id: 'eastwinds', name: 'Old', kind: 'novel', hue: 140 }] });
    await saveBridgeToken('tok', s.fetcher);
    expect((await store.get('settings', 'app'))!.worlds![0]).toEqual({ id: 'eastwinds', name: 'East Winds', kind: 'novel', hue: 140 });
  });
});

describe('as the app is hidden', () => {
  it('the batch read after the last write goes at once with keepalive, before the debounced send', async () => {
    const s = site();
    const inits: RequestInit[] = [];
    fetchSpy.mockImplementation(((u: RequestInfo | URL, init?: RequestInit) => { inits.push(init ?? {}); return s.fetcher(u, init); }) as never);
    await saveBridgeToken('tok');
    await don('eastwinds');
    await carryOnOpen();
    const stop = startCarry();
    try {
      const c = await newCouncil();
      await speak(c.id, 'written just before the phone went dark');
      await new Promise(r => setTimeout(r, 600)); // read (300 ms), not yet sent (1.2 s)
      const before = s.up.length;
      carryOnHide();
      await vi.waitFor(() => expect(s.up.length).toBeGreaterThan(before));
      expect(s.up.some(e => e.row?.text === 'written just before the phone went dark')).toBe(true);
      expect(inits.at(-1)!.keepalive).toBe(true);
      await vi.waitFor(async () => expect(await book().outbox.count()).toBe(0));
    } finally { stop(); }
  });
});

describe('the token, sealed, on home\'s row', () => {
  it('with a PIN the token and the pocket are never in the clear, and locked nothing goes', async () => {
    const s = site();
    await saveBridgeToken('tok-very-secret', s.fetcher);
    const salt = randomSalt();
    await setKey(await deriveKey('2580', salt, 1000), { salt, iterations: 1000 });
    await don('eastwinds');
    await carryOnOpen(s.fetcher);
    const raw = JSON.stringify(await home().settings.toArray());
    expect(raw).not.toContain('tok-very-secret');
    expect(raw).not.toContain('Dawn Li');
    expect(JSON.stringify(await book().settings.toArray())).not.toContain('tok-very-secret');
    const c = await newCouncil();
    await speak(c.id, 'written, then locked');
    lock();
    const before = s.calls.length;
    expect(await carryOnOpen(s.fetcher)).toBe('idle');
    expect(await bridgeToken()).toBeUndefined();
    expect(s.calls.length).toBe(before);
    expect(await handed(book()).db.outbox.count()).toBe(2);
  });
  it('removing the token takes the pocket and the times with it', async () => {
    const s = site();
    await saveBridgeToken('tok', s.fetcher);
    await don('eastwinds');
    await carryOnOpen(s.fetcher);
    await removeBridgeToken();
    expect((await store.get('settings', 'app'))!.bridge).toBeUndefined();
    expect(await carryNow(s.fetcher)).toBe('idle');
  });
});
