// The deck (PLAN-ENERGIZE.md X3), as the page uses it: on Energize, a tap on the third card (Japan Trip) raises the deck
// sheet, a tap on Jazz piano puts it in that slot, the third card reads Jazz piano and Japan Trip is back on deck.
// The cards are X2's (ui/flow/Fixations.tsx), which this branch does not have.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

// enabled when X2 is merged
test.fixme('deck: the third card swaps for Jazz piano, and Japan Trip goes back on deck', async ({ page }) => {
  await open(page, '#/flow/energize');
  const cards = page.locator('.fx-cards .fx-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(2)).toContainText('Japan Trip');
  await cards.nth(2).click();
  const sheet = page.locator('.fx-sheet .fs-sheet');
  await expect(sheet.locator('.fs-sheet-title h2')).toHaveText('Japan Trip');
  await expect(sheet.locator('.fx-since')).toHaveText('On since 10 / 28');
  await sheet.locator('.fx-deckrow', { hasText: 'Jazz piano' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(cards.nth(2)).toContainText('Jazz piano');
  await expect(page.locator('.fx-deckpeek')).toContainText('Japan Trip');
  // and back again the other way: a deck chip asks which of the three it replaces
  await page.locator('.fx-deckpeek .fs-chip', { hasText: 'Japan Trip' }).click();
  await expect(page.locator('.fx-sheet .fs-sheet-title h2')).toHaveText('Japan Trip');
  await page.locator('.fx-sheet .fx-deckrow', { hasText: 'Jazz piano' }).click();
  await expect(cards.nth(2)).toContainText('Japan Trip');
});
