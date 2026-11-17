// What each sign is for (PLAN-SIGN-LINES.md sections 3 and 4, L1), in the production build at 390 wide. On Root's page
// the pair stands where the gloss was (the sign lit, "Safety", "vs.", "fear", the sign emptied), the italic line under
// it on two rules at most, a blank rule, then the gate, which stands in one place from first paint to loaded. The line
// is rewritten on the first rule of the questions' Edit sheet and kept over a reload; a rule left empty puts the
// starter back. Still: the two signs leave, the words and the line stay, the block keeps its height. Through the door:
// neither the pair nor the line.
import { test, expect, type Page } from '@playwright/test';

const LINE = 'You want to be safe. The alarm rings when nothing is wrong.';
const MINE = 'You want ground under you. The floor is already there.';

test.use({ viewport: { width: 390, height: 844 } });

/** Records, at every change to the page, where the gate stands and whether the line has been read. */
const watch = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __gate: { top: number; read: boolean }[] };
  w.__gate = [];
  const look = () => {
    const block = document.querySelector('.ck-for');
    const gate = block?.nextElementSibling;
    if (!block || !gate) return;
    const top = Math.round(gate.getBoundingClientRect().top + scrollY);
    const read = block.hasAttribute('data-read');
    const last = w.__gate[w.__gate.length - 1];
    if (!last || last.top !== top || last.read !== read) w.__gate.push({ top, read });
  };
  new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true });
  const frame = () => { look(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
});
const gates = (page: Page) => page.evaluate(() => (window as unknown as { __gate: { top: number; read: boolean }[] }).__gate);

async function enter(page: Page) {
  await page.locator('.fs-page').first().waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('the pair in the gloss\'s place, the line in italic, the gate never moving; rewritten in the Edit sheet; Still keeps the words', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await watch(page);
  await page.goto('/#/flow/c/root');
  await enter(page);
  const block = page.locator('.ck-for[data-for="root"]');
  const pair = block.locator('[data-versus]');
  const line = block.locator('.ck-for-line');
  await expect(line).toHaveText(LINE);
  await expect(pair).toHaveText('Safetyvs.fear');
  await expect(pair.locator('[data-end="lit"]')).toBeVisible();
  await expect(pair.locator('[data-end="emptied"]')).toBeVisible();
  await expect(line).toHaveCSS('font-style', 'italic');
  // the gloss left the sign's page; the pair is on one rule, the line on two at most, the block four rules tall
  await expect(page.locator('.ck-page .ck-gloss')).toHaveCount(0);
  const rule = await block.evaluate(el => parseFloat(getComputedStyle(el.querySelector('.ck-for-line')!).lineHeight));
  const box = async (l: ReturnType<Page['locator']>) => (await l.boundingBox())!;
  expect(Math.round((await box(block)).height)).toBe(Math.round(rule * 4));
  expect(Math.round((await box(pair)).height)).toBe(Math.round(rule));
  expect((await box(line)).height).toBeLessThanOrEqual(rule * 2 + 1);
  // inside the column: nothing cut at the right edge
  const b = await box(block), p = await box(pair);
  expect(p.x + p.width).toBeLessThanOrEqual(b.x + b.width + 1);
  expect(await pair.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  // nothing in it is tappable
  await expect(block.locator('button, a, input, textarea')).toHaveCount(0);
  // first paint to read: the gate stood in one place
  await page.waitForTimeout(400);
  let seen = await gates(page);
  expect(seen.some(s => s.read), JSON.stringify(seen)).toBe(true);
  expect(new Set(seen.map(s => s.top)).size, JSON.stringify(seen)).toBe(1);
  const settled = seen[0].top;

  // his to rewrite: the first rule of the questions' Edit sheet
  await page.locator('[data-asks="root"]').getByRole('button', { name: 'Edit' }).click();
  const sheet = page.locator('[data-sheet="Root asks"]');
  const field = sheet.getByRole('textbox', { name: 'The line' });
  await expect(field).toHaveValue(LINE);
  await expect(field).toHaveCSS('font-style', 'italic');
  // over the deck's first rule (both read in one look: the sheet is still rising)
  expect(await sheet.evaluate(el => {
    const line = el.querySelector('[data-rule="line"]')!, first = el.querySelector('.ck-deck textarea')!;
    return line.getBoundingClientRect().top < first.getBoundingClientRect().top;
  })).toBe(true);
  await field.fill(MINE);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(line).toHaveText(MINE);
  await page.reload();
  await enter(page);
  await expect(line).toHaveText(MINE);
  await page.waitForTimeout(400);
  seen = await gates(page);
  expect(seen.map(s => s.top), JSON.stringify(seen)).toEqual(seen.map(() => settled));
  // a rule left empty puts the starter back
  await page.locator('[data-asks="root"]').getByRole('button', { name: 'Edit' }).click();
  await field.fill('');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(line).toHaveText(LINE);

  // Still: the signs leave, the words and the line stay, the block keeps its height
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(pair.locator('[data-end="lit"]')).toBeHidden();
  await expect(pair.locator('[data-end="emptied"]')).toBeHidden();
  await expect(pair).toContainText('Safety');
  await expect(pair).toContainText('fear');
  await expect(line).toHaveText(LINE);
  // the rules are taller in Still; the block is still four of them
  const stillRule = await block.evaluate(el => parseFloat(getComputedStyle(el.querySelector('.ck-for-line')!).lineHeight));
  expect(Math.round((await box(block)).height)).toBe(Math.round(stillRule * 4));
  expect((await box(line)).height).toBeLessThanOrEqual(stillRule * 2 + 1);
  expect(errors).toEqual([]);
});

test('every sign: its pair fits its rule and its line two rules at 390', async ({ page }) => {
  await page.goto('/#/flow/c/crown');
  await enter(page);
  for (const id of ['crown', 'third-eye', 'throat', 'heart', 'solar-plexus', 'sacral', 'root']) {
    await page.evaluate(h => { location.hash = h; }, `#/flow/c/${id}`);
    const block = page.locator(`.ck-for[data-for="${id}"][data-read]`);
    await expect(block.locator('.ck-for-line')).not.toHaveText('');
    const fits = await block.evaluate(el => {
      const pair = el.querySelector('[data-versus]')!, line = el.querySelector('.ck-for-line')!;
      return { pair: pair.scrollWidth <= pair.clientWidth, line: line.scrollHeight <= line.clientHeight + 1 };
    });
    expect(fits, id).toEqual({ pair: true, line: true });
  }
});

test('through the door: the gloss, and neither the pair nor the line', async ({ page }) => {
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
  await expect(body.locator('.ck-gloss')).toHaveText('Root · feeling safe');
  await expect(body.locator('.ck-for, [data-versus]')).toHaveCount(0);
  await expect(page.getByText(LINE)).toHaveCount(0);
});
