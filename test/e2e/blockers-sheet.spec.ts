// The Blockers sheet (PLAN-BLOCKERS.md K4, walkthrough step 5): a long press on a row raises "Root blockers"; a tap
// strikes one off the sign with a drawn stroke and the page loses its row; a tap puts it back; "+ blocker" opens New
// flow with the sign chosen, and the flow made stands under the sign. Every press here is a real touch (CDP), a thumb's,
// never the mouse: a long press under a finger is what the iPhone does.
import { test, expect, type Page, type Locator } from '@playwright/test';

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

/** A thumb on the middle of el, held for ms, then lifted. */
async function touch(page: Page, el: Locator, ms: number) {
  await el.scrollIntoViewIfNeeded();
  const b = (await el.boundingBox())!;
  const x = b.x + Math.min(b.width / 3, 60), y = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
const hold = (page: Page, el: Locator) => touch(page, el, 800);
const tap = (page: Page, el: Locator) => touch(page, el, 40);

/** One field of a stored flow (the clear fields: chakra, offSigns), or null. */
const flowField = (page: Page, id: string, key: string) => page.evaluate(([id, key]) => new Promise<unknown>((resolve, reject) => {
  const req = indexedDB.open('flowstate');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const r = req.result.transaction('flows').objectStore('flows').get(id);
    r.onsuccess = () => { req.result.close(); resolve(r.result?.[key] ?? null); };
    r.onerror = () => reject(r.error);
  };
}), [id, key]);
const offSigns = (page: Page, id: string) => flowField(page, id, 'offSigns');

test('a long press raises the sheet; a tap strikes 3 a.m. off Root and a tap puts it back', async ({ page }) => {
  await open(page, '#/flow/c/root');
  const rows = page.locator('[data-blockers]:not([data-wait]) .bk-row');
  await expect(rows.locator('.fs-list-line')).toHaveText(['Panic', 'What if', '3 a.m.']);
  await hold(page, rows.nth(1));
  const sheet = page.locator('.fs-sheet[data-sheet="Root blockers"]');
  await expect(sheet).toBeVisible();
  // the hold opened nothing else, and the lift's click did not land on the sheet that rose under the thumb
  await expect(page).toHaveURL(/#\/flow\/c\/root$/);
  await page.waitForTimeout(300);
  await expect(page.locator('.fs-sheet[data-sheet="New flow"]')).toHaveCount(0);
  await expect(sheet.locator('.bk-pick[aria-pressed="true"]')).toHaveCount(0);
  const picks = sheet.locator('.bk-pick');
  await expect(picks.locator('.bk-pick-name')).toHaveText(['Panic', 'What if', '3 a.m.']);
  await expect(picks.nth(2).locator('.bk-tag')).toHaveText('also Crown');
  await expect(sheet.getByRole('button', { name: '+ blocker' })).toBeVisible();

  await tap(page, picks.nth(2));
  await expect(picks.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(picks.nth(2).locator('s.fs-struck .fs-struck-line')).toBeVisible();
  await expect.poll(() => offSigns(page, 'night')).toEqual(['root']);
  await expect(rows.locator('.fs-list-line')).toHaveText(['Panic', 'What if']);

  await tap(page, picks.nth(2));
  await expect(picks.nth(2)).toHaveAttribute('aria-pressed', 'false');
  await expect(picks.nth(2).locator('s')).toHaveCount(0);
  await expect.poll(() => offSigns(page, 'night')).toBeNull();
  await expect(rows.locator('.fs-list-line')).toHaveText(['Panic', 'What if', '3 a.m.']);

  // a short touch on a row still opens the flow
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await tap(page, rows.first());
  await expect(page).toHaveURL(/#\/flow\/panic$/);
});

test('every blocker struck: the word and "+ blocker" only, which raises the sheet to put one back', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  const rows = page.locator('[data-blockers]:not([data-wait]) .bk-row');
  await expect(rows).toHaveCount(2);
  await hold(page, rows.first());
  const sheet = page.locator('.fs-sheet[data-sheet="Heart blockers"]');
  await expect(sheet.locator('.bk-pick .bk-tag')).toHaveText(['draft']);
  for (const p of await sheet.locator('.bk-pick').all()) await tap(page, p);
  await expect(rows).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  const block = page.locator('[data-blockers]:not([data-wait])');
  await expect(block).toHaveText('Blockers+ blocker');
  await tap(page, block.getByRole('button', { name: '+ blocker' }));
  await expect(sheet).toBeVisible();
  await tap(page, sheet.locator('.bk-pick[data-flow="depress"]'));
  await expect(rows.locator('.fs-list-line')).toHaveText(['Depress']);
});

test('"+ blocker" opens New flow with the sign chosen, and the flow made is under it', async ({ page }) => {
  await open(page, '#/flow/c/throat');
  const rows = page.locator('[data-blockers]:not([data-wait]) .bk-row');
  await expect(rows).toHaveCount(2);
  await hold(page, rows.first());
  const sheet = page.locator('.fs-sheet[data-sheet="Throat blockers"]');
  await tap(page, sheet.getByRole('button', { name: '+ blocker' }));
  const form = page.locator('.fs-sheet[data-sheet="New flow"]');
  await expect(form).toBeVisible();
  await expect(form.locator('.fl-signpick[aria-pressed="true"]')).toHaveAttribute('aria-label', 'Throat');
  await form.getByLabel('Name').fill('Biting my tongue');
  await tap(page, form.getByRole('button', { name: 'Make' }));
  await expect(page).toHaveURL(/#\/flow\/[0-9a-f-]{36}$/);
  const made = page.url().split('/').pop()!;
  await expect.poll(() => flowField(page, made, 'chakra')).toBe('throat');
  await page.goto('/#/flow/c/throat');
  await expect(rows.locator('.fs-list-line')).toHaveText(['Fight', 'Swallowed it', 'Biting my tongue']);
});
