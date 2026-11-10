// The On sheet's model (PLAN-PICKS.md P1): a line ticked writes episodes.on and ticks the On row, one pick at a time; a
// cover Spotify played writes episodes.music; the row reads only its own step's pick; struck picks never show; an album
// on no read playlist plays as itself; the kept albums come from the ♪ grid's cache only.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store } from '../../src/db/fields';
import { moveDot, endEpisode, flowById } from '../../src/model/flows';
import {
  albumPick, earlierOf, lastFirst, lastOn, livePicks, moveTip, newLine, onTitle, saveStep, setOn, setOnAlbum, whatHelped,
} from '../../src/model/tips';
import { playBody } from '../../src/music/spotify';
import { keptAlbums } from '../../src/music/covers';

beforeEach(async () => { await freshDB(); await ensureSeeded(); });
const T0 = new Date(2026, 10, 10, 21, 0).getTime();

describe('a line put on', () => {
  it('writes episodes.on and ticks the On row; another replaces it; un-ticked, both go', async () => {
    const e = (await moveDot('panic', [], 'panic-4', T0))!;
    await setOn(e.id, 'panic-4-album', { id: 'pk-panic-4-new-girl', title: 'New Girl' }, T0 + 1);
    let row = (await store.get('episodes', e.id))!;
    expect(row.on).toEqual({ pickId: 'pk-panic-4-new-girl', title: 'New Girl', at: T0 + 1 });
    expect(row.done).toEqual([{ tipId: 'panic-4-album', at: T0 + 1 }]);
    await setOn(e.id, 'panic-4-album', { id: 'pk-panic-4-a-short-hike', title: 'A Short Hike' }, T0 + 2);
    row = (await store.get('episodes', e.id))!;
    expect(row.on!.title).toBe('A Short Hike');
    expect(row.done).toEqual([{ tipId: 'panic-4-album', at: T0 + 1 }]);
    await setOn(e.id, 'panic-4-album', null);
    row = (await store.get('episodes', e.id))!;
    expect(row.on).toBeUndefined();
    expect(row.done).toEqual([]);
  });

  it('an ended episode takes nothing', async () => {
    const e = (await moveDot('panic', [], 'panic-4', T0))!;
    await endEpisode(e.id, T0 + 1);
    expect(await setOn(e.id, 'panic-4-album', { id: 'pk-panic-4-new-girl', title: 'New Girl' })).toBeUndefined();
    expect((await store.get('episodes', e.id))!.on).toBeUndefined();
  });

  it('a cover played writes the album and ticks the row once', async () => {
    const e = (await moveDot('panic', [], 'panic-4', T0))!;
    const m = { albumUri: 'spotify:album:2ZDjruwuzzzT8JMJRXvLtl', album: 'Lonesome Dreams', artist: 'Lord Huron' };
    await setOnAlbum(e.id, 'panic-4-album', m, T0 + 1);
    await setOnAlbum(e.id, 'panic-4-album', m, T0 + 2);
    const row = (await store.get('episodes', e.id))!;
    expect(row.music).toEqual(m);
    expect(row.done).toEqual([{ tipId: 'panic-4-album', at: T0 + 1 }]);
  });

  it('the row reads only a pick of its own step', async () => {
    const panic = (await flowById('panic'))!;
    const e = { on: { pickId: 'pk-panic-4-new-girl', title: 'New Girl', at: 1 } };
    expect(onTitle(panic.steps[3], e)).toBe('New Girl');
    expect(onTitle(panic.steps[0], e)).toBeUndefined();
    expect(onTitle(panic.steps[3], undefined)).toBeUndefined();
  });

  it('a struck pick never shows', async () => {
    const step = (await flowById('panic'))!.steps[3];
    const struck = { ...step, picks: step.picks!.map((p, i) => (i === 3 ? { ...p, struck: true } : p)) };
    expect(livePicks(struck).map(p => p.title)).not.toContain('New Girl');
    expect(livePicks(struck)).toHaveLength(5);
    expect(livePicks({})).toEqual([]);
  });
});

describe('an album as itself', () => {
  it('plays from its first song with no offset when it is on no read playlist', () => {
    expect(playBody('spotify:album:2ZDjruwuzzzT8JMJRXvLtl', '')).toEqual({ context_uri: 'spotify:album:2ZDjruwuzzzT8JMJRXvLtl' });
    expect(playBody('spotify:playlist:M', 'spotify:track:a')).toEqual({ context_uri: 'spotify:playlist:M', offset: { uri: 'spotify:track:a' } });
  });

  it('the kept albums: the row and the first chosen playlist that holds it, and nothing for an album never kept', async () => {
    const uri = 'spotify:album:2ZDjruwuzzzT8JMJRXvLtl';
    await store.many({
      albums: [{ albumUri: uri, album: 'Lonesome Dreams', artist: 'Lord Huron', cover: new Uint8Array([1]).buffer, coverAt: 1 }],
      playlists: [{ id: 'M', name: 'master (ii)', uri: 'spotify:playlist:M', order: 0, snapshotId: 's', total: 1, chosen: true },
        { id: 'X', name: 'off', uri: 'spotify:playlist:X', order: 1, snapshotId: 's', total: 1, chosen: false }],
      shelves: [{ playlistId: 'X', albumUri: uri, order: 0, firstTrackUri: 'spotify:track:x' }, { playlistId: 'M', albumUri: uri, order: 3, firstTrackUri: 'spotify:track:m' }],
    });
    const k = await keptAlbums([uri, 'spotify:album:nothing']);
    expect([...k.keys()]).toEqual([uri]);
    expect(k.get(uri)!.shelf).toMatchObject({ playlistId: 'M', firstTrackUri: 'spotify:track:m' });
  });
});

describe('yours (P2)', () => {
  it('the step sheet saves the picks, the printed line, a strike and a reorder as one revision; unchanged writes nothing', async () => {
    const before = (await flowById('depress'))!;
    const step = before.steps[3];
    const picks = [step.picks![2], { ...step.picks![0], struck: true }, step.picks![1], newLine()];
    picks[3].title = '  Paddington 2 ';
    picks[3].kind = 'film';
    const draft = { name: step.name, line: step.line, said: step.said, usual: step.usual, tips: step.tips, picks, onLine: ' One that stays. ' };
    const saved = (await saveStep('depress', 'depress-4', draft, T0))!;
    const after = saved.steps[3];
    expect(after.picks!.map(p => [p.title, !!p.struck])).toEqual([['Birthplace', false], ['Atlas: I', true], ['Carrie & Lowell', false], ['Paddington 2', false]]);
    expect(after.onLine).toBe('One that stays.');
    expect(saved.revisions).toHaveLength(before.revisions.length + 1);
    // the struck pick and the old printed line are earlier words, struck through, never hidden
    expect(earlierOf(saved, 'depress-4').map(w => w.text)).toEqual(expect.arrayContaining(['Atlas: I', 'One that keeps you company, then one that lifts.']));
    // unchanged: nothing written
    const again = (await saveStep('depress', 'depress-4', { ...draft, picks: after.picks, onLine: after.onLine }, T0 + 1))!;
    expect(again.revisions).toHaveLength(saved.revisions.length);
    // a blank printed line is no printed line; a line with no title is dropped
    const blank = (await saveStep('depress', 'depress-4', { ...draft, picks: [...after.picks!, newLine()], onLine: '  ' }, T0 + 2))!;
    expect(blank.steps[3].onLine).toBeUndefined();
    expect(blank.steps[3].picks).toHaveLength(4);
  });

  it('a step with no picks saved by the sheet gets none', async () => {
    const panic = (await flowById('panic'))!;
    const s = panic.steps[1];
    const saved = (await saveStep('panic', 'panic-2', { name: 'The wave, again', line: s.line, said: s.said, usual: s.usual, tips: s.tips, onLine: '' }, T0))!;
    expect('picks' in saved.steps[1]).toBe(false);
    expect('onLine' in saved.steps[1]).toBe(false);
  });

  it('"+ album" makes a pick from what the ♪ grid gave', () => {
    expect(albumPick({ albumUri: 'spotify:album:2ZDjruwuzzzT8JMJRXvLtl', album: 'Lonesome Dreams', artist: 'Lord Huron' }))
      .toMatchObject({ kind: 'album', title: 'Lonesome Dreams', by: 'Lord Huron', albumId: '2ZDjruwuzzzT8JMJRXvLtl' });
    expect(Object.keys(newLine()).sort()).toEqual(['id', 'kind', 'title']);
  });

  it('a pick moves to its place', async () => {
    const p = (await flowById('panic'))!.steps[3].picks!;
    expect(moveTip(p, p[4].id, 0).map(x => x.title).slice(0, 2)).toEqual(["Ferris Bueller's Day Off", 'Lonesome Dreams']);
  });

  it('last chosen first: the newest other episode that put one of the step\'s picks on, a line or an album', async () => {
    const step = (await flowById('panic'))!.steps[3];
    expect(await lastOn('panic', step)).toBeUndefined();
    const a = (await moveDot('panic', [], 'panic-4', T0))!;
    await setOn(a.id, 'panic-4-album', step.picks![5], T0 + 1);
    await endEpisode(a.id, T0 + 2);
    expect(await lastOn('panic', step)).toBe(step.picks![5].id);
    const b = (await moveDot('panic', [], 'panic-4', T0 + 10))!;
    await setOnAlbum(b.id, 'panic-4-album', { albumUri: 'spotify:album:3MhJ8lLj98SPgtiH16ZmXo', album: 'The Head and the Heart', artist: 'The Head And The Heart' }, T0 + 11);
    expect(await lastOn('panic', step, b.id)).toBe(step.picks![5].id);
    expect(await lastOn('panic', step)).toBe(step.picks![1].id);
    expect(lastFirst(step.picks!, step.picks![5].id).map(p => p.title)).toEqual([
      'A Short Hike', 'Lonesome Dreams', 'The Head and the Heart', 'My Head Is An Animal (The Cabin Sessions)', 'New Girl', "Ferris Bueller's Day Off",
    ]);
    expect(lastFirst(step.picks!, undefined)).toEqual(step.picks);
  });

  it('"what helped" names the pick: the line put on, else the album played, else the row', async () => {
    const panic = (await flowById('panic'))!;
    const done = [{ tipId: 'panic-4-water', at: 1 }, { tipId: 'panic-4-album', at: 2 }];
    expect(whatHelped(panic, { done, on: { pickId: 'pk-panic-4-new-girl', title: 'New Girl', at: 2 } })).toEqual(['Water, then food', 'New Girl']);
    expect(whatHelped(panic, { done, music: { albumUri: 'spotify:album:2ZDjruwuzzzT8JMJRXvLtl', album: 'Lonesome Dreams', artist: 'Lord Huron' } }))
      .toEqual(['Water, then food', 'Lonesome Dreams']);
    expect(whatHelped(panic, { done })).toEqual(['Water, then food', 'An album, or the TV']);
  });
});
