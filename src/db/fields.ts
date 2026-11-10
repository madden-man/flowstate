// The one typed door to the database (PLAN.md section 7). Every secret text field is written and read
// here, so no UI code ever touches a stored string:
//   messages.text (and its revisions' text), items.text, leans.note, paradoxes.*.aspect and middle.scenario (revisions too),
//   pages.title (a question is Tommy's own text; decided at review of PR #1), settings.spotify.tokens,
//   flows: name, line, restLine, every step's name, line, said, usual, usualShort, tips (text, short, person), picks and onLine, the revisions'
//   names and steps, and the notes' text (PLAN-FLOWS.md section 5); episodes: the Five lines, the prediction's text and the On pick's title;
//   fixations: name and next (PLAN-ENERGIZE.md section 5).
// With no key the layer stores plain text. Once a key is set (package 6 adds the keypad) each record's
// secret fields are sealed together with AES-GCM, and setKey() re-encrypts every existing row in place.
// Ids, dates, tags, colours and voice names stay clear so lists can render before unlock.
import type { Collection, IndexableType, Table } from 'dexie';
import { db as defaultDb, type FlowDB, type Settings, type TableName, type Tables, TABLES, type Sealed } from './schema';
import { seal, unseal, makeVerifier, checkVerifier, isSealed } from './crypto';

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

const settingsSpec: Spec<Settings> = {
  take: row => {
    const { spotify, ...rest } = row;
    const clear: Settings = spotify ? { ...rest, spotify: { connectedAt: spotify.connectedAt } } : { ...rest };
    return { clear, secret: spotify?.tokens ?? null };
  },
  give: (clear, secret) =>
    secret ? { ...clear, spotify: { ...clear.spotify, tokens: secret as NonNullable<Settings['spotify']>['tokens'] } } : clear,
};

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
};
export const SECRET_TABLES = Object.keys(SPECS) as TableName[];

/** A row as the UI sees it. locked is true when it was read while the key is out of memory. */
export type Read<T> = T & { locked?: true };

let database: FlowDB = defaultDb;
let key: CryptoKey | null = null;
let lockEnabled = false;
let queue: Promise<unknown> = Promise.resolve();

/** Writes and the re-encrypt pass run one at a time, so no write lands between a read and its rewrite. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
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
const table = <K extends TableName>(t: K) => database.table(t) as unknown as Table<Tables[K], string>;

function strip<T>(row: T): T {
  const copy = { ...(row as Record<string, unknown>) };
  delete copy.sealed;
  delete copy.locked;
  return copy as T;
}

async function toStored<K extends TableName>(t: K, row: Tables[K], withKey: CryptoKey | null): Promise<Tables[K]> {
  const plain = strip(row);
  const spec = SPECS[t] as Spec<Tables[K]> | undefined;
  if (!spec || !withKey) return plain;
  const { clear, secret } = spec.take(plain);
  const sealed: Sealed = await seal(withKey, secret, aad(t, pkOf(t, plain)));
  return { ...clear, sealed } as Tables[K];
}

async function fromStored<K extends TableName>(t: K, stored: Tables[K], withKey: CryptoKey | null): Promise<Read<Tables[K]>> {
  const env = (stored as { sealed?: unknown }).sealed;
  if (!isSealed(env)) return stored;
  const spec = SPECS[t] as Spec<Tables[K]>;
  const clear = strip(stored);
  if (!withKey) return { ...clear, locked: true } as Read<Tables[K]>;
  return spec.give(clear, await unseal(withKey, env, aad(t, pkOf(t, clear))));
}

export type KeyState = 'plain' | 'locked' | 'open';
export const keyState = (): KeyState => (key ? 'open' : lockEnabled ? 'locked' : 'plain');

/** Points the layer at a database (tests use a fresh one each) and reads whether the lock is on. */
export async function init(target: FlowDB = defaultDb): Promise<void> {
  database = target;
  key = null;
  queue = Promise.resolve();
  const s = await target.settings.get('app');
  lockEnabled = !!s?.lock.enabled;
}

/**
 * The lock's own fields (on, salt, iterations, verifier, digits) are written only by setKey and removeKey.
 * A settings write from elsewhere carries a copy read earlier, so it keeps what is stored now and may
 * change only relockAfterMin; a stale copy can never turn the lock off over sealed rows.
 */
async function keepLock<K extends TableName>(t: K, rows: Tables[K][]): Promise<Tables[K][]> {
  if (t !== 'settings') return rows;
  return Promise.all(rows.map(async r => {
    const s = r as Settings;
    const stored = await database.settings.get(s.id);
    if (!stored) return r;
    return { ...s, lock: { ...stored.lock, relockAfterMin: s.lock?.relockAfterMin ?? stored.lock.relockAfterMin } } as Tables[K];
  }));
}

function writable() {
  if (keyState() === 'locked') throw new LockedError();
}

export const store = {
  async get<K extends TableName>(t: K, id: string): Promise<Read<Tables[K]> | undefined> {
    const row = await table(t).get(id);
    return row && fromStored(t, row, key);
  },
  async all<K extends TableName>(t: K): Promise<Read<Tables[K]>[]> {
    const rows = await table(t).toArray();
    return Promise.all(rows.map(r => fromStored(t, r, key)));
  },
  /** Any Dexie query (an index range, a filter); the rows come back opened. */
  async query<K extends TableName>(t: K, build: (tb: Table<Tables[K], string>) => Collection<Tables[K], string>): Promise<Read<Tables[K]>[]> {
    const rows = await build(table(t)).toArray();
    return Promise.all(rows.map(r => fromStored(t, r, key)));
  },
  put<K extends TableName>(t: K, row: Tables[K]): Promise<void> {
    return serial(async () => {
      writable();
      const [kept] = await keepLock(t, [row]);
      await table(t).put(await toStored(t, kept, key));
    });
  },
  bulkPut<K extends TableName>(t: K, rows: Tables[K][]): Promise<void> {
    return serial(async () => {
      writable();
      const stored = await Promise.all((await keepLock(t, rows)).map(r => toStored(t, r, key)));
      await table(t).bulkPut(stored);
    });
  },
  delete(t: TableName, id: string): Promise<void> {
    return serial(async () => {
      writable();
      await table(t).delete(id);
    });
  },
  /** Deletes by primary key; a compound key (a shelf row, V7) is an array. */
  bulkDelete(t: TableName, keys: IndexableType[]): Promise<void> {
    return serial(async () => {
      writable();
      await (database.table(t) as Table<unknown, IndexableType>).bulkDelete(keys);
    });
  },
  /** Several writes in one transaction, all sealed first (WebCrypto cannot run inside an IndexedDB transaction). */
  many(writes: { [K in TableName]?: Tables[K][] }): Promise<void> {
    return serial(async () => {
      writable();
      const prepared = await Promise.all(
        (Object.keys(writes) as TableName[]).map(async t => [t, await Promise.all((await keepLock(t, writes[t] as Tables[TableName][])).map(r => toStored(t, r as never, key)))] as const),
      );
      await database.transaction('rw', prepared.map(([t]) => database.table(t)), async () => {
        for (const [t, rows] of prepared) await database.table(t).bulkPut(rows);
      });
    });
  },
};

/** Re-reads every secret row with the current key and writes it back sealed with next (or plain when next is null). */
async function rewriteAll(next: CryptoKey | null, settingsPatch: (s: Settings) => Settings): Promise<void> {
  const prepared: [TableName, unknown[]][] = [];
  for (const t of SECRET_TABLES) {
    const rows = await table(t).toArray();
    const out = [];
    for (const r of rows) {
      let opened = (await fromStored(t, r, key)) as Tables[TableName];
      if (t === 'settings') opened = settingsPatch(opened as Settings);
      out.push(await toStored(t, opened, next));
    }
    prepared.push([t, out]);
  }
  await database.transaction('rw', TABLES.map(t => database.table(t)), async () => {
    for (const [t, rows] of prepared) await database.table(t).bulkPut(rows);
  });
}

/**
 * Sets (or changes) the key and re-encrypts every existing row in place, in one transaction.
 * The lock settings (salt, iterations) are written in that same transaction with a fresh verifier,
 * so the database is never half sealed. Package 6 calls this after the PIN is chosen.
 */
export type LockSpec = { salt: string; iterations: number; relockAfterMin?: number; digits?: number };
export function setKey(next: CryptoKey, lock: LockSpec): Promise<void> {
  return serial(async () => {
    writable();
    const verifier = await makeVerifier(next);
    await rewriteAll(next, s => ({
      ...s,
      lock: {
        ...s.lock, enabled: true, salt: lock.salt, iterations: lock.iterations, verifier,
        relockAfterMin: lock.relockAfterMin ?? s.lock.relockAfterMin,
        digits: lock.digits ?? s.lock.digits,
      },
    }));
    key = next;
    lockEnabled = true;
  });
}

/** Turns the lock off: every row is written back as plain text. */
export function removeKey(): Promise<void> {
  return serial(async () => {
    writable();
    await rewriteAll(null, s => ({ ...s, lock: { enabled: false, relockAfterMin: s.lock.relockAfterMin } }));
    key = null;
    lockEnabled = false;
  });
}

/** Checks a derived key against the stored verifier and keeps it in memory if it fits. */
export async function unlock(candidate: CryptoKey): Promise<boolean> {
  const s = await database.settings.get('app');
  const v = s?.lock.verifier;
  if (!v || !(await checkVerifier(candidate, v))) return false;
  key = candidate;
  lockEnabled = true;
  return true;
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

/** Drops the key from memory (relock). Rows stay sealed; reads come back marked locked. */
export function lock(): void {
  key = null;
}
