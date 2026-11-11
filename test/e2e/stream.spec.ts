// The stream (PLAN-MOTION.md M5, DESIGN.md rule 30): Panic's drawing runs like water behind parts/Cycle and above the
// ghost rings; a landing sends one ring out; leaving the page leaves no loop running; Still runs slower with fewer; Reduce Motion shows none and runs none; and the page works without the layer.
//
// The stream is the flow page's (FlowPage): a sign's page carries no flow drawing since 2026-11-11, so these run on a
// flow under no sign. Panic is taken off its sign for its own ring (./no-sign.ts); the shape-agnostic two use Energize.
import { test, expect, type Page } from '@playwright/test';
import { offItsSign } from './no-sign';

/** Counts requestAnimationFrame calls from the first script on, so a loop left behind shows. */
const countFrames = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __rafs: number };
  w.__rafs = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { w.__rafs++; return raf(cb); };
});
const rafs = (page: Page) => page.evaluate(() => (window as unknown as { __rafs: number }).__rafs);

async function open(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

/** How many of the layer's lines show, and one line's end, now. */
const motes = (page: Page) => page.evaluate(() => {
  const ls = [...(document.querySelector('.fl-stream')?.querySelectorAll<SVGLineElement>('line') ?? [])];
  return { all: ls.length, shown: ls.filter(l => Number(l.getAttribute('opacity')) > 0.01).length, ends: ls.map(l => l.getAttribute('x2')).join(',') };
});

test('stream: Panic off its sign runs like water behind the drawing, a landing rings once, and no loop outlives the page', async ({ page }) => {
  await countFrames(page);
  await open(page, '#/flow');
  await offItsSign(page, 'panic');
  await page.goto('/#/flow/panic');
  await expect(page.locator('.ck-page')).toHaveCount(0);
  const layer = page.locator('.fs-flowpage .fl-drawing > .fl-stream');
  await expect(layer.locator('svg')).toHaveAttribute('data-running', '');
  // behind parts/Cycle (the step words, marks and dot are drawn after it) and out of the way of the thumb
  expect(await page.evaluate(() => {
    const d = document.querySelector('.fl-drawing')!, kids = [...d.children];
    return kids.indexOf(d.querySelector('.fl-stream')!) < kids.indexOf(d.querySelector('.fs-cycle')!);
  })).toBe(true);
  expect(await layer.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  const a = await motes(page);
  expect(a.all).toBeGreaterThan(29);
  expect(a.all).toBeLessThanOrEqual(90);
  expect(a.shown).toBeGreaterThan(20);
  await expect.poll(async () => (await motes(page)).ends).not.toBe(a.ends);
  // no number anywhere in the layer (rule 15)
  expect(await layer.evaluate(el => el.textContent)).toBe('');

  // a landing on the wave: one ring goes out, and the tap still answers at once
  const dot = page.getByRole('slider', { name: 'Where you are' });
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '2');
  expect(await page.locator('.fl-ripple').count()).toBeLessThanOrEqual(1);
  await expect(page.locator('.fl-ripple')).toHaveCount(0, { timeout: 5000 });

  // leaving the page takes its loop with it (the Flow tab is the mountain since R1, with its own loop, so the page
  // left to is the Journal; test/e2e/mountain.spec.ts checks the plate's)
  await page.getByRole('link', { name: 'Journal', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fl-stream')).toHaveCount(0);
  await page.waitForTimeout(300);
  const before = await rafs(page);
  await page.waitForTimeout(1000);
  expect(await rafs(page) - before).toBeLessThan(5);
});

test('stream: on Energize Still runs slower with fewer, and the page still works with the layer gone', async ({ page }) => {
  await open(page, '#/flow/energize');
  const svg = page.locator('.fl-stream svg');
  await expect(svg).toHaveAttribute('data-running', '');
  const day = Number(await svg.getAttribute('data-stream'));
  expect(day).toBeGreaterThanOrEqual(0.85);
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(svg).toHaveAttribute('data-stream', '0.4');
  await expect.poll(async () => { const m = await motes(page); return m.shown / m.all; }, { timeout: 5000 }).toBeLessThan(0.7);
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // with the layer taken away the dot still walks and writes
  await page.evaluate(() => document.querySelector('.fl-stream')?.remove());
  const dot = page.getByRole('slider', { name: 'Where you are' });
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '1');
  await expect(page.locator('.fs-flowpage')).toHaveAttribute('data-saved', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '2');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('stream: on Energize none shows and none runs, and the dot still walks', async ({ page }) => {
    await countFrames(page);
    await open(page, '#/flow/energize');
    const svg = page.locator('.fl-stream svg');
    await expect(svg).toHaveAttribute('data-stream', '0');
    await expect(svg).not.toHaveAttribute('data-running', '');
    await expect(page.locator('.fl-stream')).toBeHidden();
    const dot = page.getByRole('slider', { name: 'Where you are' });
    await dot.focus();
    await page.keyboard.press('ArrowRight');
    await expect(dot).toHaveAttribute('aria-valuenow', '1');
    await expect(page.locator('.fl-ripple')).toHaveCount(0);
    const before = await rafs(page);
    await page.waitForTimeout(1000);
    expect(await rafs(page) - before).toBeLessThan(5);
  });
});
