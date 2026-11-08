// The music tie-in's state for the UI (PLAN.md section 8.1, PLAN-V3.md section 5). Every network call is in
// src/music; every row goes through the store there and in src/model/music.ts. Off by default: with no account
// the ♪ line only points the phone at the Poems playlist, and nothing else in the app changes. Connected, ♪
// opens on the list of chosen playlists, and a name opens its grid of covers.
import { computed, signal } from '@preact/signals';
import type { Album, PageMusic, Playlist } from '../../db/schema';
import { settings, saveSettings, loadSettings } from '../settings';
import { openSheet } from '../sheets';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';
import {
  cameBackEmpty, disconnect, finishConnect, startConnect, takeReturn, withTokens, NotConnected,
  type Keep, type Outcome,
} from '../../music/connect';
import {
  readOne as readOnePlaylist, readChosen, readMine, playlistRows, choosePlaylist, shelf, albumRow, keepCover, coverWhenNear,
  type ReadHooks, type ShelfAlbum,
} from '../../music/covers';
import { ApiError, nowPlaying, openPlaylist as openInSpotify, playAlbum, TokenError, redirectUri } from '../../music/spotify';
import { noteMusic } from '../../model/music';

/** The Spotify settings, kept in the settings row through saveSettings, so the signal never goes stale. */
export const keep: Keep = {
  read: () => settings.peek().spotify,
  write: next => saveSettings({ spotify: next }),
};

export const connected = computed(() => !!settings.value.spotify?.tokens);
export const accountName = computed(() => settings.value.spotify?.tokens?.name ?? '');
export const outcome = signal<Outcome | null>(null);
/** While Spotify is being read, the quiet line that says what ("reading master (ii)"), never a spinner. */
export const reading = signal<string | null>(null);
/** One plain line when a read was refused or paused; never an alert. */
export const readNote = signal<string | null>(null);
/** The chosen playlists, in Spotify's order: the rows of the ♪ list. */
export const playlists = signal<Playlist[]>([]);
/** Every owned playlist kept, chosen or not: the Settings sheet. null until first loaded. */
export const allPlaylists = signal<Playlist[] | null>(null);
/** Each loaded playlist's shelf, by playlist id. */
export const shelves = signal<Record<string, ShelfAlbum[]>>({});
export const shelfOf = (playlistId: string): ShelfAlbum[] | undefined => shelves.value[playlistId];
/** Which grid the music sheet shows; null is the list of playlists. */
export const openPlaylist = signal<string | null>(null);
/** What Spotify is playing, as last seen by a tap or the poll. */
export const playing = signal<PageMusic | null>(null);
/** The playlist it is playing from, when it is one of these (by a tap here, or the poll's context). */
export const playingFrom = signal<string | null>(null);
export const playNote = signal<string | null>(null);
/** The album whose pages the "Pages with this album" sheet lists. */
export const albumFor = signal<PageMusic | null>(null);

export const POLL_MS = 20_000;

export const OUTCOME_LINES: Record<Outcome, string> = {
  connected: '',
  declined: 'Not connected: the sign-in was declined',
  refused: 'Not connected: Spotify refused the sign-in',
  'no-return': '',
  loopback: 'Open the app at 127.0.0.1 to connect',
  locked: 'Unlock the journal, then connect again',
  expired: 'Spotify ended the session: connect again',
};
export const outcomeLine = (o: Outcome | null) =>
  !o ? '' : o === 'no-return' ? `Spotify did not send you back: add ${redirectUri()} to the app's redirect URIs` : OUTCOME_LINES[o];

// ---- covers: object URLs made once per kept cover (an album fetched again after a month gets a new one) ----
const urls = new Map<string, { at?: number; url: string }>();
export const urlOf = (row: Pick<Album, 'albumUri' | 'cover' | 'coverType' | 'coverAt'>) => {
  if (!row.cover) return undefined;
  const had = urls.get(row.albumUri);
  if (had && had.at === row.coverAt) return had.url;
  if (had) URL.revokeObjectURL(had.url);
  const blob = row.cover instanceof Blob ? row.cover : new Blob([row.cover], { type: row.coverType ?? 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  urls.set(row.albumUri, { at: row.coverAt, url });
  return url;
};
export async function coverUrl(albumUri: string): Promise<string | undefined> {
  if (urls.has(albumUri)) return urls.get(albumUri)!.url;
  const row = await albumRow(albumUri);
  return row ? urlOf(row) : undefined;
}

const offline = (e: unknown) => e instanceof TypeError;
function failed(e: unknown) {
  if (e instanceof TokenError && e.code === 'invalid_grant') outcome.value = 'expired';
}

/** The chosen playlists and their shelves, from the database (offline). */
export async function loadMusic() {
  const rows = await playlistRows();
  allPlaylists.value = rows;
  const chosen = rows.filter(r => r.chosen);
  playlists.value = chosen;
  const next: Record<string, ShelfAlbum[]> = { ...shelves.peek() };
  for (const p of chosen) next[p.id] = await shelf(p.id);
  shelves.value = next;
}

async function loadShelfOf(playlistId: string) {
  shelves.value = { ...shelves.peek(), [playlistId]: await shelf(playlistId) };
}

/** How often a shelf is read again while covers arrive. */
const SHELF_EVERY_MS = 400;
const throttled = (playlistId: string) => {
  let shown = 0;
  return async () => {
    const t = Date.now();
    if (t - shown < SHELF_EVERY_MS) return;
    shown = t;
    await loadShelfOf(playlistId);
  };
};

// ---- reading Spotify: one read at a time, never in parallel; a 429 stops everything until it has passed ----

/** Each playlist's snapshot as /me/playlists last gave it this session: an unchanged one is not read again. */
let latest = new Map<string, string>();
let pauseUntil = 0;
let chain: Promise<unknown> = Promise.resolve();
const inTurn = (fn: () => Promise<void>): Promise<void> => {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
};

/** "Spotify asks for a pause, about 4 minutes", from its Retry-After in seconds. */
export function pauseLine(seconds = 60): string {
  const m = Math.max(1, Math.round(seconds / 60));
  if (m >= 90) return `Spotify asks for a pause, about ${Math.round(m / 60)} hours`;
  return `Spotify asks for a pause, about ${m === 1 ? 'a minute' : `${m} minutes`}`;
}

function paused(): boolean {
  const left = pauseUntil - Date.now();
  if (left <= 0) return false;
  readNote.value = pauseLine(left / 1000);
  return true;
}

/** Says what went wrong in one plain line, never an alert. A pause also holds every read until it has passed. */
function refusedRead(e: unknown, what: string) {
  failed(e);
  if (e instanceof ApiError && e.status === 429) {
    pauseUntil = Date.now() + (e.retryAfter ?? 60) * 1000;
    readNote.value = pauseLine(e.retryAfter);
  } else if (offline(e)) readNote.value = 'No connection to Spotify';
  else if (e instanceof NotConnected) readNote.value = 'Connect Spotify in Settings';
  else if (e instanceof TokenError && e.code === 'invalid_grant') readNote.value = null; // Settings already says the session ended
  else readNote.value = `Spotify did not hand over ${what}`;
}

const hooks: ReadHooks = {
  reading: p => { reading.value = `reading ${p.name}`; },
  progress: throttled,
};

/** The chosen playlists, one after another; snapshot skip applies; a pause stops the rest. */
export function refreshChosen(): Promise<void> {
  return inTurn(async () => {
    try {
      const out = await readChosen(keep, latest, hooks);
      if (out.failed.length) refusedRead(out.failed[0].error, out.failed[0].name);
    } catch (e) {
      refusedRead(e, 'the playlists');
    } finally {
      reading.value = null;
      await loadMusic();
    }
  });
}

/** /me/playlists only: the list the Settings sheet ticks from. */
function listMine(): Promise<boolean> {
  let ok = false;
  return inTurn(async () => {
    reading.value = 'reading your playlists';
    try {
      latest = new Map((await readMine(keep)).map(p => [p.id, p.snapshotId]));
      ok = true;
    } catch (e) {
      refusedRead(e, 'your playlists');
    } finally {
      reading.value = null;
      await loadMusic();
    }
  }).then(() => ok);
}

/** On connect and "Read again": /me/playlists, then the chosen ones. */
export async function readPlaylists() {
  if (reading.peek() || paused()) return;
  readNote.value = null;
  if (await listMine()) await refreshChosen();
}

/** Settings, Playlists: the sheet of every owned playlist rises. */
export function showPlaylists() {
  openSheet.value = 'playlists';
  tick('sheet');
}

/** The Settings sheet opened: the list is read once a session; the rest comes from the database. */
export async function openPlaylistsList() {
  await loadMusic();
  if (!latest.size && !reading.peek() && !paused()) await listMine();
}

/** A tick in Settings: chosen is written, and a newly ticked playlist is read at once. Unticking keeps its covers. */
export async function choose(id: string, on: boolean) {
  const row = await choosePlaylist(id, on);
  await loadMusic();
  if (!on || !row || paused()) return;
  readNote.value = null;
  await inTurn(async () => {
    try {
      await readOnePlaylist(keep, row, latest.get(row.id), hooks);
    } catch (e) {
      refusedRead(e, row.name);
    } finally {
      reading.value = null;
      await loadMusic();
    }
  });
}

/** A tile scrolled near with no cover, or one past the month: its cover fetched and the shelf shown again. */
export async function nearTile(playlistId: string, albumUri: string): Promise<string | undefined> {
  const row = await coverWhenNear(albumUri);
  if (!row?.cover) return undefined;
  const { cover, coverType, coverAt } = row;
  const list = shelves.peek()[playlistId];
  if (list) shelves.value = { ...shelves.peek(), [playlistId]: list.map(a => (a.albumUri === albumUri ? { ...a, cover, coverType, coverAt } : a)) };
  return urlOf(row);
}

export async function connectSpotify() {
  outcome.value = null;
  if ((await startConnect()) === 'loopback') outcome.value = 'loopback';
}

export async function disconnectSpotify() {
  await disconnect(keep);
  playing.value = null;
  playingFrom.value = null;
  latest = new Map();
  outcome.value = null;
}

/** The ♪ line: with no account, open the Poems playlist in Spotify; connected, the music sheet on its list.
 *  The first ♪ of a session reads the list too (and any chosen playlist whose snapshot has moved), so a
 *  playlist ticked by name, or changed in Spotify, comes without a trip to Settings. */
export function tapMusic() {
  if (!connected.peek()) { openInSpotify(); return; }
  playNote.value = null;
  openPlaylist.value = null;
  openSheet.value = 'music';
  tick('sheet');
  void loadMusic().then(() => { if (!latest.size && !reading.peek() && !paused()) void readPlaylists(); });
}

type Tapped = { playlist: Pick<Playlist, 'id' | 'uri'>; row: Pick<ShelfAlbum, 'albumUri' | 'album' | 'artist' | 'cover' | 'firstTrackUri' | 'firstTrackAt'> };
/** A tap made while Spotify was not running: it is opened to wake it, and the tap plays on coming back here. */
let pending: (Tapped & { at: number }) | null = null;
/** How long a waiting tap still plays on coming back. */
export const PENDING_MS = 3 * 60_000;
/** How the app leaves to wake Spotify (a navigation to its spotify: URI; tests swap it). */
export const wake = { open: (href: string) => { location.assign(href); } };

/** A cover tapped: that playlist plays from the album's first song on the phone's Spotify, and runs on into the
 *  next album. Spotify idle in the background is found by its device and played on; Spotify not running at all is
 *  opened, and the tap plays when you come back. A refusal is one plain line with Spotify's own status. */
export async function play(playlist: Tapped['playlist'], row: Tapped['row'], again = false) {
  if (!again) bell('album');
  playNote.value = null;
  if (!row.firstTrackUri && row.firstTrackAt === undefined) { playNote.value = 'Read again in Settings, then tap'; return; }
  try {
    const r = await withTokens(keep, t => playAlbum(t, playlist.uri, row));
    if (r === 'playing') {
      pending = null;
      playingFrom.value = playlist.id;
      playing.value = { albumUri: row.albumUri, album: row.album, artist: row.artist, coverId: row.cover ? row.albumUri : undefined };
    } else if (r === 'no-device' && !again) {
      pending = { playlist, row, at: Date.now() };
      playNote.value = 'Opening Spotify: come back and it plays';
      wake.open(playlist.uri);
    } else {
      pending = null;
      playNote.value = r === 'no-device' ? 'Open Spotify on the phone, then tap again'
        : r === 'not-found' ? 'Spotify would not start that song: Read again in Settings'
        : 'Playing from here needs Spotify Premium';
    }
  } catch (e) {
    failed(e);
    pending = null;
    playNote.value = e instanceof NotConnected ? 'Connect Spotify in Settings'
      : offline(e) ? 'No connection to Spotify'
      : e instanceof ApiError ? `Spotify did not play it (${e.status})` : 'Spotify did not answer';
  }
}

/** Back from waking Spotify: the waiting tap plays, once. */
export function playPending() {
  const p = pending;
  if (!p || document.visibilityState !== 'visible') return;
  if (Date.now() - p.at > PENDING_MS) { pending = null; return; }
  pending = null;
  void play(p.playlist, p.row, true);
}

/** One look at what is playing. The first album heard on an open page is written onto it, once. */
export async function pollOnce(pageId: string | undefined, onMusic?: (m: PageMusic) => void) {
  if (!connected.peek()) return;
  try {
    const np = await withTokens(keep, nowPlaying);
    if (!np?.isPlaying) return;
    const music = await keepCover(np);
    playing.value = music;
    if (np.contextUri?.startsWith('spotify:playlist:')) playingFrom.value = np.contextUri.slice('spotify:playlist:'.length);
    if (!pageId) return;
    const written = await noteMusic(pageId, music);
    if (written?.music) onMusic?.(written.music);
  } catch (e) {
    failed(e); // a missed look is just missed; the next one is twenty seconds away
  }
}

const afterMount = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const showSettings = async () => { await afterMount(); openSheet.value = 'settings'; };

/** On load: finish a sign-in that has just come back, or notice one that never did. */
export function bootMusic() {
  const ret = takeReturn();
  if (ret) {
    void finishConnect(ret, keep)
      .catch((): Outcome => 'refused')
      .then(async o => {
        outcome.value = o;
        await showSettings();
        if (o === 'connected') await readPlaylists();
      });
  } else {
    noticeEmptyReturn();
  }
  const again = () => { if (document.visibilityState === 'visible') { noticeEmptyReturn(); playPending(); } };
  document.addEventListener('visibilitychange', again);
  addEventListener('pageshow', again);
}

function noticeEmptyReturn() {
  const r = cameBackEmpty();
  if (r === 'elsewhere') void loadSettings();
  else if (r === 'empty') { outcome.value = 'no-return'; void showSettings(); }
}
