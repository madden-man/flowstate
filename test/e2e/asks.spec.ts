// A sign's three questions (DESIGN.md rule 37; Tommy, 2026-11-17), in the production build at 390 wide. On a fresh
// journal the Heart's page shows five covers and the plus on one row, then its three questions on the rules in italic,
// Edit on the last blank rule, and the 988 line under them, which stands where it stood at first paint. A tap opens
// today's page with the question as an italic line and the caret on the rule under it; the sign by the date comes
// back; the same question again that day is not written twice. Edit rewrites one (kept over a reload); emptied, the
// starter is back. Still: none of it. Through the door: none of it.
import { test, expect, type Page } from '@playwright/test';

const HEART = ['Who are you missing?', 'What is heavy today?', 'What was good, even a little?'];

test.use({ viewport: { width: 390, height: 844 } });

/** Records, at every change to the page, where the 988 line stands and whether the shelf or the questions still wait. */
const watch = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __tops: { top: number; wait: boolean }[] };
  w.__tops = [];
  const look = () => {
    const line = document.querySelector('.ck-safe-line');
    if (!line) return;
    const top = Math.round(line.getBoundingClientRect().top + scrollY);
    const wait = !!document.querySelector('.ck-shelf.wait, .ck-asks.wait');
    const last = w.__tops[w.__tops.length - 1];
    if (!last || last.top !== top || last.wait !== wait) w.__tops.push({ top, wait });
  };
  new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true });
  const frame = () => { look(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
});
const tops = (page: Page) => page.evaluate(() => (window as unknown as { __tops: { top: number; wait: boolean }[] }).__tops);

async function open(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  await page.locator('.fs-page').first().waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('five covers, then three questions; the line under them never moves; a tap opens today\'s page on one', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await watch(page);
  await page.clock.install({ time: new Date('2026-11-17T12:00:00') });
  await open(page, '#/flow/c/heart');
  const shelf = page.locator('[data-shelf="heart"]');
  const asks = page.locator('[data-asks="heart"]');
  await expect(shelf.locator('.fs-tile')).toHaveCount(5);
  await expect(asks.locator('.ck-ask')).toHaveText(HEART);
  // under the shelf, over the 988 line
  const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
  expect(await y('[data-asks="heart"]')).toBeGreaterThan(await y('[data-shelf="heart"]'));
  expect(await y('.ck-safe-line')).toBeGreaterThan(await y('[data-asks="heart"] .ck-ask >> nth=2'));
  // italic, a thumb and more to tap, no number, and Edit
  for (const b of await asks.locator('.ck-ask').all()) {
    await expect(b).toHaveCSS('font-style', 'italic');
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(asks).not.toContainText(/\d/);
  await expect(asks.getByRole('button', { name: 'Edit' })).toBeVisible();
  // first paint to loaded: the 988 line stood in one place while the shelf and the questions were still unread
  await page.waitForTimeout(400);
  let seen = await tops(page);
  expect(seen.some(s => s.wait), JSON.stringify(seen)).toBe(true);
  expect(new Set(seen.map(s => s.top)).size, JSON.stringify(seen)).toBe(1);
  // and again on the next load, from the room kept
  await page.reload();
  await page.locator('.fs-page').first().waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(asks.locator('.ck-ask')).toHaveCount(3);
  await page.waitForTimeout(400);
  seen = await tops(page);
  expect(new Set(seen.map(s => s.top)).size, JSON.stringify(seen)).toBe(1);

  // a tap: today's page, the question an italic line, the caret on the rule under it, the sign by the date
  await asks.getByRole('button', { name: HEART[1] }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  const line = page.locator('.fs-msg.fs-wise p', { hasText: HEART[1] });
  await expect(line).toBeVisible();
  await expect(line).toHaveCSS('font-style', 'italic');
  const caret = page.locator('textarea:focus');
  await expect(caret).toHaveCount(1);
  await expect(caret.locator('xpath=..')).not.toHaveClass(/fs-wise/);
  expect((await caret.boundingBox())!.y).toBeGreaterThan((await line.boundingBox())!.y);
  const sign = page.locator('.fs-hdr-r [data-sign-back="heart"]');
  await expect(sign).toBeVisible();
  await sign.click();
  await expect(page).toHaveURL(/#\/flow\/c\/heart$/);
  await expect(asks.locator('.ck-ask')).toHaveCount(3);
  // the same question again today: written once
  await asks.getByRole('button', { name: HEART[1] }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-msg p', { hasText: HEART[1] })).toHaveCount(1);
  await expect(page.locator('.fs-col').getByText(HEART[1], { exact: true })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Edit rewrites a question, kept over a reload; emptied, its starter is back', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  const asks = page.locator('[data-asks="heart"]');
  await asks.getByRole('button', { name: 'Edit' }).click();
  const sheet = page.locator('[data-sheet="Heart asks"]');
  await expect(sheet).toBeVisible();
  const rules = sheet.locator('input');
  await expect(rules).toHaveCount(3);
  await rules.nth(0).fill('Who do you want to call tonight?');
  await rules.nth(0).press('Enter');
  await expect(rules.nth(1)).toBeFocused();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(asks.locator('.ck-ask')).toHaveText(['Who do you want to call tonight?', HEART[1], HEART[2]]);
  await page.reload();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(asks.locator('.ck-ask')).toHaveText(['Who do you want to call tonight?', HEART[1], HEART[2]]);
  // emptied: the starter shows on the rule, and is back on the page
  await asks.getByRole('button', { name: 'Edit' }).click();
  await rules.nth(0).fill('');
  await expect(rules.nth(0)).toHaveAttribute('placeholder', HEART[0]);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(asks.locator('.ck-ask')).toHaveText(HEART);
  await page.reload();
  if (await t.count()) await t.click();
  await expect(asks.locator('.ck-ask')).toHaveText(HEART);
});

test('Still never asks: the questions and their Edit leave with the light, and come back after', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T21:30:00') });
  await open(page, '#/flow/c/root');
  const asks = page.locator('[data-asks="root"]');
  await expect(asks.locator('.ck-ask')).toHaveCount(3);
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(asks).toBeHidden();
  await expect(page.locator('.ck-asks .ck-ask:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  // the 988 line stays
  await expect(page.getByRole('link', { name: 'Call 988' })).toBeVisible();
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(asks.locator('.ck-ask')).toHaveCount(3);
  await expect(asks.locator('.ck-ask').first()).toBeVisible();
});

test('through the door: no questions at all', async ({ page }) => {
  await open(page, '#/journal');
  const tap = async (digits: string, scope = page.locator('body')) => {
    for (const d of digits) await scope.locator('.fs-key', { has: page.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
  };
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[data-sheet="Settings"]');
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const sheet = page.locator('[data-sheet="Set a PIN"]');
  await tap('3569', sheet);
  await sheet.getByRole('button', { name: 'Next' }).click();
  await tap('3569', sheet);
  await expect(settings.getByRole('button', { name: 'Change PIN' })).toBeVisible({ timeout: 15_000 });
  await settings.getByRole('switch', { name: /The ring without the PIN/ }).click();
  await settings.getByRole('button', { name: 'Done' }).click();
  await page.goto('/#/flow/c/heart');
  await page.reload();
  const body = page.locator('.ck-page[data-door]');
  await expect(body).toHaveAttribute('data-chakra', 'heart');
  await expect(page.getByRole('link', { name: 'Call 988' })).toBeVisible();
  await expect(page.locator('.ck-asks, .ck-ask, .ck-shelf')).toHaveCount(0);
  for (const q of HEART) await expect(page.getByText(q)).toHaveCount(0);
});
