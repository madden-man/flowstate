// Lock (package 6), offline: set the PIN 3569 (it spells FLOW) through Settings, reload, the keypad stands
// in front of everything; type it and the Journal opens with the earlier line intact. A deep link waits
// behind the lock and lands after it. Turn off, reload, no keypad. Nothing leaves the origin.
import { test, expect, type Page } from '@playwright/test';

const page$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });
const keypad = (p: Page) => p.getByRole('group', { name: 'PIN' });
const tap = async (p: Page, digits: string) => {
  for (const d of digits) await p.locator('.fs-key', { has: p.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
};

test('lock: set a PIN, reload to the keypad, open with the word, turn it off', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();

  const line = 'Wait out the truly hard parts, they never last forever.';
  await page$(page).click();
  await page$(page).pressSequentially(line, { delay: 2 });
  await expect(page$(page)).toHaveAttribute('data-saved', 'true');
  await page.reload();
  await expect(page.locator('.fs-msg', { hasText: line })).toBeVisible();

  // Settings: PIN, Set a PIN; the honest limit sits under it
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[data-sheet="Settings"]');
  await expect(settings.getByText('A short PIN is a curtain, not a vault.')).toBeVisible();
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const sheet = page.locator('[data-sheet="Set a PIN"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: '2 ABC' })).toBeVisible();
  await tap(page, '3569');
  await expect(sheet.locator('.fs-dots i.on')).toHaveCount(4);
  await sheet.getByRole('button', { name: 'Next' }).click();
  await expect(sheet.getByText('Once more')).toBeVisible();
  // a different second try is a quiet line, and back to the first
  await tap(page, '3568');
  await expect(sheet.getByText('Those two differ; choose again')).toBeVisible();
  await tap(page, '3569');
  await sheet.getByRole('button', { name: 'Next' }).click();
  await tap(page, '3569');
  // sealed: the sheet goes down and Settings comes back with Change PIN and Turn off
  await expect(settings.getByRole('button', { name: 'Change PIN' })).toBeVisible({ timeout: 15_000 });
  await expect(settings.getByRole('group', { name: 'Relock after' }).getByRole('button', { name: '5 min', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await settings.getByRole('button', { name: 'Done' }).click();

  // a reload starts locked: the manifesto and the keypad, no tab bar, and the hash waits
  await page.goto('/#/flow');
  await page.reload();
  await expect(keypad(page)).toBeVisible();
  await expect(page.getByText('Who to Be, How to Flow')).toBeVisible();
  await expect(page.getByText('I choose how to flow.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/flow$/);

  // a wrong one empties the dots and says so quietly
  await tap(page, '1234');
  await expect(page.getByText('Not that one')).toBeVisible();
  await expect(page.locator('.fs-dots i.on')).toHaveCount(0);

  // the word on a hardware keyboard: F L O W
  await page.keyboard.type('flow');
  const tabs = page.getByRole('navigation', { name: 'Sections' });
  await expect(tabs.getByRole('link', { name: 'Flow' })).toHaveAttribute('aria-current', 'page', { timeout: 15_000 });
  await tabs.getByRole('link', { name: 'Journal' }).click();
  await expect(page.locator('.fs-msg', { hasText: line })).toBeVisible();

  // Turn off asks once; after it a reload has no keypad
  await page.getByRole('button', { name: 'Settings' }).click();
  await settings.getByRole('button', { name: 'Turn off' }).click();
  const off = page.locator('[data-sheet="Turn off"]');
  await expect(off).toBeVisible();
  await tap(page, '3569');
  await expect(settings.getByRole('button', { name: /Set a PIN/ })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.locator('.fs-msg', { hasText: line })).toBeVisible();
  await expect(keypad(page)).toHaveCount(0);

  expect(outside).toEqual([]);
});
