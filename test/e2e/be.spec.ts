// V13: the paradoxes on Be are reordered by a long press and a drag, as the voices are; the order holds
// across a reload and on Flow.
import { test, expect } from '@playwright/test';

test('a long press lifts a paradox and a drag puts it in a new place (V13)', async ({ page }) => {
  await page.goto('/#/be');
  // the threshold, when a cold load breathes, is tapped through first
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-dichotomy').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
  const rows = page.locator('.fs-dichotomy .a');
  await expect(rows).toHaveText(['selfless', 'thoughtful']);
  const first = (await page.locator('.fs-dichotomy').first().boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await expect(page.locator('.fs-be-row.lift')).toHaveCount(1);
  // a finger is slower than a script: give the lifted row a frame to take hold of the moves
  await page.waitForTimeout(100);
  await page.mouse.move(first.x + first.width / 2, first.y + first.height * 1.8, { steps: 12 });
  await page.mouse.up();
  await expect(rows).toHaveText(['thoughtful', 'selfless']);
  // the row settles once the new order is written
  await expect(page.locator('.fs-be-row.lift')).toHaveCount(0);
  // the lift swallowed the tap: nothing opened
  await expect(page.locator('.fs-dichotomy[aria-expanded="true"]')).toHaveCount(0);
  await page.reload();
  if (await t.count()) await t.click();
  await expect(rows).toHaveText(['thoughtful', 'selfless']);
  await page.getByRole('link', { name: 'Flow', exact: true }).click();
  // Flow keeps the same order (a paradox with nothing due today still has its section)
  await expect(page.locator('.fs-flow-group').first()).toHaveAttribute('aria-label', 'thoughtful and reactive');
});
