// The mountain (PLAN-MOUNTAIN.md R1): the Flow tab is one plate. Seven signs named and in place, each a link to its
// page (#/flow/c/<chakra>, R3's route); the sea's two circles open Meditate and Energize; the arrival runs once per
// unlock and a tap cuts it short; Still hides every hue and state; Reduce Motion draws it at once with nothing
// running; the one loop stops when the page is hidden and when the plate is left.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, hash = '#/flow') {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

const NAMES = ['Crown', 'Third eye', 'Throat', 'Heart', 'Solar plexus', 'Sacral', 'Root'];
const IDS = ['crown', 'third-eye', 'throat', 'heart', 'solar-plexus', 'sacral', 'root'];
const handle = (page: Page) => page.waitForFunction(() => !!(window as unknown as { __mountain?: unknown }).__mountain);

test('mountain: seven named signs down the plate, each a link that is a thumb wide, and the sea\'s circles', async ({ page }) => {
  await open(page);
  const plate = page.locator('.mt-plate');
  await expect(plate).toBeVisible();
  const stops = plate.locator('a.mt-stop');
  await expect(stops).toHaveText(NAMES);
  for (let i = 0; i < 7; i++) {
    await expect(stops.nth(i)).toHaveAttribute('href', `#/flow/c/${IDS[i]}`);
    await expect(stops.nth(i).locator('[data-travel]')).toHaveAttribute('data-travel', `mt-sign-${IDS[i]}`);
    const box = (await stops.nth(i).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // summit to foot
  const ys = await stops.evaluateAll(as => as.map(a => a.getBoundingClientRect().top));
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  // no flow rows any more: Right now and + flow stay under the plate
  await expect(page.locator('a.fl-flow:not(.fl-now)')).toHaveCount(0);
  await expect(page.locator('a.fl-now')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ flow' })).toBeVisible();
  // the rows under the plate stay on the page's rules: the plate is whole rules tall
  const lh = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lh-ink')));
  const h = (await plate.boundingBox())!.height;
  expect(Math.abs(h / lh - Math.round(h / lh))).toBeLessThan(0.02);
  // the circles
  const circles = plate.locator('a.mt-circle');
  await expect(circles).toHaveText(['Meditate', 'Energize']);
  for (const c of await circles.all()) expect((await c.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  // no number on the plate (rule 15)
  expect(/\d/.test(await plate.innerText())).toBe(false);
});

test('mountain: a sign opens its page, the circles open Meditate and Energize, and a tap during the arrival cuts it short', async ({ page }) => {
  await open(page);
  const plate = page.locator('.mt-plate');
  // the first visit after unlocking: the arrival runs; a tap anywhere on the plate ends it at once
  await expect(plate).toHaveAttribute('data-arrive', 'run');
  await plate.click({ position: { x: 20, y: 20 } });
  await expect(plate).toHaveAttribute('data-arrive', 'done');
  await expect(plate.locator('a.mt-stop[data-lit]')).toHaveCount(7);

  await plate.getByRole('link', { name: 'Heart' }).click();
  await expect(page).toHaveURL(/#\/flow\/c\/heart$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/flow$/);
  // later in the same unlock it is already there
  await expect(page.locator('.mt-plate')).toHaveAttribute('data-arrive', 'done');

  await page.locator('a.mt-circle', { hasText: 'Meditate' }).click();
  await expect(page).toHaveURL(/#\/flow\/meditate$/);
  await expect(page.locator('.md-page')).toBeVisible();
  await page.goBack();
  await page.locator('a.mt-circle', { hasText: 'Energize' }).click();
  await expect(page).toHaveURL(/#\/flow\/energize$/);
  await expect(page.locator('.fs-flowpage')).toBeVisible();
});

test('mountain: the water answers the meter and the gates, and the sign empties as its gate closes', async ({ page }) => {
  await open(page);
  await handle(page);
  const plate = page.locator('.mt-plate');
  await expect(plate).toHaveAttribute('data-d', '0.000');
  await page.evaluate(() => (window as unknown as { __mountain: { set: (d: number, g: number[]) => void } }).__mountain.set(0.7, [0, 0, 0, 0, 0.7, 0, 0]));
  await expect(plate).toHaveAttribute('data-d', '0.700');
  await expect(plate).toHaveAttribute('data-gates', '0.000,0.000,0.000,0.000,0.700,0.000,0.000');
  await expect(plate.locator('a.mt-stop[data-chakra="solar-plexus"] .fs-sign')).toHaveAttribute('data-closed', '0.70');
  // the channel thins below the closed gate (the plate eases it there)
  const widths = () => page.locator('.mt-chan').evaluateAll(ps => ps.map(p => Number(p.getAttribute('stroke-width'))));
  await expect.poll(async () => { const w = await widths(); return w[5] < w[4] && w[0] < 2.2; }, { timeout: 8000 }).toBe(true);
});

test('mountain: Still shows no hue and no state, only the line and slow water', async ({ page }) => {
  await open(page);
  await handle(page);
  await page.evaluate(() => (window as unknown as { __mountain: { set: (d: number, g: number[]) => void } }).__mountain.set(0.6, [0, 0, 0.9, 0, 0, 0, 0]));
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  const canvas = page.locator('.mt-light');
  await expect(canvas).toHaveAttribute('data-stream', '0.4');
  // every sign open and the same cold colour, whatever its gate
  const fills = await page.locator('.mt-stop .fs-sign-body').evaluateAll(ps => ps.map(p => getComputedStyle(p).fill));
  expect(new Set(fills).size).toBe(1);
  const scales = await page.locator('.mt-stop .fs-sign-g').evaluateAll(gs => gs.map(g => getComputedStyle(g).transform));
  expect(scales.every(t => t === 'none')).toBe(true);
  // no darkness below a gate, no channel thinner than another
  await expect.poll(() => page.locator('.mt-shade-stop').evaluateAll(ss => ss.every(s => Number(s.getAttribute('stop-opacity')) === 0)), { timeout: 8000 }).toBe(true);
  await expect.poll(async () => new Set(await page.locator('.mt-chan').evaluateAll(ps => ps.map(p => p.getAttribute('stroke-width')))).size, { timeout: 8000 }).toBe(1);
  await page.getByRole('button', { name: 'Leave Still' }).click();
});

test('mountain: the loop runs only while the plate is seen, and stops when the page is hidden or left', async ({ page }) => {
  await open(page);
  const canvas = page.locator('.mt-light');
  await expect(canvas).toHaveAttribute('data-running', '');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(canvas).not.toHaveAttribute('data-running', /.*/);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(canvas).toHaveAttribute('data-running', '');
  // leaving the tab takes the loop with it
  const rafs = await page.evaluate(() => new Promise<number>(resolve => {
    location.hash = '#/journal';
    setTimeout(() => {
      let n = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => { n++; return raf(cb); };
      setTimeout(() => resolve(n), 1000);
    }, 600);
  }));
  await expect(page.locator('.mt-plate')).toHaveCount(0);
  expect(rafs).toBeLessThan(5);
});

test.describe('with Reduce Motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('mountain: drawn at once, no head, nothing running, and the channel widths still tell it', async ({ page }) => {
    await open(page);
    await handle(page);
    const plate = page.locator('.mt-plate');
    await expect(plate).toHaveAttribute('data-arrive', 'done');
    await expect(plate.locator('a.mt-stop[data-lit]')).toHaveCount(7);
    const canvas = page.locator('.mt-light');
    await expect(canvas).toHaveAttribute('data-stream', '0');
    await expect(canvas).not.toHaveAttribute('data-running', /.*/);
    await page.evaluate(() => (window as unknown as { __mountain: { set: (d: number, g: number[]) => void } }).__mountain.set(0, [0, 0, 0.8, 0, 0, 0, 0]));
    await expect.poll(async () => {
      const w = await page.locator('.mt-chan').evaluateAll(ps => ps.map(p => Number(p.getAttribute('stroke-width'))));
      return w[3] < w[2];
    }, { timeout: 8000 }).toBe(true);
    // nothing is animating on the plate
    expect(await plate.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  });
});
