// The phone's half of the Sunday question's push (PLAN-PUSH.md N3, src/push/push.ts), with navigator.serviceWorker,
// PushManager, Notification and fetch stubbed: each state, turnOn and each of its failures, resubscribeIfMoved posting
// only when something moved (and naming the old address as replaces), and offline staying quiet.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@preact/signals';
import type { Settings } from '../../src/db/schema';

const settingsSig = signal({ checkin: undefined } as unknown as Settings);
vi.mock('../../src/ui/settings', () => ({
  settings: settingsSig,
  saveSettings: async (patch: Partial<Settings>) => { settingsSig.value = { ...settingsSig.value, ...patch }; },
}));

const push = await import('../../src/push/push');
const store = await import('../../src/push/store');
const { pushState, turnOn, turnOff, sendNow, resubscribeIfMoved, startPush, pushKnock, POSTED_KEY } = push;

const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const APPLE = 'https://web.push.apple.com/first';
const APPLE2 = 'https://web.push.apple.com/second';

type Sub = { endpoint: string; toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } }; unsubscribe: () => Promise<boolean> };
let current: Sub | null;
let nextEndpoint: string;
let permission: NotificationPermission;
let askAnswer: NotificationPermission;
let standalone: boolean;
let routes: Record<string, (body: Record<string, unknown> | undefined) => [number, unknown] | 'offline'>;
let calls: { route: string; body?: Record<string, unknown> }[];

const makeSub = (endpoint: string): Sub => ({
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh: 'p256', auth: 'auth' } }),
  unsubscribe: vi.fn(async () => { if (current?.endpoint === endpoint) current = null; return true; }),
});
const subscribe = vi.fn(async () => { current = makeSub(nextEndpoint); return current; });
const reg = { pushManager: { getSubscription: async () => current, subscribe } };
const requestPermission = vi.fn(async () => { permission = askAnswer; return askAnswer; });

const ok = (): [number, unknown] => [200, { ok: true }];
const setCheckin = (patch: Record<string, unknown>) => {
  settingsSig.value = { ...settingsSig.value, checkin: { on: true, weekday: 0, hour: 10, minute: 0, line: 'Is there anything on your mind?', ...patch } } as Settings;
};
const posted = () => JSON.parse(localStorage.getItem(POSTED_KEY) ?? 'null');

beforeEach(async () => {
  current = null;
  nextEndpoint = APPLE;
  permission = 'default';
  askAnswer = 'granted';
  standalone = true;
  calls = [];
  subscribe.mockClear();
  requestPermission.mockClear();
  routes = { key: () => [200, { key: KEY }], subscribe: ok, unsubscribe: ok, test: ok };
  settingsSig.value = { checkin: undefined } as unknown as Settings;
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    get standalone() { return standalone; },
    serviceWorker: { getRegistration: async () => reg, ready: Promise.resolve(reg), addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('PushManager', function PushManager() { /* exists */ });
  vi.stubGlobal('Notification', { get permission() { return permission; }, requestPermission });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const route = url.replace('/api/push/', '');
    expect(url.startsWith('/api/push/')).toBe(true);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ route, body });
    const r = routes[route](body);
    if (r === 'offline') throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(r[1]), { status: r[0] });
  }));
  await store.clearPushStore();
});
afterEach(() => vi.unstubAllGlobals());

describe('pushState', () => {
  it('needs the home-screen app on an iPhone in Safari', async () => {
    standalone = false;
    expect(await pushState()).toBe('needsHomeScreen');
  });
  it('is unsupported with no PushManager outside iOS', async () => {
    vi.stubGlobal('PushManager', undefined);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux)', serviceWorker: {} });
    expect(await pushState()).toBe('unsupported');
  });
  it('is denied when iOS says so', async () => {
    permission = 'denied';
    expect(await pushState()).toBe('denied');
  });
  it('is off until he switched it on, and on with permission and a subscription', async () => {
    permission = 'granted';
    current = makeSub(APPLE);
    expect(await pushState()).toBe('off');
    setCheckin({ push: true });
    expect(await pushState()).toBe('on');
    current = null;
    expect(await pushState()).toBe('off');
  });
});

describe('turnOn', () => {
  it('asks, subscribes with the server key, posts the schedule and zone, and mirrors the line', async () => {
    setCheckin({ hour: 9, minute: 30, line: 'What is on your mind?' });
    expect(await turnOn()).toEqual({ state: 'on' });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(calls.map(c => c.route)).toEqual(['key', 'subscribe']);
    expect(calls[1].body).toEqual({
      subscription: { endpoint: APPLE, keys: { p256dh: 'p256', auth: 'auth' } },
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone, weekday: 0, hour: 9, minute: 30,
    });
    expect(settingsSig.value.checkin?.push).toBe(true);
    expect(await store.readPushLine()).toBe('What is on your mind?');
    expect(posted()).toMatchObject({ endpoint: APPLE, hour: 9, minute: 30 });
  });
  it('asks for permission before any other await (iOS needs the tap)', async () => {
    let first = '';
    requestPermission.mockImplementationOnce(async () => { first ||= 'permission'; permission = 'granted'; return 'granted'; });
    const getReg = navigator.serviceWorker.getRegistration;
    (navigator.serviceWorker as { getRegistration: unknown }).getRegistration = async () => { first ||= 'registration'; return getReg.call(navigator.serviceWorker); };
    await turnOn();
    expect(first).toBe('permission');
  });
  it('reads denied when he says no, and posts nothing', async () => {
    askAnswer = 'denied';
    expect(await turnOn()).toEqual({ state: 'denied' });
    expect(calls).toEqual([]);
  });
  it('stays off when he dismisses the prompt', async () => {
    askAnswer = 'default';
    expect(await turnOn()).toEqual({ state: 'off' });
  });
  it('stays off with not_configured when the server has no keys', async () => {
    routes.key = () => [503, { error: 'not_configured' }];
    expect(await turnOn()).toEqual({ state: 'off', why: 'not_configured' });
    expect(settingsSig.value.checkin?.push).toBeFalsy();
  });
  it('stays off, quietly, offline', async () => {
    routes.key = () => 'offline';
    expect(await turnOn()).toEqual({ state: 'off', why: 'offline' });
  });
  it('stays off when the subscribe post is refused (too many devices)', async () => {
    routes.subscribe = () => [409, { error: 'too_many_devices' }];
    expect(await turnOn()).toEqual({ state: 'off', why: 'failed' });
    expect(posted()).toBeNull();
  });
  it('stays off when the push service refuses to subscribe', async () => {
    subscribe.mockImplementationOnce(async () => { throw new Error('AbortError'); });
    expect(await turnOn()).toEqual({ state: 'off', why: 'failed' });
  });
  it('does nothing in the states a tap cannot change', async () => {
    standalone = false;
    expect(await turnOn()).toEqual({ state: 'needsHomeScreen' });
    expect(requestPermission).not.toHaveBeenCalled();
  });
});

describe('turnOff', () => {
  it('unsubscribes here and on the server, and forgets the line', async () => {
    await turnOn();
    const sub = current!;
    calls = [];
    expect(await turnOff()).toBe('off');
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(calls).toEqual([{ route: 'unsubscribe', body: { endpoint: APPLE } }]);
    expect(settingsSig.value.checkin?.push).toBe(false);
    expect(await store.readPushLine()).toBeNull();
    expect(posted()).toBeNull();
  });
  it('is off here even offline', async () => {
    await turnOn();
    routes.unsubscribe = () => 'offline';
    expect(await turnOff()).toBe('off');
    expect(current).toBeNull();
  });
});

describe('sendNow', () => {
  it('posts its own endpoint to test', async () => {
    await turnOn();
    calls = [];
    expect(await sendNow()).toBe('sent');
    expect(calls).toEqual([{ route: 'test', body: { endpoint: APPLE } }]);
  });
  it('on 410 subscribes again once, naming the old address, and tries once more', async () => {
    await turnOn();
    calls = [];
    nextEndpoint = APPLE2;
    let first = true;
    routes.test = () => { if (first) { first = false; return [410, { error: 'gone' }]; } return ok(); };
    expect(await sendNow()).toBe('sent');
    expect(calls.map(c => c.route)).toEqual(['test', 'key', 'subscribe', 'test']);
    expect(calls[2].body).toMatchObject({ subscription: { endpoint: APPLE2 }, replaces: APPLE });
    expect(calls[3].body).toEqual({ endpoint: APPLE2 });
  });
  it('tries only once more', async () => {
    await turnOn();
    routes.test = () => [410, { error: 'gone' }];
    nextEndpoint = APPLE2;
    expect(await sendNow()).toBe('failed');
    expect(calls.filter(c => c.route === 'test')).toHaveLength(2);
  });
  it('says offline and not_configured', async () => {
    await turnOn();
    routes.test = () => 'offline';
    expect(await sendNow()).toBe('offline');
    routes.test = () => [503, { error: 'not_configured' }];
    expect(await sendNow()).toBe('not_configured');
  });
});

describe('resubscribeIfMoved', () => {
  beforeEach(async () => { await turnOn(); calls = []; });

  it('makes no request when nothing moved', async () => {
    expect(await resubscribeIfMoved()).toBe('still');
    expect(calls).toEqual([]);
  });
  it('does nothing with push off or the question off', async () => {
    setCheckin({ push: false });
    expect(await resubscribeIfMoved()).toBe('skipped');
    setCheckin({ push: true, on: false });
    expect(await resubscribeIfMoved()).toBe('skipped');
    expect(calls).toEqual([]);
  });
  it('posts once when the schedule moved', async () => {
    setCheckin({ push: true, hour: 8 });
    expect(await resubscribeIfMoved()).toBe('posted');
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ hour: 8 });
    expect(calls[0].body).not.toHaveProperty('replaces');
    expect(await resubscribeIfMoved()).toBe('still');
    expect(calls).toHaveLength(1);
  });
  it('posts once when the zone moved', async () => {
    localStorage.setItem(POSTED_KEY, JSON.stringify({ ...posted(), tz: 'Asia/Tokyo' }));
    expect(await resubscribeIfMoved()).toBe('posted');
    expect(calls.map(c => c.route)).toEqual(['subscribe']);
  });
  it('posts with replaces when iOS changed the address', async () => {
    current = makeSub(APPLE2);
    expect(await resubscribeIfMoved()).toBe('posted');
    expect(calls).toEqual([{ route: 'subscribe', body: expect.objectContaining({ subscription: expect.objectContaining({ endpoint: APPLE2 }), replaces: APPLE }) }]);
  });
  it('subscribes again when the subscription is missing, replacing the old address', async () => {
    current = null;
    nextEndpoint = APPLE2;
    expect(await resubscribeIfMoved()).toBe('posted');
    expect(calls.map(c => c.route)).toEqual(['key', 'subscribe']);
    expect(calls[1].body).toMatchObject({ replaces: APPLE });
  });
  it('is quiet offline, and posts on the next open with a connection', async () => {
    setCheckin({ push: true, hour: 7 });
    routes.subscribe = () => 'offline';
    expect(await resubscribeIfMoved()).toBe('offline');
    routes.subscribe = ok;
    expect(await resubscribeIfMoved()).toBe('posted');
  });
});

describe('startPush', () => {
  it('a message from the worker knocks; the question switched off takes push with it', async () => {
    const sw = navigator.serviceWorker as unknown as { addEventListener: ReturnType<typeof vi.fn> };
    const stop = startPush({ addEventListener: vi.fn(), removeEventListener: vi.fn(), visibilityState: 'visible' } as unknown as Document);
    const onMessage = sw.addEventListener.mock.calls.find(c => c[0] === 'message')![1] as (e: { data: unknown }) => void;
    onMessage({ data: { kind: 'checkin' } });
    expect(pushKnock.value).toBe(true);
    pushKnock.value = false;
    await turnOn();
    setCheckin({ push: true, on: false });
    await vi.waitFor(() => expect(settingsSig.value.checkin?.push).toBe(false));
    await vi.waitFor(() => expect(calls.some(c => c.route === 'unsubscribe')).toBe(true));
    stop();
  });
  it('mirrors a changed line while push is on, and re-posts a changed time', async () => {
    await turnOn();
    const stop = startPush({ addEventListener: vi.fn(), removeEventListener: vi.fn(), visibilityState: 'visible' } as unknown as Document);
    calls = [];
    setCheckin({ push: true, line: 'Anything this week?', hour: 11 });
    await vi.waitFor(async () => expect(await store.readPushLine()).toBe('Anything this week?'));
    await vi.waitFor(() => expect(calls.filter(c => c.route === 'subscribe')).toHaveLength(1));
    expect(calls[0].body).toMatchObject({ hour: 11 });
    stop();
  });
});
