// The offline smoke (PLAN.md section 10, package 0): load, go offline, reload, write, reload again,
// the text is still there. Nothing leaves the origin at any point.
import { test, expect, type Page } from '@playwright/test';

const page$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });

test('opens, writes and survives reloads with the network off', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  await page.goto('/');
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link')).toHaveText(['Journal', 'Council', 'Be', 'Flow']);
  await expect(page.locator('html')).toHaveAttribute('data-light', /^(day|night)$/);

  // wait until the service worker has precached everything and controls the page
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page$(page)).toBeEnabled();

  const line = 'All this, and I am reduced to simple journaling.';
  await page$(page).click();
  await page$(page).pressSequentially(line, { delay: 5 });
  await expect(page$(page)).toHaveAttribute('data-saved', 'true');

  await page.reload();
  await expect(page$(page)).toHaveValue(line);

  // the other tabs open offline too, and a deep link lands on its tab
  await page.getByRole('link', { name: 'Council' }).click();
  await expect(page.getByText('Mystic')).toBeVisible();
  await page.goto('/#/be/px-selfless-selfish');
  await expect(page.getByRole('link', { name: 'Be' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('selfless', { exact: true })).toBeVisible();

  // Settings rises from the header and goes away without leaving anything over the tabs
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.locator('[data-sheet="Settings"]');
  await expect(sheet).toBeVisible();
  await page.getByRole('button', { name: 'Night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'night');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.fs-scrim')).toHaveCount(0);

  // the moon puts the page in Still; the ring brings it back
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'night');

  expect(outside).toEqual([]);
});
