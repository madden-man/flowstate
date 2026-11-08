// The pull shows earlier pages (V6, PLAN-V3.md section 4), offline: pull today's page down and the rail of
// earlier pages hangs above it in the same light, newest first, today's page left out. Short of 80px the
// page goes back up; past it the rail stays open, the light unchanged. A row opens its page; a pull up and
// a tap on the page beneath put the rail away. In Still the pull does nothing.
import { test, expect, type Page } from '@playwright/test';

const DAY = 86_400_000;
const today$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });

/** An entry three days back and a council yesterday, written straight into IndexedDB as the app stores them. */
const seed = (page: Page) => page.evaluate((DAY) => new Promise<void>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction(['pages', 'messages'], 'readwrite');
    const page = (id: string, kind: string, at: number) =>
      tx.objectStore('pages').put({ id, kind, createdAt: at, updatedAt: at, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] });
    const line = (id: string, pageId: string, at: number, text: string, voiceId?: string) =>
      tx.objectStore('messages').put({ id, pageId, at, updatedAt: at, text, kept: false, ...(voiceId ? { voiceId } : {}) });
    const entryAt = Date.now() - 3 * DAY, councilAt = Date.now() - DAY;
    page('pg-three-days', 'entry', entryAt);
    line('m-three-days', 'pg-three-days', entryAt, 'Wait out the truly hard parts.');
    page('pg-yesterday', 'council', councilAt);
    line('m-yesterday-1', 'pg-yesterday', councilAt, 'Which voices are those, exactly?', 'v-skeptic');
    line('m-yesterday-2', 'pg-yesterday', councilAt + 1000, 'The ones that answer back.', 'v-warrior');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), DAY);

test('earlier: the pull hangs the last pages above today, in the same light', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  await page.goto('/');
  await expect(page.locator('[data-threshold]')).toContainText('I determine my core.');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await seed(page);
  await page.reload();
  await expect(page.locator('[data-threshold]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();

  // today's page, written on: it is the open page, so the rail leaves it out
  const mine = 'Today the page is mine.';
  await today$(page).click();
  await today$(page).pressSequentially(mine, { delay: 2 });
  await today$(page).press('Enter');
  await expect(page.locator('.fs-msg p', { hasText: mine })).toBeVisible();
  const lightBefore = (await page.locator('html').getAttribute('data-light'))!;
  expect(lightBefore).not.toBe('still');

  const sheet = page.locator('.fs-page');
  const rail = page.locator('.fs-earlier');
  const rows = rail.locator('.fs-list-row');
  // a finger on the page's ruled column, a few rules below the lines (the editor keeps its own gestures)
  const col = (await page.locator('.fs-col').boundingBox())!;
  const x = col.x + col.width / 2, y = col.y + 300;
  const cdp = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', ty?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ty === undefined ? [] : [{ x, y: ty }] });
  const drag = async (to: number, step = 10) => {
    await touch('touchStart', y);
    for (let dy = step * Math.sign(to); Math.abs(dy) <= Math.abs(to); dy += step * Math.sign(to)) await touch('touchMove', y + dy);
  };

  // ---- short of the line: the rows follow the finger, then the page goes back up ----
  await drag(60);
  await expect(sheet).toHaveAttribute('style', /translateY\(60px\)/);
  await expect(rows).toHaveText([/Which voices are those, exactly\?/, /Wait out the truly hard parts\./, 'All pages']);
  await expect(rows.first().locator('.fs-spoke')).toHaveAttribute('aria-label', 'Skeptic, Warrior');
  await expect(rail).not.toContainText(mine);
  await expect(rail).not.toHaveClass(/ready/);
  await touch('touchEnd');
  await expect(sheet).not.toHaveAttribute('style', /translateY\(\d/);
  await expect(rail).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-light', lightBefore);

  // ---- past the line: the rail stays, the page held at its height, the light unchanged ----
  await drag(150);
  await expect(rail).toHaveClass(/ready/);
  await touch('touchEnd');
  await expect(rail).not.toHaveAttribute('aria-hidden');
  const held = await page.evaluate(() => {
    const r = document.querySelector<HTMLElement>('.fs-earlier')!, p = document.querySelector<HTMLElement>('.fs-page')!;
    return { rail: r.offsetHeight, style: p.style.transform, cap: Math.round(p.clientHeight * 0.45) };
  });
  expect(held.style).toBe(`translateY(${held.rail}px)`);
  expect(held.rail).toBeLessThanOrEqual(held.cap + 1);
  await expect(page.locator('html')).toHaveAttribute('data-light', lightBefore);
  await expect(page.getByRole('button', { name: 'Leave Still' })).toHaveCount(0);
  await expect(rows.first()).toBeInViewport();

  // ---- pull up past 40px: the rail goes back up ----
  await drag(-60);
  await touch('touchEnd');
  await expect(sheet).not.toHaveAttribute('style', /translateY\(\d/);
  await expect(rail).toHaveAttribute('aria-hidden', 'true');

  // ---- a tap on the page beneath puts it away too, and lands nowhere ----
  await drag(150);
  await touch('touchEnd');
  await expect(rail).not.toHaveAttribute('aria-hidden');
  await page.touchscreen.tap(x, y + 120);
  await expect(sheet).not.toHaveAttribute('style', /translateY\(\d/);
  await expect(page).toHaveURL(/#\/journal$/);

  // ---- a row opens its page, and the rail goes up with the page it hung over ----
  await drag(150);
  await touch('touchEnd');
  await rows.filter({ hasText: 'Wait out the truly hard parts.' }).tap();
  await expect(page).toHaveURL(/#\/journal\/pg-three-days$/);
  await expect(page.locator('.fs-msg', { hasText: 'Wait out the truly hard parts.' })).toBeVisible();
  await expect(sheet).not.toHaveAttribute('style', /translateY\(\d/);
  // on that page, the rail leaves that page out and keeps today's
  const col2 = (await page.locator('.fs-col').boundingBox())!;
  await touch('touchStart', col2.y + 160);
  for (let dy = 10; dy <= 60; dy += 10) await touch('touchMove', col2.y + 160 + dy);
  await expect(rows).toHaveText([new RegExp(mine), /Which voices are those, exactly\?/, 'All pages']);
  await touch('touchEnd');
  await expect(sheet).not.toHaveAttribute('style', /translateY\(\d/);

  // ---- in Still the pull does nothing ----
  await page.goto('/#/journal');
  await expect(today$(page)).toBeEnabled();
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(rail).toBeHidden();
  await drag(150);
  await expect(sheet).not.toHaveAttribute('style', /translateY\(\d/);
  await touch('touchEnd');
  await expect(sheet).not.toHaveAttribute('style', /translateY\(\d/);
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', lightBefore);

  expect(outside).toEqual([]);
});
