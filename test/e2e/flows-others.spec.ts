// The other three (F3, PLAN-FLOWS.md section 6): a deep link to Depress's bottom reads the step on Depress's own page
// with its printed safety line (a line, never a check), in Still too; the drawings (the valley's floor, Fight's
// mountain) are the flow page's; Energize at rest is the three (X2). "+ flow" left with the mountain (PLAN-WORLDS.md
// section 4.1).
import { test, expect, type Page } from '@playwright/test';
import { whenSeeded } from './seeded';

const threshold = async (page: Page) => {
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

test('the bottom on Depress\'s own page and its printed safety line; Energize at rest; Fight\'s own page', async ({ page }) => {
  await page.goto('/#/flow/depress/4');
  await page.locator('.fs-flowpage').waitFor();
  await threshold(page);
  const body = page.locator('.fs-flowpage[data-flow="depress"]');
  await expect(body).toHaveAttribute('data-showing', '4');
  // its own page: the valley, the step pressed, the said paragraph, the safety line
  await expect(body.locator('.fs-cycle[data-diagram="valley"]')).toBeVisible();
  await expect(body.locator('.fs-cycle-word[aria-pressed="true"]')).toHaveAttribute('aria-label', 'The bottom');
  await expect(page.locator('.fs-hdr').getByRole('link', { name: 'Flow', exact: true })).toHaveAttribute('href', '#/flow');
  const safety = body.locator('.fl-print');
  await expect(safety).toHaveText("If you're thinking about suicide, call or text 988. Someone answers, any hour.");
  // a printed line, not a row: nothing to tick
  await expect(safety).not.toHaveAttribute('role', /.+/);
  await expect(body.locator('[role="checkbox"]', { hasText: '988' })).toHaveCount(0);

  // Still keeps the safety line
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(safety).toBeVisible();
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // Energize at rest: the three (PLAN-ENERGIZE.md X2) in place of the rest page; the boundary line stays in the data
  // (X5 moves it to The tip) and is not on the rest page
  await page.goto('/#/flow/energize');
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="arc"]')).toBeVisible();
  await expect(page.locator('.fs-flowpage .fx-card .fx-name')).toHaveText(['FlowState', 'East Winds', 'Japan Trip']);
  await expect(page.locator('.fs-flowpage .fl-print')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Where you are' })).toHaveAttribute('aria-valuemax', '5');

  // Fight cooling on its own page: the mountain, and its line asks "Slower now?"
  await page.goto('/#/flow/fight/5');
  const fight = page.locator('.fs-flowpage[data-flow="fight"]');
  await expect(fight).toHaveAttribute('data-showing', '5');
  await expect(fight.locator('.fs-cycle[data-diagram="mountain"]')).toBeVisible();
  await expect(fight.locator('.fl-line')).toHaveText('Slower now?');
});

test('the bottom on the valley\'s floor with its safety line, and Fight\'s mountain cools with "Slower now?"', async ({ page }) => {
  await page.goto('/#/flow');
  await page.locator('.fs-app').waitFor();
  await threshold(page);
  await whenSeeded(page, 'depress', 'fight');
  await page.goto('/#/flow/depress/4');
  const body = page.locator('.fs-flowpage');
  await expect(body).toHaveAttribute('data-showing', '4');
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="valley"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'The bottom' })).toHaveAttribute('aria-pressed', 'true');
  await expect(body.locator('.fl-said').first()).toContainText('the floor is where it turns');
  const safety = body.locator('.fl-print');
  await expect(safety).toHaveText("If you're thinking about suicide, call or text 988. Someone answers, any hour.");
  await expect(safety).not.toHaveAttribute('role', /.+/);
  await expect(body.locator('[role="checkbox"]', { hasText: '988' })).toHaveCount(0);
  await expect(page.locator('.fs-cycle text.hand', { hasText: 'one small thing' })).toBeVisible();

  // Still keeps the safety line; the said line goes, the words-only usual comes
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(safety).toBeVisible();
  await expect(body.locator('.fl-step-page > .fl-usual.fs-stillonly')).toHaveText('The floor is where it turns.');
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // Fight: the mountain's two lines across the slope; cooling asks "Slower now?"
  await page.goto('/#/flow/fight/5');
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="mountain"] text.print')).toHaveText(['20 min', 'about an hour']);
  await expect(page.locator('.fs-flowpage .fl-line')).toHaveText('Slower now?');
});
