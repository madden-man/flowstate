// Dexie tables, version 5 (PLAN.md section 4; version 2 is PLAN-V3.md section 5.1, playlists under the music line;
// version 3 is PLAN-FLOWS.md section 5, the flows and their episodes; version 4 is PLAN-MEDITATE.md section 5, the sits;
// version 5 is PLAN-ENERGIZE.md section 5, the fixations). UI code never imports this file: it reads and writes
// through src/db/fields.ts, which owns the encrypt-on-write path (PLAN.md section 7).
import Dexie, { type EntityTable, type Table } from 'dexie';
import { POEMS_ID, POEMS_NAME } from '../music/poems';

export { POEMS_ID, POEMS_NAME };

export const SCHEMA_VERSION = 5;
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
   *  'seed-pages' is cleanSeedPages in seed.ts (the untouched manifesto and models pages go); 'fixations' is
   *  seedFixationsOnce (PLAN-ENERGIZE.md section 5, X1), the first three and the deck written once. */
  cleaned?: string[];
  /** PLAN-VALUES.md C0 (from PLAN-SELF.md section 4): ids of rows deleted on this phone, in any table, so a merge
   *  import of an older file never brings one back and drops links to it (backup.ts). Ids only, clear like every id;
   *  added with fields.ts tombstone(), they only grow (fields.ts keepLock), and a replace import takes the file's list. */
  deleted?: string[];
  /** ticked (V8): the named playlists (music/poems.ts NAMED_IDS) already ticked once, so each is ticked only once. */
  spotify?: { tokens?: SpotifyTokens; connectedAt?: Millis; ticked?: string[] };
  /** Not in PLAN.md section 4 (package 1): which kept line the echo shows today, and the ones already shown. */
  echo?: EchoState;
  /** Not in PLAN-FLOWS.md section 5 (F1): the seed flows (db/seed-flows.ts) already written once, by id, so each
   *  is written only once: a flow Tommy deletes never comes back, and a flow a later package adds is written on the next open. */
  flowsSeeded?: string[];
  /** PLAN-FLOWS.md section 5 (F2): the breath tone while a finger holds the ring; under Sounds, off by default (unset is off). */
  breathTone?: boolean;
  /** The door without the PIN (PLAN-FLOWS.md 3.7 and section 5, F5): "the ring" under the lock's keypad opens Right
   *  now and the flow pages read-only. Off by default (absent is off). Clear, like the rest of settings, so the
   *  locked gate can read it. */
  flowDoor?: boolean;
  /** PLAN-MEDITATE.md section 5 (S1): the sound the Meditate page's chips last chose; absent is rain. */
  sitSound?: SitSound;
  /** PLAN-MEDITATE.md section 5 (S2): the length the Meditate page's Minutes chips last chose, in minutes; 0 or absent is
   *  open (no end). A sit begun in Still is open whatever this says. */
  sitMinutes?: SitMinutes;
  /** PLAN-MEDITATE.md section 5 (S1): a sit's sound is media and plays with the ringer switch off ('playback'); absent is on. */
  sitThroughSilent?: boolean;
  sealed?: Sealed;
};

/** A sit's sound (PLAN-MEDITATE.md 3.1): one of the four scapes parts/Sound makes, or Quiet, the circle alone. */
export type SitSound = 'rain' | 'ocean' | 'forest' | 'bowl' | 'quiet';
/** A sit's length (PLAN-MEDITATE.md section 2): open (0), or 5, 10 or 20 minutes. */
export type SitMinutes = 0 | 5 | 10 | 20;

/** The echo above a new page (DESIGN.md rule 16): one kept line a day, oldest unseen first. Ids only, no text. */
export type EchoState = { day: string; id?: string; dismissed?: boolean; linked?: boolean; seen: string[] };

/** A voice's colour: an OKLCH hue angle, or null for the Black voice (--black-voice).
 *  chroma is a multiplier on --voice-c, for the Brown voice (tokens.css --v-brown uses .5). */
export type VoiceColour = { hue: number | null; chroma?: number };

export type Voice = {
  id: string;
  /** The role: Architect, King, Warrior. */
  name: string;
  /** V10: the name Tommy gives the voice ("Gus"); shown wherever it speaks, the role a tap away. */
  given?: string;
  aka: string[];
  colour: VoiceColour;
  shade: 'light' | 'deep';
  twinId?: string;
  starred: boolean;
  order: number;
  archived: boolean;
  revisions: { at: Millis; name: string; given?: string; aka: string[]; colour: VoiceColour }[];
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
  /** PLAN-FLOWS.md section 5 (F1): the flow episode this page was written about (F2's Journal helper links it).
   *  Optional and unindexed, like music; an id, clear. */
  flow?: { episodeId: string };
  /** PLAN-MEDITATE.md section 5 (S2): the sit this page was written after ("Write it down" on the page after a sit).
   *  Optional and unindexed, like flow; an id, clear. */
  sit?: { sitId: string };
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
  /** V13: its place on the Be list, as Tommy dragged it. Optional, so no Dexie version bump: a paradox never
   *  placed (an older one, or a new one) sorts after the placed ones, oldest first. */
  order?: number;
  sealed?: Sealed;
};

/** The one order of the paradoxes (V13), for Be, Flow and the rest: placed ones by order, then by age. */
export const byParadoxOrder = (a: Pick<Paradox, 'order' | 'createdAt' | 'id'>, b: Pick<Paradox, 'order' | 'createdAt' | 'id'>) =>
  (a.order ?? Infinity) - (b.order ?? Infinity) || a.createdAt - b.createdAt || a.id.localeCompare(b.id);

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
export type Album = {
  albumUri: string; album: string; artist: string;
  /** The kept cover. Plain bytes from V9 on (iOS Safari can lose a Blob kept in IndexedDB); a Blob in older rows. */
  cover?: Blob | ArrayBuffer;
  /** V9: the cover's image type, and when it was fetched; one older than COVER_MAX_AGE (src/music/covers.ts) is fetched again. */
  coverType?: string; coverAt?: Millis;
  coverUrl?: string; order?: number; firstTrackUri?: string;
};

/** A kept cover's bytes, whichever way it was kept. */
export async function coverBytes(c: Blob | ArrayBuffer): Promise<Uint8Array> {
  return new Uint8Array(c instanceof ArrayBuffer ? c : await c.arrayBuffer());
}

/** A playlist the account owns (V7, PLAN-V3.md 5.1). order is its place in /me/playlists; snapshotId is the
 *  snapshot its shelf was last read at ('' before the first read), so an unchanged playlist is not read again.
 *  chosen means it shows under the music line. */
export type Playlist = {
  id: string; name: string; uri: string; order: number; snapshotId: string; total: number; chosen: boolean;
  readAt?: Millis; coverUrl?: string;
};
/** One album on one playlist's shelf, at its first song's place in that playlist (V7). */
/** firstTrackAt (V9): the first song's place in the playlist, for a play Spotify will not start by uri. */
export type Shelf = { playlistId: string; albumUri: string; order: number; firstTrackUri: string; firstTrackAt?: number };
export type PageMusic = NonNullable<Page['music']>;

// ---- flows (PLAN-FLOWS.md section 5, schema version 3) ----

/** The drawn shape of a flow, one module each under src/ui/parts/cycle/. */
export type DiagramName = 'ring' | 'valley' | 'arc' | 'mountain' | 'curve' | 'coil' | 'clock' | 'stairs' | 'fork';
/** prediction (F6, not in PLAN-FLOWS.md section 5): one rule under the row for the worry written as a prediction,
 *  kept on the episode (episodes.prediction), so the morning after can ask for its outcome. sit (PLAN-MEDITATE.md
 *  section 5, S3): the row opens Meditate carrying the episode, and a sit of a minute or more ends by ticking it. */
export type TipHelper = 'still' | 'music' | 'ring' | 'five' | 'journal' | 'timer' | 'person' | 'prediction' | 'sit' | 'on';
/** What a pick is (PLAN-PICKS.md section 6): an album is a cover, the rest are written lines with their kind word. */
export type PickKind = 'album' | 'show' | 'film' | 'switch' | 'phone';
/** Something to put on at a step (PLAN-PICKS.md section 6, P0): a title and its kind, nothing more; no note (Tommy,
 *  2026-11-10). by is an album's artist, albumId its Spotify album id. struck stays struck (rule 10), never deleted.
 *  Sealed with the step. Named OnPick, not the plan's Pick, so it never shadows TypeScript's own Pick in this file. */
export type OnPick = { id: string; kind: PickKind; title: string; by?: string; albumId?: string; struck?: boolean };
/** A thing to do at a step. text is the row; short the Still row; wise sets it in italic as the wiser second person
 *  (DESIGN.md rule 17); struck stays struck (rule 10), never deleted. */
export type Tip = {
  id: string; text: string; short?: string; helper?: TipHelper;
  /** The person helper (F6): who, their number (optional), what the text says. The text may hold {time}, filled
   *  from the episode's return time ("I'm going. Back at {time}."). Sealed with the step. */
  person?: { name: string; tel?: string; text: string };
  wise?: boolean; struck?: boolean;
  /** Not in PLAN-FLOWS.md section 5 (F3): a line the page prints under the rows, never a row with a check: nothing
   *  to tick, nothing done (Depress's safety line at the bottom). Shown in every light, Still too; it has no short. */
  print?: boolean;
  /** PLAN-FLOWS.md 3.7, one episode, two flows (F4): this line names another flow, and a tap moves the dot there:
   *  the episode here ends, one starts on that flow at that step with `from` set to it. Always a printed line (print),
   *  never a row to tick. Ids only, so it stays in the clear copy like `print`. */
  handoff?: { flowId: string; stepId: string };
};
/** A step of a flow. line is Tommy's own words (italic serif); said is what the page says (print, with its data);
 *  usual the typical span in words, usualShort the same in words only for Still (no numbers, rule 15). */
export type Step = {
  id: string; name: string; line?: string; said?: string; usual?: string; usualShort?: string; tips: Tip[];
  /** Not in PLAN-FLOWS.md section 5 (F1): the usual span in minutes, the clock behind usual's words. The app opens on
   *  a live episode inside its step's span, and an episode untouched past its last step's span ends (model/flows.ts). */
  spanMin?: number;
  /** Not in PLAN-FLOWS.md section 5 (F1): the peak, where "last time" counts from ("48 minutes from the peak to clear"). */
  peak?: boolean;
  /** PLAN-PICKS.md section 6 (P0): what the step's On row offers, in its order, and the one line its sheet prints.
   *  Optional, so no Dexie version bump; sealed with the step like its tips. */
  picks?: OnPick[];
  onLine?: string;
};
/** A note to the next one of you (PLAN-FLOWS.md 3.7, F6): Tommy's line, the step it shows at, sealed. struck (F6, not
 *  in section 5) is when he struck it in the step sheet's Earlier (rule 10: struck, never deleted). */
export type FlowNote = { id: string; stepId: string; text: string; at: Millis; episodeId: string; struck?: Millis };
export type Flow = {
  id: string; name: string; order: number; createdAt: Millis; updatedAt: Millis;
  /** The flow's own line, shown at rest (Panic: "Wait out the truly hard parts."). */
  line?: string;
  /** Not in PLAN-FLOWS.md section 5 (F3): one gentle line the page prints at rest, under the flow's line, in every
   *  light; not a step (Energize's boundary: "Highs most days for a week without needing sleep: talk to your doctor."). */
  restLine?: string;
  /** Not in PLAN-FLOWS.md section 5 (F4): the clock in the middle reads in words in every light and the screen is
   *  not held awake (3 a.m.: the clock is turned away, the bed is for sleeping). A flag, in the clear like diagram. */
  quietClock?: boolean;
  diagram: DiagramName;
  steps: Step[];
  /** Every earlier version of the name and steps; a seeded flow's seed text is the first. */
  revisions: { at: Millis; name: string; steps: Step[] }[];
  notes?: FlowNote[];
  sealed?: Sealed;
};
/** One time the dot left rest (PLAN-FLOWS.md section 5). A clock, not a score: nothing here is ever totalled. */
export type Episode = {
  id: string; flowId: string; startedAt: Millis; endedAt?: Millis;
  /** Each step the dot reached, in order, with when. */
  marks: { stepId: string; at: Millis }[];
  done: { tipId: string; at: Millis }[];
  pageId?: string;
  music?: { albumUri: string; album: string; artist: string };
  /** The Five helper's lines (F2), sealed. */
  lines?: string[];
  returnAt?: Millis;
  /** The episode this one was handed off from (PLAN-FLOWS.md 3.7, F4): the other flow's, ended the moment this began. */
  from?: string;
  prediction?: { text: string; outcome?: 'didnt' | 'happened'; at: Millis };
  /** Not in PLAN-FLOWS.md section 5 (F6): when the page asked "Anything to tell the next one of you who's here?" for
   *  this episode. It asks once per episode, so set the first time it shows, and a swipe only hides it. */
  asked?: Millis;
  /** PLAN-PICKS.md section 6 (P0): the line ticked on the On sheet, by id, with its title as it read then (sealed). */
  on?: { pickId: string; title: string; at: Millis };
  /** PLAN-ENERGIZE.md section 5 (X1, set by X5's Spark it): the fixation this ride is for. An id, clear. */
  fixationId?: string;
  sealed?: Sealed;
};

// ---- sits (PLAN-MEDITATE.md section 5, schema version 4) ----

/** One sit of a minute or more on the Meditate page, written when it ends. A date and a sound, never a total: nothing
 *  here is ever added up (DESIGN.md rule 15). minutes is the chosen length (absent on an open sit); pageId is set when
 *  "Write it down" opens today's page; episodeId when the sit was reached from a flow's tip (S3). Nothing is sealed. */
export type Sit = {
  id: string; startedAt: Millis; endedAt: Millis; sound: SitSound; minutes?: Exclude<SitMinutes, 0>; pageId?: string; episodeId?: string;
};

// ---- fixations (PLAN-ENERGIZE.md section 5, schema version 5) ----

/** One time a fixation was on (PLAN-ENERGIZE.md section 2): from when it went into a slot to when it came out. No to
 *  means it is on now. slot is 0, 1 or 2, the card it sits in. A span in time, never a run of days: nothing to miss or break. */
export type Stint = { from: Millis; to?: Millis; slot: number };
/** What Tommy is into (PLAN-ENERGIZE.md section 5): a name and a hue angle on the voices' wheel. On is the last stint
 *  having no to; on deck is neither on nor finished. next is his one line, the next small step. finishedAt retires it
 *  ("Finished instead"); nothing is ever deleted. name and next are sealed (fields.ts); the hue, the stints and the
 *  dates stay clear. updatedAt (not in section 5) is the last change, so a merge import keeps the newest. */
export type Fixation = {
  id: string; name: string; hue: number; createdAt: Millis; stints: Stint[];
  next?: string; finishedAt?: Millis; updatedAt?: Millis; sealed?: Sealed;
};

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
  flows: Flow;
  episodes: Episode;
  sits: Sit;
  fixations: Fixation;
};
export type TableName = keyof Tables;
export const TABLES: TableName[] = ['settings', 'voices', 'pages', 'messages', 'paradoxes', 'items', 'leans', 'backups', 'albums', 'playlists', 'shelves', 'flows', 'episodes', 'sits', 'fixations'];

/** Version 1 stores. The first key is the primary key; the rest are PLAN.md section 4's indexes. */
export const STORES_V1: Record<Exclude<TableName, 'playlists' | 'shelves' | 'flows' | 'episodes' | 'sits' | 'fixations'>, string> = {
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
export const STORES_V2: Record<Exclude<TableName, 'flows' | 'episodes' | 'sits' | 'fixations'>, string> = {
  ...STORES_V1,
  playlists: 'id, order',
  shelves: '[playlistId+albumUri], playlistId',
};

/** Version 3 adds the flows and their episodes (PLAN-FLOWS.md section 5). The seed flows are written by
 *  seed.ts seedFlowsOnce, not here: an upgrade cannot seal (WebCrypto cannot run inside an IndexedDB transaction). */
export const STORES_V3: Record<Exclude<TableName, 'sits' | 'fixations'>, string> = {
  ...STORES_V2,
  flows: 'id, order',
  episodes: 'id, [flowId+startedAt]',
};

/** Version 4 adds the sits (PLAN-MEDITATE.md section 5). The upgrade writes nothing: a journal has sat no sits yet. */
export const STORES_V4: Record<Exclude<TableName, 'fixations'>, string> = {
  ...STORES_V3,
  sits: 'id, startedAt',
};

/** Version 5 adds the fixations (PLAN-ENERGIZE.md section 5). The upgrade writes nothing: a name is sealed and an
 *  upgrade cannot seal, so the first three and the deck come from seed.ts seedFixationsOnce once the journal is open. */
export const STORES: Record<TableName, string> = {
  ...STORES_V4,
  fixations: 'id',
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
  flows: EntityTable<Flow, 'id'>;
  episodes: EntityTable<Episode, 'id'>;
  sits: EntityTable<Sit, 'id'>;
  fixations: EntityTable<Fixation, 'id'>;
};

export function openDB(name = DB_NAME): FlowDB {
  const db = new Dexie(name) as FlowDB;
  db.version(1).stores(STORES_V1);
  // Version 2: every ordered album becomes a shelf row of the Poems playlist, and the playlist itself is written
  // ticked, so the music line has its shelf before the first read. The albums rows are not touched.
  db.version(2).stores(STORES_V2).upgrade(async tx => {
    const albums = await tx.table<Album, string>('albums').toArray();
    await tx.table('shelves').bulkPut(shelvesFromV1(albums));
    await tx.table('playlists').put(poemsPlaylist());
  });
  db.version(3).stores(STORES_V3);
  db.version(4).stores(STORES_V4);
  db.version(5).stores(STORES);
  return db;
}

export const db: FlowDB = openDB();
