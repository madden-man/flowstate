// Still (package 5), offline: tap the moon and Still settles in (the only way in since V6; the pull shows
// earlier pages, test/e2e/earlier.spec.ts): the ring breathes where the moon was, the "No." count is gone
// and a kept line sits at the top. Tap the ring and the light comes back; a short pull changes nothing;
// reload and Still is still off, and nothing in the data has changed.
import { test, expect, type Page } from '@playwright/test';

/** Every row of every table, as the database holds it: the export, read straight from IndexedDB. */
const dump = (page: Page) => page.evaluate(() => new Promise<string>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const names = [...db.objectStoreNames].sort();
    const tx = db.transaction(names, 'readonly');
    const out: Record<string, unknown[]> = {};
    for (const n of names) {
      const r = tx.objectStore(n).getAll();
      r.onsuccess = () => { out[n] = r.result; };
    }
    tx.oncomplete = () => { db.close(); resolve(JSON.stringify(out)); };
    tx.onerror = () => reject(tx.error);
  };
}));

test('still: tap the moon, the ring, the kept line, and leaving changes nothing', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  // a cold load opens on the manifesto for one breath; a reload in the same session goes straight in
  await page.goto('/');
  await expect(page.locator('[data-threshold]')).toContainText('I determine my core.');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // the seed writes no pages (V5): an entry from last week with one kept line, for Still to show
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('flowstate');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['pages', 'messages'], 'readwrite');
      const at = Date.now() - 7 * 86_400_000;
      tx.objectStore('pages').put({ id: 'pg-last-week', kind: 'entry', createdAt: at, updatedAt: at, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] });
      tx.objectStore('messages').put({ id: 'm-last-week', pageId: 'pg-last-week', at, text: 'Listen to the quiet voices within.', kept: true });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await expect(page.locator('[data-threshold]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('textbox', { name: "Today's page" })).toBeEnabled();
  await expect(page.locator('.fs-count')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-light', 'still');
  const lightBefore = await page.locator('html').getAttribute('data-light');
  const before = await dump(page);

  // the moon at the left of the header: one tap and Still settles in
  await page.getByRole('button', { name: 'Still', exact: true }).click();

  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.getByRole('button', { name: 'Leave Still' })).toBeVisible();
  await expect(page.locator('.fs-count')).toBeHidden();
  await expect(page.locator('[data-kept-line]')).toHaveText('Listen to the quiet voices within.');
  await expect(page.locator('.fs-page')).not.toHaveAttribute('style', /translateY\(\d/);

  // the ring brings the light back; a short pull (a finger on the page's ruled column, a few rules below
  // the first, which is the editor's own) puts the page back up and nothing happens
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', lightBefore!);
  await expect(page.locator('.fs-count')).toBeVisible();
  const col = (await page.locator('.fs-col').boundingBox())!;
  const x = col.x + col.width / 2, y = col.y + 120;
  const cdp = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', ty?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ty === undefined ? [] : [{ x, y: ty }] });
  await touch('touchStart', y);
  for (let dy = 10; dy <= 50; dy += 10) await touch('touchMove', y + dy);
  await touch('touchEnd');
  await expect(page.locator('html')).toHaveAttribute('data-light', lightBefore!);

  await page.reload();
  await expect(page.getByRole('textbox', { name: "Today's page" })).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('data-light', lightBefore!);
  await expect(page.locator('[data-kept-line]')).toHaveCount(0);
  expect(await dump(page)).toBe(before);

  expect(outside).toEqual([]);
});
