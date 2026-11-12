// The Research fence (PLAN-RESEARCH.md sections 1 and 6, Q2; DESIGN.md rule 22): with no research key saved, walking
// every tab and opening Settings makes no request off the origin. The Research row is there, offering to paste a key,
// and nothing is sent for it.
import { test, expect } from '@playwright/test';

test('with no research key, every tab and Settings stay on the origin', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  await page.goto('/');
  await expect(page).toHaveURL(/#\/journal$/);
  const tabs = page.getByRole('navigation', { name: 'Sections' });
  for (const slug of ['council', 'questions', 'be', 'flow', 'journal']) {
    const tab = tabs.locator(`a[href="#/${slug}"]`);
    await tab.click();
    await expect(tab).toHaveAttribute('aria-current', 'page');
  }
  await page.goto('/#/flow/meditate');
  await page.goto('/#/flow/energize');
  await page.goto('/#/journal');

  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.locator('[data-sheet="Settings"]');
  await expect(sheet).toBeVisible();
  const row = sheet.locator('[data-research]');
  await expect(row.getByText('Research key')).toBeVisible();
  await expect(row.getByText('Kept on this phone, sealed with the PIN. A question leaves the phone; nothing else does.')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);

  // let anything late (a prefetch, a beacon) have its chance before counting
  await page.waitForTimeout(500);
  expect(outside).toEqual([]);
});
