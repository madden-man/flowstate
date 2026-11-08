// @vitest-environment jsdom
// V7: the music state as the sheets use it. The first read lists /me/playlists then reads the chosen ones; a
// 429 stops it with one plain line and holds every read until the pause has passed; a tick reads at once,
// with the quiet line naming the playlist.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { loadSettings, saveSettings } from '../../src/ui/settings';
import { POEMS_ID } from '../../src/db/schema';
import { MY_PLAYLISTS_PATH } from '../../src/music/spotify';
import { choose, pauseLine, playlists, readNote, readPlaylists, reading, shelfOf } from '../../src/ui/music/state';

const API = 'https://api.spotify.com/v1';
const listed = (id: string, name: string) => ({ id, name, uri: `spotify:playlist:${id}`, snapshot_id: `s-${id}`, owner: { id: 'tommy' }, images: [], items: { total: 2 } });
const entry = (uri: string, album: string) => ({ item: { type: 'track', uri, album: { uri: `spotify:album:${album}`, name: album, images: [] }, artists: [{ name: 'X' }] } });

beforeEach(async () => {
  await freshDB();
  await ensureSeeded(0);
  await loadSettings();
  await saveSettings({ spotify: { connectedAt: 1, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 600_000, name: 'Thomas Madden' } } });
});
afterEach(() => vi.unstubAllGlobals());

describe('the music state (V7)', () => {
  it('says the pause in plain words', () => {
    expect(pauseLine(240)).toBe('Spotify asks for a pause, about 4 minutes');
    expect(pauseLine(30)).toBe('Spotify asks for a pause, about a minute');
    expect(pauseLine(86400)).toBe('Spotify asks for a pause, about 24 hours');
  });

  it('lists, reads the Poems playlist, and a tick reads the new one at once, naming it', async () => {
    const lines: (string | null)[] = [];
    const off = reading.subscribe(v => lines.push(v));
    vi.stubGlobal('fetch', async (url: string) => {
      if (url === `${API}/me`) return Response.json({ id: 'tommy' });
      if (url === `${API}${MY_PLAYLISTS_PATH}`) return Response.json({ items: [listed('M', 'master (ii)'), listed(POEMS_ID, 'For the Poems and the Prose')], next: null });
      if (url.includes(`/playlists/${POEMS_ID}/items`)) return Response.json({ items: [entry('t1', 'Pagan')], next: null });
      if (url.includes('/playlists/M/items')) return Response.json({ items: [entry('t2', 'Takk'), entry('t3', 'Pagan')], next: null });
      return new Response(null, { status: 404 });
    });
    await readPlaylists();
    expect(playlists.value.map(p => p.name)).toEqual(['For the Poems and the Prose']);
    expect(shelfOf(POEMS_ID)?.map(a => a.album)).toEqual(['Pagan']);
    await choose('M', true);
    expect(playlists.value.map(p => p.name)).toEqual(['master (ii)', 'For the Poems and the Prose']);
    expect(shelfOf('M')?.map(a => a.album)).toEqual(['Takk', 'Pagan']);
    expect(lines).toContain('reading your playlists');
    expect(lines).toContain('reading For the Poems and the Prose');
    expect(lines).toContain('reading master (ii)');
    expect(reading.value).toBeNull();
    off();
  });

  it('a 429 stops the read with one plain line, and the next tap waits out the pause without asking', async () => {
    let asked = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      asked++;
      if (url === `${API}/me`) return Response.json({ id: 'tommy' });
      return new Response(null, { status: 429, headers: { 'Retry-After': '240' } });
    });
    await readPlaylists();
    expect(readNote.value).toBe('Spotify asks for a pause, about 4 minutes');
    const before = asked;
    await readPlaylists();
    expect(asked).toBe(before);
    expect(readNote.value).toMatch(/^Spotify asks for a pause, about [34] minutes$/);
  });
});
