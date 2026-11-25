// Every write to a notebook's database, in one place (PLAN-WORLDS.md section 5, W1 for W2). A Dexie middleware on each
// notebook (schema.ts openDB puts it on every one, his own and each world's) hears every row put, added or deleted, by
// the fields layer's store, by a store.tx's raw tables (a value deleted, a line's `for` changed), by an import and by
// backupNow. It hears them inside the write's own transaction, so W2's outbox can add its rows in that same transaction
// (note.trans) and a write and its outbox row land together or not at all.
//
// W1 builds no outbox: nothing listens yet. W2 calls onWrite once, filters by note.db (a world's database, never home's:
// PLAN-WORLDS.md section 3) and by table, and writes what travels.
import type { DBCore, DBCoreMutateRequest, DBCoreTransaction, Middleware } from 'dexie';

/** One write as the database saw it: which notebook (its database name), which table, the primary keys written or
 *  deleted ('all' when a table was cleared, as a replace import does), whether they went, and the transaction. */
export type WriteNote = { db: string; table: string; keys: readonly unknown[] | 'all'; gone: boolean; trans: DBCoreTransaction };
export type WriteListener = (note: WriteNote) => void;

const listeners = new Set<WriteListener>();
let hushed = 0;

/** Hears every write to every notebook from now on; returns the way to stop. */
export function onWrite(fn: WriteListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Runs fn with the notes held back: a PIN change rewrites every row sealed with the new key, and that is not a change
 *  to anything he wrote (fields.ts setKey, removeKey and the settle after unlock; they run alone in the write queue). */
export async function unheard<T>(fn: () => Promise<T>): Promise<T> {
  hushed++;
  try { return await fn(); } finally { hushed--; }
}

function note(db: string, table: string, req: DBCoreMutateRequest, results?: readonly unknown[]) {
  if (hushed || !listeners.size) return;
  const n: WriteNote = req.type === 'deleteRange'
    ? { db, table, keys: 'all', gone: true, trans: req.trans }
    : req.type === 'delete'
      ? { db, table, keys: req.keys, gone: true, trans: req.trans }
      : { db, table, keys: results ?? req.keys ?? [], gone: false, trans: req.trans };
  for (const fn of listeners) fn(n);
}

/** The middleware itself, one per database (it carries the database's name). */
export const notebookWrites = (db: string): Middleware<DBCore> => ({
  stack: 'dbcore',
  name: 'notebook-writes',
  create: down => ({
    ...down,
    table: name => {
      const t = down.table(name);
      return {
        ...t,
        mutate: req => t.mutate(req).then(res => { note(db, name, req, res.results); return res; }),
      };
    },
  }),
});
