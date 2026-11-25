// Songs on the phone (PLAN-WORLDS.md section 6, W6): sections from blank rules and chips, takes pinned to a line and
// kept on it as the lyric changes, loose hums made songs, the list tolerant of Songbook's pocket, the take's line
// sealed, and what goes up for a song, a pinned take and a loose hum (rows, then clips after the rows are acknowledged).
import { describe, it, expect, beforeEach } from 'vitest';
import { store, don, doff, handed, book, setKey, lock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import type { Settings, Song, Take } from '../../src/db/schema';
import { blankSong, follow, looseHums, nameSection, reSection, saveSong, saveTake, sectionStarts, songFromHum, songList, takesOf, linesOf } from '../../src/model/songs';
import { readBatch, drain } from '../../src/bridge/up';
import { owed, sendClips } from '../../src/bridge/clips';
import { BRIDGE_PATH, type Ack, type Envelope } from '../../src/bridge/protocol';
import { worldDB, settled } from '../bridge/helpers';
import { freshDB } from '../db/helpers';

const take = (o: Partial<Take> = {}): Take => ({ id: `t-${Math.random().toString(36).slice(2)}`, at: 1_700_000_000_000, seconds: 14, audio: new Uint8Array([1, 2, 3, 4]).buffer, audioType: 'audio/mp4', pitch: [55, 0, 57.5], ...o });

/** The function as the phone sees it: acks every envelope, keeps every clip by world and take. */
function site(opts: { offline?: () => boolean } = {}) {
  const up: Envelope[] = [];
  const clips: { world: string; take: string; rev: number; type: string; bytes: number }[] = [];
  const fetcher = (async (u: RequestInfo | URL, init?: RequestInit) => {
    if (opts.offline?.()) throw new TypeError('Failed to fetch');
    const url = String(u);
    expect(url.startsWith(`${BRIDGE_PATH}?`)).toBe(true);
    const q = new URLSearchParams(url.split('?')[1]);
    if (q.get('op') === 'clip') {
      clips.push({ world: q.get('world')!, take: q.get('take')!, rev: Number(q.get('rev')), type: (init!.headers as Record<string, string>)['content-type'], bytes: (init!.body as ArrayBuffer).byteLength });
      return new Response(JSON.stringify({ take: q.get('take'), result: 'stored' }), { status: 200 });
    }
    const body = JSON.parse(String(init!.body)) as { envelopes: Envelope[] };
    up.push(...body.envelopes);
    return new Response(JSON.stringify({ acks: body.envelopes.map((e): Ack => ({ table: e.table, id: e.id, rev: e.rev, result: 'stored' })) }), { status: 200 });
  }) as typeof fetch;
  return { up, clips, fetcher };
}

describe('the lyric: lines, sections and their names', () => {
  it('a blank rule starts a section; the first written line starts one too', () => {
    expect(sectionStarts(linesOf('a\nb\n\nc\n\n\nd'))).toEqual([0, 3, 6]);
    expect(sectionStarts(linesOf('\n\na'))).toEqual([2]);
    expect(sectionStarts(linesOf(''))).toEqual([]);
  });
  it('a chip names the section the line is in; the same chip again takes the name off', () => {
    const s = { lyric: 'a\nb\n\nc\nd', sections: [] as Song['sections'] };
    const v = nameSection(s, 1, 'Verse');
    expect(v).toEqual([{ line: 0, name: 'Verse' }]);
    const c = nameSection({ ...s, sections: v }, 4, 'Chorus');
    expect(c).toEqual([{ line: 0, name: 'Verse' }, { line: 3, name: 'Chorus' }]);
    expect(nameSection({ ...s, sections: c }, 3, 'Chorus')).toEqual([{ line: 0, name: 'Verse' }]);
  });
  it('a section keeps its name as lines come and go above it (by its first line, else by its place)', () => {
    const was = { lyric: 'a\nb\n\nc\nd', sections: [{ line: 0, name: 'Verse' }, { line: 3, name: 'Chorus' }] };
    expect(reSection(was, 'new\na\nb\n\nc\nd')).toEqual([{ line: 0, name: 'Verse' }, { line: 4, name: 'Chorus' }]);
    expect(reSection(was, 'A\nb\n\nc\nd')).toEqual([{ line: 0, name: 'Verse' }, { line: 3, name: 'Chorus' }]);
    expect(reSection(was, 'a\nb\nc\nd')).toEqual([{ line: 0, name: 'Verse' }]);
  });
});

describe('a take pinned to a line stays on it', () => {
  it('lines added above move it down; its own line rewritten keeps its place with the new text; past the end, the last', () => {
    const t = take({ lineId: '1', lineText: 'so leave it on the nail' });
    expect(follow([t], 'You only wear that one to leave\nso leave it on the nail')).toEqual([]);
    expect(follow([t], 'new\nYou only wear that one to leave\nso leave it on the nail')[0]).toMatchObject({ lineId: '2', lineText: 'so leave it on the nail' });
    expect(follow([t], 'You only wear that one to leave\nso hang it on the nail')[0]).toMatchObject({ lineId: '1', lineText: 'so hang it on the nail' });
    expect(follow([t], 'just one')[0]).toMatchObject({ lineId: '0', lineText: 'just one' });
    expect(follow([take()], 'anything')).toEqual([]);
  });
});

describe('in a world', () => {
  beforeEach(async () => { await worldDB('eastwinds'); });

  it('a song is written with its title and lyric sealed with the PIN, and its takes follow its lines', async () => {
    const song = { ...blankSong('s-grey', 'The grey coat'), lyric: 'You only wear that one to leave\nso leave it on the nail' };
    await saveSong(song);
    await saveTake(take({ id: 't1', songId: 's-grey', lineId: '1', lineText: 'so leave it on the nail' }));
    await saveSong({ ...song, lyric: `Verse one\n${song.lyric}` }, song);
    expect((await takesOf('s-grey'))[0]).toMatchObject({ lineId: '2', lineText: 'so leave it on the nail' });
    await setKey(await deriveKey('1234', randomSalt(), 1000), { salt: randomSalt(), iterations: 1000 });
    const raw = await book().takes.get('t1');
    expect(raw!.lineText).toBeUndefined();
    expect(JSON.stringify(raw)).not.toContain('nail');
    const rawSong = await book().songs.get('s-grey');
    expect(JSON.stringify(rawSong)).not.toContain('grey coat');
    expect((await takesOf('s-grey'))[0].lineText).toBe('so leave it on the nail');
    expect(new Uint8Array((await takesOf('s-grey'))[0].audio)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('a loose hum given a title becomes a song, the hum its first take', async () => {
    const t = take({ id: 'loose1' });
    await saveTake(t);
    expect((await looseHums()).map(x => x.id)).toEqual(['loose1']);
    const s = await songFromHum((await looseHums())[0], '  Low tide ');
    expect(s.title).toBe('Low tide');
    expect(await looseHums()).toEqual([]);
    expect((await takesOf(s.id)).map(x => x.id)).toEqual(['loose1']);
  });

  it('what goes up: the song (title, lyric, sections, key, tempo, characters), a pinned take and a loose hum, never audio in a row', async () => {
    await saveSong({ ...blankSong('s-grey', 'The grey coat'), lyric: 'a\nb', sections: [{ line: 0, name: 'Verse' }], bpm: 72, characterIds: ['dawn'], tucked: [{ world: 'x', characterIds: ['y'] }] });
    await saveTake(take({ id: 't-pin', songId: 's-grey', lineId: '1', lineText: 'b', key: 'G minor', bpm: 72 }));
    await saveTake(take({ id: 't-loose' }));
    await settled();
    const b = (await readBatch(handed(book()), 'eastwinds'))!;
    const row = (t: string, id: string) => b.envelopes.find(e => e.table === t && e.id === id)!.row!;
    expect(row('songs', 's-grey')).toEqual(expect.objectContaining({ id: 's-grey', title: 'The grey coat', lyric: 'a\nb', sections: [{ line: 0, name: 'Verse' }], bpm: 72, characterIds: ['dawn'] }));
    expect(row('songs', 's-grey')).not.toHaveProperty('tucked');
    expect(row('takes', 't-pin')).toEqual({ id: 't-pin', songId: 's-grey', at: 1_700_000_000_000, seconds: 14, audioType: 'audio/mp4', pitch: [55, 0, 57.5], key: 'G minor', bpm: 72, lineId: '1', lineText: 'b' });
    expect(row('takes', 't-loose')).toEqual({ id: 't-loose', at: 1_700_000_000_000, seconds: 14, audioType: 'audio/mp4', pitch: [55, 0, 57.5] });
    expect(JSON.stringify(b.envelopes)).not.toMatch(/audio"/);
  });

  it('a clip goes only after its take\'s row is acknowledged, with its own type and the take\'s at as rev; once, and not while offline', async () => {
    const h = handed(book());
    await saveTake(take({ id: 't1', audioType: 'audio/webm' }));
    await settled();
    expect(await owed(h)).toEqual([]);
    let off = true;
    const s = site({ offline: () => off });
    await expect(drain(h, 'eastwinds', 'tok', s.fetcher)).rejects.toThrow();
    expect(await owed(h)).toEqual([]);
    off = false;
    await drain(h, 'eastwinds', 'tok', s.fetcher);
    expect((await owed(h)).map(t => t.id)).toEqual(['t1']);
    off = true;
    await expect(sendClips(h, 'eastwinds', 'tok', s.fetcher)).rejects.toThrow();
    expect((await owed(h)).map(t => t.id)).toEqual(['t1']);
    off = false;
    expect(await sendClips(h, 'eastwinds', 'tok', s.fetcher)).toBe(1);
    expect(s.clips).toEqual([{ world: 'eastwinds', take: 't1', rev: 1_700_000_000_000, type: 'audio/webm', bytes: 4 }]);
    expect((await store.get('takes', 't1'))!.clip).toMatchObject({ world: 'eastwinds' });
    // marking the clip sent nothing again: no row in the outbox, no second clip
    expect(await book().outbox.count()).toBe(0);
    expect(await sendClips(h, 'eastwinds', 'tok', s.fetcher)).toBe(0);
  });

  it('locked: no clip goes', async () => {
    await saveTake(take({ id: 't1' }));
    await setKey(await deriveKey('1234', randomSalt(), 1000), { salt: randomSalt(), iterations: 1000 });
    const s = site();
    await drain(handed(book()), 'eastwinds', 'tok', s.fetcher);
    lock();
    expect(await owed(handed(book()))).toEqual([]);
    expect(s.clips).toEqual([]);
  });
});

describe('Songbook\'s list, tolerant of its pocket', () => {
  it('the phone\'s songs first, newest first, then the pocket\'s it does not hold (its work date taken off the title); a song listed twice, untitled or already here shows once', async () => {
    await worldDB('songbook');
    await saveSong(blankSong('a', 'Mine, older'));
    await new Promise(r => setTimeout(r, 3));
    await saveSong(blankSong('b', 'Mine, newer'));
    const s = { bridge: { token: 't', pocket: { world: 'songbook', stamp: 's', pocket: { kind: 'songs' as const, songs: [{ id: 'b', title: 'Old name' }, { id: 'm1', title: '2026-11-20 From the Mac' }, { id: 'm1', title: '2026-11-20 From the Mac' }, { id: 'm2' } as never, null as never] } } } } as Pick<Settings, 'bridge'>;
    const rows = await songList(s);
    expect(rows.map(r => [r.id, r.title, !!r.fromMac])).toEqual([['b', 'Mine, newer', false], ['a', 'Mine, older', false], ['m1', 'From the Mac', true], ['m2', '', true]]);
    // another world's pocket is never read as this one's
    await don('eastwinds');
    expect(await songList(s)).toEqual([]);
  });
  it('his own pages hold no songs and offer none', async () => {
    await freshDB();
    await doff();
    expect(await songList()).toEqual([]);
  });
});
