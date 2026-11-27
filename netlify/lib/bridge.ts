// The bridge's handler (PLAN-WORLDS.md section 5, W2), apart from the MongoDB driver so tests run it against a fake
// (test/bridge/function.test.ts). netlify/functions/bridge.mts hands it the real client.
//
// What it may touch, and nothing else: the four `bridge_` collections of the one shared database, `flowstate_bridge`
// (BRIDGE_DB), through coll() below, which refuses any other database and any other name. Novel Companion's and Music
// Companion's own databases are not reachable from here at all. Every stored envelope carries its world and table, and
// the desktop apps read by those: Novel Companion its own worlds' rows, Music Companion every world's songs and takes
// and its phone app's companion rows (a table, opaque here, in bridge_up; UP_TABLES in the protocol).
//
// The protocol is src/bridge/protocol.ts, shared with the phone.
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BODY_MAX_BYTES, BATCH_MAX, BRIDGE_DB, CLIP_MAX_BYTES, COLLECTIONS, PREFIX, ROW_ID, STAMP, WORLD_ID,
  envelopeProblem, type Ack, type AckResult, type CollectionName, type Envelope, type WorldKind, type WorldRow,
} from '../../src/bridge/protocol.ts';

type Doc = Record<string, unknown>;
/** The few driver calls the bridge makes. The real MongoClient has them all; the test fake has only these. */
export interface CollLike {
  findOne(filter: Doc): Promise<Doc | null>;
  find(filter: Doc): { toArray(): Promise<Doc[]> };
  updateOne(filter: Doc, update: Doc): Promise<{ matchedCount: number }>;
  insertOne(doc: Doc): Promise<unknown>;
}
export interface ClientLike { db(name: string): { collection(name: string): CollLike } }
export type Env = { BRIDGE_TOKEN?: string; BRIDGE_MONGODB_URI?: string };
export type Deps = { env: Env; client: () => Promise<ClientLike>; now?: () => number };

export class Confined extends Error {}

/** The only way to a collection: the one database, one of the four `bridge_` names. */
export function coll(client: ClientLike, db: string, name: CollectionName): CollLike {
  if (db !== BRIDGE_DB) throw new Confined(`database ${db}`);
  if (!name.startsWith(PREFIX) || !(COLLECTIONS as readonly string[]).includes(name)) throw new Confined(`collection ${name}`);
  return client.db(db).collection(name);
}
const bridge = (client: ClientLike, name: CollectionName) => coll(client, BRIDGE_DB, name);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();
/** The bearer matches the site's token, compared in constant time over equal-length digests. No token set: never. */
export function authorised(req: Request, token: string | undefined): boolean {
  if (!token) return false;
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  if (!m) return false;
  return timingSafeEqual(digest(m[1].trim()), digest(token));
}

const isKind = (k: unknown): k is WorldKind => k === 'novel' || k === 'songs';

/** Every world in the registry. A row with no usable id or kind is left out. */
async function worlds(client: ClientLike): Promise<WorldRow[]> {
  const out: WorldRow[] = [];
  for (const r of await bridge(client, 'bridge_worlds').find({}).toArray()) {
    if (typeof r._id !== 'string' || !WORLD_ID.test(r._id) || !isKind(r.kind)) continue;
    out.push({ id: r._id, name: typeof r.name === 'string' ? r.name : r._id, kind: r.kind });
  }
  return out;
}

/** A world the registry holds with a kind it knows. Nothing is read or written for any other. */
async function known(client: ClientLike, world: string): Promise<boolean> {
  const r = await bridge(client, 'bridge_worlds').findOne({ _id: world });
  return !!r && isKind(r.kind);
}

/** Newest rev wins: write only over an older rev, insert when there is none; a duplicate key means one is there. */
async function newest(c: CollLike, _id: string, rev: number, doc: Doc): Promise<AckResult> {
  const r = await c.updateOne({ _id, rev: { $lt: rev } }, { $set: doc });
  if (r.matchedCount) return 'stored';
  try {
    await c.insertOne({ _id, ...doc });
    return 'stored';
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
    const cur = await c.findOne({ _id });
    return cur && cur.rev === rev ? 'same' : 'older';
  }
}

async function readBody(req: Request, max: number): Promise<Uint8Array | null> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > max) return null;
  const buf = new Uint8Array(await req.arrayBuffer());
  return buf.byteLength > max ? null : buf;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (!authorised(req, deps.env.BRIDGE_TOKEN)) return json(401, { error: 'unauthorized' });
  if (!deps.env.BRIDGE_MONGODB_URI) return json(503, { error: 'not configured' });
  const url = new URL(req.url);
  const op = url.searchParams.get('op');
  const now = deps.now ?? Date.now;

  if (req.method === 'GET' && op === 'worlds') {
    return json(200, { worlds: await worlds(await deps.client()) });
  }

  if (req.method === 'GET' && op === 'pocket') {
    const world = url.searchParams.get('world') ?? '';
    const stamp = url.searchParams.get('stamp');
    if (!WORLD_ID.test(world) || (stamp !== null && !STAMP.test(stamp))) return json(400, { error: 'world or stamp' });
    const client = await deps.client();
    if (!(await known(client, world))) return json(404, { error: 'no world' });
    const row = await bridge(client, 'bridge_down').findOne({ _id: world });
    if (!row || typeof row.stamp !== 'string') return json(404, { error: 'no pocket' });
    if (stamp === row.stamp) return json(200, { world, stamp: row.stamp, unchanged: true });
    return json(200, { world, stamp: row.stamp, pocket: row.pocket });
  }

  if (req.method === 'POST' && op === 'up') {
    const raw = await readBody(req, BODY_MAX_BYTES);
    if (!raw) return json(413, { error: 'too large' });
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { return json(400, { error: 'not json' }); }
    const b = body as { world?: unknown; envelopes?: unknown };
    if (!b || typeof b.world !== 'string' || !WORLD_ID.test(b.world)) return json(400, { error: 'world' });
    if (!Array.isArray(b.envelopes) || b.envelopes.length > BATCH_MAX) return json(400, { error: 'envelopes' });
    const client = await deps.client();
    if (!(await known(client, b.world))) return json(404, { error: 'no world' });
    const up = bridge(client, 'bridge_up');
    const acks: Ack[] = [];
    for (const e of b.envelopes as unknown[]) {
      const problem = envelopeProblem(e, b.world);
      const env = e as Envelope;
      const ref = { table: typeof env?.table === 'string' ? env.table : '', id: typeof env?.id === 'string' ? env.id : '', rev: typeof env?.rev === 'number' ? env.rev : 0 };
      if (problem) { acks.push({ ...ref, result: 'refused', reason: problem }); continue; }
      const doc: Doc = { world: env.world, table: env.table, id: env.id, rev: env.rev, deleted: !!env.deleted, row: env.deleted ? null : env.row, at: now() };
      acks.push({ ...ref, result: await newest(up, `${env.world}:${env.table}:${env.id}`, env.rev, doc) });
    }
    return json(200, { acks });
  }

  if (req.method === 'POST' && op === 'clip') {
    const world = url.searchParams.get('world') ?? '';
    const take = url.searchParams.get('take') ?? '';
    const rev = Number(url.searchParams.get('rev'));
    const type = (req.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!WORLD_ID.test(world) || !ROW_ID.test(take) || !Number.isSafeInteger(rev) || rev < 1) return json(400, { error: 'world, take or rev' });
    if (!/^audio\/[\w.+-]+$/.test(type)) return json(415, { error: 'audio only' });
    const raw = await readBody(req, CLIP_MAX_BYTES);
    if (!raw) return json(413, { error: 'too large' });
    const client = await deps.client();
    if (!(await known(client, world))) return json(404, { error: 'no world' });
    const result = await newest(bridge(client, 'bridge_clips'), `${world}:${take}`, rev,
      { world, take, rev, type, bytes: raw.byteLength, audio: Buffer.from(raw), at: now() });
    return json(200, { take, result });
  }

  return json(req.method === 'GET' || req.method === 'POST' ? 400 : 405, { error: 'unknown op' });
}
