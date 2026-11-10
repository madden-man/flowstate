// The On sheet's model (PLAN-PICKS.md P1): a line ticked writes episodes.on and ticks the On row, one pick at a time; a
// cover Spotify played writes episodes.music; the row reads only its own step's pick; struck picks never show; an album
// on no read playlist plays as itself; the kept albums come from the ♪ grid's cache only.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store } from '../../src/db/fields';
import { moveDot, endEpisode, flowById } from '../../src/model/flows';
import { livePicks, onTitle, setOn, setOnAlbum } from '../../src/model/tips';
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
