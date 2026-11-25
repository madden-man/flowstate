// W0 spike: every request the spike makes, all same origin to the one function (netlify/functions/spike.mts).
// design-lint DL21 is relaxed for src/spike on this branch only; W2 fences src/bridge the same way.
import { load, update, type HideRow } from './store';

export const FN = '/.netlify/functions/spike';

export interface Trip { label: string; status: number | string; ms: number; sentBytes: number; receivedBytes?: number; note?: string }

export async function send(label: string, body: BodyInit, sentBytes: number, contentType: string, token: string): Promise<Trip> {
  const t0 = performance.now();
  try {
    const r = await fetch(FN, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
      body,
      cache: 'no-store',
    });
    const ms = Math.round(performance.now() - t0);
    let j: { receivedBytes?: number; error?: string } = {};
    try { j = await r.json(); } catch { /* a 413 or 502 page is not JSON */ }
    return { label, status: r.status, ms, sentBytes, receivedBytes: j.receivedBytes, note: j.error };
  } catch (e) {
    return { label, status: 'failed', ms: Math.round(performance.now() - t0), sentBytes, note: String(e) };
  }
}

/** keepalive's body budget is 64 KiB for all keepalive requests in flight (Fetch standard, "keepalive"). */
export const KEEPALIVE_LIMIT = 65536;
const SIZES = { small: 64, 'near limit': 60000 } as const;

const freshId = () => `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** One keepalive send as the app goes. The row is written to storage before the fetch, so a frozen page still has it. */
export function sendOnHide(event: HideRow['event']) {
  const k = load();
  if (!k.token) return;
  // pagehide always sends the small body: two near-limit bodies in flight together would pass the 64 KiB budget
  const kind: HideRow['kind'] = event === 'pagehide' ? 'small' : k.nextKind;
  const bytes = SIZES[kind];
  const id = freshId();
  update(s => {
    s.hides.push({ id, at: new Date().toISOString(), event, kind, bytes });
    if (event === 'visibilitychange') s.nextKind = kind === 'small' ? 'near limit' : 'small';
  });
  const mark = (seen: string) => update(s => { const h = s.hides.find(x => x.id === id); if (h) h.seen = seen; });
  try {
    fetch(`${FN}?hide=${id}`, {
      method: 'POST',
      keepalive: true,
      headers: { authorization: `Bearer ${k.token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(bytes),
    }).then(r => mark(`response ${r.status}`), e => mark(`rejected: ${String(e).slice(0, 80)}`));
  } catch (e) {
    mark(`threw: ${String(e).slice(0, 80)}`);
  }
}

/** On return: ask the function which hide ids it has, and write the answers onto the rows. */
export async function checkArrived(): Promise<string> {
  const k = load();
  const ids = k.hides.filter(h => h.arrived === undefined || h.arrived === null).map(h => h.id);
  if (!k.token || !ids.length) return '';
  try {
    const r = await fetch(`${FN}?arrived=${ids.join(',')}`, { headers: { authorization: `Bearer ${k.token}` }, cache: 'no-store' });
    const j = await r.json() as { store?: string; arrived?: Record<string, { at: string; bytes: number } | null> };
    update(s => s.hides.forEach(h => {
      if (j.arrived && h.id in j.arrived) h.arrived = j.arrived[h.id] ? `${j.arrived[h.id]!.at} (${j.arrived[h.id]!.bytes} B)` : null;
    }));
    return j.store ?? `status ${r.status}`;
  } catch (e) {
    return `check failed: ${String(e)}`;
  }
}
