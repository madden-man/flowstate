// Export and import (PLAN.md section 7). One JSON file: every table, the schema version, exportedAt.
// Rows are written as stored, so a sealed row stays sealed in the file (encrypted export is package 6).
import { db as defaultDb, type FlowDB, SCHEMA_VERSION, TABLES, type TableName, type Tables } from './schema';
import { isSealed, toB64, fromB64 } from './crypto';
import { keyState, LockedError } from './fields';

export const BACKUP_APP = 'flowstate';

export type BackupFile = {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: number;
  tables: { [K in TableName]: unknown[] };
};

export class BackupError extends Error {
  constructor(message: string) { super(message); this.name = 'BackupError'; }
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
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now, tables };
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
export async function importData(file: BackupFile, mode: ImportMode, database: FlowDB = defaultDb): Promise<ImportResult> {
  if (keyState() !== 'plain') throw new LockedError();
  const hasSealed = TABLES.some(t => (file.tables[t] as Record<string, unknown>[]).some(r => isSealed(r.sealed)));
  if (hasSealed) throw new BackupError('This file is locked with a PIN');
  const incoming = {} as { [K in TableName]: Record<string, unknown>[] };
  for (const t of TABLES) {
    incoming[t] = (file.tables[t] as Record<string, unknown>[]).map(r =>
      t === 'albums' && r.cover && typeof r.cover === 'object' && 'b64' in (r.cover as object) ? { ...r, cover: coverIn(r.cover as CoverJSON) } : r,
    );
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
      await database.backups.put({ id: crypto.randomUUID(), at: now, bytes, encrypted: false });
      await database.settings.update('app', { lastBackupAt: now });
    });
  }
  return outcome;
}
