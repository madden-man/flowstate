// The reduced-motion pass (package 8, DESIGN.md rule 18): with prefers-reduced-motion: reduce, nothing on
// any screen moves. Open the app (no threshold breath), enter Still (a static ring), open a sheet (it
// appears without rising), open a value on Be (it opens at once), and at every step no element, nor its
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

test('reduced motion: nothing moves, in Day, in Still, with a sheet up and a value opened', async ({ page }) => {
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

  // back in the day's light
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-light', 'still');
  expect(await moving(page)).toEqual([]);

  // Be (PLAN-VALUES.md C2): a value opens on its shadow at once; the word does not travel, nothing folds or is written
  await page.getByRole('link', { name: 'Be' }).click();
  const value = page.locator('.fs-values .fs-dichotomy').first();
  await value.click();
  await expect(value).toHaveAttribute('aria-expanded', 'true');
  await expect(value.locator('.b')).toHaveText('selfish');
  expect(await page.evaluate(() => document.documentElement.dataset.turn ?? null)).toBeNull();
  await expect(page.locator('.fs-be-fold[data-fold]')).toHaveCount(0);
  expect(await moving(page)).toEqual([]);
});

// M1 (PLAN-MOTION.md): the press, the check's pen, the PIN's blot, the unlock's ring and the hold's lift all stand
// still under Reduce Motion, and every one of them still does its job.
test('reduced motion: a key held down, the dots, the unlock and a held line do not move', async ({ page }) => {
  const key = (d: string) => page.locator('.fs-key', { has: page.locator('b', { hasText: new RegExp(`^${d}$`) }) });
  const hold = async (sel: ReturnType<Page['locator']>) => {
    const b = (await sel.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
  };
  await page.goto('/');
  const today = page.getByRole('textbox', { name: "Today's page" });
  await today.fill('A line to hold.');
  await expect(today).toHaveAttribute('data-saved', 'true');
  await page.reload();

  // a line held: the hold fills without lifting, then the line sheet opens as before
  const line = page.locator('.fs-msg', { hasText: 'A line to hold.' });
  await hold(line);
  await expect(line).toHaveClass(/holding/);
  expect(await line.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  expect(await moving(page)).toEqual([]);
  await page.mouse.up();
  await page.keyboard.press('Escape');

  // a PIN set through Settings: a key held down answers at once, nothing eases
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('[data-sheet="Settings"]').getByRole('button', { name: /Set a PIN/ }).click();
  await hold(key('3'));
  await expect(key('3')).toHaveAttribute('data-down', '');
  expect(await moving(page)).toEqual([]);
  await page.mouse.up();
  for (const d of '569') await key(d).click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (const d of '3569') await key(d).click();
  const settings = page.locator('[data-sheet="Settings"]');
  await expect(settings.getByRole('button', { name: 'Change PIN' })).toBeVisible({ timeout: 15_000 });
  await settings.getByRole('button', { name: 'Done' }).click();

  // locked: a miss empties every dot at once, and the right PIN opens with no circle and no copy of the threshold
  await page.reload();
  await expect(page.getByRole('group', { name: 'PIN' })).toBeVisible();
  for (const d of '1234') await key(d).click();
  await expect(page.getByText('Not that one')).toBeVisible();
  await expect(page.locator('.fs-dots i.on')).toHaveCount(0);
  expect(await moving(page)).toEqual([]);
  for (const d of '3569') await key(d).click();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => [...document.body.children].filter(e => !e.matches('script, #app')).length)).toBe(0);
  expect(await moving(page)).toEqual([]);
});
