// Export and import (PLAN.md section 7). One JSON file: every table, the schema version, exportedAt.
// Rows are written as stored, so with the lock on every sealed row stays sealed in the file and the
// header carries what it takes to open them with the PIN (salt, iterations, the verifier), never a key.
// Import opens a sealed file with that file's own PIN, then stores every row the way this journal
// stores rows now: sealed with the current key, or plain when the lock is off.
// A merge import honours this phone's deleted list (settings.deleted, PLAN-VALUES.md C0): what was deleted stays deleted.
import { db as defaultDb, type FlowDB, SCHEMA_VERSION, TABLES, type TableName, type Tables, type Sealed, type Settings, POEMS_ID, poemsPlaylist, shelvesFromV1, coverBytes, valueFromParadox, withSeedChakra, MOUNTAIN_VERSION, VALUES_VERSION } from './schema';
import { isSealed, toB64, fromB64, checkVerifier } from './crypto';
import { keyState, LockedError, openRow, storedForm } from './fields';

export const BACKUP_APP = 'flowstate';

export type BackupFile = {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: number;
  /** Set when the journal had a PIN: the sealed rows open with a key derived from it (package 6). */
  encrypted?: true;
  salt?: string;
  iterations?: number;
  verifier?: Sealed;
  digits?: number;
  tables: { [K in TableName]: unknown[] };
  /** Set by parseBackup on a file older than this version: the version it was made at, so importData can give it what
   *  only an open journal can (a version 5 file's paradoxes as values, PLAN-VALUES.md section 5). Never exported. */
  madeAt?: number;
};

/** What it takes to open a sealed file: its own salt and iteration count, and its verifier to check a PIN. */
export type FileLock = { salt: string; iterations: number; verifier: Sealed; digits?: number };

export class BackupError extends Error {
  constructor(message: string) { super(message); this.name = 'BackupError'; }
}

/** The file is sealed with a PIN, and no key for it was given: ask for that file's PIN. */
export class NeedsPinError extends BackupError {
  constructor() { super('This file is locked with a PIN'); this.name = 'NeedsPinError'; }
}

/** A row's key as one string: albums by uri, a shelf row by its playlist and album (V7), the rest by id. */
const pk = (t: TableName, row: Record<string, unknown>) => {
  if (t === 'albums') return String(row.albumUri);
  if (t === 'shelves') return row.playlistId === undefined || row.albumUri === undefined ? 'undefined' : `${row.playlistId} ${row.albumUri}`;
  return String(row.id);
};

/**
 * How a row points at another, for the deleted list (PLAN-VALUES.md C0, from PLAN-SELF.md section 4). owner: the row
 * belongs to the one named, and goes with it (a paradox's goals and leans). link: a single id, dropped from the row.
 * links: a list of ids, the deleted ones filtered out. inner (PLAN-VALUES.md C1): an object field holding an id under
 * the key named, the whole field dropped when that id is deleted (a line's `for`, whose valueId names a value). All
 * are clear fields of the stored form. A row whose own key is deleted never comes back whatever its table.
 */
export const LINKS: { [K in TableName]?: { owner?: string[]; link?: string[]; links?: string[]; inner?: Record<string, string> } } = {
  items: { owner: ['paradoxId'], link: ['pairId', 'nextTo'] },
  leans: { owner: ['paradoxId'] },
  pages: { links: ['paradoxIds', 'valueIds'] },
  messages: { inner: { for: 'valueId' } },
};

/** Album covers are bytes (a Blob in rows from before V9); the file carries them as base64 with their type. */
type CoverJSON = { type: string; b64: string };
async function coverOut(c: Blob | ArrayBuffer, type?: string): Promise<CoverJSON> {
  return { type: type ?? (c instanceof Blob ? c.type : '') ?? '', b64: toB64(await coverBytes(c)) };
}
const coverIn = (c: CoverJSON) => { const b = fromB64(c.b64); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

export async function exportData(database: FlowDB = defaultDb, now = Date.now()): Promise<BackupFile> {
  const tables = {} as BackupFile['tables'];
  await database.transaction('r', TABLES.map(t => database.table(t)), async () => {
    for (const t of TABLES) tables[t] = await database.table(t).toArray();
  });
  tables.albums = await Promise.all(
    (tables.albums as Tables['albums'][]).map(async a => (a.cover ? { ...a, cover: await coverOut(a.cover, a.coverType), coverType: undefined } : a)),
  );
  const lock = (tables.settings as Settings[]).find(r => r.id === 'app')?.lock;
  const sealedRows = TABLES.some(t => (tables[t] as Record<string, unknown>[]).some(r => isSealed(r.sealed)));
  const header = lock?.enabled && lock.salt && lock.verifier && sealedRows
    ? { encrypted: true as const, salt: lock.salt, iterations: lock.iterations ?? 0, verifier: lock.verifier, ...(lock.digits ? { digits: lock.digits } : {}) }
    : {};
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now, ...header, tables };
}

/** The file's lock when any of its rows are sealed; null for a plain file. A sealed file with no usable header is damaged. */
export function fileLock(file: BackupFile): FileLock | null {
  const hasSealed = TABLES.some(t => (file.tables[t] as Record<string, unknown>[]).some(r => isSealed(r.sealed)));
  if (!hasSealed) return null;
  if (typeof file.salt !== 'string' || typeof file.iterations !== 'number' || file.iterations < 1 || !isSealed(file.verifier))
    throw new BackupError('This file is locked, and its lock is damaged');
  return { salt: file.salt, iterations: file.iterations, verifier: file.verifier, digits: file.digits };
}

/** True when the key opens this file (it was derived from the file's PIN with the file's salt). */
export async function fileKeyFits(file: BackupFile, fileKey: CryptoKey): Promise<boolean> {
  const fl = fileLock(file);
  return !!fl && checkVerifier(fileKey, fl.verifier);
}

export const fileName = (now = new Date()) =>
  `flowstate-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;

/** Validates the shape and the version. Throws BackupError with a plain reason. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new BackupError('Not a FlowState file'); }
  const f = data as Partial<BackupFile>;
  if (!f || f.app !== BACKUP_APP || typeof f.tables !== 'object' || !f.tables) throw new BackupError('Not a FlowState file');
  if (typeof f.schemaVersion !== 'number' || !Number.isInteger(f.schemaVersion) || f.schemaVersion < 1) throw new BackupError('No schema version');
  if (f.schemaVersion > SCHEMA_VERSION) throw new BackupError('Made by a newer FlowState');
  for (const t of TABLES) {
    const rows = (f.tables as Record<string, unknown>)[t];
    if (rows === undefined) (f.tables as Record<string, unknown[]>)[t] = [];
    else if (!Array.isArray(rows) || rows.some(r => !r || typeof r !== 'object' || !pk(t, r as Record<string, unknown>) || pk(t, r as Record<string, unknown>) === 'undefined'))
      throw new BackupError(`Damaged table: ${t}`);
  }
  return migrate(f as BackupFile);
}

/** Older files are brought up to the current version here. A version 1 file (one playlist) gets what the
 *  Dexie upgrade gives a version 1 database: its ordered albums as the Poems playlist's shelf, and that
 *  playlist ticked. A version 2 file has no flows or episodes (both tables come in empty, above); its settings
 *  row has no flowsSeeded, so seed.ts seedFlowsOnce writes the seed flows on the next open. A version 4 file has no
 *  fixations (the table comes in empty, above); its settings.cleaned has no 'fixations', so seed.ts seedFixationsOnce
 *  writes the first three and the deck on the next open (PLAN-ENERGIZE.md section 5). A version 5 file has no values
 *  (the table comes in empty, above); its paradoxes are opened only in importData, which makes them values there
 *  (madeAt says it is older). A file from before MOUNTAIN_VERSION (a version 6 file included) has no readings (the
 *  table comes in empty, above) and its seed flows have no chakra: each gets its sign here, as the Dexie upgrade gives a
 *  stored one (PLAN-MOUNTAIN.md section 8); only that clear field is added, so a sealed row still opens. A file from
 *  before TASKS_VERSION (version 7) has no signs' shelves, marks or days (the tables come in empty, above): each shelf
 *  reads as its starters (model/acts.ts), as on a phone upgraded from version 7. A file from before RESEARCH_VERSION
 *  (version 8) has no inquiries or papers (the tables come in empty, above) and no settings.research: Research sends
 *  nothing until a key is pasted again (PLAN-RESEARCH.md section 5). A newer file carries the key sealed in its
 *  settings row, as the Spotify tokens travel; a merge keeps this phone's settings, so its key with them. */
function migrate(f: BackupFile): BackupFile {
  if (f.schemaVersion < 2) {
    const tables = { ...f.tables };
    const albums = tables.albums as Tables['albums'][];
    if (!tables.shelves.length) tables.shelves = shelvesFromV1(albums);
    if (!(tables.playlists as Tables['playlists'][]).some(p => p.id === POEMS_ID)) tables.playlists = [...tables.playlists, poemsPlaylist()];
    f = { ...f, tables };
  }
  if (f.schemaVersion < MOUNTAIN_VERSION) {
    f = { ...f, tables: { ...f.tables, flows: (f.tables.flows as Tables['flows'][]).map(withSeedChakra) } };
  }
  return { ...f, schemaVersion: SCHEMA_VERSION, ...(f.schemaVersion < SCHEMA_VERSION ? { madeAt: f.madeAt ?? f.schemaVersion } : {}) };
}

/** The time a row last changed, for merge: updatedAt, else at, else its newest revision, else createdAt, else an
 *  episode's last touch, else when a question was asked (a re-asked one carries the new time) or a paper fetched
 *  (PLAN-RESEARCH.md section 5). */
export function stamp(row: Record<string, unknown>): number {
  if (typeof row.updatedAt === 'number') return row.updatedAt;
  if (typeof row.at === 'number') return row.at;
  const revs = row.revisions as { at: number }[] | undefined;
  if (Array.isArray(revs) && revs.length) return Math.max(...revs.map(r => r.at));
  if (typeof row.createdAt === 'number') return row.createdAt;
  // an episode (F1): its last touch, the end or the newest mark or tick, else its start
  if (typeof row.startedAt === 'number') {
    const marks = [...(row.marks as { at: number }[] | undefined ?? []), ...(row.done as { at: number }[] | undefined ?? [])];
    return Math.max(row.startedAt, typeof row.endedAt === 'number' ? row.endedAt : 0, ...marks.map(m => m.at));
  }
  if (typeof row.askedAt === 'number') return row.askedAt;
  if (typeof row.fetchedAt === 'number') return row.fetchedAt;
  return 0;
}

export type ImportMode = 'replace' | 'merge';
export type ImportResult = { added: number; updated: number; kept: number };

/**
 * replace: the database becomes the file.
 * merge: keyed on id; a row in the file wins only when it is newer (stamp). Settings stay this phone's,
 * except where this phone has none. A row whose key is on this phone's deleted list (settings.deleted) is never
 * brought back, nor a row it owns, and links in the file to a deleted one are dropped (LINKS). The file's own list is
 * not merged: merge never deletes this phone's rows, so the list only guards against older files. Replace takes the
 * file's list with the rest of its settings row, and a file with no settings row clears it: the file's rows come back.
 */
export async function importData(file: BackupFile, mode: ImportMode, database: FlowDB = defaultDb, fileKey?: CryptoKey): Promise<ImportResult> {
  // Locked, there is no key to store the rows with; the gate keeps the UI from ever getting here.
  if (keyState() === 'locked') throw new LockedError();
  const fl = fileLock(file);
  if (fl) {
    if (!fileKey) throw new NeedsPinError();
    if (!(await checkVerifier(fileKey, fl.verifier))) throw new BackupError('Not that one');
  }
  // This phone's lock stays this phone's: a file's lock settings never replace the ones its rows are sealed with now.
  const mine = await database.settings.get('app');
  const myLock = mine?.lock;
  const gone = new Set(mode === 'merge' ? mine?.deleted ?? [] : []);
  const incoming = {} as { [K in TableName]: Record<string, unknown>[] };
  const openedParadoxes: (Tables['paradoxes'] & { locked?: true })[] = [];
  for (const t of TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (const r of file.tables[t] as Record<string, unknown>[]) {
      let row = t === 'albums' && r.cover && typeof r.cover === 'object' && 'b64' in (r.cover as object) ? { ...r, cover: coverIn(r.cover as CoverJSON), coverType: (r.cover as CoverJSON).type || undefined } : r;
      // open with the file's key (a wrong one throws before anything is written), then store as this journal stores rows
      let opened = (await openRow(t, row as never, fileKey ?? null)) as Record<string, unknown>;
      if (t === 'paradoxes') openedParadoxes.push(opened as Tables['paradoxes']);
      if (t === 'settings') {
        opened = { ...opened, lock: myLock ?? { enabled: false, relockAfterMin: (opened.lock as Settings['lock'] | undefined)?.relockAfterMin ?? 5 } };
      }
      row = (await storedForm(t, opened as never)) as Record<string, unknown>;
      rows.push(row);
    }
    incoming[t] = rows;
  }
  // A file from before the values (version 5 or older, PLAN-VALUES.md section 5): each of its paradoxes comes in as the
  // value seed.ts valuesFromParadoxesOnce would make of it, under the same fixed id, so a merge meets this phone's own
  // copy (the newer kept) and a value deleted here stays deleted (its id is on the list). The paradoxes come in too.
  if ((file.madeAt ?? SCHEMA_VERSION) < VALUES_VERSION) {
    const have = new Set((incoming.values as { fromParadoxId?: string }[]).map(v => v.fromParadoxId).filter(Boolean));
    for (const p of openedParadoxes) {
      if (p.locked || have.has(p.id)) continue;
      incoming.values.push((await storedForm('values', valueFromParadox(p))) as unknown as Record<string, unknown>);
    }
  }
  const result: ImportResult = { added: 0, updated: 0, kept: 0 };
  await database.transaction('rw', TABLES.map(t => database.table(t)), async () => {
    for (const t of TABLES) {
      const tb = database.table(t);
      if (mode === 'replace') {
        // A file without a settings row keeps this phone's, so the seed never runs again over imported pages.
        // Its deleted list goes all the same: the database becomes the file, and the file's rows come back.
        if (t === 'settings' && !incoming[t].length) { result.kept++; await tb.update('app', { deleted: undefined }); continue; }
        await tb.clear();
        await tb.bulkAdd(incoming[t]);
        result.added += incoming[t].length;
        continue;
      }
      const existing = new Map((await tb.toArray()).map(r => [pk(t, r), r as Record<string, unknown>]));
      const write: Record<string, unknown>[] = [];
      for (const row of gone.size ? revived(t, incoming[t], gone) : incoming[t]) {
        const mine = existing.get(pk(t, row));
        if (!mine) { write.push(row); result.added++; }
        else if (t !== 'settings' && stamp(row) > stamp(mine)) { write.push(row); result.updated++; }
        else result.kept++;
      }
      if (write.length) await tb.bulkPut(write);
    }
  });
  return result;
}

/** The file's rows less what this phone deleted (merge only): a deleted row, the rows it owns, and the links to it. */
function revived(t: TableName, rows: Record<string, unknown>[], gone: Set<string>): Record<string, unknown>[] {
  const out = (id: unknown) => typeof id === 'string' && gone.has(id);
  const { owner = [], link = [], links = [], inner = {} } = LINKS[t] ?? {};
  return rows.filter(r => !out(pk(t, r)) && !owner.some(f => out(r[f]))).map(r => {
    const single = [...link.filter(f => out(r[f])), ...Object.entries(inner).filter(([f, k]) => out((r[f] as Record<string, unknown> | undefined)?.[k])).map(([f]) => f)];
    const lists = links.filter(f => Array.isArray(r[f]) && (r[f] as unknown[]).some(out));
    if (!single.length && !lists.length) return r;
    const next = { ...r };
    for (const f of single) delete next[f];
    for (const f of lists) next[f] = (r[f] as unknown[]).filter(x => !out(x));
    return next;
  });
}

/** Hands the file to the share sheet (Files, iCloud Drive, AirDrop); falls back to a download. */
export async function shareOrDownload(data: BackupFile, now = new Date()): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const json = JSON.stringify(data);
  const name = fileName(now);
  const file = new File([json], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** Export, share, and on success log it (backups table, settings.lastBackupAt). */
export async function backupNow(database: FlowDB = defaultDb): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const now = Date.now();
  const data = await exportData(database, now);
  const outcome = await shareOrDownload(data, new Date(now));
  if (outcome !== 'cancelled') {
    const bytes = new Blob([JSON.stringify(data)]).size;
    await database.transaction('rw', database.backups, database.settings, async () => {
      await database.backups.put({ id: crypto.randomUUID(), at: now, bytes, encrypted: !!data.encrypted });
      await database.settings.update('app', { lastBackupAt: now });
    });
  }
  return outcome;
}
