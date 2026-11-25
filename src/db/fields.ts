// The one typed door to the database (PLAN.md section 7). Every secret text field is written and read
// here, so no UI code ever touches a stored string:
//   messages.text (and its revisions' text), items.text, leans.note, paradoxes.*.aspect and middle.scenario (revisions too),
//   pages.title (a question is Tommy's own text; decided at review of PR #1), settings.spotify.tokens, settings.research
//   (the Anthropic and OpenAlex keys, PLAN-RESEARCH.md section 5, Q2),
//   flows: name, line, restLine, every step's name, line, said, usual, usualShort, tips (text, short, person), picks and onLine, the revisions'
//   names and steps, and the notes' text (PLAN-FLOWS.md section 5); episodes: the Five lines, the prediction's text and the On pick's title;
//   fixations: name and next (PLAN-ENERGIZE.md section 5); values: word, shadow, looks, each champion's why and the
//   revisions (PLAN-VALUES.md section 5); readings: value, the Depression meter's and each gate's
//   (PLAN-MOUNTAIN.md section 8, R0; of and at stay clear for the [of+at] index); signShelves: picks, asks, deck and line; marks: text and
//   struck; days: basics (PLAN-TASKS.md section 7, T0; ids, signs, touches and dates stay clear); inquiries: question
//   and runs whole (the agents' messages carry the question; PLAN-RESEARCH.md section 5, Q2; ids, state, picks and dates
//   stay clear). papers are not sealed: a paper's words are an index's public record, not his. settings.bridge (the
//   bridge's token and the pocket, PLAN-WORLDS.md section 9, W2); songs: title and lyric; takes: the audio.
// In a world's notebook every write here also holds the outbox, pages and messages (scope below), so src/db/outbox.ts
// records what travels in the same transaction; quiet() writes what came down from the bible without them.
// With no key the layer stores plain text. Once a key is set (package 6 adds the keypad) each record's
// secret fields are sealed together with AES-GCM, and setKey() re-encrypts every existing row in place.
// Ids, dates, tags, colours and voice names stay clear so lists can render before unlock.
//
// Two notebooks (PLAN-WORLDS.md section 3, W1). The layer holds two handles: home, always the personal notebook's
// database, and book, the notebook worn (home itself when none is). Every table reads and writes book. A world is a
// second database with the same schema (schema.ts worldDbName), sealed with the same key; don and doff swap book and
// keep the key. The settings row splits: the notebook's own fields (schema.ts BOOK_KEYS) live on book's row, every
// other field on home's, and store.get / store.put of 'settings' join and part them here, so no caller has to know
// which row a field lives on. The lock lives on home's row; each world's row keeps a copy of the lock its rows are
// sealed with (its stamp), and setKey, removeKey and unlock bring every notebook to the one key (see setKey).
import Dexie, { type Collection, type IndexableType, type Table } from 'dexie';
import { db as defaultDb, openDB, worldDbName, BOOK_KEYS, type FlowDB, type LockFields, type LockMove, type OnPick, type Settings, type TableName, type Tables, type Sealed } from './schema';
import { seal, unseal, makeVerifier, checkVerifier, isSealed, rawKey, keyFromRaw, toB64, fromB64 } from './crypto';
import { unheard } from './writes';
import { WRITE_SCOPE } from './outbox';

export class LockedError extends Error {
  constructor() { super('The journal is locked'); this.name = 'LockedError'; }
}

type Split<T> = { clear: T; secret: unknown };
type Spec<T> = { take(row: T): Split<T>; give(clear: T, secret: unknown): T };

const textSpec = <T extends { text: string }>(): Spec<T> => ({
  take: row => ({ clear: { ...row, text: '' }, secret: row.text }),
  give: (clear, secret) => ({ ...clear, text: String(secret ?? '') }),
});

/** A message seals its text, and the text of its revisions when it has any (v2). A row with no revisions
 *  seals the bare string as before, so rows sealed before revisions existed read unchanged. */
type MSecret = string | { t: string; r: string[] };
const messageSpec: Spec<Tables['messages']> = {
  take: row => {
    if (!row.revisions?.length) return { clear: { ...row, text: '' }, secret: row.text };
    return {
      clear: { ...row, text: '', revisions: row.revisions.map(r => ({ ...r, text: '' })) },
      secret: { t: row.text, r: row.revisions.map(r => r.text) } satisfies MSecret,
    };
  },
  give: (clear, raw) => {
    const s = raw as MSecret | null | undefined;
    if (s === null || s === undefined || typeof s === 'string') return { ...clear, text: String(s ?? '') };
    return { ...clear, text: s.t, revisions: (clear.revisions ?? []).map((r, i) => ({ ...r, text: s.r[i] ?? '' })) };
  },
};

type PSecret = { a: string; b: string; s?: string; r: [string, string, string | undefined][] };
const paradoxSpec: Spec<Tables['paradoxes']> = {
  take: row => {
    const secret: PSecret = {
      a: row.poleA.aspect,
      b: row.poleB.aspect,
      s: row.middle?.scenario,
      r: row.revisions.map(r => [r.poleA.aspect, r.poleB.aspect, r.middle?.scenario]),
    };
    const blankMiddle = (m?: { word?: string; scenario?: string }) => (m ? { ...m, scenario: undefined } : undefined);
    return {
      clear: {
        ...row,
        poleA: { ...row.poleA, aspect: '' },
        poleB: { ...row.poleB, aspect: '' },
        middle: blankMiddle(row.middle),
        revisions: row.revisions.map(r => ({ ...r, poleA: { ...r.poleA, aspect: '' }, poleB: { ...r.poleB, aspect: '' }, middle: blankMiddle(r.middle) })),
      },
      secret,
    };
  },
  give: (clear, raw) => {
    const s = raw as PSecret;
    const withScenario = (m: { word?: string; scenario?: string } | undefined, sc?: string) =>
      m ? { ...m, scenario: sc } : sc !== undefined ? { scenario: sc } : undefined;
    return {
      ...clear,
      poleA: { ...clear.poleA, aspect: s.a },
      poleB: { ...clear.poleB, aspect: s.b },
      middle: withScenario(clear.middle, s.s),
      revisions: clear.revisions.map((r, i) => ({
        ...r,
        poleA: { ...r.poleA, aspect: s.r[i]?.[0] ?? '' },
        poleB: { ...r.poleB, aspect: s.r[i]?.[1] ?? '' },
        middle: withScenario(r.middle, s.r[i]?.[2]),
      })),
    };
  },
};

/** The settings row seals the Spotify tokens and Research's keys (PLAN-RESEARCH.md section 5), a cover's drawing
 *  (PLAN-WORLDS.md section 9) and the bridge's token and pocket (PLAN-WORLDS.md section 9, W2). With none of the last
 *  three the secret is the tokens alone (or null), as it always was, so a row sealed before Research reads unchanged;
 *  with any it is `{ s, research?, drawing?, bridge? }`, told apart by those fields (a tokens object has none). The clear
 *  copy keeps no research field, no drawing and no bridge at all, so a locked notebook shows no key, no token, no sign
 *  of either, and plain paper. */
type Tokens = NonNullable<Settings['spotify']>['tokens'];
/** A drawing as bytes, the way it is kept and sealed (a Blob does not survive JSON, and iOS can lose a Blob kept in
 *  IndexedDB, as schema.ts Album notes); settingsOut turns it back into a Blob for the UI. */
type DrawingData = { type: string; b64: string };
type Both = { s: Tokens | null; research?: NonNullable<Settings['research']>; drawing?: DrawingData; bridge?: NonNullable<Settings['bridge']> };
type SSecret = Tokens | null | Both;
const drawingOf = (row: Settings): DrawingData | undefined => {
  const c = row.cover as { drawing?: unknown } | undefined;
  return c && isDrawingData(c.drawing) ? c.drawing : undefined;
};
const isDrawingData = (x: unknown): x is DrawingData =>
  !!x && typeof x === 'object' && typeof (x as DrawingData).b64 === 'string' && typeof (x as DrawingData).type === 'string';
const settingsSpec: Spec<Settings> = {
  take: row => {
    const { spotify, research, cover, bridge, ...rest } = row;
    const drawing = drawingOf(row);
    const clear: Settings = { ...rest, ...(spotify ? { spotify: { connectedAt: spotify.connectedAt } } : {}), ...(cover && !drawing ? { cover } : {}) };
    const tokens = spotify?.tokens ?? null;
    const secret: SSecret = research || drawing || bridge
      ? { s: tokens, ...(research ? { research } : {}), ...(drawing ? { drawing } : {}), ...(bridge ? { bridge } : {}) }
      : tokens;
    return { clear, secret };
  },
  give: (clear, raw) => {
    const s = (raw ?? null) as SSecret;
    const both = s && typeof s === 'object' && ('research' in s || 'drawing' in s || 'bridge' in s) ? s as Both : null;
    const tokens = both ? both.s : (s as Tokens | null);
    const out: Settings = tokens ? { ...clear, spotify: { ...clear.spotify, tokens } } : clear;
    if (both?.research) out.research = both.research;
    if (both?.drawing) out.cover = { drawing: both.drawing } as unknown as Settings['cover'];
    if (both?.bridge) out.bridge = both.bridge;
    return out;
  },
};

/** Before a settings row is stored: a drawing Blob becomes bytes (DrawingData). */
async function settingsIn(row: Settings): Promise<Settings> {
  const c = row.cover as { drawing?: unknown } | undefined;
  const d = c?.drawing as Blob | undefined;
  if (!d || isDrawingData(d) || typeof d.arrayBuffer !== 'function') return row;
  return { ...row, cover: { drawing: { type: d.type, b64: toB64(new Uint8Array(await d.arrayBuffer())) } } as unknown as Settings['cover'] };
}
/** After a settings row is read: kept bytes become a Blob again. */
function settingsOut<T extends Settings>(row: T): T {
  const d = drawingOf(row);
  return d ? { ...row, cover: { drawing: new Blob([fromB64(d.b64)], { type: d.type }) } } : row;
}

const pageSpec: Spec<Tables['pages']> = {
  take: row => {
    const { title, ...clear } = row;
    return { clear: clear as Tables['pages'], secret: title ?? null };
  },
  give: (clear, secret) => (typeof secret === 'string' ? { ...clear, title: secret } : clear),
};

const leanSpec: Spec<Tables['leans']> = {
  take: row => ({ clear: { ...row, note: '' }, secret: row.note }),
  give: (clear, secret) => ({ ...clear, note: String(secret ?? '') }),
};

/** A flow seals every word it holds; the clear copy keeps the shape (ids, the diagram, helpers, spans, which step is
 *  the peak), so a list can draw the flow before unlock. Opened, the sealed words come back whole. */
type FSecret = { name: string; line?: string; restLine?: string; steps: Tables['flows']['steps']; revisions: Tables['flows']['revisions']; notes?: string[] };
const blankSteps = (steps: Tables['flows']['steps']) => steps.map(st => ({
  id: st.id, name: '', tips: st.tips.map(t => ({ id: t.id, text: '', helper: t.helper, wise: t.wise, struck: t.struck, print: t.print, handoff: t.handoff })),
  spanMin: st.spanMin, peak: st.peak,
}));
const flowSpec: Spec<Tables['flows']> = {
  take: row => ({
    clear: {
      ...row, name: '', line: undefined, restLine: undefined, steps: blankSteps(row.steps),
      revisions: row.revisions.map(r => ({ at: r.at, name: '', steps: [] })),
      notes: row.notes?.map(n => ({ ...n, text: '' })),
    },
    secret: { name: row.name, line: row.line, restLine: row.restLine, steps: row.steps, revisions: row.revisions, notes: row.notes?.map(n => n.text) } satisfies FSecret,
  }),
  give: (clear, raw) => {
    const s = raw as FSecret;
    return {
      ...clear, name: s.name, line: s.line, restLine: s.restLine, steps: s.steps, revisions: s.revisions,
      notes: clear.notes?.map((n, i) => ({ ...n, text: s.notes?.[i] ?? '' })),
    };
  },
};

/** on (PLAN-PICKS.md, P0): the title of what was put on is his, so it is sealed; its id and time stay clear. */
type ESecret = { lines?: string[]; prediction?: string; on?: string };
const episodeSpec: Spec<Tables['episodes']> = {
  take: row => ({
    clear: {
      ...row, lines: undefined, prediction: row.prediction ? { ...row.prediction, text: '' } : undefined,
      on: row.on ? { ...row.on, title: '' } : undefined,
    },
    secret: { lines: row.lines, prediction: row.prediction?.text, on: row.on?.title } satisfies ESecret,
  }),
  give: (clear, raw) => {
    const s = (raw ?? {}) as ESecret;
    return {
      ...clear, lines: s.lines, prediction: clear.prediction ? { ...clear.prediction, text: s.prediction ?? '' } : undefined,
      on: clear.on ? { ...clear.on, title: s.on ?? '' } : undefined,
    };
  },
};

/** A fixation seals its name and its next line (PLAN-ENERGIZE.md section 5); the hue, the stints and the dates stay
 *  clear, so the deck can sort and the door can draw nothing from it without the key. */
type XSecret = { name: string; next?: string };
const fixationSpec: Spec<Tables['fixations']> = {
  take: row => ({ clear: { ...row, name: '', next: undefined }, secret: { name: row.name, next: row.next } satisfies XSecret }),
  give: (clear, raw) => {
    const s = (raw ?? { name: '' }) as XSecret;
    return { ...clear, name: s.name, ...(s.next !== undefined ? { next: s.next } : {}) };
  },
};

/** A value seals its words (PLAN-VALUES.md section 5): word, shadow, looks, the revisions whole, and each champion's
 *  why, keyed by voice and side so the clear list can be reordered without the whys moving. The clear copy keeps the
 *  shape: ids, status, tier, tierLog, order, dates, and every champion's voiceId, side and at, so the list draws its
 *  champions' rules and its tiers before unlock (PLAN-TIERS.md section 4); each revision keeps only its date. */
type VSecret = { word: string; shadow?: string; looks?: string; whys: Record<string, string>; revisions: Tables['values']['revisions'] };
const whyKey = (c: { voiceId: string; side: string }) => `${c.side}:${c.voiceId}`;
const valueSpec: Spec<Tables['values']> = {
  take: row => {
    const whys: Record<string, string> = {};
    for (const c of row.champions) if (c.why !== undefined) whys[whyKey(c)] = c.why;
    return {
      clear: {
        ...row, word: '', shadow: undefined, looks: undefined,
        champions: row.champions.map(({ why: _, ...c }) => c),
        revisions: row.revisions.map(r => ({ at: r.at, word: '' })),
      },
      secret: { word: row.word, shadow: row.shadow, looks: row.looks, whys, revisions: row.revisions } satisfies VSecret,
    };
  },
  give: (clear, raw) => {
    const s = (raw ?? { word: '', whys: {}, revisions: [] }) as VSecret;
    const out = { ...clear, word: s.word, revisions: s.revisions ?? [] };
    if (s.shadow !== undefined) out.shadow = s.shadow; else delete out.shadow;
    if (s.looks !== undefined) out.looks = s.looks; else delete out.looks;
    out.champions = clear.champions.map(c => (s.whys?.[whyKey(c)] !== undefined ? { ...c, why: s.whys[whyKey(c)] } : c));
    return out;
  },
};

/** A reading seals its value (PLAN-MOUNTAIN.md section 8): how heavy the mountain was and how shut each gate, by date,
 *  is among the most private things he keeps. Its id, when and what it is of stay clear, so the newest per `of` is an
 *  index read; the clear copy has no value at all, so nothing locked can be drawn as open. */
const readingSpec: Spec<Tables['readings']> = {
  take: row => { const { value, ...clear } = row; return { clear: clear as Tables['readings'], secret: value }; },
  give: (clear, secret) => ({ ...clear, value: Number(secret) }),
};

/** A sign's shelf seals its picks, as a step seals its picks (PLAN-TASKS.md section 4): what he puts on is his. Its
 *  questions, once he rewrites one, are his words too, and are sealed with them (2026-11-17). A row with no asks
 *  seals the bare picks as before, so a row sealed before the asks reads unchanged; with asks it is `{ picks, asks }`.
 *  The clear copy keeps the sign and the date, with no picks and no asks, so nothing locked can be drawn as an empty
 *  shelf he chose. */
// The deck (PLAN-BLOCKERS.md section 5, K0) rides in the same object: `{ picks, asks?, deck? }` once either is set.
// The sign's line (PLAN-SIGN-LINES.md L1) rides there too: `{ picks, asks?, deck?, line? }`.
type ShSecret = OnPick[] | { picks: OnPick[]; asks?: string[]; deck?: Tables['signShelves']['deck']; line?: string };
const signShelfSpec: Spec<Tables['signShelves']> = {
  take: row => {
    const { asks, deck, line, ...rest } = row;
    const secret: ShSecret = asks || deck || line !== undefined
      ? { picks: row.picks, ...(asks ? { asks } : {}), ...(deck ? { deck } : {}), ...(line !== undefined ? { line } : {}) }
      : row.picks;
    return { clear: { ...rest, picks: [] }, secret };
  },
  give: (clear, raw) => {
    const s = raw as ShSecret | null | undefined;
    if (Array.isArray(s)) return { ...clear, picks: s };
    if (s && typeof s === 'object' && Array.isArray(s.picks)) {
      return {
        ...clear, picks: s.picks, ...(Array.isArray(s.asks) ? { asks: s.asks } : {}), ...(Array.isArray(s.deck) ? { deck: s.deck } : {}),
        ...(typeof s.line === 'string' ? { line: s.line } : {}),
      };
    }
    return { ...clear, picks: [] };
  },
};

/** A mark seals its words (PLAN-TASKS.md section 7), as the mountain seals its readings: the line and the struck line.
 *  Its sign, touch and time stay clear for the index. */
type MkSecret = { text: string; struck?: string };
const markSpec: Spec<Tables['marks']> = {
  take: row => {
    const { struck, ...rest } = row;
    return { clear: { ...rest, text: '' }, secret: (struck !== undefined ? { text: row.text, struck } : { text: row.text }) satisfies MkSecret };
  },
  give: (clear, raw) => {
    const s = (raw ?? { text: '' }) as MkSecret;
    return { ...clear, text: String(s.text ?? ''), ...(s.struck !== undefined ? { struck: s.struck } : {}) };
  },
};

/** The day's row seals which basics are lit (PLAN-TASKS.md section 7): whether he ate or slept is his alone. */
const daySpec: Spec<Tables['days']> = {
  take: row => ({ clear: { ...row, basics: [] }, secret: row.basics }),
  give: (clear, secret) => ({ ...clear, basics: Array.isArray(secret) ? secret as Tables['days']['basics'] : [] }),
};

/** A question asked seals its question and its runs whole (PLAN-RESEARCH.md section 5): the question is his own text,
 *  and every agent's messages carry it. The clear copy keeps the id, when it was asked, the state, the picks (paper ids
 *  and sides) and the earlier picks, so the Asked list can be ordered before unlock with nothing of his on it. */
type QSecret = { question: string; runs?: Tables['inquiries']['runs'] };
const inquirySpec: Spec<Tables['inquiries']> = {
  take: row => {
    const { runs, ...rest } = row;
    return { clear: { ...rest, question: '' }, secret: (runs !== undefined ? { question: row.question, runs } : { question: row.question }) satisfies QSecret };
  },
  give: (clear, raw) => {
    const s = (raw ?? { question: '' }) as QSecret;
    return { ...clear, question: String(s.question ?? ''), ...(s.runs !== undefined ? { runs: s.runs } : {}) };
  },
};

/** A song seals its title and lyric (PLAN-WORLDS.md section 6); sections, key, tempo and dates stay clear. */
type SgSecret = { title: string; lyric: string };
const songSpec: Spec<Tables['songs']> = {
  take: row => ({ clear: { ...row, title: '', lyric: '' }, secret: { title: row.title, lyric: row.lyric } satisfies SgSecret }),
  give: (clear, raw) => {
    const s = (raw ?? { title: '', lyric: '' }) as SgSecret;
    return { ...clear, title: String(s.title ?? ''), lyric: String(s.lyric ?? '') };
  },
};

/** A take seals its audio (PLAN-WORLDS.md section 6), as base64 inside the envelope; the pitch line and the rest stay
 *  clear, so a list can draw the line before unlock and nothing of his voice can be played. */
const takeSpec: Spec<Tables['takes']> = {
  take: row => ({ clear: { ...row, audio: new ArrayBuffer(0) }, secret: toB64(new Uint8Array(row.audio)) }),
  give: (clear, raw) => {
    const b = fromB64(typeof raw === 'string' ? raw : '');
    return { ...clear, audio: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  },
};

/** Which tables carry secret fields. The rest are stored as they are. */
const SPECS: Partial<{ [K in TableName]: Spec<Tables[K]> }> = {
  settings: settingsSpec,
  pages: pageSpec,
  messages: messageSpec,
  items: textSpec<Tables['items']>(),
  leans: leanSpec,
  paradoxes: paradoxSpec,
  flows: flowSpec,
  episodes: episodeSpec,
  fixations: fixationSpec,
  values: valueSpec,
  readings: readingSpec,
  signShelves: signShelfSpec,
  marks: markSpec,
  days: daySpec,
  inquiries: inquirySpec,
  songs: songSpec,
  takes: takeSpec,
};
export const SECRET_TABLES = Object.keys(SPECS) as TableName[];

/** A row as the UI sees it. locked is true when it was read while the key is out of memory. */
export type Read<T> = T & { locked?: true };


/** The personal notebook's database: the lock, the light, the sounds, Spotify and Research live on its row. */
let homeDb: FlowDB = defaultDb;
/** The notebook worn: every table reads and writes here. homeDb itself when no world is worn. */
let bookDb: FlowDB = defaultDb;
/** The world worn, by id; null for his own pages. */
let wornId: string | null = null;
/** World databases opened this session, by name, so each is opened once. */
const openWorlds = new Map<string, FlowDB>();
let key: CryptoKey | null = null;
let lockEnabled = false;
/** A PIN change stopped partway in this session after home was rewritten (setKey): the key in memory is already the
 *  new one, a world may still be sealed with the old (or plain, a first PIN), and the next job in the write queue tries
 *  to finish it (catchUp). null otherwise; a restart forgets it and the next unlock finishes the move instead. */
let stopped: { old: CryptoKey | null; next: CryptoKey; target: Settings['lock'] } | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** The personal notebook's database, whatever is worn. */
export const home = (): FlowDB => homeDb;
/** The notebook worn (home when none is). */
export const book = (): FlowDB => bookDb;
/** The world worn, by id; null for the personal notebook. */
export const worn = (): string | null => wornId;
/** Which notebook a database is: a world's id, or null for the personal notebook (or any other). */
export const notebookOf = (db: FlowDB): string | null => {
  const pre = worldDbName(homeDb.name, '');
  return db.name.startsWith(pre) ? db.name.slice(pre.length) : null;
};
const split = () => bookDb !== homeDb;

/** Writes and the re-encrypt pass run one at a time, so no write lands between a read and its rewrite. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const job = async () => { await catchUp(); return fn(); };
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

/** A row's primary key as one string (albums by uri; a shelf row by its playlist and album, V7). */
export const pkOf = <K extends TableName>(t: K, row: Tables[K]): string => {
  if (t === 'albums') return (row as Tables['albums']).albumUri;
  if (t === 'shelves') { const s = row as Tables['shelves']; return `${s.playlistId} ${s.albumUri}`; }
  return (row as { id: string }).id;
};
const aad = (t: TableName, pk: string) => `${t}:${pk}`;
const tableOf = <K extends TableName>(db: FlowDB, t: K) => db.table(t) as unknown as Table<Tables[K], string>;
const table = <K extends TableName>(t: K) => tableOf(bookDb, t);

/** The tables a write opens its transaction over: its own, and in a world's notebook the outbox and what the outbox
 *  reads (src/db/outbox.ts), so what travels is recorded in the same transaction as the write. */
const scope = (tables: TableName[]): TableName[] => [...new Set([...tables, ...(split() ? WRITE_SCOPE : [])])];
/** Runs fn in one read-write transaction over scope(tables), on the notebook worn. */
const within = <T>(tables: TableName[], fn: () => Promise<T>): Promise<T> =>
  bookDb.transaction('rw', scope(tables).map(t => bookDb.table(t)), fn) as Promise<T>;

function strip<T>(row: T): T {
  const copy = { ...(row as Record<string, unknown>) };
  delete copy.sealed;
  delete copy.locked;
  return copy as T;
}

async function toStored<K extends TableName>(t: K, row: Tables[K], withKey: CryptoKey | null): Promise<Tables[K]> {
  let plain = strip(row);
  if (t === 'settings') plain = await settingsIn(plain as Settings) as Tables[K];
  const spec = SPECS[t] as Spec<Tables[K]> | undefined;
  if (!spec || !withKey) return plain;
  const { clear, secret } = spec.take(plain);
  const sealed: Sealed = await seal(withKey, secret, aad(t, pkOf(t, plain)));
  return { ...clear, sealed } as Tables[K];
}

async function fromStored<K extends TableName>(t: K, stored: Tables[K], withKey: CryptoKey | null): Promise<Read<Tables[K]>> {
  const out = await opened(t, stored, withKey);
  return t === 'settings' ? settingsOut(out as unknown as Read<Settings>) as unknown as Read<Tables[K]> : out;
}
async function opened<K extends TableName>(t: K, stored: Tables[K], withKey: CryptoKey | null): Promise<Read<Tables[K]>> {
  const env = (stored as { sealed?: unknown }).sealed;
  if (!isSealed(env)) return stored;
  const spec = SPECS[t] as Spec<Tables[K]>;
  const clear = strip(stored);
  // with a PIN change stopped partway, a world's row may still be sealed with the other key of the move, so both open it
  const keys = [withKey, ...(stopped ? [stopped.next, stopped.old] : [])].filter((k, i, a): k is CryptoKey => !!k && a.indexOf(k) === i);
  if (!keys.length) return { ...clear, locked: true } as Read<Tables[K]>;
  for (const [i, k] of keys.entries()) {
    try { return spec.give(clear, await unseal(k, env, aad(t, pkOf(t, clear)))); } catch (e) { if (i === keys.length - 1) throw e; }
  }
  throw new Error('unreachable');
}

export type KeyState = 'plain' | 'locked' | 'open';
export const keyState = (): KeyState => (key ? 'open' : lockEnabled ? 'locked' : 'plain');

// ---- the settings row, parted (PLAN-WORLDS.md section 3) ----

type Row = Record<string, unknown>;
const isBookKey = (k: string) => (BOOK_KEYS as readonly string[]).includes(k);
/** A row's book fields alone. */
const bookPart = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([k, v]) => isBookKey(k) && v !== undefined));
/** A row less its book fields. */
const homePart = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([k]) => !isBookKey(k)));
/** The lock a world keeps: a copy of home's, without a move under way. */
const stampOf = (l: Settings['lock'] | undefined): Settings['lock'] => {
  if (!l) return { enabled: false, relockAfterMin: 5 };
  const { moving: _m, ...rest } = l;
  return rest;
};

/** The settings row as the UI sees it: home's fields from home's row, the notebook's own from book's. One row when
 *  nothing is worn. */
async function readSettings(): Promise<Read<Settings> | undefined> {
  const h = await homeDb.settings.get('app');
  if (!split()) return h && fromStored('settings', h, key);
  if (!h) return undefined;
  const b = await bookDb.settings.get('app');
  const ho = await fromStored('settings', h, key);
  const bo = b ? await fromStored('settings', b, key) : undefined;
  const merged = { ...homePart(ho as Row), ...(bo ? bookPart(bo as Row) : {}), id: 'app' } as Read<Settings>;
  if (ho.locked || bo?.locked) merged.locked = true; else delete merged.locked;
  return merged;
}

/**
 * The lock's own fields (on, salt, iterations, verifier, digits, a move under way) are written only by setKey,
 * removeKey and unlock. A settings write from elsewhere carries a copy read earlier, so it keeps what is stored now and
 * may change only relockAfterMin; a stale copy can never turn the lock off over sealed rows. A world's row keeps its
 * stamp the same way.
 */
async function keepLock(db: FlowDB, s: Settings): Promise<Settings> {
  const stored = await db.settings.get(s.id);
  if (!stored) return s;
  const next = { ...s, lock: { ...stored.lock, relockAfterMin: s.lock?.relockAfterMin ?? stored.lock.relockAfterMin } };
  // the deleted ids (PLAN-SELF.md section 4, carried by PLAN-VALUES.md C0) only grow, so a stale copy can never drop one either
  const gone = [...new Set([...(stored.deleted ?? []), ...(s.deleted ?? [])])];
  if (gone.length) next.deleted = gone;
  return next;
}

/**
 * A notebook's cover is dress()'s alone to change (PLAN-WORLDS.md section 4): a settings write from elsewhere carries a
 * copy read before the last dress, so it keeps the cover stored on the row it lands on, plain paper included. A drawing
 * lives in the sealed secret, so the stored row is opened to find it. A row not yet stored takes the cover given.
 * A backup import writes its rows whole (backup.ts), so a file's cover still comes in.
 */
async function keepCover(db: FlowDB, s: Settings): Promise<Settings> {
  const stored = await db.settings.get(s.id);
  if (!stored) return s;
  const { cover } = await opened('settings', stored, key);
  const next = { ...s };
  if (cover) next.cover = cover; else delete next.cover;
  return next;
}

/** What a settings write puts where: one row when nothing is worn; with a world worn, home's row (its own book fields
 *  kept as they are) and the world's row (its stamp kept). Each comes back ready to seal. */
async function settingsWrites(given: Settings): Promise<[FlowDB, Settings][]> {
  // the notebook worn is the layer's to say (don, doff): a copy read before a world was put on never takes it off
  const s = { ...given };
  if (wornId) s.world = wornId; else delete s.world;
  if (!split()) return [[homeDb, await keepLock(homeDb, await keepCover(homeDb, s))]];
  const h = await homeDb.settings.get('app');
  const ho = h ? strip(await fromStored('settings', h, key)) : undefined;
  const homeRow = { ...(ho ? bookPart(ho as Row) : {}), ...homePart(s as Row), id: 'app' } as Settings;
  const b = await bookDb.settings.get('app');
  const bookRow = { ...bookPart(s as Row), id: 'app', lock: b?.lock ?? stampOf(h?.lock) } as Settings;
  return [[homeDb, await keepLock(homeDb, homeRow)], [bookDb, await keepLock(bookDb, await keepCover(bookDb, bookRow))]];
}

function writable() {
  if (keyState() === 'locked') throw new LockedError();
}

/** Reads over one database with the key in memory. */
const readerOf = (db: FlowDB, mergedSettings: boolean) => ({
  async get<K extends TableName>(t: K, id: string): Promise<Read<Tables[K]> | undefined> {
    if (t === 'settings' && mergedSettings) return readSettings() as Promise<Read<Tables[K]> | undefined>;
    const row = await tableOf(db, t).get(id);
    return row && fromStored(t, row, key);
  },
  async all<K extends TableName>(t: K): Promise<Read<Tables[K]>[]> {
    if (t === 'settings' && mergedSettings) { const s = await readSettings(); return (s ? [s] : []) as unknown as Read<Tables[K]>[]; }
    const rows = await tableOf(db, t).toArray();
    return Promise.all(rows.map(r => fromStored(t, r, key)));
  },
  /** Any Dexie query (an index range, a filter); the rows come back opened. */
  async query<K extends TableName>(t: K, build: (tb: Table<Tables[K], string>) => Collection<Tables[K], string>): Promise<Read<Tables[K]>[]> {
    const rows = await build(tableOf(db, t)).toArray();
    return Promise.all(rows.map(r => fromStored(t, r, key)));
  },
});
/** What reads another notebook (peek): get, all and query, its settings row its own. */
export type Reader = ReturnType<typeof readerOf>;

/** The reads and writes themselves, outside the queue: store wraps the writes in it, and store.unit hands these to a
 *  function already running in it, so its reads and writes are one unit. */
const direct = {
  get: <K extends TableName>(t: K, id: string) => readerOf(bookDb, true).get(t, id),
  all: <K extends TableName>(t: K) => readerOf(bookDb, true).all(t),
  query: <K extends TableName>(t: K, build: (tb: Table<Tables[K], string>) => Collection<Tables[K], string>) => readerOf(bookDb, true).query(t, build),
  async put<K extends TableName>(t: K, row: Tables[K]): Promise<void> {
    writable();
    if (t === 'settings') {
      for (const [db, r] of await settingsWrites(row as Settings)) await db.settings.put(await toStored('settings', r, key));
      return;
    }
    const stored = await toStored(t, row, key);
    await within([t], () => table(t).put(stored));
  },
  async bulkPut<K extends TableName>(t: K, rows: Tables[K][]): Promise<void> {
    writable();
    if (t === 'settings') { for (const r of rows) await direct.put(t, r); return; }
    const stored = await Promise.all(rows.map(r => toStored(t, r, key)));
    await within([t], () => table(t).bulkPut(stored));
  },
  /** Several writes in one transaction, all sealed first (WebCrypto cannot run inside an IndexedDB transaction).
   *  drops are primary keys deleted in that same transaction, after the writes. With a world worn, a settings row's
   *  home fields are written to home's row just after (a second database cannot join the transaction). */
  async many(writes: { [K in TableName]?: Tables[K][] }, drops: { [K in TableName]?: string[] } = {}): Promise<void> {
    writable();
    const db = bookDb;
    const after: Settings[] = [];
    const prepared = await Promise.all(
      (Object.keys(writes) as TableName[]).map(async t => {
        let rows = writes[t] as Tables[TableName][];
        if (t === 'settings') {
          const parts = (await Promise.all((rows as Settings[]).map(settingsWrites))).flat();
          after.push(...parts.filter(([d]) => d !== db).map(([, r]) => r));
          rows = parts.filter(([d]) => d === db).map(([, r]) => r) as Tables[TableName][];
        }
        return [t, await Promise.all(rows.map(r => toStored(t, r as never, key)))] as const;
      }),
    );
    const gone = (Object.keys(drops) as TableName[]).filter(t => drops[t]?.length);
    const tables = [...new Set([...prepared.map(([t]) => t), ...gone])];
    if (tables.length) {
      await db.transaction('rw', scope(tables).map(t => db.table(t)), async () => {
        for (const [t, rows] of prepared) await db.table(t).bulkPut(rows);
        for (const t of gone) await db.table(t).bulkDelete(drops[t]!);
      });
    }
    for (const r of after) await homeDb.settings.put(await toStored('settings', r, key));
  },
};
export type Unit = typeof direct;

/** The raw tables store.tx hands its function: clear fields only, never a sealed one. */
export type TxTables = <K extends TableName>(t: K) => Table<Tables[K], string>;

/**
 * Puts ids on the settings row's deleted list (PLAN-VALUES.md C0, from PLAN-SELF.md section 4), so a merge import
 * of an older backup never brings those rows back and drops links to them (backup.ts). For use inside store.tx with
 * 'settings' among its tables, in the same transaction as the delete itself. Any table's row id works; the list only
 * grows. A phone with no settings row yet has nothing to import over, so nothing is written. The list is the
 * notebook's own (book's row), which is the row tb('settings') is.
 */
export async function tombstone(tb: TxTables, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const settings = tb('settings');
  const s = await settings.get('app');
  if (!s) return;
  await settings.update('app', { deleted: [...new Set([...(s.deleted ?? []), ...ids])] });
}

export const store = {
  get: direct.get,
  all: direct.all,
  query: direct.query,
  put<K extends TableName>(t: K, row: Tables[K]): Promise<void> {
    return serial(() => direct.put(t, row));
  },
  bulkPut<K extends TableName>(t: K, rows: Tables[K][]): Promise<void> {
    return serial(() => direct.bulkPut(t, rows));
  },
  /** A read and the writes that follow from it as one unit in the write queue (PLAN-SELF.md section 4): fn reads and
   *  writes through u, the same calls as store's, and no other write can land between them. Refuses while locked. */
  unit<T>(fn: (u: Unit) => Promise<T>): Promise<T> {
    return serial(async () => {
      writable();
      return fn(direct);
    });
  },
  delete(t: TableName, id: string): Promise<void> {
    return serial(async () => {
      writable();
      await within([t], () => table(t).delete(id));
    });
  },
  /** Deletes by primary key; a compound key (a shelf row, V7) is an array. */
  bulkDelete(t: TableName, keys: IndexableType[]): Promise<void> {
    return serial(async () => {
      writable();
      await within([t], () => (bookDb.table(t) as Table<unknown, IndexableType>).bulkDelete(keys));
    });
  },
  /** Reads and writes of clear fields as one unit (PLAN-SELF.md section 4): fn runs in the write queue, inside one
   *  transaction over tables, on the raw tables. It may read rows, .delete() them (by key or by index), .modify()
   *  their clear fields (ids, links, status) and call tombstone(); it must never write a sealed field, and it cannot
   *  seal (WebCrypto does not run inside an IndexedDB transaction). A sealed row's AAD is its table and primary key
   *  alone (aad above), so a row whose clear fields were modified still opens. Refuses while locked. The tables are
   *  the notebook worn's, its settings row its own (tombstone). */
  tx<T>(tables: TableName[], fn: (tb: TxTables) => Promise<T>): Promise<T> {
    return serial(async () => {
      writable();
      const db = bookDb;
      return db.transaction('rw', scope(tables).map(t => db.table(t)), () => fn(<K extends TableName>(t: K) => tableOf(db, t)));
    });
  },
  /** Several writes in one transaction, all sealed first (direct.many), in the write queue. */
  many(writes: { [K in TableName]?: Tables[K][] }, drops: { [K in TableName]?: string[] } = {}): Promise<void> {
    return serial(() => direct.many(writes, drops));
  },
};

/**
 * A notebook handed to the bridge (PLAN-WORLDS.md section 5, W2): reads come back opened with the key in memory, and
 * writeDown writes what came DOWN from the bible (voices from characters, question pages from its questions) sealed like
 * any write, in the write queue, but in a transaction over its own tables only, never the outbox: what the bible sent
 * is never sent back as if he wrote it (src/db/outbox.ts acts only in a transaction that holds the outbox). Locked, the
 * reads come back marked locked and writeDown throws LockedError. src/bridge is given one of these for a world's
 * notebook and never the personal one.
 */
export function handed(target: FlowDB) {
  const tb = <K extends TableName>(t: K) => target.table(t) as unknown as Table<Tables[K], string>;
  return {
    name: target.name,
    db: target,
    async get<K extends TableName>(t: K, id: string): Promise<Read<Tables[K]> | undefined> {
      const row = await tb(t).get(id);
      return row && fromStored(t, row, key);
    },
    async many<K extends TableName>(t: K, ids: string[]): Promise<(Read<Tables[K]> | undefined)[]> {
      const rows = await tb(t).bulkGet(ids);
      return Promise.all(rows.map(r => (r ? fromStored(t, r, key) : undefined)));
    },
    async query<K extends TableName>(t: K, build: (tb: Table<Tables[K], string>) => Collection<Tables[K], string>): Promise<Read<Tables[K]>[]> {
      const rows = await build(tb(t)).toArray();
      return Promise.all(rows.map(r => fromStored(t, r, key)));
    },
    open: () => keyState() !== 'locked',
    writeDown(writes: { [K in TableName]?: Tables[K][] }): Promise<void> {
      return serial(async () => {
        writable();
        const tables = (Object.keys(writes) as TableName[]).filter(t => writes[t]?.length);
        if (tables.includes('outbox')) throw new Error('writeDown never writes the outbox');
        const prepared = await Promise.all(tables.map(async t => [t, await Promise.all((writes[t] as Tables[TableName][]).map(r => toStored(t, r as never, key)))] as const));
        if (!prepared.length) return;
        await target.transaction('rw', tables.map(t => target.table(t)), async () => {
          for (const [t, rows] of prepared) await target.table(t).bulkPut(rows);
        });
      });
    },
  };
}
export type Handed = ReturnType<typeof handed>;


// ---- the notebooks (PLAN-WORLDS.md section 3) ----

/** The world databases on this phone, by name (worn or not, in the registry or not). */
async function worldNames(): Promise<string[]> {
  const pre = worldDbName(homeDb.name, '');
  return (await Dexie.getDatabaseNames()).filter(n => n.startsWith(pre));
}

/** A world's database, opened once a session. */
async function dbNamed(name: string): Promise<FlowDB> {
  if (bookDb.name === name) return bookDb;
  let db = openWorlds.get(name);
  if (!db) { db = openDB(name); openWorlds.set(name, db); }
  if (!db.isOpen()) await db.open();
  return db;
}

/** A world's database, made with its own row when it is new: no seeds (a world seeds nothing, section 3), only the
 *  notebook's seededAt and the stamp of the lock in force, so its rows are sealed with the key every other notebook is. */
async function openWorld(worldId: string): Promise<FlowDB> {
  const db = await dbNamed(worldDbName(homeDb.name, worldId));
  if (!(await db.settings.get('app'))) {
    const h = await homeDb.settings.get('app');
    await db.settings.put({ id: 'app', lock: stampOf(h?.lock), seededAt: Date.now() } as Settings);
  }
  return db;
}

/** Writes the notebook worn on home's row, for reopening: a clear field, written even while locked (the door). */
async function markWorn(worldId: string | null) {
  if (await homeDb.settings.get('app')) await homeDb.settings.update('app', { world: worldId ?? undefined });
}

/** Points the layer at a database (tests use a fresh one each) and reads whether the lock is on. The notebook left
 *  worn (home's world) is worn again: the app reopens in the world it was left in (decision 3). */
export async function init(target: FlowDB = defaultDb): Promise<void> {
  homeDb = target;
  bookDb = target;
  wornId = null;
  key = null;
  stopped = null;
  queue = Promise.resolve();
  const s = await target.settings.get('app');
  lockEnabled = !!s?.lock.enabled;
  if (s?.world) {
    bookDb = await openWorld(s.world);
    wornId = s.world;
  }
}

const wornListeners = new Set<(worldId: string | null) => void>();
/** Hears every don and doff once it has happened (the bridge fetches a world's pocket on donning, W2). */
export function onWorn(fn: (worldId: string | null) => void): () => void {
  wornListeners.add(fn);
  return () => { wornListeners.delete(fn); };
}
const tellWorn = () => { const w = wornId; setTimeout(() => wornListeners.forEach(fn => fn(w)), 0); };

/** Puts a world's notebook on: every table now reads and writes its database. The key stays in memory (unlike init);
 *  a world left plain by a stop halfway through setting the lock is sealed with it first. */
export function don(worldId: string): Promise<void> {
  return serial(async () => {
    const db = await openWorld(worldId);
    if (key) await unheard(() => settle(db, [key!]));
    bookDb = db;
    wornId = worldId;
    await markWorn(worldId);
    tellWorn();
  });
}

/** Takes the world off: his own pages again. The key stays in memory. */
export function doff(): Promise<void> {
  return serial(async () => {
    bookDb = homeDb;
    wornId = null;
    await markWorn(null);
    tellWorn();
  });
}

/** Reads another notebook without putting it on (the shelf: the last line written in it, its cover): null is his own
 *  pages, an id a world's. Its settings row is its own. undefined when that world has no database yet. */
export async function peek<T>(worldId: string | null, fn: (r: Reader) => Promise<T>): Promise<T | undefined> {
  const name = worldId === null ? homeDb.name : worldDbName(homeDb.name, worldId);
  if (worldId !== null && name !== bookDb.name && !(await worldNames()).includes(name)) return undefined;
  const db = worldId === null ? homeDb : await dbNamed(name);
  return fn(readerOf(db, false));
}

/** Dresses a notebook's cover (PLAN-WORLDS.md section 4): albums, a drawing, or plain paper (undefined), on that
 *  notebook's own row whether it is worn or not, sealed like the rest of the row. Refuses while locked. */
export function dress(worldId: string | null, cover: Settings['cover']): Promise<void> {
  return serial(async () => {
    writable();
    const db = worldId === null ? homeDb : await openWorld(worldId);
    const row = await db.settings.get('app');
    if (!row) return;
    const open = strip(await fromStored('settings', row, key)) as Settings;
    const next = { ...open };
    if (cover) next.cover = cover; else delete next.cover;
    await db.settings.put(await toStored('settings', next, key));
  });
}

// ---- the key across every notebook (PLAN-WORLDS.md section 3) ----
//
// Every notebook's rows are sealed with the one key. Home's row holds the lock; each world's row holds a stamp, a copy
// of the lock its own rows were sealed with, so which key opens a notebook is always known (settle, keyOpening).
// IndexedDB cannot hold one transaction across databases, so a PIN change is made safe to stop halfway instead:
//   1. home's row gets lock.moving: the new lock, the old one (was), the new key sealed under the old and the old
//      under the new;
//   2. home is rewritten with the new key (its lock the new one, the move still on it); then each world, each in its
//      own transaction with its new stamp;
//   3. the move is cleared.
// A stop anywhere in that leaves every notebook whole under one key or the other, and the next unlock with either PIN
// opens the other key from the move and finishes it (unlock). Setting the first PIN seals home first and then the
// worlds; removing it unseals the worlds first and home last. A stop in either leaves a world plain while home is
// locked, and the next unlock seals it again (settle), so no world stays readable without the key once he opens it.
// A notebook neither key opens is left exactly as it is: nothing is ever wiped.

/** The key among these that opens a database: its row's lock says which (null when its rows are plain). undefined
 *  when none of them does. */
async function keyOpening(db: FlowDB, keys: CryptoKey[]): Promise<CryptoKey | null | undefined> {
  const s = await db.settings.get('app');
  const v = s?.lock?.enabled ? s.lock.verifier : undefined;
  if (!v) return null;
  for (const k of keys) if (await checkVerifier(k, v)) return k;
  return undefined;
}

/** Re-reads every secret row of a database with one key and writes it back sealed with the next (plain when next is
 *  null), its settings row taking the lock given, all in one transaction. */
async function rewriteDb(db: FlowDB, from: CryptoKey | null, next: CryptoKey | null, lock: Settings['lock']): Promise<void> {
  const prepared: [TableName, unknown[]][] = [];
  for (const t of SECRET_TABLES) {
    const rows = await tableOf(db, t).toArray();
    const out = [];
    for (const r of rows) {
      let row = (await fromStored(t, r, from)) as Tables[TableName];
      if (t === 'settings') row = { ...(row as Settings), lock };
      out.push(await toStored(t, row, next));
    }
    prepared.push([t, out]);
  }
  // over the sealed tables only, never the outbox: a PIN change re-seals rows, it is not a write of his to send
  await db.transaction('rw', prepared.map(([t]) => db.table(t)), async () => {
    for (const [t, rows] of prepared) await db.table(t).bulkPut(rows);
  });
}

/** One world brought to the key in force: whichever of keys opens it is read, and it is sealed with keys[last]...
 *  keys[0] is the key in force; any other is a key it may still be sealed with (a move under way). */
async function settle(db: FlowDB, keys: CryptoKey[]): Promise<void> {
  const h = await homeDb.settings.get('app');
  if (!h?.lock.enabled) return;
  const from = await keyOpening(db, keys);
  if (from === undefined || from === keys[0]) return;
  await rewriteDb(db, from, keys[0], stampOf(h.lock));
}

/** Finishes a move to next from old: home first when it is not yet there, then every world, then the move is cleared. */
async function finishMove(old: CryptoKey | null, next: CryptoKey, target: Settings['lock']): Promise<void> {
  const keys = old ? [next, old] : [next];
  const fromHome = await keyOpening(homeDb, keys);
  if (fromHome === undefined) throw new Error('Home opens with neither key');
  if (fromHome !== next) await rewriteDb(homeDb, fromHome, next, target);
  for (const name of await worldNames()) {
    const db = await dbNamed(name);
    const from = await keyOpening(db, keys);
    if (from === undefined || from === next) continue;
    await rewriteDb(db, from, next, stampOf(target));
  }
  if (target.moving) await homeDb.settings.update('app', { 'lock.moving': undefined } as never);
}

/** The lock a move goes to, from the move itself. */
const lockFromMove = (m: LockMove, relockAfterMin: number): Settings['lock'] => {
  const l: Settings['lock'] = { enabled: true, salt: m.salt, iterations: m.iterations, verifier: m.verifier, relockAfterMin, moving: m };
  if (m.digits) l.digits = m.digits;
  return l;
};

/**
 * Sets (or changes) the key and re-encrypts every existing row in every notebook, home first, a transaction each, as
 * the comment above says. The lock settings (salt, iterations) are written with home's rows and a fresh verifier,
 * so no notebook is ever half sealed. Package 6 calls this after the PIN is chosen.
 */
export type LockSpec = { salt: string; iterations: number; relockAfterMin?: number; digits?: number };
export function setKey(next: CryptoKey, lock: LockSpec): Promise<void> {
  return serial(() => unheard(async () => {
    writable();
    const old = key;
    const was = (await homeDb.settings.get('app'))?.lock ?? { enabled: false, relockAfterMin: 5 };
    const verifier = await makeVerifier(next);
    const fields: LockFields = { salt: lock.salt, iterations: lock.iterations, verifier };
    const digits = lock.digits ?? was.digits;
    if (digits) fields.digits = digits;
    const target: Settings['lock'] = { ...stampOf(was), enabled: true, ...fields, relockAfterMin: lock.relockAfterMin ?? was.relockAfterMin };
    if (old && was.enabled && was.salt && was.verifier) {
      const before: LockFields = { salt: was.salt, iterations: was.iterations ?? 0, verifier: was.verifier, ...(was.digits ? { digits: was.digits } : {}) };
      const moving: LockMove = {
        ...fields, was: before,
        wrapNew: await seal(old, await rawKey(next), 'moving-new'),
        wrapOld: await seal(next, await rawKey(old), 'moving-old'),
      };
      await homeDb.settings.update('app', { 'lock.moving': moving } as never);
      target.moving = moving;
    }
    try {
      await finishMove(old, next, target);
    } catch (e) {
      // stopped at a world after home was rewritten: home opens only with the new key now, so the session goes on with
      // it, and the worlds left behind are read with either key and finished by the next write (catchUp)
      if ((await keyOpening(homeDb, [next])) === next) { key = next; lockEnabled = true; stopped = { old, next, target }; }
      throw e;
    }
    key = next;
    lockEnabled = true;
  }));
}

/** Tries again to finish a PIN change stopped partway in this session (stopped); a stop again leaves it for the next job. */
async function catchUp(): Promise<void> {
  const s = stopped;
  if (!s || key !== s.next) return;
  try {
    await unheard(() => finishMove(s.old, s.next, s.target));
    stopped = null;
  } catch { /* still stopped: the next job tries again, and a restart's unlock finishes it */ }
}

/** Turns the lock off: every row of every notebook is written back as plain text, the worlds first and home last. */
export function removeKey(): Promise<void> {
  return serial(() => unheard(async () => {
    writable();
    const h = await homeDb.settings.get('app');
    const off: Settings['lock'] = { enabled: false, relockAfterMin: h?.lock.relockAfterMin ?? 5 };
    const keys = key ? [key] : [];
    for (const name of await worldNames()) {
      const db = await dbNamed(name);
      const from = await keyOpening(db, keys);
      if (from === undefined) continue;
      await rewriteDb(db, from, null, off);
    }
    await rewriteDb(homeDb, key, null, off);
    key = null;
    lockEnabled = false;
  }));
}

/** Checks a derived key against the stored verifier and keeps it in memory if it fits. With a PIN change stopped
 *  halfway, either PIN opens the notebook and the change is finished first; every world is brought to the key. */
export function unlock(candidate: CryptoKey): Promise<boolean> {
  return serial(() => unheard(async () => {
    const s = await homeDb.settings.get('app');
    const l = s?.lock;
    if (!l?.verifier) return false;
    const m = l.moving;
    const fits = (v?: Sealed) => (v ? checkVerifier(candidate, v) : Promise.resolve(false));
    let old: CryptoKey | null = null, next: CryptoKey | null = null;
    if (await fits(l.verifier)) {
      if (!m) {
        key = candidate;
        lockEnabled = true;
        for (const name of await worldNames()) await settle(await dbNamed(name), [candidate]);
        return true;
      }
      // the new PIN with home already moved, or the old one with home not yet moved
      if (await fits(m.verifier)) { next = candidate; old = await keyFromRaw(await unseal(candidate, m.wrapOld, 'moving-old')); }
      else { old = candidate; next = await keyFromRaw(await unseal(candidate, m.wrapNew, 'moving-new')); }
    } else if (m && (await fits(m.verifier))) {
      next = candidate; old = await keyFromRaw(await unseal(candidate, m.wrapOld, 'moving-old'));
    } else if (m && (await fits(m.was.verifier))) {
      old = candidate; next = await keyFromRaw(await unseal(candidate, m.wrapNew, 'moving-new'));
    } else return false;
    await finishMove(old, next, lockFromMove(m!, l.relockAfterMin));
    key = next;
    lockEnabled = true;
    return true;
  }));
}

/** The salts a PIN may have been chosen with: the lock's, and while a change is under way, the move's two. */
export function lockSalts(l: Settings['lock']): { salt: string; iterations?: number }[] {
  const out: { salt: string; iterations?: number }[] = [];
  if (l.salt) out.push({ salt: l.salt, iterations: l.iterations });
  if (l.moving) {
    for (const x of [l.moving, l.moving.was]) if (!out.some(o => o.salt === x.salt)) out.push({ salt: x.salt, iterations: x.iterations });
  }
  return out;
}

/** Opens a row as stored with a given key (an imported file's own); plain rows come back as they are. */
export async function openRow<K extends TableName>(t: K, stored: Tables[K], withKey: CryptoKey | null): Promise<Read<Tables[K]>> {
  return fromStored(t, stored, withKey);
}

/** A plain row as this journal would store it now: sealed with the key in memory, or plain with the lock off. */
export async function storedForm<K extends TableName>(t: K, row: Tables[K]): Promise<Tables[K]> {
  writable();
  return toStored(t, row, key);
}

/** Drops the key from memory (relock). Rows stay sealed in every notebook; reads come back marked locked. */
export function lock(): void {
  key = null;
  stopped = null;
}
