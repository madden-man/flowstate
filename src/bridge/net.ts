// The bridge's only requests (PLAN-WORLDS.md section 5, W2; DESIGN.md rule 22): every one goes to BRIDGE_PATH on this
// origin, never an absolute URL and never another host (test/bridge/fence.test.ts reads this folder to prove it).
// Callers pass the token they were handed; this file never reads a database.
import { BRIDGE_PATH, type Ack, type PocketReply, type UpBatch, type WorldRow } from './protocol';

export class BridgeError extends Error {
  constructor(readonly status: number | 'offline', message: string) { super(message); this.name = 'BridgeError'; }
}

type Call = { token: string; query: Record<string, string>; body?: string; keepalive?: boolean; fetcher?: typeof fetch };

async function call<T>({ token, query, body, keepalive, fetcher = (input, init) => fetch(input, init) }: Call): Promise<T> {
  const path = `${BRIDGE_PATH}?${new URLSearchParams(query)}`;
  let r: Response;
  try {
    r = await fetcher(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body,
      cache: 'no-store',
      credentials: 'omit',
      keepalive: !!keepalive,
    });
  } catch (e) {
    throw new BridgeError('offline', String(e));
  }
  if (!r.ok) throw new BridgeError(r.status, `bridge ${r.status}`);
  return r.json() as Promise<T>;
}

export const listWorlds = (token: string, fetcher?: typeof fetch) =>
  call<{ worlds: WorldRow[] }>({ token, query: { op: 'worlds' }, fetcher }).then(r => r.worlds);

export const getPocket = (token: string, world: string, stamp?: string, fetcher?: typeof fetch) =>
  call<PocketReply>({ token, query: stamp ? { op: 'pocket', world, stamp } : { op: 'pocket', world }, fetcher });

/** body is the UpBatch already serialised, so a hidden send can be measured against the keepalive budget first. */
export const postUp = (token: string, body: string, keepalive = false, fetcher?: typeof fetch) =>
  call<{ acks: Ack[] }>({ token, query: { op: 'up' }, body, keepalive, fetcher }).then(r => r.acks);

export type { UpBatch };
