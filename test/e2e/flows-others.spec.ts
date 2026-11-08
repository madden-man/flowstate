// The other three and your own flows (F3, PLAN-FLOWS.md section 6): a deep link to Depress's bottom shows the step on
// the valley's floor with its printed safety line (a line, never a check), in Still too; Energize at rest prints its
// boundary line; "+ flow" makes a flow that opens on an empty drawing, its first step is named in the sheet, and the
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
  await expect(page.locator('.fs-cycle[data-diagram="valley"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'The bottom' })).toHaveAttribute('aria-pressed', 'true');
  await expect(body.locator('.fl-said').first()).toContainText('the floor is where it turns');
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
  await expect(body.locator('.fs-stillonly')).toHaveText('The floor is where it turns.');
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // Energize at rest: the boundary is one printed line on the page, not a step
  await page.goto('/#/flow/energize');
  await expect(page.locator('.fs-cycle[data-diagram="arc"]')).toBeVisible();
  await expect(page.locator('.fs-flowpage .fl-print')).toHaveText('Highs most days for a week without needing sleep: talk to your doctor.');
  await expect(page.getByRole('slider', { name: 'Where you are' })).toHaveAttribute('aria-valuemax', '5');

  // Fight: the mountain's two lines across the slope; cooling asks "Slower now?"
  await page.goto('/#/flow/fight/5');
  await expect(page.locator('.fs-cycle[data-diagram="mountain"] text.print')).toHaveText(['20 min', 'about an hour']);
  await expect(page.locator('.fs-flowpage .fl-line')).toHaveText('Slower now?');

  // the list: Panic, Depress, Energize, Fight, then "+ flow"
  await page.goto('/#/flow');
  await expect(page.locator('a.fl-flow .fs-list-line')).toHaveText(['Panic', 'Depress', 'Energize', 'Fight']);
  await expect(page.locator('a.fl-flow .fs-list-meta')).toHaveText(['The ring', 'The valley', 'The landing arc', 'The mountain']);
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
  await expect(page.locator('.fs-cycle[data-diagram="valley"]')).toBeVisible();
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
