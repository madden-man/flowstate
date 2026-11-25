// Carrying a world to the bible and back (PLAN-WORLDS.md section 5, W2): the one place that knows both the bridge's
// settings on home's row and the notebook worn, and hands src/bridge a world's notebook and that world's id, never home.
//
// Opt-in, twice over: nothing is sent and no pocket is fetched until a bridge token is pasted in Settings AND a world is
// worn. The registry of worlds (the shelf's covers, home's `worlds`) is asked for when he saves the token and when he
// taps Carry now, and on opening while a world is worn: it carries nothing of his, only the token.
//
// Up goes when a write settles (debounced; the batch is read soon after the write and sent a moment later, so a batch is
// ready if the app is hidden in between), when the app is hidden (keepalive, under its budget; if it never completes
// the outbox still holds every entry), and on opening. Down is the pocket, on donning and on opening, if its stamp moved.
// Locked, nothing is read and nothing goes; the token itself is sealed in the settings row.
import { signal } from '@preact/signals';
import { book, handed, keyState, onWorn, store, worn, type Handed } from '../db/fields';
import { onOutbox } from '../db/outbox';
import type { BridgeSettings, Settings, WorldEntry } from '../db/schema';
import { readBatch, sendBatch, drain, type Batch } from '../bridge/up';
import { getPocket, listWorlds, BridgeError } from '../bridge/net';
import { applyPocket } from '../bridge/down';
import { KEEPALIVE_MAX_BYTES } from '../bridge/protocol';

/** When a batch was last acknowledged, for the Settings row's "Carried"; undefined before the first, or locked. */
export const carriedAt = signal<number | undefined>(undefined);

const open = () => keyState() !== 'locked';

/** The bridge's settings, from home's row (store.get joins the rows; bridge is not a book key). Locked: none. */
async function bridgeOf(): Promise<BridgeSettings | undefined> {
  if (!open()) return undefined;
  const s = await store.get('settings', 'app');
  return s && !s.locked ? s.bridge : undefined;
}

/** Writes the bridge's settings onto the stored row as it stands now, in the write queue, so a stale copy never drops a
 *  switch or the Spotify tokens; patch undefined takes the bridge away. LockedError when locked. */
async function writeBridge(patch: (b: BridgeSettings | undefined) => BridgeSettings | undefined, extra: Partial<Settings> = {}): Promise<void> {
  await store.unit(async u => {
    const s = await u.get('settings', 'app');
    if (!s) return;
    const { locked: _, bridge, ...rest } = s;
    const next = patch(bridge);
    await u.put('settings', { ...rest, ...extra, ...(next ? { bridge: next } : {}) } as Settings);
  });
}

let token: string | undefined;

/** The token, if one is saved and the notebook is open. */
export async function bridgeToken(): Promise<string | undefined> {
  const b = await bridgeOf();
  token = b?.token || undefined;
  carriedAt.value = b?.upAt;
  return token;
}

type Fetcher = typeof fetch | undefined;

/** Saves a pasted token (trimmed; a blank one is refused) and asks for the registry with it. */
export async function saveBridgeToken(t: string, fetcher?: Fetcher): Promise<void> {
  const k = t.trim();
  if (!k) throw new Error('No token');
  await writeBridge(b => ({ ...(b ?? {}), token: k }));
  token = k;
  await refreshWorlds(fetcher).catch(() => undefined);
}

/** Takes the token away, with the pocket and the times; nothing is sent after. */
export async function removeBridgeToken(): Promise<void> {
  await writeBridge(() => undefined);
  token = undefined;
  ready = null;
  carriedAt.value = undefined;
}

/** The registry, read from both databases by the function, onto home's row; a world's spine hue is kept. */
async function refreshWorlds(fetcher?: Fetcher): Promise<void> {
  if (!token || !open()) return;
  const rows = await listWorlds(token, fetcher);
  const s = await store.get('settings', 'app');
  const hues = new Map((s?.worlds ?? []).map(w => [w.id, w.hue]));
  const worlds: WorldEntry[] = rows.map(w => ({ id: w.id, name: w.name, kind: w.kind, ...(hues.get(w.id) !== undefined ? { hue: hues.get(w.id) } : {}) }));
  await store.unit(async u => {
    const cur = await u.get('settings', 'app');
    if (!cur || cur.locked) return;
    const { locked: _, ...rest } = cur;
    await u.put('settings', { ...rest, worlds });
  });
}

/** The world worn and its notebook, handed to the bridge; null with his own pages worn, no token, or locked. */
function target(): { world: string; h: Handed } | null {
  const world = worn();
  if (!world || !token || !open()) return null;
  return { world, h: handed(book()) };
}

const stamp = async (patch: Partial<BridgeSettings>) => {
  await writeBridge(b => (b ? { ...b, ...patch } : b)).catch(() => undefined);
};

/** Up: every entry the outbox holds, in batches. */
async function carryUp(fetcher?: Fetcher): Promise<number> {
  const t = target();
  if (!t) return 0;
  const sent = await drain(t.h, t.world, token!, fetcher);
  if (sent) { const at = Date.now(); carriedAt.value = at; await stamp({ upAt: at }); }
  return sent;
}

/** Down: the pocket, if its stamp moved, written into the world's notebook and kept on home's row. */
async function carryDown(fetcher?: Fetcher): Promise<void> {
  const t = target();
  if (!t) return;
  const b = await bridgeOf();
  const have = b?.pocket?.world === t.world ? b.pocket.stamp : undefined;
  const r = await getPocket(token!, t.world, have, fetcher);
  if ('unchanged' in r) return;
  if (worn() !== t.world) return; // taken off while it was on its way
  await applyPocket(t.h, r.pocket);
  await stamp({ downAt: Date.now(), pocket: { world: t.world, stamp: r.stamp, pocket: r.pocket } });
}

export type Carried = 'idle' | 'carried' | 'offline' | 'failed';

/** Up, then down. Idle when nothing may go (no token, his own pages worn, or locked); offline when the request never
 *  reached the function (the outbox waits); failed on any other answer. */
export async function carry(opts: { worlds?: 'worn' | 'always'; fetcher?: Fetcher } = {}): Promise<Carried> {
  if (!token) await bridgeToken();
  if (!token || !open()) return 'idle';
  try {
    if (opts.worlds === 'always' || (opts.worlds === 'worn' && worn())) await refreshWorlds(opts.fetcher);
    if (!target()) return 'idle';
    await carryUp(opts.fetcher);
    await carryDown(opts.fetcher);
    return 'carried';
  } catch (e) {
    return e instanceof BridgeError && e.status === 'offline' ? 'offline' : 'failed';
  }
}

// ---- when it goes: a write settling, the app hidden, the app opened, a world donned ----

const READ_MS = 300;
const SEND_MS = 1200;
/** The batch read soon after the last write, under the keepalive budget, so a hide can send it at once. */
let ready: { batch: Batch; h: Handed; world: string } | null = null;
let readTimer: ReturnType<typeof setTimeout> | undefined;
let sendTimer: ReturnType<typeof setTimeout> | undefined;

function onWrite(dbName: string) {
  if (!token || dbName !== book().name || !worn()) return;
  ready = null;
  clearTimeout(readTimer);
  clearTimeout(sendTimer);
  readTimer = setTimeout(() => void prepare(), READ_MS);
}

async function prepare() {
  const t = target();
  if (!t) return;
  const batch = await readBatch(t.h, t.world, KEEPALIVE_MAX_BYTES).catch(() => null);
  ready = batch && batch.envelopes.length ? { batch, ...t } : null;
  sendTimer = setTimeout(() => void carryUp().catch(() => undefined), SEND_MS);
}

/** As the app is hidden: the batch already read goes with keepalive; if none is ready, one is read and sent while the
 *  key is still in memory. A keepalive send that never completes leaves every entry in the outbox. */
export function carryOnHide(fetcher?: Fetcher): void {
  if (!token || !open()) { ready = null; if (!open()) token = undefined; return; }
  clearTimeout(readTimer);
  clearTimeout(sendTimer);
  const r = ready;
  ready = null;
  if (r && worn() === r.world) {
    void sendBatch(r.h, r.batch, token, { keepalive: true, fetcher }).then(() => stamp({ upAt: Date.now() })).catch(() => undefined);
    return;
  }
  const t = target();
  if (!t) return;
  void readBatch(t.h, t.world, KEEPALIVE_MAX_BYTES)
    .then(b => (b ? sendBatch(t.h, b, token!, { keepalive: true, fetcher }) : null))
    .catch(() => undefined);
}

/** Listens for writes, the app hidden and shown, and donning. Called once at boot, before the relock starts listening,
 *  so a hide reads the batch ready before the key can drop. Returns the way to stop. */
export function startCarry(): () => void {
  const offWrite = onOutbox(onWrite);
  const offWorn = onWorn(w => { if (w) void carry(); else ready = null; });
  const vis = () => {
    if (document.visibilityState === 'hidden') carryOnHide();
    else void carry({ worlds: 'worn' });
  };
  const doc = typeof document === 'undefined' ? null : document;
  doc?.addEventListener('visibilitychange', vis);
  return () => { offWrite(); offWorn(); doc?.removeEventListener('visibilitychange', vis); };
}

/** On opening, once the notebook is open (the gate calls it when the PIN lets him in, or at once with no PIN). */
export const carryOnOpen = (fetcher?: Fetcher) => carry({ worlds: 'worn', fetcher });
/** "Carry now" in Settings: the registry too, whatever is worn, then up and down for a world worn. */
export const carryNow = (fetcher?: Fetcher) => carry({ worlds: 'always', fetcher });
