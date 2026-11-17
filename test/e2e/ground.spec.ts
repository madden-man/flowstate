// The question that always shows (PLAN-SIGN-LINES.md section 5, L2), in the production build at 390 wide. On Root's
// page the grounding question stands first in the questions block, italic, with no Resolve, over the deck's three; the
// 988 line under the block stands in one place from first paint to loaded, on a fresh journal, on a reload, and with a
// room kept before the grounding question counted in. A tap opens today's page on it, written once a day. Still: gone.
// Through the door: the question as print on the sign's page, no tap, none of the deck.
import { test, expect, type Page } from '@playwright/test';

const ROOT = 'Feel your feet on the floor. What are five things you can see?';
const DECK = ['What is true right here, in this room?', 'What do you need in the next hour?', 'What has held before when it felt like this?'];

test.use({ viewport: { width: 390, height: 844 } });

/** Records, at every change to the page, where the 988 line stands and whether the shelf or the questions still wait. */
const watch = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __tops: { top: number; wait: boolean }[] };
  w.__tops = [];
  const look = () => {
    const line = document.querySelector('.ck-safe-line');
    if (!line) return;
    const top = Math.round(line.getBoundingClientRect().top + scrollY);
    const wait = !!document.querySelector('.ck-shelf.wait, .ck-asks.wait, [data-blockers][data-wait]');
    const last = w.__tops[w.__tops.length - 1];
    if (!last || last.top !== top || last.wait !== wait) w.__tops.push({ top, wait });
  };
  new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true });
  const frame = () => { look(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
});
const tops = (page: Page) => page.evaluate(() => (window as unknown as { __tops: { top: number; wait: boolean }[] }).__tops);

async function enter(page: Page) {
  await page.locator('.fs-page').first().waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('first, italic, no Resolve; the 988 line never moves on first paint; a tap writes it once a day', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await watch(page);
  await page.clock.install({ time: new Date('2026-11-17T12:00:00') });
  await page.goto('/#/flow/c/root');
  await enter(page);
  const asks = page.locator('[data-asks="root"]');
  const ground = asks.locator('[data-ground="root"]');
  await expect(asks.locator('.ck-ask')).toHaveText(DECK);
  await expect(ground).toHaveText(ROOT);
  // first in the block, over the deck's three, italic, a thumb and more to tap, nothing beside it
  expect(await asks.evaluate(el => el.firstElementChild?.getAttribute('data-ground'))).toBe('root');
  const g = (await ground.boundingBox())!;
  expect(g.y + g.height).toBeLessThanOrEqual((await asks.locator('.ck-ask-row').first().boundingBox())!.y + 1);
  await expect(ground.locator('.ck-ground')).toHaveCSS('font-style', 'italic');
  expect(g.height).toBeGreaterThanOrEqual(44);
  await expect(ground.getByRole('checkbox')).toHaveCount(0);
  await expect(asks.getByRole('checkbox', { name: 'Resolved' })).toHaveCount(3);
  // first paint to loaded: the 988 line stood in one place while the page's blocks were still unread
  await page.waitForTimeout(400);
  let seen = await tops(page);
  expect(seen.some(s => s.wait), JSON.stringify(seen)).toBe(true);
  expect(new Set(seen.map(s => s.top)).size, JSON.stringify(seen)).toBe(1);
  const settled = seen[0].top;
  // and again on the next load, from the room kept
  await page.reload();
  await enter(page);
  await expect(asks.locator('.ck-ask')).toHaveCount(3);
  await page.waitForTimeout(400);
  seen = await tops(page);
  expect(seen.map(s => s.top), JSON.stringify(seen)).toEqual(seen.map(() => settled));

  // a tap: today's page with it as an italic line, linked to the sign; the same again today is not written twice
  await ground.getByRole('button', { name: ROOT }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  const line = page.locator('.fs-msg.fs-wise', { hasText: ROOT });
  await expect(line).toBeVisible();
  await expect(line.locator('p')).toHaveCSS('font-style', 'italic');
  // not a deck question: no Resolve on the journal line
  await expect(line.getByRole('checkbox', { name: 'Resolved' })).toHaveCount(0);
  await page.locator('.fs-hdr-r [data-sign-back="root"]').click();
  await expect(page).toHaveURL(/#\/flow\/c\/root$/);
  await ground.getByRole('button', { name: ROOT }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-col').getByText(ROOT, { exact: true })).toHaveCount(1);
  // never on the ? tab (the rail of earlier pages above it, aria-hidden, is today's page, not a question)
  await page.evaluate(() => { location.hash = '#/questions'; });
  await expect(page.getByRole('button', { name: 'New question' })).toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.getByRole('link', { name: ROOT })).toHaveCount(0);
  await expect(page.locator('.fs-list-line:not(.fs-earlier *)', { hasText: ROOT })).toHaveCount(0);

  // Still: gone with the block; the 988 line stays
  await page.evaluate(() => { location.hash = '#/flow/c/root'; });
  await expect(ground).toBeVisible();
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(ground).toBeHidden();
  await expect(page.getByRole('link', { name: 'Call 988' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a room kept before the grounding question is not read, so the safety lines still do not move', async ({ page }) => {
  await watch(page);
  // a phone that kept the three's room under the old key, one row short of the block as it is now
  await page.addInitScript(() => { localStorage.setItem('fs-asks-room', JSON.stringify({ root: 6 })); });
  await page.goto('/#/flow/c/root');
  await enter(page);
  await expect(page.locator('[data-asks="root"] .ck-ask')).toHaveCount(3);
  await page.waitForTimeout(400);
  const seen = await tops(page);
  expect(seen.some(s => s.wait), JSON.stringify(seen)).toBe(true);
  expect(new Set(seen.map(s => s.top)).size, JSON.stringify(seen)).toBe(1);
});

test('through the door: the grounding question as print, no tap, none of the deck', async ({ page }) => {
  await page.goto('/#/journal');
  await enter(page);
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

  await page.goto('/#/flow/c/root');
  await page.reload();
  const body = page.locator('.ck-page[data-door]');
  await expect(body).toHaveAttribute('data-chakra', 'root');
  await expect(page.getByRole('group', { name: 'PIN' })).toHaveCount(0);
  const ground = body.locator('[data-ground="root"]');
  await expect(ground).toHaveText(ROOT);
  await expect(ground).toHaveCSS('font-style', 'italic');
  expect(await ground.evaluate(el => el.tagName)).toBe('P');
  await expect(ground.locator('button, a')).toHaveCount(0);
  // under the gloss, over the 988 line
  const y = async (sel: string) => (await body.locator(sel).first().boundingBox())!.y;
  expect(await y('[data-ground]')).toBeGreaterThan(await y('.ck-gloss'));
  expect(await y('.ck-safe-line')).toBeGreaterThan(await y('[data-ground]'));
  await expect(page.locator('.ck-asks, .ck-ask, .ck-shelf, .fs-resolve')).toHaveCount(0);
  for (const q of DECK) await expect(page.getByText(q)).toHaveCount(0);
  // a tap on it does nothing: the page stays, nothing opens
  await ground.click();
  await expect(page).toHaveURL(/#\/flow\/c\/root$/);
  // Heart through the door: its own
  await page.goto('/#/flow/c/heart');
  await expect(page.locator('.ck-page[data-door] [data-ground="heart"]')).toHaveText('Hand on your chest for three breaths. What is it holding?');
});
