// The Sunday question's push, the phone's half (PLAN-PUSH.md N3), in the states a desktop Chromium can reach. Real push
// delivery from Apple cannot be tested here: PushManager is stubbed (Chromium would call its own push service), the
// four /api/push/ routes are answered by page.route, and the home-screen app is stood in for by navigator.standalone.
// What is real: the built service worker with public/push-sw.js imported, its push handler (woken through the DevTools
// protocol), fs-push, the Settings row, and the landing from the worker's message.
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const LINE = 'Is there anything on your mind?';
const SUN = new Date(2026, 10, 22, 10, 1);
const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

test.use({ viewport: { width: 390, height: 844 } });

async function enter(page: Page, url: string) {
  await page.goto(url);
  await page.reload();
  await page.locator('.fs-app, [data-lock]').first().waitFor();
  const t = page.locator('[data-threshold]:not([data-lock])');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

/** The home-screen app, with PushManager answering from memory (kept across reloads in localStorage). */
async function homeScreen(context: BrowserContext, opts: { denied?: boolean; noPush?: boolean } = {}) {
  await context.addInitScript(o => {
    Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true });
    // headless Chromium answers denied whatever is granted, so the permission is stood in for too
    let perm = o.denied ? 'denied' : localStorage.getItem('e2e-perm') ?? 'default';
    Object.defineProperty(Notification, 'permission', { get: () => perm, configurable: true });
    Notification.requestPermission = async () => {
      if (perm === 'default') { perm = 'granted'; localStorage.setItem('e2e-perm', perm); }
      return perm as NotificationPermission;
    };
    if (o.noPush) { delete (window as { PushManager?: unknown }).PushManager; return; }
    const make = (endpoint: string) => ({
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ', auth: 'tBHItJI5svbpez7KI4CCXg' } }),
      unsubscribe: async () => { localStorage.removeItem('e2e-sub'); return true; },
    });
    PushManager.prototype.getSubscription = async function () { const e = localStorage.getItem('e2e-sub'); return (e ? make(e) : null) as never; };
    PushManager.prototype.subscribe = async function () { localStorage.setItem('e2e-sub', 'https://web.push.apple.com/e2e'); return make('https://web.push.apple.com/e2e') as never; };
  }, opts);
  await context.grantPermissions(['notifications']);
}

type Calls = { route: string; body?: Record<string, unknown> }[];
async function server(page: Page, answer: Partial<Record<string, [number, unknown] | 'offline'>> = {}): Promise<Calls> {
  const calls: Calls = [];
  await page.route('**/api/push/*', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    const body = route.request().postData();
    calls.push({ route: name, body: body ? JSON.parse(body) : undefined });
    const a = answer[name] ?? (name === 'key' ? [200, { key: KEY }] : [200, { ok: true }]);
    if (a === 'offline') return route.abort('internetdisconnected');
    await route.fulfill({ status: a[0], contentType: 'application/json', body: JSON.stringify(a[1]) });
  });
  return calls;
}

async function openRow(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const row = page.locator('[data-sheet="Settings"] [data-checkin]');
  await row.scrollIntoViewIfNeeded();
  return row;
}

const swReady = (page: Page) => page.waitForFunction(() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.getRegistration().then(r => !!r?.active));

test('in Safari: the switch is held, and Add to Home Screen first', async ({ page }) => {
  const calls = await server(page);
  await enter(page, '/#/journal');
  const row = await openRow(page);
  const sw = row.getByRole('switch', { name: /Notify me/ });
  await expect(sw).toBeDisabled();
  await expect(row.getByText('Add to Home Screen first')).toBeVisible();
  await expect(row.locator('[data-push-send]')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/push-needs-home-day.png' });
  expect(calls).toEqual([]);
});

test('denied in iOS Settings: one line, no button', async ({ page, context }) => {
  await homeScreen(context, { denied: true });
  await enter(page, '/#/journal');
  const row = await openRow(page);
  await expect(row.getByText('Notifications are off for FlowState in iOS Settings')).toBeVisible();
  await expect(row.getByRole('switch', { name: /Notify me/ })).toHaveCount(0);
});

test('no Web Push at all: no push controls', async ({ page, context }) => {
  await homeScreen(context, { noPush: true });
  await enter(page, '/#/journal');
  const row = await openRow(page);
  await expect(row.getByRole('switch', { name: /Sunday question/ })).toBeVisible();
  await expect(row.locator('[data-push]')).toHaveCount(0);
});

test('on: subscribes and posts the schedule, Send one now, a push lands and Last arrived shows; three lights; off again', async ({ page, context }) => {
  await homeScreen(context);
  await page.clock.install({ time: SUN });
  const calls = await server(page);
  await enter(page, '/#/journal');
  await swReady(page);
  // nothing leaves the phone before the tap
  expect(calls).toEqual([]);
  const row = await openRow(page);
  const sw = row.getByRole('switch', { name: /Notify me/ });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(calls.map(c => c.route)).toEqual(['key', 'subscribe']);
  expect(calls[1].body).toMatchObject({ subscription: { endpoint: 'https://web.push.apple.com/e2e' }, weekday: 0, hour: 10, minute: 0 });
  expect(typeof calls[1].body!.tz).toBe('string');
  // the line is mirrored for the worker
  await expect.poll(() => page.evaluate(() => new Promise(res => {
    const o = indexedDB.open('fs-push');
    o.onsuccess = () => { const q = o.result.transaction('push').objectStore('push').get('line'); q.onsuccess = () => { o.result.close(); res(q.result); }; };
  }))).toBe(LINE);
  await expect(row.locator('[data-push-arrived]')).toHaveCount(0);

  await row.getByRole('button', { name: 'Send one now' }).click();
  await expect(row.locator('[data-push-note]')).toHaveText('Sent');
  expect(calls.at(-1)).toEqual({ route: 'test', body: { endpoint: 'https://web.push.apple.com/e2e' } });

  // the real worker's push handler, woken as a push service would wake it
  const cdp = await context.newCDPSession(page);
  const regId = new Promise<string>(resolve => cdp.on('ServiceWorker.workerRegistrationUpdated', e => { const r = e.registrations.find(x => !x.isDeleted); if (r) resolve(r.registrationId); }));
  await cdp.send('ServiceWorker.enable');
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(page.url()).origin, registrationId: await regId, data: '{"kind":"checkin"}' });
  // (the worker keeps the real clock, so the weekday is today's, not the page's Sunday)
  await expect(row.locator('[data-push-arrived]')).toHaveText(/^Last arrived [A-Z][a-z]+day \d\d:\d\d$/, { timeout: 15_000 });
  await page.screenshot({ path: 'test-results/push-on-day.png' });

  // a changed time posts again, once
  const before = calls.length;
  await row.locator('[data-checkin-time]').fill('09:30');
  await expect.poll(() => calls.length).toBe(before + 1);
  expect(calls.at(-1)).toMatchObject({ route: 'subscribe', body: { hour: 9, minute: 30 } });

  // a reload with nothing moved posts nothing
  await enter(page, '/#/journal');
  await expect(page.locator('.fs-page').first()).toBeVisible();
  await page.waitForTimeout(500);
  expect(calls.length).toBe(before + 1);

  const row2 = await openRow(page);
  const settings = page.locator('[data-sheet="Settings"]');
  await settings.getByRole('button', { name: 'Night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'night');
  await row2.scrollIntoViewIfNeeded();
  await expect(row2.locator('[data-push-arrived]')).toBeVisible();
  await page.screenshot({ path: 'test-results/push-on-night.png' });
  await settings.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await page.getByRole('button', { name: 'Settings' }).click();
  await row2.scrollIntoViewIfNeeded();
  await expect(row2.locator('[data-push-arrived]')).toBeHidden();
  await expect(row2.getByRole('switch', { name: /Notify me/ }).locator('small')).toBeHidden();
  await page.screenshot({ path: 'test-results/push-on-still.png' });
  await settings.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // the question switched off takes push with it
  await page.getByRole('button', { name: 'Settings' }).click();
  await row2.getByRole('switch', { name: /Sunday question/ }).click();
  await expect.poll(() => calls.at(-1)?.route).toBe('unsubscribe');
  await row2.getByRole('switch', { name: /Sunday question/ }).click();
  await expect(row2.getByRole('switch', { name: /Notify me/ })).toHaveAttribute('aria-checked', 'false');
});

test('turning on with the server not set up, or offline: the switch stays off with one line', async ({ page, context }) => {
  await homeScreen(context);
  const answer: Partial<Record<string, [number, unknown] | 'offline'>> = { key: [503, { error: 'not_configured' }] };
  await server(page, answer);
  await enter(page, '/#/journal');
  await swReady(page);
  const row = await openRow(page);
  const sw = row.getByRole('switch', { name: /Notify me/ });
  await sw.click();
  await expect(row.locator('[data-push-note]')).toHaveText('Not set up yet');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  answer.key = 'offline';
  await sw.click();
  await expect(row.locator('[data-push-note]')).toHaveText('No connection');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
});

test('the worker\'s knock lands on today\'s page with the question, even with the app already open', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 21, 12, 0) });
  await enter(page, '/#/be');
  await page.clock.setSystemTime(SUN);
  await expect(page).toHaveURL(/#\/be$/);
  // what public/push-sw.js posts to the focused window on a tap
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { kind: 'checkin' } })));
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-msg p', { hasText: LINE })).toBeVisible();
  await expect(page.locator('.fs-msg.fs-wise textarea')).toBeFocused();
  // and the address arriving too (navigate): landing twice writes nothing twice
  await page.evaluate(() => { location.hash = '#/journal?ask=checkin'; });
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-msg p', { hasText: LINE })).toHaveCount(1);
});

test('airplane mode with push on: the journal opens and posts nothing', async ({ page, context }) => {
  await homeScreen(context);
  const calls = await server(page, { subscribe: 'offline', key: 'offline', test: 'offline' });
  await enter(page, '/#/journal');
  await page.evaluate(() => { localStorage.setItem('e2e-sub', 'https://web.push.apple.com/e2e'); localStorage.setItem('e2e-perm', 'granted'); });
  await expect.poll(async () => {
    await page.evaluate(() => new Promise<void>(res => {
      const o = indexedDB.open('flowstate');
      o.onsuccess = () => {
        const s = o.result.transaction('settings', 'readwrite').objectStore('settings');
        const g = s.get('app');
        g.onsuccess = () => { s.put({ ...g.result, checkin: { on: true, weekday: 0, hour: 10, minute: 0, line: 'Is there anything on your mind?', push: true } }); };
        s.transaction.oncomplete = () => { o.result.close(); res(); };
      };
    }));
    await enter(page, '/#/journal');
    return page.evaluate(() => new Promise(res => {
      const o = indexedDB.open('flowstate');
      o.onsuccess = () => { const g = o.result.transaction('settings').objectStore('settings').get('app'); g.onsuccess = () => { o.result.close(); res(g.result.checkin?.push); }; };
    }));
  }).toBe(true);
  await context.setOffline(true);
  await enter(page, '/#/journal');
  await expect(page.locator('.fs-page').first()).toBeVisible();
  const composer = page.locator('.fs-page textarea').first();
  await expect(composer).toBeVisible();
  // the open tried to post (nothing was posted before) and failed quietly; the page is the page
  expect(calls.every(c => c.route === 'subscribe')).toBe(true);
  await context.setOffline(false);
});
