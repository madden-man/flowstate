// Dexie tables, version 2 (PLAN.md section 4; version 2 is PLAN-V3.md section 5.1, playlists under the music line). UI code never imports this file: it reads and writes
// through src/db/fields.ts, which owns the encrypt-on-write path (PLAN.md section 7).
import Dexie, { type EntityTable, type Table } from 'dexie';
import { POEMS_ID, POEMS_NAME } from '../music/poems';

export { POEMS_ID, POEMS_NAME };

export const SCHEMA_VERSION = 2;
export const DB_NAME = 'flowstate';

/** Epoch milliseconds. Every date in the database is one of these. */
export type Millis = number;

/** An AES-GCM envelope: the record's secret fields, sealed together with one IV (src/db/crypto.ts). */
export type Sealed = { v: 1; iv: string; ct: string };

export type LightPin = 'sky' | 'day' | 'night';
export type Place = { lat: number; lon: number; name: string };
/** name (package 7) is the account's display name for "Connected as"; it rides in the sealed tokens. */
export type SpotifyTokens = { accessToken: string; refreshToken: string; expiresAt: number; name?: string };

export type Settings = {
  id: 'app';
  light: LightPin;
  place?: Place;
  stillAfterMidnight: 'offer' | 'never';
  sounds: boolean;
  haptics: boolean;
  lock: {
    enabled: boolean; salt?: string; verifier?: Sealed; iterations?: number;
    /** Minutes in the background before the key drops; 0 means as soon as the app is hidden. */
    relockAfterMin: number;
    /** Not in PLAN.md section 4 (package 6): how many digits the PIN has, so the lock screen opens on the
     *  last one instead of asking for a separate "open" tap. It tells a stranger the length, nothing more. */
    digits?: number;
  };
  lastBackupAt?: Millis;
  seededAt?: Millis;
  /** Not in PLAN.md section 4 (package 8): what navigator.storage.persist() last answered, so Settings reads it offline. */
  persisted?: boolean;
  /** Not in PLAN.md section 4 (V5): one-time passes over old data already run, by name, so each runs once.
   *  'seed-pages' is cleanSeedPages in seed.ts (the untouched manifesto and models pages go). */
  cleaned?: string[];
  spotify?: { tokens?: SpotifyTokens; connectedAt?: Millis };
  /** Not in PLAN.md section 4 (package 1): which kept line the echo shows today, and the ones already shown. */
  echo?: EchoState;
  sealed?: Sealed;
};

/** The echo above a new page (DESIGN.md rule 16): one kept line a day, oldest unseen first. Ids only, no text. */
export type EchoState = { day: string; id?: string; dismissed?: boolean; linked?: boolean; seen: string[] };

/** A voice's colour: an OKLCH hue angle, or null for the Black voice (--black-voice).
 *  chroma is a multiplier on --voice-c, for the Brown voice (tokens.css --v-brown uses .5). */
export type VoiceColour = { hue: number | null; chroma?: number };

export type Voice = {
  id: string;
  name: string;
  aka: string[];
  colour: VoiceColour;
  shade: 'light' | 'deep';
  twinId?: string;
  starred: boolean;
  order: number;
  archived: boolean;
  revisions: { at: Millis; name: string; aka: string[]; colour: VoiceColour }[];
};

export type PageKind = 'question' | 'entry' | 'council';
export type Page = {
  id: string;
  kind: PageKind;
  createdAt: Millis;
  updatedAt: Millis;
  title?: string;
  /** A question's: open, or answered (V2: only "This answers it" sets it). 'revisited' is an older row's,
   *  from before V2, and reads as answered. An entry or council stays 'open'. */
  state: 'open' | 'answered' | 'revisited';
  tags: string[];
  paradoxIds: string[];
  linkedPageIds: string[];
  /** Not in PLAN.md section 4 (package 1): the notebook's plain mood words for an entry, clear like tags.
   *  v2 (V1) took Mood out of the UI; the field stays so older rows and backups still read. */
  mood?: string[];
  /** Not in PLAN.md section 4 (package 1): the linked pages this one is a "smaller version of" (also in linkedPageIds). */
  smallerOf?: string[];
  /** Not in PLAN.md section 4 (v2, V1): on a question made by "Ask this", the page its line was written on
   *  (also in linkedPageIds), so that page shows the link as "Asked". An id, clear like the links. */
  askedFrom?: string;
  /** Not in PLAN.md section 4 (v2, V2): when "This answers it" moved a question under Answered, shown on the
   *  Questions list as the date answered; cleared when its last answer is taken back ("Not the answer").
   *  Optional and unindexed, so no Dexie version bump; an older answered row simply has none. */
  answeredAt?: Millis;
  music?: { albumUri: string; album: string; artist: string; coverId?: string };
  /** Not in PLAN.md section 4 (V3, the council's seats screen "Who sits?"): the voices seated at a council,
   *  by id, in seat order; turns go round them (model/council.ts nextSpeaker). Undefined until a voice is
   *  seated, which keeps older councils on plain chips. Ids stay clear, like paradoxIds; nothing to seal. */
  seats?: string[];
};

export type Message = {
  id: string;
  pageId: string;
  at: Millis;
  /** Not in PLAN.md section 4: set when a message is edited, so a merge import can keep the newest. */
  updatedAt?: Millis;
  voiceId?: string;
  text: string;
  replyTo?: string;
  kept: boolean;
  /** Not in PLAN.md section 4 (package 1): set in italic as the wiser second person, an answer or a later reading. */
  wise?: boolean;
  /** Not in PLAN.md section 4 (v2, V1): the line's earlier text, kept when it is edited on a later day than it
   *  was written (one per day of editing; at is when that text was replaced). Sealed with text in fields.ts.
   *  Optional, so no Dexie version bump: older rows simply have none. */
  revisions?: { at: Millis; text: string }[];
  sealed?: Sealed;
};

export type Pole = { value: string; aspect: string; shadow?: string };
export type Middle = { word?: string; scenario?: string };
export type Paradox = {
  id: string;
  createdAt: Millis;
  updatedAt: Millis;
  status: 'active' | 'resting' | 'retired';
  poleA: Pole;
  poleB: Pole;
  middle?: Middle;
  revisions: { at: Millis; poleA: Pole; poleB: Pole; middle?: Middle }[];
  sealed?: Sealed;
};

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'once';
export type Item = {
  id: string;
  paradoxId: string;
  pole: 'a' | 'b';
  pairId?: string;
  text: string;
  /** -1 top of the page to +1 bottom */
  lean: number;
  cadence?: Cadence;
  nextTo?: string;
  doneLog: { at: Millis }[];
  order: number;
  /** Not in PLAN.md section 4 (package 3): a goal is archived, never deleted. Missing means false, so
   *  no migration is needed; an archived goal leaves the spread and its balance shows an open slot. */
  archived?: boolean;
  sealed?: Sealed;
};

export type Lean = { id: string; paradoxId: string; at: Millis; lean: number; note: string; sealed?: Sealed };
export type Backup = { id: string; at: Millis; bytes: number; encrypted: boolean };
/** One cover per album however many playlists hold it (V7). order and firstTrackUri are version 1's (its place
 *  in the one playlist; -1 when off it): they stay on old rows and are no longer read, a playlist's order lives in
 *  shelves. coverUrl (not in PLAN-V3.md 5.1) is where the cover can still be fetched, so a tile below the fold
 *  fetches its own when it is scrolled near. Nothing is deleted: a page that heard an album keeps its cover. */
export type Album = { albumUri: string; album: string; artist: string; cover?: Blob; coverUrl?: string; order?: number; firstTrackUri?: string };

/** A playlist the account owns (V7, PLAN-V3.md 5.1). order is its place in /me/playlists; snapshotId is the
 *  snapshot its shelf was last read at ('' before the first read), so an unchanged playlist is not read again.
 *  chosen means it shows under the music line. */
export type Playlist = {
  id: string; name: string; uri: string; order: number; snapshotId: string; total: number; chosen: boolean;
  readAt?: Millis; coverUrl?: string;
};
/** One album on one playlist's shelf, at its first song's place in that playlist (V7). */
export type Shelf = { playlistId: string; albumUri: string; order: number; firstTrackUri: string };
export type PageMusic = NonNullable<Page['music']>;

export type Tables = {
  settings: Settings;
  voices: Voice;
  pages: Page;
  messages: Message;
  paradoxes: Paradox;
  items: Item;
  leans: Lean;
  backups: Backup;
  albums: Album;
  playlists: Playlist;
  shelves: Shelf;
};
export type TableName = keyof Tables;
export const TABLES: TableName[] = ['settings', 'voices', 'pages', 'messages', 'paradoxes', 'items', 'leans', 'backups', 'albums', 'playlists', 'shelves'];

/** Version 1 stores. The first key is the primary key; the rest are PLAN.md section 4's indexes. */
export const STORES_V1: Record<Exclude<TableName, 'playlists' | 'shelves'>, string> = {
  settings: 'id',
  voices: 'id',
  pages: 'id, createdAt, state, kind, *tags, *paradoxIds',
  messages: 'id, [pageId+at]',
  paradoxes: 'id',
  items: 'id, paradoxId',
  leans: 'id, [paradoxId+at]',
  backups: 'id',
  albums: 'albumUri',
};

/** Version 2 adds the playlists and one shelf per playlist (PLAN-V3.md 5.1). */
export const STORES: Record<TableName, string> = {
  ...STORES_V1,
  playlists: 'id, order',
  shelves: '[playlistId+albumUri], playlistId',
};

/** The Poems playlist, the one version 1 knew, as a playlists row: ticked, never read yet. */
export const poemsPlaylist = (): Playlist => ({
  id: POEMS_ID, name: POEMS_NAME, uri: `spotify:playlist:${POEMS_ID}`, order: 0, snapshotId: '', total: 0, chosen: true,
});

/** Version 1's ordered albums as the Poems playlist's shelf. Used by the Dexie upgrade and by an imported version 1 file. */
export function shelvesFromV1(albums: Pick<Album, 'albumUri' | 'order' | 'firstTrackUri'>[]): Shelf[] {
  return albums
    .filter(a => typeof a.order === 'number' && a.order >= 0)
    .map(a => ({ playlistId: POEMS_ID, albumUri: a.albumUri, order: a.order!, firstTrackUri: a.firstTrackUri ?? '' }));
}
export type FlowDB = Dexie & {
  settings: EntityTable<Settings, 'id'>;
  voices: EntityTable<Voice, 'id'>;
  pages: EntityTable<Page, 'id'>;
  messages: EntityTable<Message, 'id'>;
  paradoxes: EntityTable<Paradox, 'id'>;
  items: EntityTable<Item, 'id'>;
  leans: EntityTable<Lean, 'id'>;
  backups: EntityTable<Backup, 'id'>;
  albums: EntityTable<Album, 'albumUri'>;
  playlists: EntityTable<Playlist, 'id'>;
  shelves: Table<Shelf, [string, string]>;
};

export function openDB(name = DB_NAME): FlowDB {
  const db = new Dexie(name) as FlowDB;
  db.version(1).stores(STORES_V1);
  // Version 2: every ordered album becomes a shelf row of the Poems playlist, and the playlist itself is written
  // ticked, so the music line has its shelf before the first read. The albums rows are not touched.
  db.version(2).stores(STORES).upgrade(async tx => {
    const albums = await tx.table<Album, string>('albums').toArray();
    await tx.table('shelves').bulkPut(shelvesFromV1(albums));
    await tx.table('playlists').put(poemsPlaylist());
  });
  return db;
}

export const db: FlowDB = openDB();
