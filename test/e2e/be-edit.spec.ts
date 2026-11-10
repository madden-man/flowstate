// Edit and delete on Be (PLAN-SELF.md S2): a pole word tapped on the spread opens the paradox sheet with the caret in
// that field, and the new word holds on the row and the spread across a reload; the Both line rides the same sheet;
// a goal and a paradox are deleted with two taps on the same row, and one tap deletes nothing.
import { test, expect, type Page } from '@playwright/test';

async function openBe(page: Page, path = '/#/be') {
  await page.goto(path);
  // the threshold, when a cold load breathes, is tapped through first
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-dichotomy').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('a pole word opens its field; the new word and the Both line hold across a reload', async ({ page }) => {
  await openBe(page, '/#/be/px-selfless-selfish');
  const card = page.locator('#be-px-selfless-selfish');
  await card.locator('.fs-pole.a button').click();
  const sheet = page.locator('[data-sheet="The paradox"]');
  const top = sheet.getByRole('textbox', { name: 'Top: value' });
  await expect(top).toBeFocused();
  await top.fill('giving');
  await sheet.getByRole('textbox', { name: 'Both, in a sentence' }).fill('I give, and I keep enough back to give again');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.fs-dichotomy .a')).toHaveText(['giving', 'thoughtful']);
  await expect(card.locator('.fs-pole.a')).toHaveText('giving');

  await page.reload();
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-dichotomy').first().waitFor();
  if (await t.count()) await t.click();
  await expect(page.locator('.fs-dichotomy .a')).toHaveText(['giving', 'thoughtful']);
  await expect(card.locator('.fs-pole.a')).toHaveText('giving');
  // the other pole word takes the caret in its own field
  await card.locator('.fs-pole.b button').click();
  await expect(sheet.getByRole('textbox', { name: 'Bottom: value' })).toBeFocused();
  await expect(sheet.getByRole('textbox', { name: 'Both, in a sentence' })).toHaveValue('I give, and I keep enough back to give again');
  // the earlier word stays, struck through
  await expect(sheet.getByLabel('Earlier versions')).toContainText('selfless');
});

test('a goal is deleted with two taps and its balance shows the dashed slot; one tap deletes nothing', async ({ page }) => {
  await openBe(page, '/#/be/px-selfless-selfish');
  const card = page.locator('#be-px-selfless-selfish');
  const goal = card.locator('[data-goal="it-volunteer"]');
  await goal.click();
  const sheet = page.locator('[data-sheet="Fill both"]');
  await sheet.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(sheet.getByRole('button', { name: /Delete it/ })).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(goal).toHaveCount(1);

  await goal.click();
  await sheet.getByRole('button', { name: 'Delete', exact: true }).click();
  await sheet.getByRole('button', { name: /Delete it/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(goal).toHaveCount(0);
  await expect(card.locator('[data-goal="it-breathing-room"]')).toHaveCount(1);
  await expect(card.locator('[data-slot-for="it-breathing-room"]')).toBeVisible();
});

test('a paradox is deleted with two taps and is gone after a reload; one tap deletes nothing', async ({ page }) => {
  await openBe(page, '/#/be/px-thoughtful-reactive');
  const card = page.locator('#be-px-thoughtful-reactive');
  const sheet = page.locator('[data-sheet="The paradox"]');
  await card.locator('.fs-spread-words').getByRole('button', { name: 'Edit' }).click();
  const del = sheet.getByRole('button', { name: 'Delete', exact: true });
  await del.click();
  await expect(sheet.getByRole('button', { name: /Delete it/ })).toBeVisible();
  // the ask lets go after a few seconds
  await expect(del).toBeVisible({ timeout: 6000 });
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.fs-dichotomy .a')).toHaveText(['selfless', 'thoughtful']);

  await card.locator('.fs-spread-words').getByRole('button', { name: 'Edit' }).click();
  await del.click();
  await sheet.getByRole('button', { name: /Delete it/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.fs-dichotomy .a')).toHaveText(['selfless']);
  await page.reload();
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-dichotomy').first().waitFor();
  if (await t.count()) await t.click();
  await expect(page.locator('.fs-dichotomy .a')).toHaveText(['selfless']);
});
