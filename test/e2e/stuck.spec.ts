// What stuck (PLAN-ENERGIZE.md X4): from Energize the word under the deck opens the ribbons, East Winds first (on
// since 8 / 20, the longest held), each row on the page and nothing clipped; the way back returns to Energize.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  await page.locator('.fs-app').waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('Energize, What stuck, East Winds first, and back to Energize', async ({ page }) => {
  await open(page, '#/flow/energize');
  await page.locator('.fx-foot a', { hasText: 'What stuck' }).click();
  await expect(page).toHaveURL(/#\/flow\/energize\/stuck$/);
  const rows = page.locator('.fx-stuck .fx-rib');
  await expect(rows.locator('.fx-rib-name > span')).toHaveText(['East Winds', 'Japan Trip', 'FlowState']);
  await expect(rows.first().locator('.fx-meta')).toHaveText(/^on since 8 \/ 20$/i);
  await expect(rows.first().locator('.fx-track i.on')).toHaveCount(1);
  await expect(page.locator('.fx-axis .fx-axis-now')).toHaveText(/now/i);
  // nothing clipped at 390 wide: every ribbon inside the page
  const width = page.viewportSize()!.width;
  for (const rib of await page.locator('.fx-track i').all()) {
    const b = (await rib.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(width);
  }
  await page.locator('.fs-hdr a.fs-word', { hasText: 'Energize' }).click();
  await expect(page).toHaveURL(/#\/flow\/energize$/);
  await expect(page.locator('.fx-card .fx-name')).toHaveText(['FlowState', 'East Winds', 'Japan Trip']);
});
