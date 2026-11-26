// The bridge's wire protocol (PLAN-WORLDS.md section 5, W2): the one contract the phone (src/bridge) and the function
// (netlify/functions/bridge.mts) share. Pure: no fetch, no database, no DOM. The function imports this file too, so a
// limit or an allow-list is written once.
//
// Every request goes to one same-origin path, BRIDGE_PATH, with `Authorization: Bearer <token>`. Without a token that
// matches BRIDGE_TOKEN on the site the answer is 401 and nothing is read or written.
//
//   GET  ?op=worlds                        { worlds: WorldRow[] }       the registry, flowstate_bridge.bridge_worlds
//   GET  ?op=pocket&world=<id>&stamp=<s>   PocketReply                   "unchanged" when the stamp matches
//   POST ?op=up      body UpBatch           { acks: Ack[] }               one ack an envelope, in the order sent
//   POST ?op=clip&world=<id>&take=<id>&rev=<n>   body audio bytes         { take, result }   (W6 sends these)
//
// Every answer carries `cache-control: no-store`. Everything the function reads or writes is in one database, BRIDGE_DB.

export const BRIDGE_PATH = '/.netlify/functions/bridge';

/** The one database the function may touch (Tommy, 2026-11-25: one shared database), its one prefix and its four
 *  collections. Novel Companion and Music Companion each read it and write their own registry rows and pockets there;
 *  neither app's own database is reachable through the function. */
export const BRIDGE_DB = 'flowstate_bridge';
export const PREFIX = 'bridge_';
export const COLLECTIONS = ['bridge_worlds', 'bridge_down', 'bridge_up', 'bridge_clips'] as const;
export type CollectionName = typeof COLLECTIONS[number];

/** A world's kind: a novel's bible (Novel Companion writes its row and pocket) or Songbook (Music Companion's). It no
 *  longer picks a database: every world's rows live in BRIDGE_DB, told apart by the `world` and `table` they carry. */
export type WorldKind = 'novel' | 'songs';

/** The tables that travel (section 5): a council page and its lines, a question page and its lines, a journal line while
 *  it is kept, the questions researched, songs and takes. Values, voices and the music tables never do. */
export const TRAVELS = ['pages', 'messages', 'inquiries', 'songs', 'takes'] as const;
export type TravelTable = typeof TRAVELS[number];

export const WORLD_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const ROW_ID = /^[A-Za-z0-9._:-]{1,120}$/;
/** A pocket's version stamp, as the desktop app writes it (a hash or a time). */
export const STAMP = /^[A-Za-z0-9._:-]{1,80}$/;

/** One envelope's row, as JSON, at most this many bytes. A page or a line is far smaller. */
export const ENVELOPE_MAX_BYTES = 64 * 1024;
/** Envelopes in one batch. */
export const BATCH_MAX = 200;
/** A whole up body. */
export const BODY_MAX_BYTES = 1024 * 1024;
/** A send as the app is hidden goes with keepalive, whose body budget is 64 KiB for every keepalive request in flight
 *  (Fetch standard); the phone keeps its hidden batch under this. */
export const KEEPALIVE_MAX_BYTES = 60 * 1024;
/** A clip's audio. Netlify buffers at most 6 MB a request and a binary body is base64 encoded on the way in, so about
 *  4.5 MB of audio; this leaves room. Three minutes of a phone hum is W0's to measure. */
export const CLIP_MAX_BYTES = 4 * 1024 * 1024;

export type WorldRow = { id: string; name: string; kind: WorldKind };

/** One row going up. `rev` grows with every write on the phone, so the newest for an id wins; a resend of the same rev
 *  is answered "same" and changes nothing. A delete carries no row. */
export type Envelope = { world: string; table: TravelTable; id: string; rev: number; deleted?: true; row?: Record<string, unknown> };
export type UpBatch = { world: string; envelopes: Envelope[] };
/** stored: written; same: this rev was already there; older: a newer rev is there, this one is dropped; refused: the
 *  envelope failed a check (`reason` says which) and nothing was written. The first three let the phone clear its outbox. */
export type AckResult = 'stored' | 'same' | 'older' | 'refused';
export type Ack = { table: string; id: string; rev: number; result: AckResult; reason?: string };
export const CLEARS: readonly AckResult[] = ['stored', 'same', 'older'];

// ---- the pocket (section 5): what the phone needs to wear a world; written by the desktop apps into bridge_down ----

export type PocketCharacter = {
  id: string; fullName: string; firstName: string; chineseName?: string;
  /** The family's colour as the bible keeps it, a six-digit hex string; the phone takes its hue. */
  familyColour?: string; born?: number; died?: number;
};
export type PocketQuestion = { id: string; question: string; state: 'open' | 'decided'; decision?: string; changedAt: number };
export type NovelPocket = {
  kind: 'novel';
  characters: PocketCharacter[];
  places: { id: string; name: string; community?: string }[];
  chapters: { id: string; title: string; year?: number }[];
  events: { id: string; title: string; year: number }[];
  storyYear?: number;
  span?: { from: number; to: number };
  questions: PocketQuestion[];
};
/** A Mac song in Songbook's pocket (W7 writes it): its id, its title (Music Companion's, the work date in front), and
 *  its lyric with lyricAt, the Mac's time of the lyric's last change, in epoch milliseconds like every time the phone's
 *  rows carry. Both optional: an older pocket has neither. */
export type PocketSong = { id: string; title: string; lyric?: string; lyricAt?: number };
export type SongsPocket = { kind: 'songs'; songs: PocketSong[] };

/** A song row as it goes up (src/bridge/up.ts names these fields and no others). lyricAt: when the lyric itself last
 *  changed on the phone (absent if he never edited it there); lyricFrom: the pocket's lyricAt his text started from
 *  (absent if it started from nothing). Both epoch milliseconds. The sections are the lyric (a [Name] line on the Mac),
 *  so naming one moves lyricAt; a rename, the key, the tempo and the Character chip never move either. */
export type SongRow = {
  id: string; createdAt: number; updatedAt: number; title: string; lyric: string; sections: { line: number; name: string }[];
  key?: string; bpm?: number; characterIds?: string[]; lyricAt?: number; lyricFrom?: number;
};
export type Pocket = NovelPocket | SongsPocket;
export type PocketReply = { world: string; stamp: string; unchanged: true } | { world: string; stamp: string; pocket: Pocket };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bytesOf = (s: string) => new TextEncoder().encode(s).length;

/** Checks one envelope against the allow-lists and the size limit, for the world the batch is for. Returns the reason
 *  it is refused, or null. Used by the function on every envelope, and by the phone before it sends one. */
export function envelopeProblem(e: unknown, world: string): string | null {
  if (!isObj(e)) return 'not an object';
  if (e.world !== world) return 'world';
  if (typeof e.table !== 'string' || !(TRAVELS as readonly string[]).includes(e.table)) return 'table';
  if (typeof e.id !== 'string' || !ROW_ID.test(e.id)) return 'id';
  if (typeof e.rev !== 'number' || !Number.isSafeInteger(e.rev) || e.rev < 1) return 'rev';
  const allowed = new Set(['world', 'table', 'id', 'rev', 'deleted', 'row']);
  if (Object.keys(e).some(k => !allowed.has(k))) return 'field';
  if (e.deleted !== undefined) {
    if (e.deleted !== true) return 'deleted';
    if (e.row !== undefined) return 'row on a delete';
    return null;
  }
  if (!isObj(e.row)) return 'row';
  if (e.row.id !== e.id) return 'row id';
  if (bytesOf(JSON.stringify(e.row)) > ENVELOPE_MAX_BYTES) return 'size';
  return null;
}
