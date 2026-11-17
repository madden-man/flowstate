// The deck on a sign's page (PLAN-BLOCKERS.md K2, section 3 steps 7 to 11), in the production build at 390 wide.
// Step 7: three questions under the shelf, Resolve at the right of each one's first rule. Step 8: a tap on the word
// resolves one; it stays in its slot in print grey with the check, and nothing on the page moves, the block and the
// 988 line under it measured before and after. Step 9: on coming back, the next in the deck stands in that slot. Step
// 10: Edit raises the deck sheet, every open question on a rule that wraps whole, a blank rule, then Resolved with the
// date and the check, which brings one back. Step 11: a question carried to today's page carries Resolve there too, and
// resolved there it is gone from the sign the next time.
import { test, expect, type Page } from '@playwright/test';

const HEART = ['Who are you missing?', 'What is heavy today?', 'What was good, even a little?', 'Who has been kind to you lately?',
  'What are you grieving that you have not named?'];

test.use({ viewport: { width: 390, height: 844 } });

async function open(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  await page.locator('.fs-page').first().waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}
const go = async (page: Page, hash: string) => { await page.evaluate(h => { location.hash = h; }, hash); };

/** Where each thing stands on the page: the block, each row, each Resolve, the 988 line. */
const where = (page: Page) => page.evaluate(() => {
  const y = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().top + scrollY) : -1);
  const hgt = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().height) : -1);
  const block = document.querySelector('[data-asks="heart"]');
  return {
    block: [y(block), hgt(block)],
    rows: [...document.querySelectorAll('[data-asks="heart"] .ck-ask-row')].map(r => [y(r), hgt(r)]),
    resolves: [...document.querySelectorAll('[data-asks="heart"] .fs-resolve')].map(y),
    safe: y(document.querySelector('.ck-safe-line')),
  };
});

test('steps 7 to 9: Resolve on each; resolved, it keeps its slot and nothing moves; next time the next stands there', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await open(page, '#/flow/c/heart');
  const asks = page.locator('[data-asks="heart"]');
  await expect(asks.locator('.ck-ask')).toHaveText(HEART.slice(0, 3));
  const words = asks.getByRole('checkbox', { name: 'Resolved' });
  await expect(words).toHaveCount(3);
  // step 7: the print word at the right of each question's first rule, over the 988 line
  for (let i = 0; i < 3; i++) {
    const w = (await words.nth(i).boundingBox())!;
    const q = (await asks.locator('.ck-ask').nth(i).boundingBox())!;
    await expect(words.nth(i)).toHaveText('Resolve');
    expect(Math.abs(w.y - q.y)).toBeLessThan(2);
    expect(w.x + w.width).toBeGreaterThan(q.x + q.width - 2);
    expect(w.x + w.width).toBeLessThanOrEqual(390);
  }
  await expect(page.locator('.ck-safe-line')).toBeVisible();
  await page.waitForTimeout(300);
  const before = await where(page);
  expect(before.safe).toBeGreaterThan(before.block[0] + before.block[1] - 2);

  // step 8: the first resolved, in its place, grey with the check; nothing on the page moved
  const ink = await asks.locator('.ck-ask').nth(1).evaluate(el => getComputedStyle(el).color);
  await words.nth(0).click();
  await expect(words.nth(0)).toBeChecked();
  await expect(asks.locator('.ck-ask')).toHaveText(HEART.slice(0, 3));
  await expect(asks.locator('.ck-ask-row').nth(0)).toHaveClass(/\bdone\b/);
  await page.waitForTimeout(600);
  expect(await asks.locator('.ck-ask').nth(0).evaluate(el => getComputedStyle(el).color)).not.toBe(ink);
  await expect(asks.locator('.ck-ask-row').nth(0).locator('.fs-resolve-mark')).toBeVisible();
  expect(await where(page)).toEqual(before);
  // taken back and resolved again: still nothing moves
  await words.nth(0).click();
  await expect(words.nth(0)).not.toBeChecked();
  await words.nth(0).click();
  await expect(words.nth(0)).toBeChecked();
  await page.waitForTimeout(400);
  expect(await where(page)).toEqual(before);

  // step 9: away and back, the fourth question stands where the first was
  await go(page, '#/journal');
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-col')).toBeVisible();
  await page.waitForTimeout(600);
  await go(page, '#/flow/c/heart');
  await expect(asks.locator('.ck-ask')).toHaveText([HEART[3], HEART[1], HEART[2]]);
  await expect(asks.getByRole('checkbox', { name: 'Resolved' }).nth(0)).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('step 10: the deck sheet, rules that wrap whole, the blank rule, and Resolved with its date and check', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T12:00:00') });
  await open(page, '#/flow/c/heart');
  const asks = page.locator('[data-asks="heart"]');
  await asks.getByRole('checkbox', { name: 'Resolved' }).nth(1).click();
  await asks.getByRole('button', { name: 'Edit' }).click();
  const sheet = page.locator('[data-sheet="Heart asks"]');
  const rules = sheet.locator('.ck-deck textarea');
  // six open (the resolved one is under Resolved), then the blank rule
  await expect(rules).toHaveCount(7);
  await expect(rules.nth(6)).toHaveValue('');
  // a long question wraps on its rules, all of it in sight while it is rewritten
  const long = 'What would you say to the person you were a year ago, if they could hear it without arguing back?';
  await rules.nth(0).fill(long);
  const lines = await rules.nth(0).evaluate(el => {
    const t = el as HTMLTextAreaElement;
    return { h: t.clientHeight, sh: t.scrollHeight, lh: parseFloat(getComputedStyle(t).lineHeight) };
  });
  expect(lines.h).toBeGreaterThanOrEqual(lines.lh * 2 - 1);
  expect(lines.sh).toBeLessThanOrEqual(lines.h + 1);
  // the blank rule adds one
  await rules.nth(6).fill('Who would you call first?');
  await rules.nth(6).press('Enter');
  await expect(rules).toHaveCount(8);
  await expect(rules.nth(6)).toHaveValue('Who would you call first?');
  await expect(rules.nth(7)).toHaveValue('');
  // Resolved: the word, the question with its date and its check
  const done = sheet.locator('.ck-deck-done');
  await expect(sheet.locator('.ck-deck-resolved .fs-month')).toHaveText('Resolved');
  await expect(done).toHaveCount(1);
  await expect(done.locator('.ck-deck-text')).toHaveText(HEART[1]);
  await expect(done.locator('.fs-list-meta')).toHaveText('11 / 17 / 26');
  await expect(done.getByRole('checkbox', { name: 'Resolved' })).toBeChecked();
  // nothing counted
  await expect(sheet.locator('.ck-asks-sheet')).not.toContainText(/\b\d+ of \d+\b/);
  // the check brings it back
  await done.getByRole('checkbox', { name: 'Resolved' }).click();
  await expect(done).toHaveCount(0);
  await expect(sheet.locator('.ck-deck-resolved')).toHaveCount(0);
  await expect(rules.nth(1)).toHaveValue(HEART[1]);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(asks.locator('.ck-ask').nth(0)).toHaveText(long);
  await expect(asks.locator('.ck-ask').nth(1)).toHaveText(HEART[1]);
  await expect(asks.locator('.ck-ask-row').nth(1)).not.toHaveClass(/\bdone\b/);
});

test('step 11: Resolve on the journal line; resolved there, the sign shows the next one', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  const asks = page.locator('[data-asks="heart"]');
  await asks.getByRole('button', { name: HEART[2] }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  const line = page.locator('.fs-msg.fs-wise', { hasText: HEART[2] });
  await expect(line).toBeVisible();
  const word = line.getByRole('checkbox', { name: 'Resolved' });
  await expect(word).toHaveText('Resolve');
  // the page has turned and its ink has landed (rule 29) before anything is measured
  await page.waitForTimeout(600);
  const lb = (await line.boundingBox())!, wb = (await word.boundingBox())!;
  expect(Math.abs(wb.y - lb.y)).toBeLessThan(2);
  expect(wb.x + wb.width).toBeGreaterThan(lb.x + lb.width - 2);
  // he writes under it, then resolves it where he answered it
  await page.keyboard.type('The light in the kitchen this morning.');
  await page.waitForTimeout(500);
  const ink = await line.locator('p').evaluate(el => getComputedStyle(el).color);
  await word.click();
  await expect(word).toBeChecked();
  await page.waitForTimeout(500);
  expect(await line.locator('p').evaluate(el => getComputedStyle(el).color)).not.toBe(ink);
  // his answer is still on the page, as written (in its rule, the caret's or the page's)
  expect(await page.evaluate(() => [...document.querySelectorAll('.fs-col .fs-msg')].some(m =>
    (m.querySelector('textarea')?.value ?? m.querySelector('p')?.textContent) === 'The light in the kitchen this morning.'))).toBe(true);
  // back to the sign: the next in the deck stands in its slot
  await page.locator('.fs-hdr-r [data-sign-back="heart"]').click();
  await expect(page).toHaveURL(/#\/flow\/c\/heart$/);
  await expect(asks.locator('.ck-ask')).toHaveText([HEART[0], HEART[1], HEART[3]]);
  // and in Still, none of it on the journal line
  await go(page, '#/journal');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.fs-msg .fs-resolve:visible')).toHaveCount(0);
});
