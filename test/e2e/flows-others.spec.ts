// The other three and your own flows (F3, PLAN-FLOWS.md section 6): a deep link to Depress's bottom shows the step on
// the valley's floor with its printed safety line (a line, never a check), in Still too; Energize at rest is the three
// (X2); "+ flow" makes a flow that opens on an empty drawing, its first step is named in the sheet, and the
// flow survives an offline reload.
import { test, expect, type Page } from '@playwright/test';

const threshold = async (page: Page) => {
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

test('the bottom of the valley and its printed safety line; Energize at rest; Fight cools with "Slower now?"', async ({ page }) => {
  await page.goto('/#/flow/depress/4');
  await page.locator('.fs-flowpage').waitFor();
  await threshold(page);
  const body = page.locator('.fs-flowpage');
  await expect(body).toHaveAttribute('data-showing', '4');
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="valley"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'The bottom' })).toHaveAttribute('aria-pressed', 'true');
  // R3: the Heart's page; the said paragraph leaves it, the safety line stays (PLAN-MOUNTAIN.md section 6)
  await expect(body).toHaveAttribute('data-chakra', 'heart');
  await expect(body.locator('.fl-said:not(.fl-print)')).toHaveCount(0);
  const safety = body.locator('.fl-print');
  await expect(safety).toHaveText("If you're thinking about suicide, call or text 988. Someone answers, any hour.");
  // a printed line, not a row: nothing to tick
  await expect(safety).not.toHaveAttribute('role', /.+/);
  await expect(body.locator('[role="checkbox"]', { hasText: '988' })).toHaveCount(0);
  await expect(page.locator('.fs-cycle text.hand', { hasText: 'one small thing' })).toBeVisible();

  // Still keeps the safety line; the said line goes, the words-only usual comes
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(safety).toBeVisible();
  await expect(body.locator('.fl-step-page > .fl-usual')).toHaveCount(0);
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // Energize at rest: the three (PLAN-ENERGIZE.md X2) in place of the rest page; the boundary line stays in the data
  // (X5 moves it to The tip) and is not on the rest page
  await page.goto('/#/flow/energize');
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="arc"]')).toBeVisible();
  await expect(page.locator('.fs-flowpage .fx-card .fx-name')).toHaveText(['FlowState', 'East Winds', 'Japan Trip']);
  await expect(page.locator('.fs-flowpage .fl-print')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Where you are' })).toHaveAttribute('aria-valuemax', '5');

  // Fight: the mountain's two lines across the slope; cooling asks "Slower now?"
  await page.goto('/#/flow/fight/5');
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="mountain"] text.print')).toHaveText(['20 min', 'about an hour']);
  // R3: the step's own line leaves the Throat's page with the copy (open question 3)
  await expect(page.locator('.fs-flowpage .fl-line')).toHaveCount(0);

  // on the mountain Fight sits under the throat's sign (PLAN-MOUNTAIN.md section 6), reached through it
  await page.goto('/#/flow');
  await expect(page.locator('a.mt-stop[data-chakra="throat"]')).toHaveAttribute('href', '#/flow/c/throat');
});

test('"+ flow" makes a flow from nothing that survives an offline reload', async ({ page }) => {
  await page.goto('/#/flow');
  await page.locator('.fs-flows').waitFor();
  await threshold(page);
  // the service worker takes the page over from the next load
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await threshold(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await page.getByRole('button', { name: '+ flow' }).click();
  const sheet = page.locator('.fs-sheet[data-sheet="New flow"]');
  await expect(sheet).toBeVisible();
  const make = sheet.getByRole('button', { name: 'Make' });
  await expect(make).toHaveAttribute('aria-disabled', 'true');
  await expect(sheet.locator('.fl-shape')).toHaveCount(9);
  await sheet.getByLabel('Name').fill('Grief');
  await sheet.locator('.fl-shape[data-diagram="valley"]').click();
  await expect(sheet.locator('.fl-shape[data-diagram="valley"]')).toHaveAttribute('aria-pressed', 'true');
  await make.click();

  await expect(page).toHaveURL(/#\/flow\/[0-9a-f-]{36}$/);
  const url = page.url();
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="valley"]')).toBeVisible();
  await page.getByRole('button', { name: 'name the first step' }).click();
  const step = page.locator('.fs-sheet[data-sheet="The first step"]');
  await step.getByLabel('Name').fill('Facing it');
  await step.getByLabel('Your line').fill('Everything is heavy.');
  await step.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Facing it' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ step' })).toBeVisible();

  await page.context().setOffline(true);
  await page.goto('/#/flow');
  await page.reload();
  await threshold(page);
  await expect(page.locator('a.fl-flow .fs-list-line').last()).toHaveText('Grief');
  await expect(page.locator('a.fl-flow').last()).toHaveAttribute('href', new URL(url).hash);
  await page.locator('a.fl-flow').last().click();
  await expect(page.getByRole('button', { name: 'Facing it' })).toBeVisible();
  await page.getByRole('button', { name: 'Facing it' }).click();
  await expect(page.locator('.fs-flowpage .fl-line')).toHaveText('Everything is heavy.');
});
