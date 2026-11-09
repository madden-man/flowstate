// Meditate (PLAN-MEDITATE.md, S1): the Flow list's second row opens #/flow/meditate; a tap on the circle sits (the
// header and the tabs leave, the page says it is sitting) and a tap comes back; the chosen sound survives a reload
// offline; with Reduce Motion the circle does not breathe; and "meditate" is never read as a flow's id. Nobody can
// hear a headless browser: the sound itself is the iPhone check in the plan.
import { test, expect, type Page } from '@playwright/test';

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

test('meditate: the row, a sit and back, the sound kept offline', async ({ page }) => {
  await open(page, '#/flow');
  // the second row of the list, under Right now and above the flows
  const rows = page.locator('.fs-flows > a.fl-flow');
  await expect(rows.nth(0)).toHaveAttribute('href', '#/flow/now');
  await expect(rows.nth(1)).toHaveAttribute('href', '#/flow/meditate');
  await expect(rows.nth(1).locator('.fs-list-line')).toHaveText('Meditate');
  await expect(rows.nth(1).locator('.fs-list-meta')).toHaveText('The circle');
  await expect(rows.nth(1).locator('.fl-mini [data-circle="row"] path.arc')).toHaveCount(1);
  await expect(rows.nth(2)).toHaveAttribute('href', '#/flow/panic');
  await rows.nth(1).click();
  await expect(page).toHaveURL(/#\/flow\/meditate$/);

  // at rest: the circle with "begin", the five chips, rain chosen
  const md = page.locator('.md-page');
  await expect(md).toHaveAttribute('data-state', 'rest');
  const circle = page.getByRole('button', { name: 'Begin' });
  await expect(circle.locator('.md-mid')).toHaveText('begin');
  await expect(page.locator('.md-sounds .fs-chip')).toHaveText(['Rain', 'Ocean', 'Forest', 'Bowl', 'Quiet']);
  await expect(page.getByRole('button', { name: 'Rain' })).toHaveAttribute('aria-pressed', 'true');
  const box = await circle.boundingBox();

  // a tap sits: only the circle is left, in the same place
  await circle.click();
  await expect(md).toHaveAttribute('data-state', 'sitting');
  await expect(page.locator('.fs-app')).toHaveAttribute('data-sitting', 'true');
  const gone = (sel: string) => expect.poll(() => page.locator(sel).first().evaluate(el => getComputedStyle(el).opacity)).toBe('0');
  await gone('.fs-hdr');
  await gone('.fs-tabs');
  await gone('.md-quiet');
  await gone('.md-mid');
  expect(await page.locator('.md-circle').boundingBox()).toEqual(box);
  // the circle is on the sound's clock now, not the CSS breath
  expect(await page.locator('.md-breath').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect.poll(() => page.locator('.md-breath').evaluate(el => el.style.transform)).toMatch(/^scale\(/);
  // the light never changes because of a sit
  const light = await page.locator('html').getAttribute('data-light');

  // a tap comes back
  await page.getByRole('button', { name: 'End the sit' }).click();
  await expect(md).toHaveAttribute('data-state', 'rest');
  await expect(page.locator('.fs-app')).not.toHaveAttribute('data-sitting', /.*/);
  await expect.poll(() => page.locator('.fs-tabs').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  expect(await page.locator('html').getAttribute('data-light')).toBe(light);

  // hidden mid-sit, the sit ends
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(md).toHaveAttribute('data-state', 'sitting');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(md).toHaveAttribute('data-state', 'rest');
  await page.evaluate(() => { delete (document as unknown as Record<string, unknown>).visibilityState; });

  // the ocean, chosen, survives a reload offline
  await page.getByRole('button', { name: 'Ocean' }).click();
  await expect(page.getByRole('button', { name: 'Ocean' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Rain' })).toHaveAttribute('aria-pressed', 'false');
  // written to the settings row before the reload
  await expect.poll(() => page.evaluate(() => new Promise<string | undefined>((resolve, reject) => {
    const open = indexedDB.open('flowstate');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const r = open.result.transaction('settings').objectStore('settings').get('app');
      r.onsuccess = () => { open.result.close(); resolve(r.result?.sitSound); };
      r.onerror = () => reject(r.error);
    };
  }))).toBe('ocean');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.context().setOffline(true);
  await page.reload();
  if (await t.count()) await t.click();
  await expect(page).toHaveURL(/#\/flow\/meditate$/);
  await expect(page.getByRole('button', { name: 'Ocean' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.md-page')).toHaveAttribute('data-sound', 'ocean');

  // a route away mid-sit ends it, and the frame comes back
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('.fs-app')).toHaveAttribute('data-sitting', 'true');
  await page.evaluate(() => { location.hash = '#/flow'; });
  await expect(page.locator('.fs-flows')).toBeVisible();
  await expect(page.locator('.fs-app')).not.toHaveAttribute('data-sitting', /.*/);
});

test('meditate: in Still the page is the circle and the sounds', async ({ page }) => {
  await open(page, '#/flow/meditate');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  await expect(page.locator('.md-sounds .fs-chip')).toHaveCount(5);
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('.md-page')).toHaveAttribute('data-state', 'sitting');
  await page.getByRole('button', { name: 'End the sit' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
});

test('meditate is not a flow id', async ({ page }) => {
  await open(page, '#/flow/meditate/1');
  await expect(page).toHaveURL(/#\/flow\/meditate$/);
  await expect(page.locator('.md-page')).toBeVisible();
  await expect(page.locator('.fs-flowpage')).toHaveCount(0);
  await expect(page.locator('.fs-hdr-r')).toContainText('Meditate');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the circle does not breathe, at rest or sitting', async ({ page }) => {
    await open(page, '#/flow/meditate');
    const breath = page.locator('.md-breath');
    expect(await breath.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.md-page')).toHaveAttribute('data-state', 'sitting');
    await page.waitForTimeout(500);
    expect(await breath.evaluate(el => el.style.transform)).toBe('');
    expect(await breath.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    // the frame still leaves, at once
    expect(await page.locator('.fs-tabs').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
  });
});
