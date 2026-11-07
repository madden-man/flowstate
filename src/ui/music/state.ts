// The music tie-in's state for the UI (PLAN.md section 8.1). Every network call is in src/music; every
// row goes through the store there and in src/model/music.ts. Off by default: with no account the ♪ line
// only points the phone at the playlist, and nothing else in the app changes.
import { computed, signal } from '@preact/signals';
import type { Album, PageMusic } from '../../db/schema';
import { settings, saveSettings, loadSettings } from '../settings';
import { openSheet } from '../sheets';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';
import {
  cameBackEmpty, disconnect, finishConnect, startConnect, takeReturn, withTokens, NotConnected,
  type Keep, type Outcome,
} from '../../music/connect';
import { readPlaylist, shelf, albumRow, keepCover } from '../../music/covers';
import { nowPlaying, openPlaylist, playFromAlbum, TokenError, redirectUri } from '../../music/spotify';
import { noteMusic } from '../../model/music';

/** The Spotify settings, kept in the settings row through saveSettings, so the signal never goes stale. */
export const keep: Keep = {
  read: () => settings.peek().spotify,
  write: next => saveSettings({ spotify: next }),
};

export const connected = computed(() => !!settings.value.spotify?.tokens);
export const accountName = computed(() => settings.value.spotify?.tokens?.name ?? '');
export const outcome = signal<Outcome | null>(null);
/** True while the playlist is being read: a quiet "reading the playlist" line, never a spinner. */
export const reading = signal(false);
export const readNote = signal<string | null>(null);
export const albums = signal<Album[] | null>(null);
/** What Spotify is playing, as last seen by a tap or the poll. */
export const playing = signal<PageMusic | null>(null);
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

// ---- covers: object URLs made once per album, for the life of the app ----
const urls = new Map<string, string>();
export const urlOf = (row: Pick<Album, 'albumUri' | 'cover'>) => {
  if (!row.cover) return undefined;
  let u = urls.get(row.albumUri);
  if (!u) { u = URL.createObjectURL(row.cover); urls.set(row.albumUri, u); }
  return u;
};
export async function coverUrl(albumUri: string): Promise<string | undefined> {
  if (urls.has(albumUri)) return urls.get(albumUri);
  const row = await albumRow(albumUri);
  return row ? urlOf(row) : undefined;
}

const offline = (e: unknown) => e instanceof TypeError;
function failed(e: unknown) {
  if (e instanceof TokenError && e.code === 'invalid_grant') outcome.value = 'expired';
}

export async function loadShelf() {
  albums.value = await shelf();
}

/** How often the shelf is read again while covers arrive. */
const SHELF_EVERY_MS = 400;

/** "Refresh playlist", and the first read after connecting. The shelf shows its tiles as soon as the
 *  playlist is read, and fills in as the covers land. */
export async function refreshPlaylist() {
  if (reading.peek()) return;
  reading.value = true;
  readNote.value = null;
  let shown = 0;
  const onProgress = async () => {
    const t = Date.now();
    if (t - shown < SHELF_EVERY_MS) return;
    shown = t;
    await loadShelf();
  };
  try {
    await readPlaylist(keep, undefined, onProgress);
    await loadShelf();
  } catch (e) {
    failed(e);
    readNote.value = offline(e) ? 'No connection to Spotify' : 'Spotify did not hand over the playlist';
  } finally {
    reading.value = false;
  }
}

export async function connectSpotify() {
  outcome.value = null;
  if ((await startConnect()) === 'loopback') outcome.value = 'loopback';
}

export async function disconnectSpotify() {
  await disconnect(keep);
  playing.value = null;
  outcome.value = null;
}

/** The ♪ line: with no account, open the playlist in Spotify; connected, the music sheet. */
export function tapMusic() {
  if (!connected.peek()) { openPlaylist(); return; }
  playNote.value = null;
  openSheet.value = 'music';
  tick('sheet');
  void loadShelf();
}

/** A cover tapped: the playlist plays from that album's first song on the phone's Spotify. */
export async function play(row: Album) {
  bell('album');
  playNote.value = null;
  try {
    const r = await withTokens(keep, t => playFromAlbum(t, row));
    if (r === 'playing') {
      playing.value = { albumUri: row.albumUri, album: row.album, artist: row.artist, coverId: row.cover ? row.albumUri : undefined };
    } else {
      playNote.value = r === 'no-device' ? 'Open Spotify on the phone first' : 'Playing from here needs Spotify Premium';
    }
  } catch (e) {
    failed(e);
    playNote.value = e instanceof NotConnected ? 'Connect Spotify in Settings' : offline(e) ? 'No connection to Spotify' : 'Spotify did not answer';
  }
}

/** One look at what is playing. The first album heard on an open page is written onto it, once. */
export async function pollOnce(pageId: string | undefined, onMusic?: (m: PageMusic) => void) {
  if (!connected.peek()) return;
  try {
    const np = await withTokens(keep, nowPlaying);
    if (!np?.isPlaying) return;
    const music = await keepCover(np);
    playing.value = music;
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
        if (o === 'connected') await refreshPlaylist();
      });
  } else {
    noticeEmptyReturn();
  }
  const again = () => { if (document.visibilityState === 'visible') noticeEmptyReturn(); };
  document.addEventListener('visibilitychange', again);
  addEventListener('pageshow', again);
}

function noticeEmptyReturn() {
  const r = cameBackEmpty();
  if (r === 'elsewhere') void loadSettings();
  else if (r === 'empty') { outcome.value = 'no-return'; void showSettings(); }
}
