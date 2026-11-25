// A world's notebook for the bridge's tests: named as W1 names one (flowstate-w-<id>), so openDB installs the outbox.
import { openDB, type FlowDB } from '../../src/db/schema';
import { init, handed, type Handed } from '../../src/db/fields';
import type { Ack, Envelope } from '../../src/bridge/protocol';

let n = 0;
export async function worldDB(): Promise<{ db: FlowDB; h: Handed }> {
  const db = openDB(`flowstate-w-test${Date.now().toString(36)}${n++}`);
  await db.open();
  await init(db);
  return { db, h: handed(db) };
}

/** Lets the outbox's after-write tick and any pending transaction finish. */
export const settled = () => new Promise(r => setTimeout(r, 5));

/** A stand-in for the function: records every request and answers each envelope as the real one would for a fresh
 *  store (stored, then same on a resend of the same rev, older below the newest). */
export function fakeBridge(opts: { offline?: () => boolean } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const kept = new Map<string, Envelope>();
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (opts.offline?.()) throw new TypeError('Failed to fetch');
    const body = JSON.parse(String(init?.body ?? '{}')) as { envelopes?: Envelope[] };
    const acks: Ack[] = (body.envelopes ?? []).map(e => {
      const k = `${e.world}:${e.table}:${e.id}`;
      const cur = kept.get(k);
      if (cur && cur.rev > e.rev) return { table: e.table, id: e.id, rev: e.rev, result: 'older' };
      if (cur && cur.rev === e.rev) return { table: e.table, id: e.id, rev: e.rev, result: 'same' };
      kept.set(k, e);
      return { table: e.table, id: e.id, rev: e.rev, result: 'stored' };
    });
    return new Response(JSON.stringify({ acks }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, kept, fetcher };
}
