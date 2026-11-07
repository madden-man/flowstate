// The offline smoke, extended through the council (package 2): with the network off, open a council,
// speak as the Skeptic then the Mystic, add a voice "Gardener" from the chip row, speak as it, reload,
// and everything is still there. Nothing leaves the origin.
import { test, expect } from '@playwright/test';

test('a council speaks, gains a voice and survives a reload offline', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole('textbox', { name: "Today's page" })).toBeEnabled();
  await page.getByRole('link', { name: 'Council', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Council', exact: true })).toHaveAttribute('aria-current', 'page');
  const say = page.getByRole('textbox', { name: 'Message' });
  const chip = (name: string) => page.getByRole('group', { name: 'Who speaks next' }).getByRole('button', { name, exact: true });

  // the blank council is already open: the first line makes the page
  await chip('Skeptic').click();
  await say.fill('The mind is not pure, nor is it reliable.');
  await say.press('Enter');
  await expect(page).toHaveURL(/#\/council\/[\w-]+$/);
  await chip('Mystic').click();
  await expect(chip('Mystic')).toHaveAttribute('aria-pressed', 'true');
  await say.fill('Listen to the quiet voices within, even when you do not agree.');
  await say.press('Enter');

  // "+ voice": a name and a hue on the wheel, and it speaks next
  await chip('+ voice').click();
  const sheet = page.locator('[data-sheet="A new voice"]');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Gardener');
  const wheel = sheet.getByRole('slider', { name: 'Colour' });
  const box = (await wheel.boundingBox())!;
  // a tap on the left of the ring, a little above the middle: violet, clear of every seeded voice
  await wheel.click({ position: { x: box.width * 0.1, y: box.height * 0.4 } });
  await expect.poll(async () => Number(await wheel.getAttribute('aria-valuenow'))).toBeGreaterThan(270);
  expect(Number(await wheel.getAttribute('aria-valuenow'))).toBeLessThan(290);
  await expect(sheet.getByRole('status')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(chip('Gardener')).toHaveAttribute('aria-pressed', 'true');
  await say.fill('Tend what is growing.');
  await say.press('Enter');

  const lines = page.locator('.fs-msg');
  const expectAll = async () => {
    await expect(lines).toHaveCount(3);
    await expect(lines.nth(0)).toHaveAttribute('data-voice', 'Skeptic');
    await expect(lines.nth(1)).toHaveAttribute('data-voice', 'Mystic');
    await expect(lines.nth(2)).toHaveAttribute('data-voice', 'Gardener');
    await expect(lines.nth(2)).toContainText('Tend what is growing.');
  };
  await expectAll();
  // the lamp takes the last speaker's colour
  await expect(page.locator('.fs-app')).toHaveAttribute('data-lamp', '');

  await page.reload();
  await expectAll();
  await expect(chip('Gardener')).toBeVisible();

  // the Voices screen has it too, beside the rest of the pantheon
  await page.getByRole('link', { name: 'Voices', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Gardener/ })).toBeVisible();

  expect(outside).toEqual([]);
});
