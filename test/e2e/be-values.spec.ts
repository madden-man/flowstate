// Be as values (PLAN-VALUES.md section 3 steps 1, 2, 3 and 11; C2): the list shows the words and never a shadow; a tap
// opens a value on its shadow and a second folds it; #/be/:id opens one; a new value needs only its word; an edit on a
// later day keeps the old word struck; Resting puts one down and brings it back; Delete is two taps; a drag reorders;
// Still is the words alone and opens nothing. A fresh install seeds selfless | selfish and thoughtful | reactive.
import { test, expect, type Page } from '@playwright/test';

const words = (p: Page) => p.locator('.fs-values .fs-be-row > .fs-dichotomy .a');
const row = (p: Page, w: string) => p.locator('.fs-values .fs-be-row', { has: p.locator('.a', { hasText: new RegExp(`^${w}$`) }) });
const sheet = (p: Page) => p.locator('[data-sheet="Value"]');

async function cross(page: Page) {
  // the threshold, when a cold load breathes, is drawn with the page: wait for the list, then tap through
  await expect(page.locator('.fs-be-core')).toBeAttached();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

async function be(page: Page, hash = '#/be') {
  await page.goto(`/${hash}`);
  await cross(page);
}

/** Puts the sheet away (Done), which keeps what is written. */
async function done(page: Page) {
  await sheet(page).getByRole('button', { name: 'Done' }).click();
  await expect(sheet(page)).toHaveCount(0);
}

test('the list is the words: no shadows; a tap opens a value on its shadow, a second folds it', async ({ page }) => {
  await be(page);
  await expect(page.locator('.fs-be-core')).toHaveText('I determine my core.');
  await expect(page.getByRole('navigation', { name: 'Be' }).getByRole('link')).toHaveText(['Values', 'Champions']);
  await expect(page.getByRole('button', { name: 'New value' })).toBeVisible();
  await expect(words(page)).toHaveText(['selfless', 'thoughtful']);
  await expect(page.locator('.fs-values')).not.toContainText('selfish');
  await expect(page.locator('.fs-values')).not.toContainText('reactive');
  // nobody fights for the seeded values yet: each carries the one dashed rule
  await expect(page.locator('.fs-values .fs-spoke-none')).toHaveCount(2);

  const selfless = row(page, 'selfless');
  await selfless.locator('.fs-dichotomy').click();
  const open = selfless.locator('.fs-dichotomy');
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  await expect(open.locator('.b')).toHaveText('selfish');
  // the shadow is a value too: italic, at full ink, never the grey of a resting row
  const [shadowInk, wordInk, style] = await open.evaluate(b => [
    getComputedStyle(b.querySelector('.b')!).color, getComputedStyle(b.querySelector('.a')!).color, getComputedStyle(b.querySelector('.b')!).fontStyle]);
  expect(shadowInk).toBe(wordInk);
  expect(style).toBe('italic');
  await expect(selfless.locator('.fs-value-looks')).toBeVisible();
  await expect(selfless.getByRole('button', { name: 'Edit' })).toBeVisible();

  await open.click();
  await expect(selfless.locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.fs-values')).not.toContainText('selfish');
  await expect(selfless.locator('.fs-value-body')).toHaveCount(0);
});

test('a deep link opens its value; Champions is the second segment', async ({ page }) => {
  await be(page, '#/be/value-px-thoughtful-reactive');
  const thoughtful = row(page, 'thoughtful');
  await expect(thoughtful.locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
  await expect(thoughtful.locator('.fs-dichotomy .b')).toHaveText('reactive');
  await page.getByRole('navigation', { name: 'Be' }).getByRole('link', { name: 'Champions' }).click();
  await expect(page.getByRole('navigation', { name: 'Be' }).getByRole('link', { name: 'Champions' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'New value' })).toHaveCount(0);
});

test('a new value needs only its word; + shadow gives it one; a later day keeps the old word struck', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 10, 9, 40) });
  await be(page);
  await page.getByRole('button', { name: 'New value' }).click();
  await expect(sheet(page).getByRole('textbox', { name: 'Value' })).toBeFocused();
  await expect(sheet(page).getByRole('textbox', { name: 'Shadow' })).toHaveAttribute('placeholder', 'The one that looks after me');
  await expect(sheet(page).getByRole('textbox', { name: 'What it looks like' })).toHaveAttribute('placeholder', 'Living it, in a sentence');
  await sheet(page).getByRole('textbox', { name: 'Value' }).fill('courage');
  await done(page);
  await expect(words(page)).toHaveText(['selfless', 'thoughtful', 'courage']);
  await page.reload();
  await cross(page);
  await expect(words(page)).toHaveText(['selfless', 'thoughtful', 'courage']);

  // no shadow yet: open, it is the word alone, centred, with + shadow under it
  const courage = row(page, 'courage');
  await courage.locator('.fs-dichotomy').click();
  await expect(courage.locator('.fs-dichotomy')).toHaveClass(/alone/);
  await expect(courage.locator('.fs-dichotomy .b')).toHaveCount(0);
  await courage.getByRole('button', { name: '+ shadow' }).click();
  await expect(sheet(page).getByRole('textbox', { name: 'Shadow' })).toBeFocused();
  await sheet(page).getByRole('textbox', { name: 'Shadow' }).fill('safety');
  await done(page);
  await expect(courage.locator('.fs-dichotomy .b')).toHaveText('safety');

  // the next day the word changes: the old pair stays, struck, in the sheet
  await page.clock.setSystemTime(new Date(2026, 10, 11, 9, 40));
  await page.reload();
  await cross(page);
  await row(page, 'courage').locator('.fs-dichotomy').click();
  await row(page, 'courage').getByRole('button', { name: 'Edit' }).click();
  await expect(sheet(page).getByLabel('Earlier versions')).toHaveCount(0);
  await sheet(page).getByRole('textbox', { name: 'Value' }).fill('nerve');
  await done(page);
  await expect(words(page)).toHaveText(['selfless', 'thoughtful', 'nerve']);
  await row(page, 'nerve').getByRole('button', { name: 'Edit' }).click();
  const earlier = sheet(page).getByLabel('Earlier versions');
  await expect(earlier.locator('[data-struck]')).toHaveCount(1);
  await expect(earlier.locator('[data-struck]')).toContainText('courage | safety');
  // dated the day it was written over
  await expect(earlier).toContainText('11 / 11');
});

test('the seeded paradox words a value has no field for are kept struck', async ({ page }) => {
  await be(page, '#/be/value-px-thoughtful-reactive');
  await row(page, 'thoughtful').getByRole('button', { name: 'Edit' }).click();
  // pole A's bracket word, the pole overdone, is not a shadow: it is drawn struck, never as the shadow
  await expect(sheet(page).getByLabel('Earlier versions').locator('[data-struck]', { hasText: 'obsessive' })).toHaveCount(1);
  await expect(sheet(page).getByRole('textbox', { name: 'Shadow' })).toHaveValue('reactive');
});

test('Resting puts a value down and brings it back', async ({ page }) => {
  await be(page);
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await row(page, 'thoughtful').getByRole('button', { name: 'Edit' }).click();
  await sheet(page).getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Resting' }).click();
  await done(page);
  await expect(words(page)).toHaveText(['selfless']);
  const resting = page.getByRole('button', { name: 'Resting', exact: true });
  await expect(resting).toHaveAttribute('aria-expanded', 'false');
  await resting.click();
  await expect(words(page)).toHaveText(['selfless', 'thoughtful']);
  // it was open when it was put down, and is still open under Resting
  await expect(row(page, 'thoughtful').locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
  await row(page, 'thoughtful').getByRole('button', { name: 'Edit' }).click();
  await sheet(page).getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Held' }).click();
  await done(page);
  await page.reload();
  await cross(page);
  await expect(words(page)).toHaveText(['selfless', 'thoughtful']);
  await expect(page.getByRole('button', { name: 'Resting', exact: true })).toHaveCount(0);
});

test('Delete is two taps on the same row, and the value is gone after a reload', async ({ page }) => {
  await be(page);
  await row(page, 'selfless').locator('.fs-dichotomy').click();
  await row(page, 'selfless').getByRole('button', { name: 'Edit' }).click();
  await sheet(page).getByRole('button', { name: 'Delete' }).click();
  // the first tap only asks; nothing is gone and no dialog rose
  await expect(sheet(page).getByRole('button', { name: /Delete it/ })).toBeVisible();
  await expect(page.locator('dialog, [role="dialog"]')).toHaveCount(0);
  await sheet(page).getByRole('button', { name: /Delete it/ }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(words(page)).toHaveText(['thoughtful']);
  await page.reload();
  await cross(page);
  await expect(words(page)).toHaveText(['thoughtful']);
});

test('a long press lifts a value and a drag puts it in a new place, across a reload', async ({ page }) => {
  await be(page);
  await expect(words(page)).toHaveText(['selfless', 'thoughtful']);
  const first = (await page.locator('.fs-values .fs-dichotomy').first().boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await expect(page.locator('.fs-be-row.lift')).toHaveCount(1);
  // a finger is slower than a script: give the lifted row a frame to take hold of the moves
  await page.waitForTimeout(100);
  await page.mouse.move(first.x + first.width / 2, first.y + first.height * 1.8, { steps: 12 });
  await page.mouse.up();
  await expect(words(page)).toHaveText(['thoughtful', 'selfless']);
  await expect(page.locator('.fs-be-row.lift')).toHaveCount(0);
  // the lift swallowed the tap: nothing opened
  await expect(page.locator('.fs-values .fs-dichotomy[aria-expanded="true"]')).toHaveCount(0);
  await page.reload();
  await cross(page);
  await expect(words(page)).toHaveText(['thoughtful', 'selfless']);
});

test('in Still, the held words alone, and a tap opens nothing', async ({ page }) => {
  await be(page, '#/be/value-px-selfless-selfish');
  await expect(row(page, 'selfless').locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  const still = page.locator('.fs-values .fs-value');
  await expect(still).toHaveText(['selfless', 'thoughtful']);
  await expect(page.locator('.fs-be-core')).toHaveText('I determine my core.');
  await expect(page.getByRole('navigation', { name: 'Be' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'New value' })).toBeHidden();
  await expect(page.locator('.fs-values .fs-spoke, .fs-values .fs-spoke-none, .fs-values button')).toHaveCount(0);
  await expect(page.locator('.fs-values')).not.toContainText('selfish');
  await still.first().click();
  await expect(page.locator('.fs-values .fs-value-body')).toHaveCount(0);
  await expect(page.locator('.fs-values')).not.toContainText('selfish');
});

test('the tapped word travels to the seam as one turn, and nothing stays named after (rule 28)', async ({ page }) => {
  await be(page);
  await page.evaluate(() => {
    const seen: string[] = ((window as unknown as { turns: string[] }).turns = []);
    new MutationObserver(() => { const t = document.documentElement.dataset.turn; if (t) seen.push(t); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-turn'] });
  });
  const selfless = row(page, 'selfless').locator('.fs-dichotomy');
  await selfless.click();
  await expect(selfless).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => (window as unknown as { turns: string[] }).turns)).toContain('be-value');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.turn ?? null)).toBeNull();
  expect(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => getComputedStyle(el).viewTransitionName !== 'none').length)).toBe(0);
  await expect(page.locator('[data-turning]')).toHaveCount(0);
});
