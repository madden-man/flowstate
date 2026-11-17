// PLAN-TIERS.md B2, the drag across the tiers, driven by touch-style pointer events as the gate specs drive theirs: a
// long press lifts a row and folds every open value; every place keeps its fold (PLAN-FOLDS.md G2), every open place
// ends in a landing rule, every folded line turns dashed and both shelves show; the row rides across a heading (a tier
// tick as it crosses, the word taking the place's size) and drops (placeValue, the drop tick), into First, an empty
// Third, onto a folded line (into its run, the fold kept) and past one, into an open shelf where it is held, and back;
// near an edge the list scrolls under it; a drop where it started writes nothing; Still lifts nothing. B2_SHOTS=1
// writes the mid-drag screenshots.
import { test, expect, type Page, type Locator } from '@playwright/test';

const SHOTS = process.env.B2_SHOTS_DIR ?? '/private/tmp/claude-501/-Users-musicman-dev/dd72be1f-a9a3-4c9c-9d41-8c02e2a7bd04/scratchpad/b2';
const shots = !!process.env.B2_SHOTS;

const list = (p: Page) => p.locator('.fs-values');
const row = (p: Page, w: string) => p.locator('.fs-values .fs-be-row', { has: p.locator('.a', { hasText: new RegExp(`^${w}$`) }) });
const words = (p: Page, place: string) => p.locator(`.fs-values .fs-be-row[data-place="${place}"] > .fs-dichotomy .a`);
const land = (p: Page, place: string) => p.locator(`.fs-values [data-land="${place}"]`);
/** A place's heading button (PLAN-FOLDS.md G1): aria-expanded says open or folded. */
const head = (p: Page, place: string) => p.locator(`.fs-values .fs-be-head[data-place="${place}"] > button`);
const run = (p: Page, place: string) => head(p, place).locator('.run > span:not(.dot)');
const lifted = (p: Page) => p.locator('.fs-values .fs-be-row.lift');
/** settings.beFolded as stored (G0), read straight from IndexedDB. */
const kept = (page: Page) => page.evaluate(() => new Promise<unknown>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const r = db.transaction('settings', 'readonly').objectStore('settings').get('app');
    r.onsuccess = () => { db.close(); resolve((r.result as { beFolded?: unknown } | undefined)?.beFolded ?? null); };
    r.onerror = () => { db.close(); reject(r.error); };
  };
}));
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
/** Carries the held finger, a little at a time, onto the middle of `to` (plus dy), measuring it again at every step as
 *  a finger follows what it sees (a folded line moves as the row's gap goes from above it to under it). Returns every
 *  place the lifted row rode in on the way. */
async function onto(page: Page, hold: Hold, to: Locator, dy = 0): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < 120; i++) {
    const b = (await to.boundingBox())!;
    const d = b.y + b.height / 2 + dy - hold.y;
    if (Math.abs(d) < 1) break;
    hold.y += Math.sign(d) * Math.min(Math.abs(d), 8);
    await fire(page, 'pointermove', hold.x, hold.y);
    const at = await lifted(page).getAttribute('data-place');
    if (at && seen[seen.length - 1] !== at) seen.push(at);
  }
  return seen;
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

test('a lift folds every open value, every place keeps its fold, every open tier ends in a landing rule, both shelves show folded and dashed; let go where it started, nothing is written', async ({ page }) => {
  await be(page);
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await expect(row(page, 'thoughtful').locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.turn ?? null)).toBeNull();
  await page.waitForTimeout(500);
  const before = await kept(page);
  const hold = await lift(page, 'selfless');
  await expect(list(page).locator('.fs-dichotomy[aria-expanded="true"]')).toHaveCount(0);
  await expect(list(page).locator('.fs-value-body')).toHaveCount(0);
  for (const p of ['1', '2', '3']) await expect(land(page, p)).toHaveCount(1);
  // nothing is on either shelf: each shows, at its kept fold (folded), its own line dashed, somewhere to land
  for (const p of ['resting', 'legacy']) {
    await expect(head(page, p)).toHaveAttribute('aria-expanded', 'false');
    await expect(land(page, p)).toHaveCount(0);
    const line = page.locator(`.fs-values .fs-be-head[data-place="${p}"]`);
    await expect(line).toHaveClass(/\bland\b/);
    expect(await line.evaluate(el => getComputedStyle(el).borderBottomStyle)).toBe('dashed');
  }
  // an open heading is not dashed
  await expect(page.locator('.fs-values .fs-be-head[data-place="2"]')).not.toHaveClass(/\bland\b/);
  const order = await list(page).evaluate(el => [...el.children].map(c => { const d = (c as HTMLElement).dataset; return d.heading ? `h${d.heading}` : d.land ? `_${d.land}` : d.row ? d.row.replace(/^value-px-|-.*$/g, '') : ''; }));
  expect(order).toEqual(['', 'h1', '_1', 'h2', 'selfless', 'thoughtful', '_2', 'h3', '_3', 'hresting', 'hlegacy']);
  await shot(page, 'lifted');
  // the lifted row did not move under the still finger
  const r = (await lifted(page).boundingBox())!;
  expect(Math.abs(r.y + hold.grab - hold.y)).toBeLessThanOrEqual(1);
  // a little way and back, then let go where it started
  await fire(page, 'pointermove', hold.x, hold.y + 12);
  await fire(page, 'pointermove', hold.x, hold.y);
  await release(page, hold);
  await expect(words(page, '2')).toHaveText(['selfless', 'thoughtful']);
  await expect(land(page, '2')).toHaveCount(0);
  await expect(head(page, 'resting').or(head(page, 'legacy'))).toHaveCount(0);
  expect(await ticks(page)).toEqual([]);
  // the lift swallowed the tap: nothing opened
  await expect(list(page).locator('.fs-dichotomy[aria-expanded="true"]')).toHaveCount(0);
  expect(await kept(page)).toEqual(before);
  await page.reload();
  await be(page);
  await expect(words(page, '2')).toHaveText(['selfless', 'thoughtful']);
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
  await expect.poll(() => size(row(page, 'thoughtful').locator('.fs-dichotomy'))).toBe(await px(page, '--fs-first'));
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

test('carry onto a folded line: the row rides alone under it, its word last in the run in italic; dropped, the run gains it, no row is drawn, the fold is kept; back out it is its size again', async ({ page }) => {
  await be(page);
  await head(page, '3').click();
  await expect(head(page, '3')).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => kept(page)).toEqual({ '3': true });
  const before = await kept(page);
  const hold = await lift(page, 'selfless');
  const third = page.locator('.fs-values .fs-be-head[data-place="3"]');
  await expect(third).toHaveClass(/\bland\b/);
  expect(await onto(page, hold, third)).toContain('3');
  await expect(lifted(page)).toHaveAttribute('data-place', '3');
  await expect(lifted(page)).toHaveClass(/\binfold\b/);
  await expect(head(page, '3')).toHaveAttribute('aria-expanded', 'false');
  await expect(run(page, '3')).toHaveText(['selfless']);
  await expect(run(page, '3').last()).toHaveClass('riding');
  expect(await run(page, '3').last().evaluate(el => getComputedStyle(el).fontStyle)).toBe('italic');
  // one rule tall, at ink's size
  await expect.poll(() => size(lifted(page).locator('.fs-dichotomy'))).toBe(await px(page, '--fs-ink'));
  expect(Math.round((await lifted(page).boundingBox())!.height)).toBeLessThanOrEqual(30);
  expect(await ticks(page)).toEqual(['tier']);
  await shot(page, 'riding-folded');
  // back out into Second: its size again, no longer in the run
  await onto(page, hold, land(page, '2'), 10);
  await expect(lifted(page)).toHaveAttribute('data-place', '2');
  await expect(lifted(page)).not.toHaveClass(/\binfold\b/);
  await expect(run(page, '3')).toHaveCount(0);
  await expect.poll(() => size(lifted(page).locator('.fs-dichotomy'))).toBe(await px(page, '--fs-title'));
  // and onto the folded line again, and let go
  await onto(page, hold, third);
  await expect(lifted(page)).toHaveAttribute('data-place', '3');
  await release(page, hold);
  expect((await ticks(page)).slice(-1)).toEqual(['drop']);
  await expect(head(page, '3')).toHaveAttribute('aria-expanded', 'false');
  await expect(run(page, '3')).toHaveText(['selfless']);
  await expect(run(page, '3').locator('.riding')).toHaveCount(0);
  await expect(row(page, 'selfless')).toHaveCount(0);
  await expect(page.locator('.fs-values .fs-be-head.land')).toHaveCount(0);
  await expect(words(page, '2')).toHaveText(['thoughtful']);
  expect(await kept(page)).toEqual(before);
  await page.reload();
  await be(page);
  await expect(head(page, '3')).toHaveAttribute('aria-expanded', 'false');
  await expect(run(page, '3')).toHaveText(['selfless']);
  await head(page, '3').click();
  await expect(words(page, '3')).toHaveText(['selfless']);
});

test('carry past a folded line into the tier beyond: it rides through the folded place and lands in the open tier', async ({ page }) => {
  await be(page);
  // selfless to First, then Second folded over thoughtful
  let hold = await lift(page, 'selfless');
  await carry(page, hold, land(page, '1'));
  await release(page, hold);
  await expect(words(page, '1')).toHaveText(['selfless']);
  await head(page, '2').click();
  await expect(run(page, '2')).toHaveText(['thoughtful']);
  hold = await lift(page, 'selfless');
  const seen = await onto(page, hold, land(page, '3'), 10);
  expect(seen).toEqual(['1', '2', '3']);
  await expect(lifted(page)).toHaveAttribute('data-place', '3');
  await expect(lifted(page)).not.toHaveClass(/\binfold\b/);
  await expect(run(page, '2')).toHaveText(['thoughtful']);
  await release(page, hold);
  expect(await ticks(page)).toEqual(['tier', 'drop', 'tier', 'tier', 'drop']);
  await expect(words(page, '3')).toHaveText(['selfless']);
  await expect(head(page, '2')).toHaveAttribute('aria-expanded', 'false');
  await expect(run(page, '2')).toHaveText(['thoughtful']);
  await page.reload();
  await be(page);
  await expect(words(page, '3')).toHaveText(['selfless']);
});

test('onto folded Resting and Legacy: each keeps its fold, its run one word longer; Legacy shows dates; carried back from Legacy to a tier', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 12, 9, 40) });
  await be(page);
  let hold = await lift(page, 'selfless');
  await onto(page, hold, page.locator('.fs-values .fs-be-head[data-place="resting"]'));
  await expect(row(page, 'selfless')).toHaveAttribute('data-place', 'resting');
  await release(page, hold);
  // a drop writes no fold (PLAN-FOLDS.md section 5): Resting is folded as it was, the value in its run
  await expect(head(page, 'resting')).toHaveAttribute('aria-expanded', 'false');
  await expect(run(page, 'resting')).toHaveText(['selfless']);
  await expect(row(page, 'selfless')).toHaveCount(0);
  // Legacy was drawn only for the lift, and nothing landed there: it is gone again
  await expect(head(page, 'legacy')).toHaveCount(0);

  hold = await lift(page, 'thoughtful');
  // the lift keeps Resting folded: its row is not drawn
  await expect(head(page, 'resting')).toHaveAttribute('aria-expanded', 'false');
  await expect(row(page, 'selfless')).toHaveCount(0);
  await onto(page, hold, page.locator('.fs-values .fs-be-head[data-place="legacy"]'));
  await expect(row(page, 'thoughtful')).toHaveAttribute('data-place', 'legacy');
  await shot(page, 'over-legacy');
  await release(page, hold);
  await expect(head(page, 'legacy')).toHaveAttribute('aria-expanded', 'false');
  await expect(head(page, 'resting')).toHaveAttribute('aria-expanded', 'false');
  await expect(run(page, 'legacy')).toHaveText(['thoughtful']);
  await expect(words(page, '2')).toHaveCount(0);
  expect((await ticks(page)).filter(t => t === 'drop')).toHaveLength(2);
  await head(page, 'legacy').click();
  await expect(row(page, 'thoughtful').locator('.fs-value-dates')).toHaveText('11 / 6 / 26 to 11 / 12 / 26');

  // back from Legacy to First
  hold = await lift(page, 'thoughtful');
  await carry(page, hold, land(page, '1'));
  await expect(row(page, 'thoughtful')).toHaveAttribute('data-place', '1');
  await release(page, hold);
  await expect(words(page, '1')).toHaveText(['thoughtful']);
  await expect(head(page, 'legacy')).toHaveCount(0);
  await expect(run(page, 'resting')).toHaveText(['selfless']);
  await page.reload();
  await be(page);
  await expect(words(page, '1')).toHaveText(['thoughtful']);
  await head(page, 'resting').click();
  await expect(words(page, 'resting')).toHaveText(['selfless']);
});

test('into an open shelf it lands where it is held, between two of its rows', async ({ page }) => {
  await be(page);
  const sheet = page.locator('[data-sheet="Value"]');
  await page.getByRole('button', { name: 'New value' }).click();
  await sheet.getByRole('textbox', { name: 'Value' }).fill('courage');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  // the five words put selfless and thoughtful on Resting, which opens to show them land (and stays open)
  for (const w of ['selfless', 'thoughtful']) {
    await row(page, w).locator('.fs-dichotomy').click();
    await expect(row(page, w).locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
    await row(page, w).getByRole('group', { name: 'Place' }).getByRole('button', { name: 'Resting' }).click();
    await expect(row(page, w)).toHaveAttribute('data-place', 'resting');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.turn ?? null)).toBeNull();
    await row(page, w).locator('.fs-dichotomy').click();
    await expect(row(page, w).locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.turn ?? null)).toBeNull();
  }
  await page.waitForTimeout(500);
  await expect(words(page, 'resting')).toHaveText(['selfless', 'thoughtful']);
  const hold = await lift(page, 'courage');
  // the open shelf ends in its landing rule, as a tier does
  const order = await list(page).evaluate(el => [...el.children].map(c => { const d = (c as HTMLElement).dataset; return d.heading ? `h${d.heading}` : d.land ? `_${d.land}` : d.row ?? ''; }).filter(x => /^[h_]/.test(x)));
  expect(order.slice(-3)).toEqual(['hresting', '_resting', 'hlegacy']);
  await carry(page, hold, row(page, 'selfless'));
  await expect(row(page, 'courage')).toHaveAttribute('data-place', 'resting');
  await release(page, hold);
  await expect(words(page, 'resting')).toHaveText(['selfless', 'courage', 'thoughtful']);
  await page.reload();
  await be(page);
  await expect(words(page, 'resting')).toHaveText(['selfless', 'courage', 'thoughtful']);
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
  for (const w of ['resting', 'legacy']) if (await head(page, w).count() && await head(page, w).getAttribute('aria-expanded') === 'false') await head(page, w).click();
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
