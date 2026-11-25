// The /api/push/* routes (PLAN-PUSH.md section 5, "Guarding a public endpoint").
// There are no accounts, so every input is checked hard: the endpoint must be
// https on a known push host, the zone a real IANA zone, the time in range, the
// body small; the store holds at most four phones; test sends only to an
// address that is already stored, and only ever the wordless payload.

import { isValidZone } from './due.mts';
import { keyFor, MAX_DEVICES, type Device, type DeviceStore, type PushSubscriptionJSON } from './store.mts';
import type { SendResult } from './send.mts';

export interface RouteDeps {
  store: () => Promise<DeviceStore>;
  /** null when VAPID is not configured. */
  send: () => Promise<((s: PushSubscriptionJSON) => Promise<SendResult>) | null>;
  publicKey: () => string | undefined;
  now?: () => Date;
}

/** Bytes; a real subscribe body is about 400. */
export const MAX_BODY = 4096;

const PUSH_HOSTS = [/^[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com$/, /^updates\.push\.services\.mozilla\.com$/];

/** True for an https URL on a known Web Push service, with no credentials or odd port. */
export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false;
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  return PUSH_HOSTS.some(re => re.test(u.hostname));
}

const b64url = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && /^[A-Za-z0-9_\-=]+$/.test(v);
const int = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (status: number, error: string, field?: string) => json(status, field ? { error, field } : { error });

class BadRequest extends Error {
  constructor(
    public status: number,
    public code: string,
    public field?: string,
  ) {
    super(code);
  }
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY) throw new BadRequest(413, 'too_large');
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY) throw new BadRequest(413, 'too_large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new BadRequest(400, 'bad_json');
  }
  if (!isObj(body)) throw new BadRequest(400, 'bad_json');
  return body;
}

function readSubscribe(body: Record<string, unknown>): Omit<Device, 'updatedAt' | 'lastSentWeek'> {
  const sub = body.subscription;
  if (!isObj(sub) || !isPushEndpoint(sub.endpoint)) throw new BadRequest(400, 'invalid', 'endpoint');
  const keys = sub.keys;
  if (!isObj(keys) || !b64url(keys.p256dh, 200) || !b64url(keys.auth, 100)) throw new BadRequest(400, 'invalid', 'keys');
  if (!isValidZone(body.tz)) throw new BadRequest(400, 'invalid', 'tz');
  if (!int(body.weekday, 0, 6)) throw new BadRequest(400, 'invalid', 'weekday');
  if (!int(body.hour, 0, 23)) throw new BadRequest(400, 'invalid', 'hour');
  if (!int(body.minute, 0, 59)) throw new BadRequest(400, 'invalid', 'minute');
  return {
    // Rebuilt, so nothing but these fields is stored (expirationTime and extras dropped).
    subscription: { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    tz: body.tz,
    weekday: body.weekday,
    hour: body.hour,
    minute: body.minute,
  };
}

/** subscribe's optional replaces: the address this phone posted last, when iOS has since given it a new one. */
function readReplaces(body: Record<string, unknown>): string | null {
  if (body.replaces === undefined || body.replaces === null) return null;
  if (!isPushEndpoint(body.replaces)) throw new BadRequest(400, 'invalid', 'replaces');
  return body.replaces;
}

function readEndpoint(body: Record<string, unknown>): string {
  if (!isPushEndpoint(body.endpoint)) throw new BadRequest(400, 'invalid', 'endpoint');
  return body.endpoint;
}

export function makePushHandler(deps: RouteDeps) {
  const now = deps.now ?? (() => new Date());

  return async function handle(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    const route = `${req.method} ${path}`;
    try {
      switch (route) {
        case 'GET /api/push/key': {
          const key = deps.publicKey();
          return key ? json(200, { key }) : fail(503, 'not_configured');
        }

        case 'POST /api/push/subscribe': {
          const body = await readBody(req);
          const device = readSubscribe(body);
          const replaces = readReplaces(body);
          const store = await deps.store();
          const key = keyFor(device.subscription.endpoint);
          const existing = await store.get(key);
          // iOS gave the phone a new push address: the old one's blob is the same phone, so it hands over its week
          // stamp and goes, and it does not count toward the cap (N3, resubscribeIfMoved).
          const oldKey = replaces && replaces !== device.subscription.endpoint ? keyFor(replaces) : null;
          const old = oldKey ? await store.get(oldKey) : null;
          if (!existing && !old) {
            const count = (await store.keys()).length;
            if (count >= MAX_DEVICES) return fail(409, 'too_many_devices');
          }
          // An update keeps the week stamp, so a re-subscribe never earns a second push that week.
          const next: Device = { ...device, updatedAt: now().toISOString() };
          const week = [existing?.lastSentWeek, old?.lastSentWeek].filter((w): w is string => !!w).sort().pop();
          if (week) next.lastSentWeek = week;
          await store.set(key, next);
          if (oldKey && old) await store.delete(oldKey);
          return json(200, { ok: true });
        }

        case 'POST /api/push/unsubscribe': {
          const endpoint = readEndpoint(await readBody(req));
          const store = await deps.store();
          await store.delete(keyFor(endpoint));
          return json(200, { ok: true });
        }

        case 'POST /api/push/test': {
          const endpoint = readEndpoint(await readBody(req));
          const store = await deps.store();
          const key = keyFor(endpoint);
          const device = await store.get(key);
          // 409, not 404: Netlify retries a function's 404 against .html variants of the path.
          if (!device) return fail(409, 'not_subscribed');
          const send = await deps.send();
          if (!send) return fail(503, 'not_configured');
          const result = await send(device.subscription);
          if (result === 'gone') {
            await store.delete(key);
            return fail(410, 'gone');
          }
          if (result === 'failed') return fail(502, 'push_failed');
          return json(200, { ok: true });
        }

        default:
          return fail(404, 'not_found');
      }
    } catch (err) {
      if (err instanceof BadRequest) return fail(err.status, err.code, err.field);
      console.warn('[push] route failed:', route, (err as Error | null)?.message ?? '');
      return fail(500, 'server_error');
    }
  };
}
