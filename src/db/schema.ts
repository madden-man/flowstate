// Dexie tables, version 1 (PLAN.md section 4). UI code never imports this file: it reads and writes
// through src/db/fields.ts, which owns the encrypt-on-write path (PLAN.md section 7).
import Dexie, { type EntityTable } from 'dexie';

export const SCHEMA_VERSION = 1;
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
  state: 'open' | 'answered' | 'revisited';
  tags: string[];
  paradoxIds: string[];
  linkedPageIds: string[];
  /** Not in PLAN.md section 4 (package 1): the notebook's plain mood words for an entry, clear like tags. */
  mood?: string[];
  /** Not in PLAN.md section 4 (package 1): the linked pages this one is a "smaller version of" (also in linkedPageIds). */
  smallerOf?: string[];
  music?: { albumUri: string; album: string; artist: string; coverId?: string };
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
/** order is the album's place in the playlist; -1 (package 7) keeps an album that is no longer on the playlist,
 *  or was never on it, so a page that heard it still shows its cover offline. Nothing is deleted. */
export type Album = { albumUri: string; album: string; artist: string; order: number; firstTrackUri: string; cover?: Blob };
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
};
export type TableName = keyof Tables;
export const TABLES: TableName[] = ['settings', 'voices', 'pages', 'messages', 'paradoxes', 'items', 'leans', 'backups', 'albums'];

/** Version 1 stores. The first key is the primary key; the rest are PLAN.md section 4's indexes. */
export const STORES: Record<TableName, string> = {
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
};

export function openDB(name = DB_NAME): FlowDB {
  const db = new Dexie(name) as FlowDB;
  db.version(SCHEMA_VERSION).stores(STORES);
  return db;
}

export const db: FlowDB = openDB();
