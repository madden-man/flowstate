// The service worker's two handlers (PLAN-PUSH.md N3, public/push-sw.js), loaded into a fake `self`: a push always
// shows a notification (his line from fs-push, or the bare title when the store is empty or throws), tagged checkin,
// and stamps lastArrivedAt; a tap focuses the open app and lands it (a message and the address), or opens the address.
// The names the worker shares with the app are read from both files, so the two cannot drift apart.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import { PUSH_DB, PUSH_STORE, PUSH_DB_VERSION, clearPushStore, readLastArrived, writePushLine } from '../../src/push/store';

const code = fs.readFileSync('public/push-sw.js', 'utf8');
const ORIGIN = 'https://flowstate-journal.netlify.app';

type Handler = (e: { waitUntil: (p: Promise<unknown>) => void; [k: string]: unknown }) => void;
function load(idb: IDBFactory = indexedDB) {
  const handlers: Record<string, Handler> = {};
  const wins: { url: string; focus: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> }[] = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => { handlers[type] = fn; },
    registration: { showNotification: vi.fn(async (_title: string, _options?: object) => undefined) },
    clients: { matchAll: vi.fn(async () => wins), openWindow: vi.fn(async () => null) },
  };
  new Function('self', 'indexedDB', code)(self, idb);
  const fire = async (type: string, extra: Record<string, unknown> = {}) => {
    let done: Promise<unknown> = Promise.resolve();
    handlers[type]({ waitUntil: p => { done = p; }, ...extra });
    await done;
  };
  const win = (url: string) => {
    const w = { url, focus: vi.fn(async () => w), navigate: vi.fn(async () => w), postMessage: vi.fn() };
    wins.push(w);
    return w;
  };
  return { self, fire, win };
}

const constant = (name: string) => code.match(new RegExp(`const ${name} = ([^;]+);`))![1];

beforeEach(async () => { await clearPushStore(); });

describe('kept in step with the app', () => {
  it('the fs-push names are the ones src/push/store.ts uses', () => {
    expect(constant('PUSH_DB')).toBe(`'${PUSH_DB}'`);
    expect(constant('PUSH_STORE')).toBe(`'${PUSH_STORE}'`);
    expect(constant('PUSH_DB_VERSION')).toBe(String(PUSH_DB_VERSION));
  });
  it('the address a tap opens is / + CHECKIN_HASH from journal/checkin.tsx', () => {
    const tsx = fs.readFileSync('src/ui/journal/checkin.tsx', 'utf8');
    const ask = tsx.match(/export const ASK_CHECKIN = '([^']+)'/)![1];
    const hash = tsx.match(/export const CHECKIN_HASH = `([^`]+)`/)![1].replace('${ASK_CHECKIN}', ask);
    expect(constant('CHECKIN_URL')).toBe(`'/${hash}'`);
  });
  it('the icon is one the app ships', () => {
    expect(fs.existsSync(`public${constant('PUSH_ICON').replace(/'/g, '')}`)).toBe(true);
  });
  it('carries no address but its own origin\'s paths', () => {
    expect(code).not.toMatch(/https?:\/\//);
  });
});

describe('push', () => {
  it('shows his line, tagged checkin, and stamps lastArrivedAt', async () => {
    await writePushLine('Is there anything on your mind?');
    const { self, fire, win } = load();
    const w = win(`${ORIGIN}/#/journal`);
    const before = Date.now();
    await fire('push');
    expect(self.registration.showNotification).toHaveBeenCalledTimes(1);
    expect(self.registration.showNotification).toHaveBeenCalledWith('FlowState', {
      body: 'Is there anything on your mind?', tag: 'checkin', icon: '/icon-192.png', data: { url: '/#/journal?ask=checkin' },
    });
    const at = await readLastArrived();
    expect(at).toBeGreaterThanOrEqual(before);
    expect(w.postMessage).toHaveBeenCalledWith({ kind: 'arrived', at });
  });
  it('shows the bare title when the store is empty', async () => {
    const { self, fire } = load();
    await fire('push');
    expect(self.registration.showNotification).toHaveBeenCalledWith('FlowState', { tag: 'checkin', icon: '/icon-192.png', data: { url: '/#/journal?ask=checkin' } });
  });
  it('shows the bare title when IndexedDB throws', async () => {
    const broken = { open: () => { throw new Error('no IndexedDB in this wake'); } } as unknown as IDBFactory;
    const { self, fire } = load(broken);
    await fire('push');
    expect(self.registration.showNotification).toHaveBeenCalledTimes(1);
    expect(self.registration.showNotification.mock.calls[0]).toEqual(['FlowState', { tag: 'checkin', icon: '/icon-192.png', data: { url: '/#/journal?ask=checkin' } }]);
  });
  it('still shows the bare title when showing with the line fails', async () => {
    await writePushLine('A line');
    const { self, fire } = load();
    self.registration.showNotification.mockRejectedValueOnce(new Error('bad options'));
    await fire('push');
    expect(self.registration.showNotification).toHaveBeenCalledTimes(2);
    expect(self.registration.showNotification.mock.calls[1][1]).not.toHaveProperty('body');
  });
});

describe('notificationclick', () => {
  const tap = () => ({ notification: { close: vi.fn(), data: { url: '/#/journal?ask=checkin' } } });

  it('closes it, focuses the open app, sends the knock and navigates it to the question', async () => {
    const { self, fire, win } = load();
    const w = win(`${ORIGIN}/#/be`);
    const e = tap();
    await fire('notificationclick', e);
    expect(e.notification.close).toHaveBeenCalled();
    expect(w.focus).toHaveBeenCalled();
    expect(w.postMessage).toHaveBeenCalledWith({ kind: 'checkin' });
    expect(w.navigate).toHaveBeenCalledWith(`${ORIGIN}/#/journal?ask=checkin`);
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });
  it('a navigate that fails is fine: the knock lands it', async () => {
    const { fire, win } = load();
    const w = win(`${ORIGIN}/`);
    w.navigate.mockRejectedValueOnce(new TypeError('not controlled'));
    await fire('notificationclick', tap());
    expect(w.postMessage).toHaveBeenCalledWith({ kind: 'checkin' });
  });
  it('opens the question when no window is open', async () => {
    const { self, fire, win } = load();
    win('https://elsewhere.example/');
    await fire('notificationclick', tap());
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/#/journal?ask=checkin`);
  });
});
