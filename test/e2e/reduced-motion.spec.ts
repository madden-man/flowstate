// The reduced-motion pass (package 8, DESIGN.md rule 18): with prefers-reduced-motion: reduce, nothing on
// any screen moves. Open the app (no threshold breath), enter Still (a static ring), open a sheet (it
// appears without rising), check an item (the check draws at once), and at every step no element, nor its
// ::before or ::after, has a non-zero computed animation-duration or transition-duration.
import { test, expect, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

/** Every element whose animation or transition would take time, as "tag.class::pseudo duration". */
const moving = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const long = (v: string) => v.split(',').some(x => parseFloat(x) > 0);
  for (const el of document.querySelectorAll('*')) {
    for (const pseudo of [null, '::before', '::after'] as const) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && cs.content === 'none') continue;
      if (long(cs.animationDuration) && cs.animationName !== 'none') out.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ''} animation ${cs.animationDuration}`);
      if (long(cs.transitionDuration)) out.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ''} transition ${cs.transitionDuration}`);
    }
  }
  return out;
});

test('reduced motion: nothing moves, in Day, in Still, with a sheet up and a check drawn', async ({ page }) => {
  await page.goto('/');
  // the threshold's breath is skipped: the page is straight there
  await expect(page.locator('[data-threshold]')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: "Today's page" })).toBeEnabled();
  expect(await moving(page)).toEqual([]);

  // Still: the ring stands where the moon was, and does not breathe
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  const ring = page.getByRole('button', { name: 'Leave Still' }).locator('.fs-ring-mark');
  await expect(ring).toBeVisible();
  expect(await ring.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await moving(page)).toEqual([]);

  // a sheet appears without rising
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.locator('[data-sheet="Settings"]');
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await moving(page)).toEqual([]);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.fs-scrim')).toHaveCount(0);

  // Flow, still in Still: a check draws at once, and the lean mark does not travel
  await page.getByRole('link', { name: 'Flow' }).click();
  const item = page.getByRole('checkbox', { name: /write for its own sake/ });
  await item.click();
  await expect(item).toHaveAttribute('aria-checked', 'true');
  expect(await moving(page)).toEqual([]);

  // and back in the day's light
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-light', 'still');
  expect(await moving(page)).toEqual([]);
});
