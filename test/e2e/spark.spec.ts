// Spark it (PLAN-ENERGIZE.md X5), as the page uses it: a tap on East Winds raises the deck sheet, Spark it puts the dot
// on Spark and lands on #/flow/energize/1 with East Winds' card above the Spark rows and the water in its one hue; a
// Next line written on the ride's card is on the card back at rest.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('spark: East Winds names the ride at Spark, its Next line is written there and read at rest', async ({ page }) => {
  await open(page, '#/flow/energize');
  const cards = page.locator('.fx-cards .fx-card');
  await expect(cards).toHaveCount(3);
  await cards.nth(1).click();
  const sheet = page.locator('.fx-sheet .fs-sheet');
  await expect(sheet.locator('.fs-sheet-title h2')).toHaveText('East Winds');
  await sheet.locator('.fs-sheet-words .fs-word', { hasText: 'Spark it' }).click();
  await expect(page).toHaveURL(/#\/flow\/energize\/1$/);
  await expect(sheet).toHaveCount(0);

  const step = page.locator('.fl-step-page');
  const ride = step.locator('.fx-card.fx-ride');
  await expect(ride).toHaveCount(1);
  await expect(ride.locator('.fx-name')).toHaveText('East Winds');
  await expect(step).toContainText('One task, and its next small step');
  // the card sits above the Spark rows
  const cardBox = (await ride.boundingBox())!;
  const rowBox = (await step.getByText('One task, and its next small step').boundingBox())!;
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(rowBox.y);
  await expect(page.locator('.fl-said:not(.fl-print)')).toHaveCount(0);
  // the water in one hue: every lane East Winds' green
  const svg = page.locator('.fl-stream svg');
  const fx = await svg.evaluate(s => [0, 1, 2].map(k => (s as SVGSVGElement).style.getPropertyValue(`--fx${k}`)));
  expect(new Set(fx).size).toBe(1);
  expect(fx[0]).toMatch(/ 150\)$/);

  const next = ride.locator('.fx-next input');
  await next.fill('Chapter nine, the harbor at dawn');
  await next.blur();
  await expect(page.locator('.fs-flowpage')).toHaveAttribute('data-saved', 'true');

  // back to rest: the dot off Spark to rest ends the ride, and the three come back with the Next line on the card
  await page.locator('[role="slider"]').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/#\/flow\/energize$/);
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(1).locator('.fx-next')).toHaveText('NextChapter nine, the harbor at dawn');
  const back = await svg.evaluate(s => [0, 1, 2].map(k => (s as SVGSVGElement).style.getPropertyValue(`--fx${k}`)));
  expect(new Set(back).size).toBe(3);
});
