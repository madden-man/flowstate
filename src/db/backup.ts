// Export and import (PLAN.md section 7). One JSON file: every table, the schema version, exportedAt.
// Rows are written as stored, so with the lock on every sealed row stays sealed in the file and the
// header carries what it takes to open them with the PIN (salt, iterations, the verifier), never a key.
// Import opens a sealed file with that file's own PIN, then stores every row the way this journal
// stores rows now: sealed with the current key, or plain when the lock is off.
import { db as defaultDb, type FlowDB, SCHEMA_VERSION, TABLES, type TableName, type Tables, type Sealed, type Settings } from './schema';
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

const pk = (t: TableName, row: Record<string, unknown>) => String(t === 'albums' ? row.albumUri : row.id);

/** Album covers are Blobs; the file carries them as base64 with their type. */
type CoverJSON = { type: string; b64: string };
async function coverOut(b: Blob): Promise<CoverJSON> {
  return { type: b.type, b64: toB64(new Uint8Array(await b.arrayBuffer())) };
}
const coverIn = (c: CoverJSON) => new Blob([fromB64(c.b64)], { type: c.type });

export async function exportData(database: FlowDB = defaultDb, now = Date.now()): Promise<BackupFile> {
  const tables = {} as BackupFile['tables'];
  await database.transaction('r', TABLES.map(t => database.table(t)), async () => {
    for (const t of TABLES) tables[t] = await database.table(t).toArray();
  });
  tables.albums = await Promise.all(
    (tables.albums as Tables['albums'][]).map(async a => (a.cover ? { ...a, cover: await coverOut(a.cover) } : a)),
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

/** Older files are brought up to the current version here. Version 1 is the first, so nothing to do yet. */
function migrate(f: BackupFile): BackupFile {
  return { ...f, schemaVersion: SCHEMA_VERSION };
}

/** The time a row last changed, for merge: updatedAt, else at, else its newest revision, else createdAt. */
export function stamp(row: Record<string, unknown>): number {
  if (typeof row.updatedAt === 'number') return row.updatedAt;
  if (typeof row.at === 'number') return row.at;
  const revs = row.revisions as { at: number }[] | undefined;
  if (Array.isArray(revs) && revs.length) return Math.max(...revs.map(r => r.at));
  if (typeof row.createdAt === 'number') return row.createdAt;
  return 0;
}

export type ImportMode = 'replace' | 'merge';
export type ImportResult = { added: number; updated: number; kept: number };

/**
 * replace: the database becomes the file.
 * merge: keyed on id; a row in the file wins only when it is newer (stamp). Settings stay this phone's,
 * except where this phone has none.
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
  const myLock = (await database.settings.get('app'))?.lock;
  const incoming = {} as { [K in TableName]: Record<string, unknown>[] };
  for (const t of TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (const r of file.tables[t] as Record<string, unknown>[]) {
      let row = t === 'albums' && r.cover && typeof r.cover === 'object' && 'b64' in (r.cover as object) ? { ...r, cover: coverIn(r.cover as CoverJSON) } : r;
      // open with the file's key (a wrong one throws before anything is written), then store as this journal stores rows
      let opened = (await openRow(t, row as never, fileKey ?? null)) as Record<string, unknown>;
      if (t === 'settings') {
        opened = { ...opened, lock: myLock ?? { enabled: false, relockAfterMin: (opened.lock as Settings['lock'] | undefined)?.relockAfterMin ?? 5 } };
      }
      row = (await storedForm(t, opened as never)) as Record<string, unknown>;
      rows.push(row);
    }
    incoming[t] = rows;
  }
  const result: ImportResult = { added: 0, updated: 0, kept: 0 };
  await database.transaction('rw', TABLES.map(t => database.table(t)), async () => {
    for (const t of TABLES) {
      const tb = database.table(t);
      if (mode === 'replace') {
        // A file without a settings row keeps this phone's, so the seed never runs again over imported pages.
        if (t === 'settings' && !incoming[t].length) { result.kept++; continue; }
        await tb.clear();
        await tb.bulkAdd(incoming[t]);
        result.added += incoming[t].length;
        continue;
      }
      const existing = new Map((await tb.toArray()).map(r => [pk(t, r), r as Record<string, unknown>]));
      const write: Record<string, unknown>[] = [];
      for (const row of incoming[t]) {
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
