// The three (PLAN-ENERGIZE.md X2): Energize at rest shows the three seeded fixations in slot order over the drawing's
// water, the deck as chips and What stuck; Still keeps the names only; the Flow list's Energize row names the three.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  await page.locator('.fs-app').waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('Energize is the three, the deck and What stuck; Still the names; the list names them', async ({ page }) => {
  await open(page, '#/flow/energize');
  const body = page.locator('.fs-flowpage');
  await expect(body.locator('.fx-card .fx-name')).toHaveText(['FlowState', 'East Winds', 'Japan Trip']);
  await expect(body.locator('.fx-card .fx-meta').first()).toContainText(/^Since 11 \/ 7 · /);
  await expect(body.locator('.fx-deckpeek .fs-chip')).toHaveText(['Jazz piano', 'Conduit', 'Learning Chinese', 'Studying philosophy']);
  await expect(body.locator('.fx-foot a')).toHaveText('What stuck');
  await expect(body.locator('.fx-foot a')).toHaveAttribute('href', '#/flow/energize/stuck');
  // the water in the three hues, lane by lane
  await expect(body.locator('.fl-stream line.h0').first()).toBeAttached();
  await expect(body.locator('.fl-stream line.h2').first()).toBeAttached();
  // nothing clipped at 390 wide: each card inside the page
  for (const card of await body.locator('.fx-card').all()) {
    const b = (await card.boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }

  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(body.locator('.fx-card .fx-name')).toHaveText(['FlowState', 'East Winds', 'Japan Trip']);
  await expect(body.locator('.fx-meta, .fx-deckpeek, .fx-foot, .fx-under')).toHaveCount(0);
  await page.getByRole('button', { name: 'Leave Still' }).click();

  await page.goto('/#/flow');
  const row = page.locator('a.fl-flow', { has: page.locator('.fs-list-line', { hasText: 'Energize' }) });
  await expect(row.locator('.fs-list-meta')).toHaveText('FlowState · East Winds · Japan Trip');
});
