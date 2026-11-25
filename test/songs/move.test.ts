// A song moved from one world to another (W6; Tommy, 2026-11-25): the song and every take, audio and all, land in the
// other notebook with the same ids and leave the first; a stop between the halves leaves it in both, never in neither,
// and is finished later; what goes up is a delete under the old world and rows under the new; clips already
// acknowledged are not sent again, owed ones go under the new world; characters are tucked and brought back; the old
// world's deletes go up without wearing it; his own notebook is never a place a song can go.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store, don, handed, book, into, handedWorld, setKey } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { defaultSettings } from '../../src/db/seed';
import type { Take } from '../../src/db/schema';
import { blankSong, saveSong, saveTake } from '../../src/model/songs';
import { moveSong, settleMoves, songFor, MoveError } from '../../src/model/move';
import { drain } from '../../src/bridge/up';
import { sendClips } from '../../src/bridge/clips';
import { carryNow, saveBridgeToken, removeBridgeToken } from '../../src/model/carry';
import { BRIDGE_PATH, type Ack, type Envelope } from '../../src/bridge/protocol';
import { worldDB, settled } from '../bridge/helpers';

const take = (o: Partial<Take> = {}): Take => ({ id: `t-${Math.random().toString(36).slice(2)}`, at: 1_700_000_000_000, seconds: 3, audio: new Uint8Array([9, 8, 7]).buffer, audioType: 'audio/mp4', pitch: [60], ...o });

function site() {
  const up: Envelope[] = [];
  const clips: { world: string; take: string }[] = [];
  const fetcher = (async (u: RequestInfo | URL, init?: RequestInit) => {
    const url = String(u);
    expect(url.startsWith(`${BRIDGE_PATH}?`)).toBe(true);
    const q = new URLSearchParams(url.split('?')[1]);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (q.get('op') === 'worlds') return json({ worlds: [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }, { id: 'songbook', name: 'Songbook', kind: 'songs' }] });
    if (q.get('op') === 'pocket') return json({ world: q.get('world'), stamp: 's', unchanged: true });
    if (q.get('op') === 'clip') { clips.push({ world: q.get('world')!, take: q.get('take')! }); return json({ take: q.get('take'), result: 'stored' }); }
    const body = JSON.parse(String(init!.body)) as { envelopes: Envelope[] };
    up.push(...body.envelopes);
    return json({ acks: body.envelopes.map((e): Ack => ({ table: e.table, id: e.id, rev: e.rev, result: 'stored' })) });
  }) as typeof fetch;
  return { up, clips, fetcher };
}

/** East Winds worn, holding "The grey coat" (Dawn Li's) with a pinned take whose clip went up and a take still owing. */
async function grey() {
  await worldDB('eastwinds');
  await saveSong({ ...blankSong('s-grey', 'The grey coat'), lyric: 'a\nb', characterIds: ['dawn'] });
  await saveTake(take({ id: 't-sent', songId: 's-grey', lineId: '1', lineText: 'b' }));
  await saveTake(take({ id: 't-owed', songId: 's-grey', audio: new Uint8Array([1, 2, 3, 4, 5]).buffer }));
  await settled();
  const s = site();
  await drain(handed(book()), 'eastwinds', 'tok', s.fetcher);
  // the first take's clip went up; the second's has not yet
  const sent = (await store.get('takes', 't-sent'))!;
  await handed(book()).writeDown({ takes: [{ ...sent, clip: { world: 'eastwinds', at: 1 } } as Take] });
  return s;
}

const holds = async (world: string) => {
  const w = into(world);
  return { song: await w.get('songs', 's-grey'), takes: (await w.query('takes', t => t.where('songId').equals('s-grey'))).map(t => t.id).sort() };
};

describe('moving a song', () => {
  it('lands whole in the other world with the same ids, audio and all, and leaves the first', async () => {
    await grey();
    await moveSong('s-grey', 'eastwinds', 'songbook');
    const there = await holds('songbook');
    expect(there.song).toMatchObject({ id: 's-grey', title: 'The grey coat', lyric: 'a\nb' });
    expect(there.song!.movedFrom).toBeUndefined();
    expect(there.takes).toEqual(['t-owed', 't-sent']);
    const owedThere = await into('songbook').get('takes', 't-owed');
    expect(new Uint8Array(owedThere!.audio)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    expect((await into('songbook').get('takes', 't-sent'))!).toMatchObject({ lineId: '1', lineText: 'b' });
    const here = await holds('eastwinds');
    expect(here.song).toBeUndefined();
    expect(here.takes).toEqual([]);
  });

  it('stays sealed with the one key in its new notebook', async () => {
    await grey();
    await setKey(await deriveKey('1234', randomSalt(), 1000), { salt: randomSalt(), iterations: 1000 });
    await moveSong('s-grey', 'eastwinds', 'songbook');
    const h = await handedWorld('songbook');
    const raw = await h!.db.songs.get('s-grey');
    expect(JSON.stringify(raw)).not.toContain('grey coat');
    expect(raw!.sealed).toBeTruthy();
    expect((await into('songbook').get('songs', 's-grey'))!.title).toBe('The grey coat');
  });

  it('a stop between the halves leaves it in both, never neither; settling (or moving again) finishes it', async () => {
    await grey();
    // the first half alone, as a stop after it would leave it
    const song = (await into('eastwinds').get('songs', 's-grey'))!;
    const takes = await into('eastwinds').query('takes', t => t.where('songId').equals('s-grey'));
    await into('songbook').many({ songs: [songFor(song, 'eastwinds', 'songbook')], takes: takes as Take[] });
    expect((await holds('eastwinds')).song).toBeTruthy();
    expect((await holds('songbook')).song).toMatchObject({ movedFrom: 'eastwinds' });
    // a take made in the old world after the stop is carried over, not lost
    await saveTake(take({ id: 't-late', songId: 's-grey' }));
    expect(await settleMoves('songbook')).toBe(1);
    expect((await holds('eastwinds')).song).toBeUndefined();
    expect((await holds('songbook')).takes).toEqual(['t-late', 't-owed', 't-sent']);
    expect((await holds('songbook')).song!.movedFrom).toBeUndefined();
    // again: nothing left to do, and the same move run again is the same move
    expect(await settleMoves('songbook')).toBe(0);
    await moveSong('s-grey', 'eastwinds', 'songbook');
    expect((await holds('songbook')).takes).toEqual(['t-late', 't-owed', 't-sent']);
  });

  it('what goes up: deletes under the old world, rows under the new (same ids, no characters it does not know); clips owed only', async () => {
    const s = await grey();
    s.up.length = 0;
    await moveSong('s-grey', 'eastwinds', 'songbook');
    await settled();
    await drain(handed(book()), 'eastwinds', 'tok', s.fetcher);
    const sb = (await handedWorld('songbook'))!;
    await drain(sb, 'songbook', 'tok', s.fetcher);
    const of = (w: string) => s.up.filter(e => e.world === w).map(e => [e.table, e.id, e.deleted ? 'deleted' : 'row']).sort();
    expect(of('eastwinds')).toEqual([['songs', 's-grey', 'deleted'], ['takes', 't-owed', 'deleted'], ['takes', 't-sent', 'deleted']]);
    expect(of('songbook')).toEqual([['songs', 's-grey', 'row'], ['takes', 't-owed', 'row'], ['takes', 't-sent', 'row']]);
    const songRow = s.up.find(e => e.world === 'songbook' && e.table === 'songs')!.row!;
    expect(songRow).not.toHaveProperty('characterIds');
    expect(songRow).not.toHaveProperty('tucked');
    expect(songRow).not.toHaveProperty('movedFrom');
    await sendClips(handed(book()), 'eastwinds', 'tok', s.fetcher);
    await sendClips(sb, 'songbook', 'tok', s.fetcher);
    expect(s.clips).toEqual([{ world: 'songbook', take: 't-owed' }]);
  });

  it('Dawn Li is tucked moving out of East Winds and comes back moving home; another world never sees her', async () => {
    await grey();
    await moveSong('s-grey', 'eastwinds', 'songbook');
    const out = (await into('songbook').get('songs', 's-grey'))!;
    expect(out.characterIds).toBeUndefined();
    expect(out.tucked).toEqual([{ world: 'eastwinds', characterIds: ['dawn'] }]);
    await moveSong('s-grey', 'songbook', 'eastwinds');
    const back = (await into('eastwinds').get('songs', 's-grey'))!;
    expect(back.characterIds).toEqual(['dawn']);
    expect(back.tucked).toBeUndefined();
    expect(songFor({ ...back, characterIds: ['dawn'] }, 'eastwinds', 'other')).toMatchObject({ tucked: [{ world: 'eastwinds', characterIds: ['dawn'] }] });
    expect(songFor({ ...back, characterIds: ['dawn'] }, 'eastwinds', 'other').characterIds).toBeUndefined();
  });

  it('his own pages are never a place a song goes or comes from', async () => {
    await grey();
    await expect(moveSong('s-grey', 'eastwinds', '')).rejects.toBeInstanceOf(MoveError);
    await expect(moveSong('s-grey', 'eastwinds', 'eastwinds')).rejects.toBeInstanceOf(MoveError);
    expect(() => into('')).toThrow();
    expect((await holds('eastwinds')).song).toBeTruthy();
  });
});

describe('the old world\'s deletes are not stranded', () => {
  beforeEach(() => { vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('no real request in a unit test'); }); });
  it('carrying drains every world on the phone the registry knows, worn or not', async () => {
    await grey();
    await store.put('settings', { ...defaultSettings(), ...(await store.get('settings', 'app')) });
    const s = site();
    await saveBridgeToken('tok', s.fetcher);
    await moveSong('s-grey', 'eastwinds', 'songbook');
    // he puts Songbook on and never wears East Winds again
    await don('songbook');
    s.up.length = 0;
    expect(await carryNow(s.fetcher)).toBe('carried');
    expect(s.up.filter(e => e.world === 'eastwinds' && e.deleted).map(e => e.id).sort()).toEqual(['s-grey', 't-owed', 't-sent']);
    expect((await (await handedWorld('eastwinds'))!.db.outbox.count())).toBe(0);
    await removeBridgeToken();
  });
});
