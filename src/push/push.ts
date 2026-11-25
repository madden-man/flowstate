// The phone's half of the Sunday question's Web Push (PLAN-PUSH.md section 5, N3). The only code allowed to reach the
// server, and only this app's own origin under /api/push/ (DESIGN.md rule 22, lint DL21, script/check-dist.mjs). Off
// until he switches it on in Settings; then only a push address, a time and a zone leave the phone, never a word.
// Copied and slimmed from Semper Dulce's src/lib/push.ts (one person, no ntfy). Every call is quiet when offline: the
// journal opens and works in airplane mode with push on.
//
//   pushState()          what the Settings row shows: unsupported, needsHomeScreen, denied, off, on
//   turnOn()             only from his tap: permission, subscribe, post the schedule
//   turnOff()            unsubscribe here and on the server
//   sendNow()            "Send one now": the server pushes to this phone's own address
//   resubscribeIfMoved() on open, on return to the front and on a schedule change: posts only when something moved
//   startPush()          main.tsx: wires the last one, the line's mirror and the worker's messages
import { effect, signal } from '@preact/signals';
import { settings, saveSettings } from '../ui/settings';
import { isStandalone } from '../pwa/hints';
import { checkinOf, type Checkin } from './due';
import { clearPushStore, writePushLine } from './store';

export type PushState = 'unsupported' | 'needsHomeScreen' | 'denied' | 'off' | 'on';
/** Why a call came to nothing: the server has no VAPID keys, there is no connection, or anything else. */
export type PushWhy = 'not_configured' | 'offline' | 'failed';
export type TurnOn = { state: PushState; why?: PushWhy };

const API = '/api/push/';
/** What this phone last posted to subscribe, so an open with nothing moved sends nothing. About this browser, not the
 *  journal, so localStorage, like the launch count (pwa/hints.ts). */
export const POSTED_KEY = 'fs-push-posted';
type Posted = { endpoint: string; tz: string; weekday: number; hour: number; minute: number };

/** The worker's knock (public/push-sw.js): a tap on the notification ('checkin'), or a push landing ('arrived').
 *  journal/checkin.tsx lands on the first; the Settings row reads "Last arrived" again on the second. */
export const pushKnock = signal(false);
export const pushArrived = signal(0);

const local = {
  get(): Posted | null { try { return JSON.parse(localStorage.getItem(POSTED_KEY) ?? 'null') as Posted | null; } catch { return null; } },
  set(p: Posted): void { try { localStorage.setItem(POSTED_KEY, JSON.stringify(p)); } catch { /* private mode: posts again next open */ } },
  clear(): void { try { localStorage.removeItem(POSTED_KEY); } catch { /* nothing kept */ } },
};

const zone = (): string => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } };
const isIOS = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const saveCheckin = (patch: Partial<Checkin>) => saveSettings({ checkin: { ...checkinOf(settings.peek()), ...patch } }).catch(() => undefined);

/** The states that need no await: kept synchronous so turnOn asks for permission as its first await, inside the tap. */
function blocked(): PushState | null {
  // iOS: Web Push lives only in the home-screen app; a Safari tab may not even expose the API
  if (isIOS() && !isStandalone()) return 'needsHomeScreen';
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof PushManager === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return null;
}

async function registration(wait = false): Promise<ServiceWorkerRegistration | null> {
  try {
    const now = await navigator.serviceWorker.getRegistration();
    if (now || !wait) return now ?? null;
    return await Promise.race([navigator.serviceWorker.ready, new Promise<null>(r => setTimeout(() => r(null), 5000))]);
  } catch { return null; }
}

async function subscription(reg: ServiceWorkerRegistration | null): Promise<PushSubscription | null> {
  try { return (await reg?.pushManager.getSubscription()) ?? null; } catch { return null; }
}

type Answer = { status: number; body: Record<string, unknown> };
/** One same-origin call; null when there is no connection (fetch rejects). Never throws. */
async function call(route: 'key' | 'subscribe' | 'unsubscribe' | 'test', body?: unknown): Promise<Answer | null> {
  try {
    const res = await fetch(`${API}${route}`, body === undefined
      ? { cache: 'no-store' }
      : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    let json: Record<string, unknown> = {};
    try { json = (await res.json()) as Record<string, unknown>; } catch { /* no body */ }
    return { status: res.status, body: json };
  } catch { return null; }
}

const whyOf = (a: Answer | null): PushWhy => (!a ? 'offline' : a.status === 503 ? 'not_configured' : 'failed');

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** A new subscription with the server's VAPID key. */
async function subscribeNew(reg: ServiceWorkerRegistration): Promise<PushSubscription | PushWhy> {
  const a = await call('key');
  if (!a || a.status !== 200 || typeof a.body.key !== 'string') return whyOf(a);
  try { return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(a.body.key) }); }
  catch { return 'failed'; }
}

const postedOf = (sub: PushSubscription, c: Checkin): Posted => ({ endpoint: sub.endpoint, tz: zone(), weekday: c.weekday, hour: c.hour, minute: c.minute });
const samePosted = (a: Posted | null, b: Posted) => !!a && a.endpoint === b.endpoint && a.tz === b.tz && a.weekday === b.weekday && a.hour === b.hour && a.minute === b.minute;

/** Posts this phone's address and schedule; replaces names the address posted before, when iOS has since changed it. */
async function post(sub: PushSubscription, replaces?: string): Promise<PushWhy | null> {
  const p = postedOf(sub, checkinOf(settings.peek()));
  const json = sub.toJSON();
  const a = await call('subscribe', {
    subscription: { endpoint: sub.endpoint, keys: json.keys },
    tz: p.tz, weekday: p.weekday, hour: p.hour, minute: p.minute,
    ...(replaces && replaces !== sub.endpoint ? { replaces } : {}),
  });
  if (a?.status !== 200) return whyOf(a);
  local.set(p);
  return null;
}

export async function pushState(): Promise<PushState> {
  const b = blocked();
  if (b) return b;
  if (!checkinOf(settings.peek()).push || Notification.permission !== 'granted') return 'off';
  return (await subscription(await registration())) ? 'on' : 'off';
}

/** Only ever from his tap: permission is asked first, before any other await, so iOS sees the tap. */
export async function turnOn(): Promise<TurnOn> {
  const b = blocked();
  if (b) return { state: b };
  let perm: NotificationPermission = Notification.permission;
  if (perm !== 'granted') {
    try { perm = await Notification.requestPermission(); } catch { return { state: 'off', why: 'failed' }; }
  }
  if (perm === 'denied') return { state: 'denied' };
  if (perm !== 'granted') return { state: 'off' };
  const reg = await registration(true);
  if (!reg) return { state: 'off', why: 'failed' };
  let sub = await subscription(reg);
  if (!sub) {
    const made = await subscribeNew(reg);
    if (typeof made === 'string') return { state: 'off', why: made };
    sub = made;
  }
  const last = local.get();
  const why = await post(sub, last?.endpoint);
  if (why) return { state: 'off', why };
  await saveCheckin({ push: true });
  await writePushLine(checkinOf(settings.peek()).line);
  return { state: 'on' };
}

/** Off here first (the switch answers at once), then the subscription, then the server; offline, the server finds out
 *  from the push service the next Sunday (a 410 deletes the address). */
export async function turnOff(): Promise<'off'> {
  await saveCheckin({ push: false });
  const last = local.get();
  local.clear();
  await clearPushStore();
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'off';
  const sub = await subscription(await registration());
  const endpoint = sub?.endpoint ?? last?.endpoint;
  if (sub) { try { await sub.unsubscribe(); } catch { /* gone already */ } }
  if (endpoint) await call('unsubscribe', { endpoint });
  return 'off';
}

/** "Send one now": the server pushes the wordless payload to this phone's own address. A 410 (the push service dropped
 *  it) or a 409 (the server lost it) subscribes again once and tries once more. */
export async function sendNow(): Promise<'sent' | PushWhy> {
  if (blocked()) return 'failed';
  const reg = await registration();
  if (!reg) return 'failed';
  let sub = await subscription(reg);
  if (!sub) {
    const made = await subscribeNew(reg);
    if (typeof made === 'string') return made;
    sub = made;
    const why = await post(sub, local.get()?.endpoint);
    if (why) return why;
  }
  let a = await call('test', { endpoint: sub.endpoint });
  if (a?.status === 409 || a?.status === 410) {
    const old = sub.endpoint;
    if (a.status === 410) {
      try { await sub.unsubscribe(); } catch { /* already gone */ }
      const made = await subscribeNew(reg);
      if (typeof made === 'string') return made;
      sub = made;
    }
    const why = await post(sub, old);
    if (why) return why;
    a = await call('test', { endpoint: sub.endpoint });
  }
  return a?.status === 200 ? 'sent' : whyOf(a);
}

let moving: Promise<unknown> | null = null;
let moveAgain = false;

/**
 * On open, on return to the front, and when the time changes, with push on: reads the subscription here and posts only
 * if the address is missing or changed, the zone changed, or the schedule changed since the last post. A normal open
 * makes no request. A changed address names the old one as replaces, so the server keeps its week stamp.
 */
export function resubscribeIfMoved(): Promise<'still' | 'posted' | 'skipped' | PushWhy> {
  if (moving) { moveAgain = true; return moving as Promise<'still'>; }
  const run = (async () => {
    const c = checkinOf(settings.peek());
    if (!c.on || !c.push || blocked() || Notification.permission !== 'granted') return 'skipped' as const;
    const reg = await registration();
    if (!reg) return 'skipped' as const;
    let sub = await subscription(reg);
    const last = local.get();
    if (!sub) {
      const made = await subscribeNew(reg);
      if (typeof made === 'string') return made;
      sub = made;
    }
    if (samePosted(last, postedOf(sub, c))) return 'still' as const;
    return (await post(sub, last?.endpoint)) ?? ('posted' as const);
  })().finally(() => {
    moving = null;
    if (moveAgain) { moveAgain = false; void resubscribeIfMoved(); }
  });
  moving = run;
  return run;
}

/** main.tsx, after the settings load. Returns a stop function (tests). */
export function startPush(doc: Document = document): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => undefined;
  const onMessage = (e: MessageEvent) => {
    const kind = (e.data as { kind?: unknown } | null)?.kind;
    if (kind === 'checkin') pushKnock.value = true;
    else if (kind === 'arrived') pushArrived.value++;
  };
  // a sandboxed frame (the walkthroughs) has a navigator.serviceWorker that throws when touched: no push there
  try { navigator.serviceWorker.addEventListener('message', onMessage); } catch { return () => undefined; }
  const onFront = () => { if (doc.visibilityState === 'visible') void resubscribeIfMoved(); };
  doc.addEventListener('visibilitychange', onFront);
  // the line's mirror for the worker, the schedule's re-post, and the question's switch taking push with it
  let seen = '';
  const stop = effect(() => {
    const c = checkinOf(settings.value);
    const key = JSON.stringify([c.on, !!c.push, c.line, c.weekday, c.hour, c.minute]);
    if (key === seen) return;
    seen = key;
    if (!c.push) return;
    if (!c.on) { void turnOff(); return; }
    void writePushLine(c.line);
    void resubscribeIfMoved();
  });
  return () => {
    try { navigator.serviceWorker.removeEventListener('message', onMessage); } catch { /* gone with the frame */ }
    doc.removeEventListener('visibilitychange', onFront);
    stop();
  };
}
