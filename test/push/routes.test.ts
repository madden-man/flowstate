import { describe, expect, it, vi } from 'vitest';
import { isPushEndpoint, makePushHandler, MAX_BODY } from '../../netlify/functions/lib/routes.mts';
import { keyFor, memoryStore, type Device } from '../../netlify/functions/lib/store.mts';
import type { SendResult } from '../../netlify/functions/lib/send.mts';

const APPLE = 'https://web.push.apple.com/QGuQyavXutnMH';
const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const NOW = new Date('2026-11-25T12:00:00Z');

const body = (endpoint = APPLE, extra: Record<string, unknown> = {}) => ({
  subscription: { endpoint, keys, expirationTime: null },
  tz: 'America/Denver',
  weekday: 0,
  hour: 10,
  minute: 0,
  ...extra,
});

const device = (endpoint: string, extra: Partial<Device> = {}): Device => ({
  subscription: { endpoint, keys },
  tz: 'America/Denver',
  weekday: 0,
  hour: 10,
  minute: 0,
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...extra,
});

function setup(seed: Record<string, Device> = {}, result: SendResult = 'sent', publicKey: string | null = 'BPUBLIC') {
  const store = memoryStore(seed);
  const send = vi.fn(async () => result);
  const handle = makePushHandler({ store: async () => store, send: async () => send, publicKey: () => publicKey ?? undefined, now: () => NOW });
  const call = async (method: string, path: string, payload?: unknown, raw?: string) => {
    const res = await handle(
      new Request(`https://flowstate.example${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: raw ?? (payload === undefined ? undefined : JSON.stringify(payload)),
      }),
    );
    return { status: res.status, json: await res.json() };
  };
  return { store, send, call };
}

describe('isPushEndpoint', () => {
  it('allows the four push services over https', () => {
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushEndpoint('https://api.push.apple.com/abc')).toBe(true);
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpoint('https://wns2-by3p.notify.windows.com/w/?token=abc')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
  });

  it('refuses http, other hosts, look-alikes, ports and credentials', () => {
    expect(isPushEndpoint('http://web.push.apple.com/abc')).toBe(false);
    expect(isPushEndpoint('https://example.com/abc')).toBe(false);
    expect(isPushEndpoint('https://push.apple.com.evil.com/abc')).toBe(false);
    expect(isPushEndpoint('https://evilpush.apple.com/abc')).toBe(false);
    expect(isPushEndpoint('https://fcm.googleapis.com.evil.com/abc')).toBe(false);
    expect(isPushEndpoint('https://web.push.apple.com:8443/abc')).toBe(false);
    expect(isPushEndpoint('https://u:p@web.push.apple.com/abc')).toBe(false);
    expect(isPushEndpoint('not a url')).toBe(false);
    expect(isPushEndpoint(42)).toBe(false);
  });
});

describe('GET /api/push/key', () => {
  it('returns the public key', async () => {
    expect(await setup().call('GET', '/api/push/key')).toEqual({ status: 200, json: { key: 'BPUBLIC' } });
  });

  it('says so when VAPID is not set', async () => {
    expect(await setup({}, 'sent', null).call('GET', '/api/push/key')).toEqual({ status: 503, json: { error: 'not_configured' } });
  });
});

describe('POST /api/push/subscribe', () => {
  it('stores the device under sha256(endpoint), with only the known fields', async () => {
    const { call, store } = setup();
    expect(await call('POST', '/api/push/subscribe', body())).toEqual({ status: 200, json: { ok: true } });
    expect(store.data.get(keyFor(APPLE))).toEqual({
      subscription: { endpoint: APPLE, keys },
      tz: 'America/Denver',
      weekday: 0,
      hour: 10,
      minute: 0,
      updatedAt: NOW.toISOString(),
    });
    expect(keyFor(APPLE)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['bad host', body('https://example.com/push'), 'endpoint'],
    ['http', body('http://web.push.apple.com/x'), 'endpoint'],
    ['bad tz', body(APPLE, { tz: 'Nowhere/Land' }), 'tz'],
    ['weekday 7', body(APPLE, { weekday: 7 }), 'weekday'],
    ['hour 24', body(APPLE, { hour: 24 }), 'hour'],
    ['minute 60', body(APPLE, { minute: 60 }), 'minute'],
    ['minute as a string', body(APPLE, { minute: '0' }), 'minute'],
    ['fractional hour', body(APPLE, { hour: 9.5 }), 'hour'],
    ['missing keys', { ...body(), subscription: { endpoint: APPLE } }, 'keys'],
  ])('refuses %s', async (_name, payload, field) => {
    const { call, store } = setup();
    expect(await call('POST', '/api/push/subscribe', payload)).toEqual({ status: 400, json: { error: 'invalid', field } });
    expect(store.data.size).toBe(0);
  });

  it('refuses a body that is not JSON', async () => {
    expect((await setup().call('POST', '/api/push/subscribe', undefined, '{nope')).json).toEqual({ error: 'bad_json' });
  });

  it('refuses an oversized body', async () => {
    const big = body(APPLE, { pad: 'x'.repeat(MAX_BODY) });
    expect(await setup().call('POST', '/api/push/subscribe', big)).toEqual({ status: 413, json: { error: 'too_large' } });
  });

  it('refuses a fifth device', async () => {
    const seed = Object.fromEntries([1, 2, 3, 4].map(i => [keyFor(`${APPLE}${i}`), device(`${APPLE}${i}`)]));
    const { call, store } = setup(seed);
    expect(await call('POST', '/api/push/subscribe', body(`${APPLE}5`))).toEqual({ status: 409, json: { error: 'too_many_devices' } });
    expect(store.data.size).toBe(4);
  });

  it('lets one of four existing devices update, keeping its week stamp', async () => {
    const seed = Object.fromEntries([1, 2, 3, 4].map(i => [keyFor(`${APPLE}${i}`), device(`${APPLE}${i}`, { lastSentWeek: '2026-11-22' })]));
    const { call, store } = setup(seed);
    expect(await call('POST', '/api/push/subscribe', body(`${APPLE}2`, { tz: 'Asia/Tokyo', hour: 9 }))).toEqual({ status: 200, json: { ok: true } });
    const d = store.data.get(keyFor(`${APPLE}2`));
    expect(d).toMatchObject({ tz: 'Asia/Tokyo', hour: 9, lastSentWeek: '2026-11-22', updatedAt: NOW.toISOString() });
    expect(store.data.size).toBe(4);
  });
});

describe('POST /api/push/unsubscribe', () => {
  it('deletes the device', async () => {
    const { call, store } = setup({ [keyFor(APPLE)]: device(APPLE) });
    expect(await call('POST', '/api/push/unsubscribe', { endpoint: APPLE })).toEqual({ status: 200, json: { ok: true } });
    expect(store.data.size).toBe(0);
  });

  it('is fine when the device is already gone', async () => {
    expect((await setup().call('POST', '/api/push/unsubscribe', { endpoint: APPLE })).status).toBe(200);
  });

  it('refuses an endpoint that is not a push address', async () => {
    expect((await setup().call('POST', '/api/push/unsubscribe', { endpoint: 'https://example.com' })).status).toBe(400);
  });
});

describe('POST /api/push/test', () => {
  it('sends only to a stored endpoint', async () => {
    const { call, send } = setup();
    expect(await call('POST', '/api/push/test', { endpoint: APPLE })).toEqual({ status: 409, json: { error: 'not_subscribed' } });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends to the stored subscription of that endpoint', async () => {
    const other = 'https://fcm.googleapis.com/fcm/send/other';
    const { call, send } = setup({ [keyFor(APPLE)]: device(APPLE), [keyFor(other)]: device(other) });
    expect(await call('POST', '/api/push/test', { endpoint: APPLE })).toEqual({ status: 200, json: { ok: true } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ endpoint: APPLE, keys });
  });

  it('deletes the device when the push service says it is gone', async () => {
    const { call, store } = setup({ [keyFor(APPLE)]: device(APPLE) }, 'gone');
    expect(await call('POST', '/api/push/test', { endpoint: APPLE })).toEqual({ status: 410, json: { error: 'gone' } });
    expect(store.data.size).toBe(0);
  });

  it('keeps the device on any other failure', async () => {
    const { call, store } = setup({ [keyFor(APPLE)]: device(APPLE) }, 'failed');
    expect(await call('POST', '/api/push/test', { endpoint: APPLE })).toEqual({ status: 502, json: { error: 'push_failed' } });
    expect(store.data.size).toBe(1);
  });
});

describe('anything else', () => {
  it.each([
    ['GET', '/api/push/subscribe'],
    ['POST', '/api/push/key'],
    ['GET', '/api/push/nope'],
    ['DELETE', '/api/push/unsubscribe'],
  ])('%s %s is 404', async (method, path) => {
    expect(await setup().call(method, path, method === 'POST' ? {} : undefined)).toEqual({ status: 404, json: { error: 'not_found' } });
  });

  it('answers a store failure without a stack trace', async () => {
    const handle = makePushHandler({
      store: async () => {
        throw new Error('blob store down at /secret/path');
      },
      send: async () => null,
      publicKey: () => 'K',
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await handle(new Request('https://x/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: APPLE }) }));
    warn.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'server_error' });
  });
});
