// The outbox's half of the one write path (PLAN-WORLDS.md section 5, W2). A Dexie middleware, installed by openDB only on
// a world's notebook (a database named WORLD_DB_PREFIX + its id, never `flowstate`), that adds `{ table, id }` to the
// outbox in the same transaction as every put and delete of what travels:
//
//   a council page and its lines, a question page and its lines;
//   a journal line while it is kept (and once more when it stops being kept, which goes up as a delete);
//   inquiries, songs and takes.
//
// Values, voices, the music tables and a journal page itself never enter it. Only which row is recorded, never the row:
// the envelope is built at send time from the row as it stands (src/bridge/up.ts), so many edits collapse into one. A
// row written again replaces its entry with a new n and a higher rev.
//
// It acts only in a transaction that holds the outbox. fields.ts opens every write in a world with the outbox, pages and
// messages in scope (WRITE_SCOPE); a write that comes DOWN from the bible (fields.ts quiet) opens its transaction
// without the outbox, so it never goes back up as if he wrote it; and an import, a PIN change's re-seal and anything
// else that does not hold the outbox passes straight through.
import Dexie, { type DBCore, type DBCoreMutateRequest, type DBCoreTable, type DBCoreTransaction, type Middleware } from 'dexie';
import { TRAVELS, type TravelTable } from '../bridge/protocol';

/** A world's notebook is this prefix and the world's id (PLAN-WORLDS.md section 3: flowstate-w-eastwinds). */
export const WORLD_DB_PREFIX = 'flowstate-w-';
export const isWorldDB = (name: string) => name.startsWith(WORLD_DB_PREFIX);
/** What a write in a world must hold besides its own tables, so the middleware can read a line's page and record it. */
export const WRITE_SCOPE = ['outbox', 'pages', 'messages'] as const;

type Row = Record<string, unknown> & { id?: string };
type Touch = { table: TravelTable; id: string };

const listeners = new Set<(dbName: string) => void>();
/** Called (after the write, on a later tick) whenever a world's outbox gained a row: the bridge's debounced send. */
export function onOutbox(fn: (dbName: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The envelope's rev: the time of the write, and always above the last one handed out in this session. */
let lastRev = 0;
export const nextRev = (now = Date.now()) => (lastRev = Math.max(now, lastRev + 1));

const travels = (name: string): name is TravelTable => (TRAVELS as readonly string[]).includes(name);
const storeNames = (trans: DBCoreTransaction): string[] => {
  const names = (trans as unknown as { objectStoreNames?: DOMStringList }).objectStoreNames;
  if (names) return Array.from(names);
  return Dexie.currentTransaction?.storeNames ?? [];
};

const EQUAL = 1 as never;
const RANGE = 2 as never;

/** The keys a mutation touches. A deleteRange is read first, so its rows are known before they go. */
async function keysOf(t: DBCoreTable, req: DBCoreMutateRequest): Promise<string[]> {
  if (req.type === 'delete') return req.keys as string[];
  if (req.type === 'deleteRange') {
    const r = await t.query({ trans: req.trans, values: false, query: { index: t.schema.primaryKey, range: req.range } });
    return r.result as string[];
  }
  const fromValues = (req.values as Row[]).map((v, i) => (req.keys?.[i] as string | undefined) ?? v?.id).filter((k): k is string => typeof k === 'string');
  const fromUpdates = req.type === 'put' ? (req.updates?.keys as string[] | undefined) ?? [] : [];
  return [...new Set([...fromValues, ...fromUpdates])];
}

async function pagesOf(down: DBCore, trans: DBCoreTransaction, ids: string[]): Promise<Map<string, Row>> {
  const uniq = [...new Set(ids)];
  const rows = (await down.table('pages').getMany({ trans, keys: uniq })) as (Row | undefined)[];
  return new Map(uniq.map((id, i) => [id, rows[i]]).filter((e): e is [string, Row] => !!e[1]));
}

/** A page's lines, by the [pageId+at] index. */
async function linesOf(down: DBCore, trans: DBCoreTransaction, pageId: string): Promise<Row[]> {
  const t = down.table('messages');
  const index = t.schema.getIndexByKeyPath(['pageId', 'at'])!;
  const r = await t.query({ trans, values: true, query: { index, range: { type: RANGE, lower: [pageId, -Infinity], upper: [pageId, Infinity] } } });
  return r.result as Row[];
}

const yearOf = (p: Row) => JSON.stringify([p.createdAt, p.year, (p.chips as { year?: unknown } | undefined)?.year]);

/** Which rows of this mutation travel, given the rows before and after it (section 5's rules, one by one). */
async function decide(down: DBCore, trans: DBCoreTransaction, table: TravelTable, keys: string[], before: (Row | undefined)[], after: (Row | undefined)[]): Promise<Touch[]> {
  const out: Touch[] = [];
  const add = (t: TravelTable, id: string) => out.push({ table: t, id });
  if (table === 'inquiries' || table === 'songs' || table === 'takes') {
    keys.forEach(id => add(table, id));
    return out;
  }
  if (table === 'pages') {
    for (let i = 0; i < keys.length; i++) {
      const page = after[i] ?? before[i];
      if (!page) continue;
      if (page.kind !== 'entry') {
        add('pages', keys[i]);
        // a new council or question: any line already written in this transaction goes with it
        if (!before[i] && after[i]) for (const m of await linesOf(down, trans, keys[i])) add('messages', String(m.id));
        continue;
      }
      // a journal page never travels; its kept lines carry its date and year, so they go again when those change
      if (before[i] && after[i] && yearOf(before[i]!) !== yearOf(after[i]!)) {
        for (const m of await linesOf(down, trans, keys[i])) if (m.kept) add('messages', String(m.id));
      }
    }
    return out;
  }
  // messages
  const pageIds = keys.map((_, i) => String((after[i] ?? before[i])?.pageId ?? ''));
  const pages = await pagesOf(down, trans, pageIds.filter(Boolean));
  for (let i = 0; i < keys.length; i++) {
    const line = after[i] ?? before[i];
    if (!line) continue;
    const page = pages.get(pageIds[i]);
    const inThread = !!page && page.kind !== 'entry';
    // kept now, or kept before (a line no longer kept, or a kept line deleted, goes up as a delete)
    if (inThread || after[i]?.kept === true || before[i]?.kept === true) add('messages', keys[i]);
  }
  return out;
}

/** Each touched row's outbox entry replaced by a new one: a new n, a higher rev. */
async function enqueue(down: DBCore, trans: DBCoreTransaction, touched: Touch[]): Promise<void> {
  const ob = down.table('outbox');
  const index = ob.schema.getIndexByKeyPath(['table', 'id'])!;
  const seen = new Set<string>();
  for (const t of touched) {
    const k = `${t.table} ${t.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const old = await ob.query({ trans, values: false, query: { index, range: { type: EQUAL, lower: [t.table, t.id], upper: [t.table, t.id] } } });
    if (old.result.length) await ob.mutate({ type: 'delete', trans, keys: old.result as number[] });
    const at = Date.now();
    await ob.mutate({ type: 'add', trans, values: [{ table: t.table, id: t.id, rev: nextRev(at), at }] });
  }
}

/** The middleware itself. openDB installs it on a world's notebook only. */
export function outboxMiddleware(dbName: string): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'flowstate-outbox',
    // directly over IndexedDB, under Dexie's own cache and observability layers (levels -1 and 0), so the outbox's reads
    // and writes are plain requests in the write's own transaction and need nothing of Dexie's zone
    level: -2,
    create: down => ({
      ...down,
      table: (name: string) => {
        const t = down.table(name);
        if (!travels(name)) return t;
        return {
          ...t,
          mutate: async (req: DBCoreMutateRequest) => {
            const scope = storeNames(req.trans);
            if (!scope.includes('outbox')) return t.mutate(req);
            const missing = WRITE_SCOPE.filter(s => !scope.includes(s));
            if (missing.length) throw new Error(`outbox: a write in a world must hold ${missing.join(', ')}`);
            const keys = await keysOf(t, req);
            if (!keys.length) return t.mutate(req);
            const before = (await t.getMany({ trans: req.trans, keys })) as (Row | undefined)[];
            const res = await t.mutate(req);
            const after = req.type === 'delete' || req.type === 'deleteRange'
              ? keys.map(() => undefined)
              : ((await t.getMany({ trans: req.trans, keys })) as (Row | undefined)[]);
            const touched = await decide(down, req.trans, name, keys, before, after);
            if (touched.length) {
              await enqueue(down, req.trans, touched);
              setTimeout(() => listeners.forEach(fn => fn(dbName)), 0);
            }
            return res;
          },
        };
      },
    }),
  };
}
