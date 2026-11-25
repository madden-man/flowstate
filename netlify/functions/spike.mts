// W0 spike (PLAN-WORLDS.md section 10, row W0): the one function the spike screen talks to. No MongoDB.
// Never merges. W2's `bridge` function is the real one.
//
// POST /.netlify/functions/spike            echo: { ok, receivedBytes, contentType, at }
// POST /.netlify/functions/spike?hide=<id>  a keepalive send as the app was hidden: remembered, then echoed
// GET  /.netlify/functions/spike?arrived=<id,id,...>  which of those hide ids arrived, and when
//
// Every request needs `Authorization: Bearer <SPIKE_TOKEN>`; without it (or with SPIKE_TOKEN unset) the answer is
// 401 and nothing is read or kept.
//
// Size: Netlify's "Buffered request/response payload" limit is 6 MB, and a binary body is base64 encoded on the way
// in, about 30% more, so a binary request is effectively 4.5 MB at most. Source: Netlify docs, Functions,
// "Configuration for functions", table "Default deployment options", footnote 2
// (https://docs.netlify.com/build/functions/configuration/, read 2026-11-25).
//
// Remembering hide ids: Netlify Blobs (store "spike-hides", strong consistency) when the runtime provides it, which
// it does on a deployed site and under `netlify dev` with no setup. If getStore throws, a module-level Map is used:
// best effort only, since each invocation may land on a fresh instance. The answer says which one was used.
import { getStore } from '@netlify/blobs';

interface Seen { at: string; bytes: number }
const memory = new Map<string, Seen>();

type Kept = { kind: 'blobs' | 'memory'; set(id: string, v: Seen): Promise<void>; get(id: string): Promise<Seen | null> };

function keeper(): Kept {
  try {
    const store = getStore({ name: 'spike-hides', consistency: 'strong' });
    return {
      kind: 'blobs',
      set: async (id, v) => { await store.setJSON(id, v); },
      get: async id => ((await store.get(id, { type: 'json' })) as Seen | null) ?? null,
    };
  } catch {
    return {
      kind: 'memory',
      set: async (id, v) => { memory.set(id, v); },
      get: async id => memory.get(id) ?? null,
    };
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const ID = /^[\w-]{1,80}$/;

export default async (req: Request): Promise<Response> => {
  const token = process.env.SPIKE_TOKEN;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || given !== token) return json(401, { ok: false, error: 'unauthorized' });

  const url = new URL(req.url);
  const at = new Date().toISOString();

  if (req.method === 'GET') {
    const ids = (url.searchParams.get('arrived') ?? '').split(',').filter(id => ID.test(id)).slice(0, 200);
    const k = keeper();
    const arrived: Record<string, Seen | null> = {};
    try {
      for (const id of ids) arrived[id] = await k.get(id);
      return json(200, { ok: true, store: k.kind, arrived, at });
    } catch (e) {
      return json(500, { ok: false, store: k.kind, error: String(e) });
    }
  }

  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST or GET' });

  const body = await req.arrayBuffer();
  const receivedBytes = body.byteLength;
  const hide = url.searchParams.get('hide');
  let store: string | undefined;
  if (hide && ID.test(hide)) {
    const k = keeper();
    store = k.kind;
    try {
      await k.set(hide, { at, bytes: receivedBytes });
    } catch (e) {
      // a Blobs write that failed at run time falls back to memory, and says so
      memory.set(hide, { at, bytes: receivedBytes });
      store = `memory (blobs failed: ${String(e).slice(0, 120)})`;
    }
    console.log(`spike hide ${hide} ${receivedBytes} bytes, kept in ${store}`);
  }
  return json(200, { ok: true, receivedBytes, contentType: req.headers.get('content-type'), at, ...(store ? { store } : {}) });
};
