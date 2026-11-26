// Songs on the phone (PLAN-WORLDS.md section 6, W6): sections from blank rules and chips, takes pinned to a line and
// kept on it as the lyric changes, loose hums made songs, the list tolerant of Songbook's pocket, the take's line
// sealed, and what goes up for a song, a pinned take and a loose hum (rows, then clips after the rows are acknowledged).
import { describe, it, expect, beforeEach } from 'vitest';
import { store, don, doff, handed, book, setKey, lock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import type { Settings, Song, Take } from '../../src/db/schema';
import { blankSong, follow, looseHums, nameSection, reSection, saveSong, saveTake, sectionStarts, songFromHum, songFromPocket, songList, takesOf, linesOf, withLyric, withSections, fromMacLyric, toMacLyric } from '../../src/model/songs';
import { applyPocket } from '../../src/bridge/down';
import { readBatch, drain } from '../../src/bridge/up';
import { owed, sendClips } from '../../src/bridge/clips';
import { BRIDGE_PATH, type Ack, type Envelope } from '../../src/bridge/protocol';
import { worldDB, settled } from '../bridge/helpers';
import { carryNow, saveBridgeToken, removeBridgeToken } from '../../src/model/carry';
import { defaultSettings } from '../../src/db/seed';
import { vi } from 'vitest';
import macFixture from './fixtures/mac-lyrics.json';
import { macScenarios, type Scenario } from './mac-scenarios';
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
    // a blank rule taken out joins the sections: the second name is never dropped, it stands over its line mid-section
    // (it is a [Chorus] line on the Mac, and the phone never deletes one it was not asked to)
    expect(reSection(was, 'a\nb\nc\nd')).toEqual([{ line: 0, name: 'Verse' }, { line: 2, name: 'Chorus' }]);
    // a section's first line taken out: its name goes to the line that now starts it
    expect(reSection(was, 'a\nb\n\nd')).toEqual([{ line: 0, name: 'Verse' }, { line: 3, name: 'Chorus' }]);
  });
  it('a chip names the section, beside a name from the Mac it never takes away; on a line holding a chip name it acts there', () => {
    const s = { lyric: 'a\n\nb\nc', sections: [{ line: 2, name: 'From the phone' }, { line: 2, name: 'Verse' }] };
    expect(nameSection(s, 3, 'Chorus')).toEqual([{ line: 2, name: 'From the phone' }, { line: 2, name: 'Chorus' }]);
    expect(nameSection(s, 3, 'Verse')).toEqual([{ line: 2, name: 'From the phone' }]);
    const onlyMac = { ...s, sections: [{ line: 2, name: 'From the phone' }] };
    expect(nameSection(onlyMac, 2, 'Bridge')).toEqual([{ line: 2, name: 'From the phone' }, { line: 2, name: 'Bridge' }]);
    // a Chorus left mid-section by a join is cleared with the caret on its own line
    const joined = { lyric: 'a\nb\nc', sections: [{ line: 0, name: 'Verse' }, { line: 2, name: 'Chorus' }] };
    expect(nameSection(joined, 2, 'Chorus')).toEqual([{ line: 0, name: 'Verse' }]);
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

describe('Songbook\'s lyrics both ways (W7\'s review): lyricAt and lyricFrom', () => {
  const POCKET_SONG = { id: 'mac-tide', title: '2026-11-19 Low tide', lyric: 'the water goes out\nand comes back', lyricAt: 1_800_000_000_000 };
  const pocket = (songs: object[]) => ({ kind: 'songs' as const, songs: songs as never });
  beforeEach(async () => { await worldDB('songbook'); });

  it('a pocket song opens with its lyric, its title without the date, and remembers the Mac\'s lyricAt', () => {
    const s = songFromPocket(POCKET_SONG);
    expect(s).toMatchObject({ id: 'mac-tide', title: 'Low tide', lyric: 'the water goes out\nand comes back', lyricFrom: 1_800_000_000_000 });
    expect(s.lyricAt).toBeUndefined();
    expect(songFromPocket({ id: 'old', title: 'Older pocket' }).lyric).toBe('');
  });

  it('typing and the sections move lyricAt (a name is lyric text on the Mac); a rename, the tempo and the Character chip never do; lyricFrom stays; both go up', async () => {
    const opened = songFromPocket(POCKET_SONG);
    // a rename, the tempo and the Character chip: not the lyric
    const renamed = { ...opened, title: 'Low tide again', bpm: 80, characterIds: ['dawn'] };
    expect(renamed.lyricAt).toBeUndefined();
    expect(withLyric(renamed, renamed.lyric)).toBe(renamed);
    // a section named from a chip is a lyric change: on the Mac it is a [Verse] line (Tommy, 2026-11-25, review of #112)
    const named = withSections(renamed, nameSection(renamed, 0, 'Verse'), 1_800_000_000_300);
    expect(named).toMatchObject({ sections: [{ line: 0, name: 'Verse' }], lyricAt: 1_800_000_000_300, lyricFrom: 1_800_000_000_000 });
    // the same sections again change nothing
    expect(withSections(named, [{ line: 0, name: 'Verse' }], 9)).toBe(named);
    // cleared, it moves again
    expect(withSections(named, nameSection(named, 0, 'Verse'), 1_800_000_000_400)).toMatchObject({ sections: [], lyricAt: 1_800_000_000_400 });
    const typed = withLyric(named, `${named.lyric}\nand I wait`, 1_800_000_000_500);
    expect(typed).toMatchObject({ lyricAt: 1_800_000_000_500, lyricFrom: 1_800_000_000_000 });
    expect(typed.sections).toEqual([{ line: 0, name: 'Verse' }]);
    expect(withLyric({ ...typed, title: 'x' }, typed.lyric).lyricAt).toBe(1_800_000_000_500);
    // a blank rule typed (a section started) is a lyric change too, and so is joining it back
    const split = withLyric(typed, 'the water goes out\n\nand comes back\nand I wait', 1_800_000_000_600);
    expect(split.lyricAt).toBe(1_800_000_000_600);
    await saveSong(typed);
    await settled();
    const row = (await readBatch(handed(book()), 'songbook'))!.envelopes.find(e => e.table === 'songs')!.row!;
    expect(row).toMatchObject({ id: 'mac-tide', lyricAt: 1_800_000_000_500, lyricFrom: 1_800_000_000_000 });
  });

  it('a newer pocket never overwrites an unsent edit; once it has gone up, the newer Mac lyric is taken; an older one never', async () => {
    const typed = withLyric(songFromPocket(POCKET_SONG), 'the water goes out\nI typed this', 1_800_000_000_500);
    await saveSong(typed);
    await saveTake(take({ id: 't-in', songId: 'mac-tide', lineId: '1', lineText: 'I typed this' }));
    await settled();
    const newer = { ...POCKET_SONG, lyric: 'a new first line\nthe water goes out\nand comes back', lyricAt: 1_800_000_009_000 };
    await applyPocket(handed(book()), pocket([newer]));
    expect((await store.get('songs', 'mac-tide'))!.lyric).toBe('the water goes out\nI typed this');
    // it goes up (the outbox empties); the next pocket, newer than the text it started from, is taken
    const s = site();
    await drain(handed(book()), 'songbook', 'tok', s.fetcher);
    await applyPocket(handed(book()), pocket([newer]));
    const now = (await store.get('songs', 'mac-tide'))!;
    expect(now).toMatchObject({ lyric: newer.lyric, lyricFrom: 1_800_000_009_000 });
    expect(now.lyricAt).toBeUndefined();
    // what came down is not sent back
    expect(await book().outbox.count()).toBe(0);
    // an older pocket (or the same one again) changes nothing
    await applyPocket(handed(book()), pocket([{ ...POCKET_SONG, lyric: 'old', lyricAt: 1_800_000_000_000 }]));
    expect((await store.get('songs', 'mac-tide'))!.lyric).toBe(newer.lyric);
  });

  it('a pocket passed over for an unsent edit is read again on the next carry, not lost to its stamp', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('no real request in a unit test'); });
    await store.put('settings', { ...defaultSettings(), ...(await store.get('settings', 'app')), world: 'songbook' } as Settings);
    const newer = { ...POCKET_SONG, lyric: 'the Mac wrote this', lyricAt: 1_800_000_009_000 };
    let refuse = true;
    const asked: (string | null)[] = [];
    const fetcher = (async (u: RequestInfo | URL, init?: RequestInit) => {
      const q = new URLSearchParams(String(u).split('?')[1]);
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (q.get('op') === 'worlds') return json({ worlds: [{ id: 'songbook', name: 'Songbook', kind: 'songs' }] });
      if (q.get('op') === 'pocket') {
        asked.push(q.get('stamp'));
        return json(q.get('stamp') === 'p2' ? { world: 'songbook', stamp: 'p2', unchanged: true } : { world: 'songbook', stamp: 'p2', pocket: pocket([newer]) });
      }
      if (q.get('op') === 'clip') return json({ take: q.get('take'), result: 'stored' });
      const body = JSON.parse(String(init!.body)) as { envelopes: Envelope[] };
      // the first carry's song row is refused (it waits in the outbox), so the pocket finds an unsent edit
      return json({ acks: body.envelopes.map((e): Ack => ({ table: e.table, id: e.id, rev: e.rev, result: refuse ? 'refused' : 'stored', ...(refuse ? { reason: 'test' } : {}) })) });
    }) as typeof fetch;
    await saveBridgeToken('tok', fetcher);
    await saveSong(withLyric(songFromPocket(POCKET_SONG), 'the water goes out\nI typed this', 1_800_000_000_500));
    await settled();
    expect(await carryNow(fetcher)).toBe('carried');
    expect((await store.get('songs', 'mac-tide'))!.lyric).toBe('the water goes out\nI typed this');
    // his edit goes up on the next carry; the pocket it was passed over for is read again and taken
    refuse = false;
    expect(await carryNow(fetcher)).toBe('carried');
    expect(asked[1]).not.toBe('p2');
    expect((await store.get('songs', 'mac-tide'))!).toMatchObject({ lyric: 'the Mac wrote this', lyricFrom: 1_800_000_009_000 });
    await removeBridgeToken();
  });

  it('a page left open while the pocket replaced the lyric, then only renamed, does not put the old lyric back', async () => {
    const opened = songFromPocket(POCKET_SONG);
    await saveSong(opened);
    const s = site();
    await settled();
    await drain(handed(book()), 'songbook', 'tok', s.fetcher);
    // the page holds the song as it was opened; the Mac's newer lyric comes down underneath it
    const page = (await store.get('songs', 'mac-tide'))! as Song;
    await applyPocket(handed(book()), pocket([{ ...POCKET_SONG, lyric: 'the Mac wrote this', lyricAt: 1_800_000_009_000 }]));
    await saveSong({ ...page, title: 'Low tide, renamed' }, { lyric: page.lyric, sections: page.sections });
    expect((await store.get('songs', 'mac-tide'))!).toMatchObject({ title: 'Low tide, renamed', lyric: 'the Mac wrote this', lyricFrom: 1_800_000_009_000 });
    // a lyric he did type on that page is his, and wins
    await saveSong(withLyric({ ...page, title: 'x' }, 'his words', 1_800_000_010_000), { lyric: page.lyric, sections: page.sections });
    expect((await store.get('songs', 'mac-tide'))!).toMatchObject({ lyric: 'his words', lyricAt: 1_800_000_010_000 });
  });

  it('a song the phone does not hold is not written by a pocket, and a pocket with no lyric changes nothing', async () => {
    await applyPocket(handed(book()), pocket([POCKET_SONG]));
    expect(await store.all('songs')).toEqual([]);
    await saveSong(blankSong('mine', 'Mine'));
    await applyPocket(handed(book()), pocket([{ id: 'mine', title: 'Mine' }]));
    expect((await store.get('songs', 'mine'))!.lyric).toBe('');
  });
});

describe('the Mac\'s [Name] lines round-trip (W7: Music Companion writes sections into its lyric)', () => {
  const MAC = [
    '[Verse]', 'the water goes out', 'and comes back', '',
    '[Pre-chorus]', 'low tide, low tide', '[Hook]', 'nobody waving', '',
    '[From the phone]', 'slow train, low sun', '[Chorus]', '[Bridge]', 'two on one line', '',
    ' [not a head]', '[ also not ]', 'last line', '[Outro]',
  ].join('\n');
  it('read into the phone\'s sections and out of the text; the Mac rebuilds the identical text, any name kept', () => {
    const p = fromMacLyric(MAC);
    expect(p.lyric).not.toMatch(/^\[(Verse|Pre-chorus|Hook|From the phone|Chorus|Bridge|Outro)\]$/m);
    expect(p.lyric).toContain(' [not a head]');
    expect(p.lyric).toContain('[ also not ]');
    expect(p.sections.map(s => s.name)).toEqual(['Verse', 'Pre-chorus', 'Hook', 'From the phone', 'Chorus', 'Bridge', 'Outro']);
    expect(toMacLyric(p)).toBe(MAC);
    expect(toMacLyric(fromMacLyric('no sections at all\nhere'))).toBe('no sections at all\nhere');
    expect(fromMacLyric('')).toEqual({ lyric: '', sections: [] });
  });
  it('opened from the pocket and sent up unedited, the row rebuilds to the Mac\'s text exactly', async () => {
    await worldDB('songbook');
    const opened = songFromPocket({ id: 'mac-tide', title: '2026-11-19 Low tide', lyric: MAC, lyricAt: 1_800_000_000_000 });
    await saveSong({ ...opened, title: 'Low tide, renamed' });
    await settled();
    const row = (await readBatch(handed(book()), 'songbook'))!.envelopes.find(e => e.table === 'songs')!.row! as { lyric: string; sections: Song['sections'] };
    expect(toMacLyric(row)).toBe(MAC);
    expect(row).not.toHaveProperty('lyricAt');
  });
  it('a newer pocket taken in comes in the same way, and an edit keeps a name standing mid-section on its line', async () => {
    await worldDB('songbook');
    await saveSong({ ...songFromPocket({ id: 'mac-tide', title: 'Low tide', lyric: 'old', lyricAt: 1 }) });
    const s = site();
    await settled();
    await drain(handed(book()), 'songbook', 'tok', s.fetcher);
    await applyPocket(handed(book()), { kind: 'songs', songs: [{ id: 'mac-tide', title: 'Low tide', lyric: MAC, lyricAt: 2 }] });
    const now = (await store.get('songs', 'mac-tide'))!;
    expect(toMacLyric(now)).toBe(MAC);
    // a first line typed into the verse: the Mac text comes back with that line alone added, every [Name] line kept
    const edited = withLyric(now, `added first\n${now.lyric}`);
    expect(toMacLyric(edited)).toBe(MAC.replace('[Verse]\n', '[Verse]\nadded first\n'));
  });
  it('any Mac lyric, opened, one written line edited, sent: the Mac text is the same but for that line, every [Name] line still there in order', () => {
    const heads = ['[Verse]', '[Chorus]', '[Bridge]', '[From the phone]', '[Pre-chorus]', '[Hook]', '[Outro]'];
    const words = ['low tide', 'the water goes out', 'and comes back', 'nobody waving', 'slow train', 'low tide'];
    let seed = 7;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const lyrics: string[] = [MAC, '[Chorus]\n[Bridge]\nline one\nline two', '[From the phone]\n[Verse]\nfrom the phone\n\n[Verse]\nmac', 'a\n[Hook]\n[Hook]\nb\n[Outro]\n[Outro]'];
    for (let n = 0; n < 200; n++) {
      const ls: string[] = [];
      const len = 1 + rnd(12);
      for (let i = 0; i < len; i++) { const r = rnd(10); ls.push(r < 3 ? heads[rnd(heads.length)] : r < 4 ? '' : words[rnd(words.length)]); }
      lyrics.push(ls.join('\n'));
    }
    let checked = 0;
    for (const mac of lyrics) {
      const opened = songFromPocket({ id: 'p', title: 'P', lyric: mac, lyricAt: 1 });
      expect(toMacLyric(opened), mac).toBe(mac);
      const macLines = mac.split('\n');
      const ls = linesOf(opened.lyric);
      ls.forEach((l, j) => {
        if (!l.trim()) return;
        const edited = withLyric(opened, ls.map((x, i) => (i === j ? `${x} (edited)` : x)).join('\n'));
        // the same Mac line, found by its place among the lines that are not [Name] lines, carries the edit
        const head = (x: string) => { const m = /^\[([^\[\]\n]+)\]$/.exec(x); return !!m && m[1] === m[1].trim(); };
        const allHeads = macLines.every(head);
        let k = -1, seen = -1;
        for (let i = 0; i < macLines.length; i++) { if (!allHeads && head(macLines[i])) continue; if (++seen === j) { k = i; break; } }
        const want = macLines.map((x, i) => (i === k ? `${x} (edited)` : x)).join('\n');
        expect(toMacLyric(edited), `${JSON.stringify(mac)} line ${j}`).toBe(want);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(300);
  });
  it('a lyric of section lines only comes back exactly: what the phone cannot hold as a name stays as its text', () => {
    for (const mac of ['[Verse]', '[Verse]\n[Chorus]', '[Verse]\n', '']) {
      const opened = fromMacLyric(mac);
      expect(toMacLyric(opened), JSON.stringify(mac)).toBe(mac);
    }
    expect(fromMacLyric('[Verse]')).toEqual({ lyric: '[Verse]', sections: [] });
  });
});

describe('against Music Companion\'s real lyric rules (fixtures/mac-lyrics.json, made by mac-lyrics.gen.test.ts from mc-worlds-w7 95ab373)', () => {
  const fixture = macFixture as Scenario[];
  const mine = macScenarios();
  it('the phone sends exactly the rows the Mac was run on: a chip moves lyricAt, so the Mac takes the name and never pastes the lyric again', () => {
    for (const k of [0, 1]) {
      expect(mine[k].steps.map(x => x.row), fixture[k].name).toEqual(fixture[k].steps.map(x => x.row));
      for (const st of fixture[k].steps) {
        // what the Mac holds after each step is the phone's text, [Name] lines and all: replaced, never appended
        expect(st.mac, `${fixture[k].name}: ${st.did}`).toBe(toMacLyric(st.row));
        expect(st.mac).not.toContain('[From the phone]');
      }
    }
    expect(fixture[0].steps.at(-1)!.mac).toBe('[Verse]\nYou only wear that one to leave\nso leave it on the nail\n\n[Chorus]\nKeep this for me, one year');
    expect(fixture[1].steps.at(-1)!.mac).toBe('[Verse]\nthe water goes out\nand never comes back\n\n[Chorus]\nlow tide, low tide');
  });
  it('toMacLyric, the phone\'s copy of the Mac\'s lyricsFromPhone, gives the Mac\'s own answers', () => {
    for (const st of fixture[2].steps) expect(toMacLyric(st.row), JSON.stringify(st.row)).toBe(st.mac);
  });
});
