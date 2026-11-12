// PLAN-TIERS.md B2, the drag across the tiers, driven by touch-style pointer events as the gate specs drive theirs: a
// long press lifts a row and folds every open value; every tier ends in a landing rule and both shelves open with one;
// the row rides across a heading (a tier tick as it crosses, the word taking the place's size) and drops (placeValue,
// the drop tick), into First, an empty Third, Resting and Legacy and back; near an edge the list scrolls under it; a
// drop where it started writes nothing; Still lifts nothing. B2_SHOTS=1 writes the mid-drag screenshots.
import { test, expect, type Page, type Locator } from '@playwright/test';

const SHOTS = process.env.B2_SHOTS_DIR ?? '/private/tmp/claude-501/-Users-musicman-dev/dd72be1f-a9a3-4c9c-9d41-8c02e2a7bd04/scratchpad/b2';
const shots = !!process.env.B2_SHOTS;

const list = (p: Page) => p.locator('.fs-values');
const row = (p: Page, w: string) => p.locator('.fs-values .fs-be-row', { has: p.locator('.a', { hasText: new RegExp(`^${w}$`) }) });
const words = (p: Page, place: string) => p.locator(`.fs-values .fs-be-row[data-place="${place}"] > .fs-dichotomy .a`);
const land = (p: Page, place: string) => p.locator(`.fs-values [data-land="${place}"]`);
const shelf = (p: Page, w: 'Resting' | 'Legacy') => p.locator('.fs-be-shelf button', { hasText: new RegExp(`^${w}$`) });
const lifted = (p: Page) => p.locator('.fs-values .fs-be-row.lift');
const size = (l: Locator) => l.evaluate(el => getComputedStyle(el).fontSize);
const px = (page: Page, token: string) => page.evaluate(t => getComputedStyle(document.documentElement).getPropertyValue(t).trim(), token);

async function be(page: Page) {
  await page.goto('/#/be');
  await expect(page.locator('.fs-be-core')).toBeAttached();
  const t = page.locator('[data-threshold]');
  await page.waitForTimeout(50);
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
  await expect(page.locator('[data-heading="1"]')).toBeAttached();
  // every tick from here on, by name (parts/Haptic marks its switch with the tick it is)
  await page.evaluate(() => {
    const seen: string[] = ((window as unknown as { ticks: string[] }).ticks = []);
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement && n.dataset.tick) seen.push(n.dataset.tick);
    }).observe(document.body, { childList: true });
  });
}
const ticks = (p: Page) => p.evaluate(() => (window as unknown as { ticks: string[] }).ticks);

/** One touch pointer event at (x, y), on whatever is under it, a frame after the last. */
const fire = (page: Page, type: string, x: number, y: number) => page.evaluate(async ([type, x, y]) => {
  const el = document.elementFromPoint(x as number, y as number) ?? document.body;
  el.dispatchEvent(new PointerEvent(type as string, { pointerId: 11, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x as number, clientY: y as number, button: 0 }));
  await new Promise(r => requestAnimationFrame(() => r(null)));
}, [type, x, y] as const);

type Hold = { x: number; y: number; grab: number; h: number };
/** A long press on a row's word, held until it lifts. */
async function lift(page: Page, w: string): Promise<Hold> {
  const b = (await row(page, w).locator('.fs-dichotomy').boundingBox())!;
  const x = b.x + b.width / 3, y = b.y + b.height / 2;
  await fire(page, 'pointerdown', x, y);
  await page.waitForTimeout(650);
  await expect(lifted(page)).toHaveCount(1);
  // a finger is slower than a script: a frame for the lifted list to be drawn
  await page.waitForTimeout(60);
  const r = (await lifted(page).boundingBox())!;
  return { x, y, grab: y - r.y, h: r.height };
}
/** Carries the held row in steps until its top edge is just past the middle of `to` (measured on the lifted list as
 *  if the row were not in it: a slot below the row sits a row higher once it is taken out). */
async function carry(page: Page, hold: Hold, to: Locator) {
  const t = (await to.boundingBox())!, r = (await lifted(page).boundingBox())!;
  const below = t.y >= r.y + r.height - 1;
  const top = t.y - (below ? hold.h : 0) + t.height / 2 + 3;
  const y = top + hold.grab;
  const steps = 14;
  for (let i = 1; i <= steps; i++) await fire(page, 'pointermove', hold.x, hold.y + ((y - hold.y) * i) / steps);
  hold.y = y;
}
const release = async (page: Page, hold: Hold) => {
  await fire(page, 'pointerup', hold.x, hold.y);
  await expect(lifted(page)).toHaveCount(0);
};
const shot = async (page: Page, name: string) => {
  if (!shots) return;
  for (const l of ['day', 'night'] as const) {
    await page.evaluate(x => { document.documentElement.dataset.light = x; }, l);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${SHOTS}/${name}-${l}.png` });
  }
  await page.evaluate(() => { document.documentElement.dataset.light = 'day'; });
  await page.waitForTimeout(1400);
};

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); });

test('a lift folds every open value, every tier ends in a landing rule, both shelves open with one; let go where it started, nothing is written', async ({ page }) => {
  await be(page);
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await expect(row(page, 'thoughtful').locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.turn ?? null)).toBeNull();
  await page.waitForTimeout(500);
  const hold = await lift(page, 'selfless');
  await expect(list(page).locator('.fs-dichotomy[aria-expanded="true"]')).toHaveCount(0);
  await expect(list(page).locator('.fs-value-body')).toHaveCount(0);
  for (const p of ['1', '2', '3', 'resting', 'legacy']) await expect(land(page, p)).toHaveCount(1);
  // nothing is on either shelf, yet each shows open so there is somewhere to drop
  await expect(shelf(page, 'Resting')).toHaveAttribute('aria-expanded', 'true');
  await expect(shelf(page, 'Legacy')).toHaveAttribute('aria-expanded', 'true');
  const order = await list(page).evaluate(el => [...el.children].map(c => { const d = (c as HTMLElement).dataset; return d.heading ? `h${d.heading}` : d.land ? `_${d.land}` : d.shelf ? `s:${d.shelf}` : d.row ? d.row.replace(/^value-px-|-.*$/g, '') : ''; }));
  expect(order).toEqual(['', 'h1', '_1', 'h2', 'selfless', 'thoughtful', '_2', 'h3', '_3', 's:resting', '_resting', 's:legacy', '_legacy']);
  // the lifted row did not move under the still finger
  const r = (await lifted(page).boundingBox())!;
  expect(Math.abs(r.y + hold.grab - hold.y)).toBeLessThanOrEqual(1);
  // a little way and back, then let go where it started
  await fire(page, 'pointermove', hold.x, hold.y + 12);
  await fire(page, 'pointermove', hold.x, hold.y);
  await release(page, hold);
  await expect(words(page, '2')).toHaveText(['selfless', 'thoughtful']);
  await expect(land(page, '2')).toHaveCount(0);
  await expect(page.locator('.fs-be-shelf')).toHaveCount(0);
  expect(await ticks(page)).toEqual([]);
  // the lift swallowed the tap: nothing opened
  await expect(list(page).locator('.fs-dichotomy[aria-expanded="true"]')).toHaveCount(0);
});

test('carry Second to First across the heading: a tier tick as it crosses, the word takes First\'s size, a drop tick, and it stays after a reload', async ({ page }) => {
  await be(page);
  const hold = await lift(page, 'thoughtful');
  await carry(page, hold, land(page, '1'));
  await expect(row(page, 'thoughtful')).toHaveAttribute('data-place', '1');
  await expect(row(page, 'thoughtful').locator('.fs-dichotomy')).toHaveClass(/fs-value-t1/);
  expect(await ticks(page)).toEqual(['tier']);
  // it still rides under the finger after its place changed
  const r = (await lifted(page).boundingBox())!;
  expect(Math.abs(r.y + hold.grab - hold.y)).toBeLessThanOrEqual(3);
  await shot(page, 'over-first');
  await release(page, hold);
  expect(await ticks(page)).toEqual(['tier', 'drop']);
  await expect(words(page, '1')).toHaveText(['thoughtful']);
  await expect(words(page, '2')).toHaveText(['selfless']);
  await expect(land(page, '1')).toHaveCount(0);
  await expect.poll(() => size(row(page, 'thoughtful').locator('.fs-dichotomy'))).toBe(await px(page, '--fs-manifesto'));
  await expect(page.locator('[data-settling]')).toHaveCount(0);
  await page.reload();
  await be(page);
  await expect(words(page, '1')).toHaveText(['thoughtful']);
  await expect(words(page, '2')).toHaveText(['selfless']);
});

test('drop into an empty Third', async ({ page }) => {
  await be(page);
  const hold = await lift(page, 'selfless');
  await carry(page, hold, land(page, '3'));
  await expect(row(page, 'selfless')).toHaveAttribute('data-place', '3');
  await release(page, hold);
  await expect(words(page, '3')).toHaveText(['selfless']);
  await expect(words(page, '2')).toHaveText(['thoughtful']);
  await expect.poll(() => size(row(page, 'selfless').locator('.fs-dichotomy'))).toBe(await px(page, '--fs-ink'));
  expect(await ticks(page)).toEqual(['tier', 'drop']);
  await page.reload();
  await be(page);
  await expect(words(page, '3')).toHaveText(['selfless']);
});

test('drop into Resting and into Legacy: each shelf stays open, Legacy shows dates; carried back from Legacy to a tier', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 12, 9, 40) });
  await be(page);
  let hold = await lift(page, 'selfless');
  await carry(page, hold, land(page, 'resting'));
  await expect(row(page, 'selfless')).toHaveAttribute('data-place', 'resting');
  await release(page, hold);
  await expect(shelf(page, 'Resting')).toHaveAttribute('aria-expanded', 'true');
  await expect(row(page, 'selfless')).toHaveAttribute('data-place', 'resting');
  await expect(row(page, 'selfless').locator('.fs-dichotomy')).toHaveClass(/resting/);
  // Legacy was opened only for the lift, and nothing landed there: it is gone again
  await expect(shelf(page, 'Legacy')).toHaveCount(0);

  hold = await lift(page, 'thoughtful');
  await carry(page, hold, land(page, 'legacy'));
  await expect(row(page, 'thoughtful')).toHaveAttribute('data-place', 'legacy');
  await shot(page, 'over-legacy');
  await release(page, hold);
  await expect(shelf(page, 'Legacy')).toHaveAttribute('aria-expanded', 'true');
  await expect(shelf(page, 'Resting')).toHaveAttribute('aria-expanded', 'true');
  await expect(row(page, 'thoughtful').locator('.fs-value-dates')).toHaveText('11 / 6 / 26 to 11 / 12 / 26');
  await expect(words(page, '2')).toHaveCount(0);
  expect((await ticks(page)).filter(t => t === 'drop')).toHaveLength(2);

  // back from Legacy to First
  hold = await lift(page, 'thoughtful');
  await carry(page, hold, land(page, '1'));
  await expect(row(page, 'thoughtful')).toHaveAttribute('data-place', '1');
  await release(page, hold);
  await expect(words(page, '1')).toHaveText(['thoughtful']);
  await expect(shelf(page, 'Legacy')).toHaveCount(0);
  await expect(words(page, 'resting')).toHaveText(['selfless']);
  await page.reload();
  await be(page);
  await expect(words(page, '1')).toHaveText(['thoughtful']);
  await shelf(page, 'Resting').click();
  await expect(words(page, 'resting')).toHaveText(['selfless']);
});

test('near an edge the list scrolls under the lifted row, and it lands where it was carried', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await be(page);
  const sheet = page.locator('[data-sheet="Value"]');
  for (const w of ['courage', 'patience', 'candour', 'rest', 'play', 'grace', 'nerve', 'care', 'wonder', 'thrift']) {
    await page.getByRole('button', { name: 'New value' }).click();
    await sheet.getByRole('textbox', { name: 'Value' }).fill(w);
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toHaveCount(0);
  }
  await expect(words(page, '2')).toHaveCount(12);
  const scroll = () => list(page).evaluate(el => el.scrollTop);
  // the foot: carry the last one up to the top edge and hold it there
  await list(page).evaluate(el => { el.scrollTop = el.scrollHeight; });
  const foot = await scroll();
  expect(foot).toBeGreaterThan(200);
  const hold = await lift(page, 'thrift');
  const box = (await list(page).boundingBox())!;
  const edge = box.y + 10;
  for (let i = 1; i <= 10; i++) await fire(page, 'pointermove', hold.x, hold.y + ((edge - hold.y) * i) / 10);
  hold.y = edge;
  await expect.poll(scroll, { timeout: 5000 }).toBe(0);
  // at the top of the list the row is above First's heading: the head of First
  await expect(row(page, 'thrift')).toHaveAttribute('data-place', '1');
  await expect(lifted(page)).toBeInViewport();
  await release(page, hold);
  await expect(words(page, '1')).toHaveText(['thrift']);
  await page.reload();
  await be(page);
  await expect(words(page, '1')).toHaveText(['thrift']);

  // the top: carry the first of Second down to the bottom edge; the list scrolls down under it
  const h2 = await lift(page, 'selfless');
  const bottom = box.y + box.height - 10;
  for (let i = 1; i <= 10; i++) await fire(page, 'pointermove', h2.x, h2.y + ((bottom - h2.y) * i) / 10);
  h2.y = bottom;
  await expect.poll(scroll, { timeout: 5000 }).toBeGreaterThan(150);
  const went = await row(page, 'selfless').getAttribute('data-place');
  await release(page, h2);
  // carried down past the others it rode over, and it stays where it was let go
  await expect(row(page, 'selfless')).toHaveAttribute('data-place', went!);
  expect(await words(page, '2').first().textContent()).not.toBe('selfless');
  await page.reload();
  await be(page);
  for (const w of ['Resting', 'Legacy'] as const) if (await shelf(page, w).count()) await shelf(page, w).click();
  await expect(row(page, 'selfless')).toHaveAttribute('data-place', went!);
});

test('with Reduce Motion the drag works the same and nothing is left moving', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await be(page);
  const hold = await lift(page, 'thoughtful');
  await carry(page, hold, land(page, '1'));
  await expect(row(page, 'thoughtful')).toHaveAttribute('data-place', '1');
  await release(page, hold);
  await expect(words(page, '1')).toHaveText(['thoughtful']);
  await expect(page.locator('[data-settling]')).toHaveCount(0);
  expect(await row(page, 'thoughtful').evaluate(el => el.style.transform)).toBe('');
});

test('in Still a long press lifts nothing', async ({ page }) => {
  await be(page);
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  const b = (await page.locator('.fs-values .fs-value').first().boundingBox())!;
  await fire(page, 'pointerdown', b.x + 20, b.y + b.height / 2);
  await page.waitForTimeout(650);
  await fire(page, 'pointermove', b.x + 20, b.y + 200);
  await fire(page, 'pointerup', b.x + 20, b.y + 200);
  await expect(page.locator('.fs-values .lift, .fs-values .fs-be-land')).toHaveCount(0);
  // entering Still ticks (rule 19); nothing after it
  expect(await ticks(page)).toEqual(['still']);
});
