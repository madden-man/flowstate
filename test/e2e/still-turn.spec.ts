// Still from the moon (M4, PLAN-MOTION.md, DESIGN.md rule 29): a tap on the moon runs turn('still') and the dark opens
// from the moon; a tap on the ring runs turn('wake') and it closes back into the ring. The light changes inside the
// turn, never after it: the turn does not delay the change. The Settings pin is no turn (rule 12's one breath);
// Reduce Motion runs no turn; with no view transitions the light still changes, over today's cross-fade.
import { test, expect, type Page } from '@playwright/test';

type Entry = { light?: string; turn: string | null; x: string; r: string; td: string };

/** Logs every change of data-light and data-turn on <html> (with the circle's vars and the root's transition at that
 *  moment), and every view transition started, with the turn it was started as. */
function watch() {
  const w = window as unknown as { __log: Entry[]; __turns: string[] };
  w.__log = []; w.__turns = [];
  const d = document as Document & { startViewTransition?: (cb: () => unknown) => unknown };
  const svt = d.startViewTransition?.bind(d);
  if (svt) d.startViewTransition = cb => { w.__turns.push(d.documentElement.dataset.turn ?? ''); return svt(cb); };
  // the init script runs before the parser makes <html>: watch the document and keep <html>'s own changes
  new MutationObserver(ms => {
    const h = document.documentElement;
    if (!ms.some(m => m.target === h)) return;
    w.__log.push({
      light: h.dataset.light, turn: h.dataset.turn ?? null,
      x: h.style.getPropertyValue('--still-x'), r: h.style.getPropertyValue('--still-r'),
      td: getComputedStyle(h).transitionDuration,
    });
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-light', 'data-turn', 'style'] });
}

const log = (page: Page) => page.evaluate(() => (window as unknown as { __log: Entry[] }).__log);
const turns = (page: Page) => page.evaluate(() => (window as unknown as { __turns: string[] }).__turns);
const html = (page: Page) => page.locator('html');

/** The first logged moment the light was `light`, after `from` entries. */
const landed = async (page: Page, light: string, from = 0) => (await log(page)).slice(from).find(e => e.light === light);

async function open(page: Page, path = '/') {
  await page.goto(path);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-hdr').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

async function pin(page: Page, light: 'Day' | 'Night') {
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.locator('[data-sheet="Settings"]');
  await sheet.getByRole('button', { name: light, exact: true }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.fs-scrim')).toHaveCount(0);
}

const moonCentre = (page: Page) => page.locator('.fs-hdr .fs-moon').first().evaluate(el => {
  const r = el.getBoundingClientRect();
  return r.left + r.width / 2;
});

test.describe('with view transitions', () => {
  test.beforeEach(async ({ page }) => { await page.addInitScript(watch); });

  test('the moon opens Still as a turn from the moon, the light Still at once; the ring closes it; the pin is no turn', async ({ page }) => {
    await open(page);
    for (const sky of ['Day', 'Night'] as const) {
      await pin(page, sky);
      const light = sky.toLowerCase();
      await expect(html(page)).toHaveAttribute('data-light', light);
      // the pin is rule 12's one breath: no turn ran for it
      expect(await turns(page)).toEqual(sky === 'Day' ? [] : ['still', 'wake']);
      expect((await landed(page, light))?.turn ?? null).toBeNull();

      const x = await moonCentre(page);
      let from = (await log(page)).length;
      await page.getByRole('button', { name: 'Still', exact: true }).click();
      // Still lands inside the turn, while it is still running, with the circle's vars set and the light's own
      // cross-fade off: the turn never waits to make the change
      await page.waitForFunction(() => document.documentElement.dataset.light === 'still');
      const into = (await landed(page, 'still', from))!;
      expect(into.turn).toBe('still');
      expect(parseFloat(into.x)).toBeCloseTo(x, 0);
      expect(parseFloat(into.r)).toBeGreaterThan(0);
      expect(into.td).toBe('0s');
      await expect(page.getByRole('button', { name: 'Leave Still' })).toBeVisible();
      await expect(page.locator('.fs-count')).toBeHidden();
      // the turn ends and takes its name and vars with it; the light's breath is back for the sky
      await expect(html(page)).not.toHaveAttribute('data-turn', /./);
      expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--still-x'))).toBe('');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).transitionDuration)).not.toBe('0s');

      // the ring: back to the pinned light, inside a wake turn from the ring
      from = (await log(page)).length;
      await page.getByRole('button', { name: 'Leave Still' }).click();
      await page.waitForFunction(l => document.documentElement.dataset.light === l, light);
      const out = (await landed(page, light, from))!;
      expect(out.turn).toBe('wake');
      expect(parseFloat(out.x)).toBeCloseTo(x, 0);
      await expect(html(page)).not.toHaveAttribute('data-turn', /./);
      expect(await turns(page)).toEqual(sky === 'Day' ? ['still', 'wake'] : ['still', 'wake', 'still', 'wake']);
    }
  });

  test('"Dim the page" on a flow\'s tip opens Still from the moon, as if the moon had been tapped', async ({ page }) => {
    await open(page, '/#/flow/panic/1');
    const x = await moonCentre(page);
    await page.getByRole('checkbox', { name: /^Less coming in/ }).click();
    await page.waitForFunction(() => document.documentElement.dataset.light === 'still');
    const into = (await landed(page, 'still'))!;
    expect(into.turn).toBe('still');
    expect(parseFloat(into.x)).toBeCloseTo(x, 0);
    expect(await turns(page)).toEqual(['still']);
  });
});

test.describe('Reduce Motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(async ({ page }) => { await page.addInitScript(watch); });

  test('no turn runs: the light just changes, both ways', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Still', exact: true }).click();
    await expect(html(page)).toHaveAttribute('data-light', 'still');
    await page.getByRole('button', { name: 'Leave Still' }).click();
    await expect(html(page)).not.toHaveAttribute('data-light', 'still');
    expect(await turns(page)).toEqual([]);
    expect((await log(page)).filter(e => e.turn)).toEqual([]);
  });
});

test.describe('no view transitions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition; });
    await page.addInitScript(watch);
  });

  test('the light changes at the tap over today\'s --t-light cross-fade, both ways', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => 'startViewTransition' in document)).toBe(false);
    const before = await html(page).getAttribute('data-light');
    await page.getByRole('button', { name: 'Still', exact: true }).click();
    await expect(html(page)).toHaveAttribute('data-light', 'still');
    await expect(page.getByRole('button', { name: 'Leave Still' })).toBeVisible();
    await page.getByRole('button', { name: 'Leave Still' }).click();
    await expect(html(page)).toHaveAttribute('data-light', before!);
    expect((await log(page)).filter(e => e.turn)).toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).transitionDuration)).not.toBe('0s');
  });
});
