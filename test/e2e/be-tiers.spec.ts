// PLAN-TIERS.md B1, the tiered list: after the upgrade every value is in Second, with First and Third each over a
// dashed landing rule; the five words on an open value carry it to each place and back (a shelf it lands on opens, the
// value stays open); a Legacy row carries its dates; the value sheet has no Status; Still shows First's words alone.
// Each in Day and Night where it is drawn. B1_SHOTS=1 writes the review screenshots to the scratchpad.
import { test, expect, type Page } from '@playwright/test';

const SHOTS = process.env.B1_SHOTS_DIR ?? '/private/tmp/claude-501/-Users-musicman-dev/dd72be1f-a9a3-4c9c-9d41-8c02e2a7bd04/scratchpad/b1';
const shots = !!process.env.B1_SHOTS;
type Light = 'day' | 'night' | 'still';
const light = (page: Page, l: Light) => page.evaluate(x => { document.documentElement.dataset.light = x; }, l);
const shot = async (page: Page, name: string, l: 'day' | 'night', at?: ReturnType<Page['locator']>) => {
  if (!shots) return;
  await light(page, l);
  if (at) await at.scrollIntoViewIfNeeded();
  // the light changes over --t-light: wait it out before the picture
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${SHOTS}/${name}-${l}.png` });
};

const list = (p: Page) => p.locator('.fs-values');
const row = (p: Page, w: string) => p.locator('.fs-values .fs-be-row', { has: p.locator('.a', { hasText: new RegExp(`^${w}$`) }) });
const words = (p: Page, place: string) => p.locator(`.fs-values .fs-be-row[data-place="${place}"] > .fs-dichotomy .a`);
const heading = (p: Page, n: 1 | 2 | 3) => p.locator(`.fs-values [data-heading="${n}"]`);
const land = (p: Page, place: string) => p.locator(`.fs-values [data-land="${place}"]`);
const places = (r: ReturnType<Page['locator']>) => r.getByRole('group', { name: 'Place' });
const shelf = (p: Page, w: 'Resting' | 'Legacy') => p.getByRole('button', { name: w, exact: true }).and(p.locator('.fs-be-shelf button'));

async function be(page: Page, hash = '#/be') {
  await page.goto(`/${hash}`);
  await expect(page.locator('.fs-be-core')).toBeAttached();
  const t = page.locator('[data-threshold]');
  await page.waitForTimeout(50);
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
  await expect(heading(page, 1)).toBeAttached();
}

const size = (l: ReturnType<Page['locator']>) => l.evaluate(el => getComputedStyle(el).fontSize);
const px = (page: Page, token: string) => page.evaluate(t => getComputedStyle(document.documentElement).getPropertyValue(t).trim(), token);

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); });

test('after the upgrade every value is in Second; First and Third each show a dashed landing rule', async ({ page }) => {
  await be(page);
  await expect(list(page).locator('.fs-be-tier')).toHaveText(['First', 'Second', 'Third']);
  await expect(words(page, '2')).toHaveText(['selfless', 'thoughtful']);
  await expect(words(page, '1')).toHaveCount(0);
  await expect(words(page, '3')).toHaveCount(0);
  await expect(land(page, '1')).toHaveCount(1);
  await expect(land(page, '2')).toHaveCount(0);
  await expect(land(page, '3')).toHaveCount(1);
  // nothing on either shelf yet: neither word shows
  await expect(page.locator('.fs-be-shelf')).toHaveCount(0);
  // the order on the page: core line, First, its rule, Second, its rows, Third, its rule
  const order = await list(page).evaluate(el => [...el.children].map(c => (c as HTMLElement).dataset.heading ?? (c as HTMLElement).dataset.land ?? (c as HTMLElement).dataset.row ?? c.className));
  expect(order).toEqual(['fs-be-core', '1', '1', '2', 'value-px-selfless-selfish', 'value-px-thoughtful-reactive', '3', '3']);
  for (const l of ['day', 'night'] as const) {
    await light(page, l);
    // the heading is the core line's print in ink; the rule is dashed; no number, colour or count anywhere
    const [hColor, ink, border] = await page.evaluate(() => [
      getComputedStyle(document.querySelector('[data-heading="1"]')!).color,
      getComputedStyle(document.querySelector('.fs-values .fs-value .a')!).color,
      getComputedStyle(document.querySelector('[data-land="1"]')!).borderBottomStyle]);
    expect(hColor).toBe(ink);
    expect(border).toBe('dashed');
    await expect(list(page)).not.toContainText(/\d/);
  }
  expect(await size(row(page, 'selfless').locator('.fs-dichotomy'))).toBe(await px(page, '--fs-title'));
  await shot(page, 'list', 'day');
  await shot(page, 'list', 'night');
});

test('the five words carry an open value to each place and back; it stays open, and a shelf it lands on opens', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 12, 9, 40) });
  await be(page);
  const selfless = row(page, 'selfless');
  await selfless.locator('.fs-dichotomy').click();
  const five = places(selfless);
  await expect(five.getByRole('button')).toHaveText(['First', 'Second', 'Third', 'Resting', 'Legacy']);
  await expect(five.getByRole('button', { pressed: true })).toHaveText('Second');
  // the seeded value was made on the notebook's 11 / 6 and has been in Second since
  await expect(selfless.locator('.fs-be-since')).toHaveText('Second since 11 / 6 / 26');
  // the five fit one line at the phone's width
  const tops = await five.getByRole('button').evaluateAll(bs => [...new Set(bs.map(b => Math.round(b.getBoundingClientRect().top)))]);
  expect(tops).toHaveLength(1);
  await shot(page, 'open', 'day', selfless);
  await shot(page, 'open', 'night', selfless);
  await light(page, 'day');

  const to = async (w: string, place: string) => {
    await five.getByRole('button', { name: w, exact: true }).click();
    await expect(selfless).toHaveAttribute('data-place', place);
    await expect(selfless.locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
    await expect(five.getByRole('button', { pressed: true })).toHaveText(w);
    await expect(selfless).toBeInViewport({ ratio: 0.1 });
    await expect(page.locator('[data-turning]')).toHaveCount(0);
  };

  await to('First', '1');
  await expect(words(page, '1')).toHaveText(['selfless']);
  await expect(land(page, '1')).toHaveCount(0);
  await expect(selfless.locator('.fs-be-since')).toHaveText('First since 11 / 12 / 26');

  await to('Third', '3');
  await expect(land(page, '1')).toHaveCount(1);
  await expect(land(page, '3')).toHaveCount(0);
  await expect(selfless.locator('.fs-be-since')).toHaveText('Third since 11 / 12 / 26');

  await to('Resting', 'resting');
  await expect(shelf(page, 'Resting')).toHaveAttribute('aria-expanded', 'true');
  await expect(selfless.locator('.fs-be-since')).toHaveCount(0);
  await expect(land(page, '3')).toHaveCount(1);

  await to('Legacy', 'legacy');
  await expect(shelf(page, 'Legacy')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.fs-be-shelf')).toHaveCount(1);
  // a Legacy value's champions are kept, not drawn; nor is "Call a council"
  await expect(selfless.locator('.fs-champs')).toHaveCount(0);
  await expect(selfless.getByRole('button', { name: 'Call a council' })).toHaveCount(0);

  await to('Second', '2');
  await expect(page.locator('.fs-be-shelf')).toHaveCount(0);
  // back at Second's foot
  await expect(words(page, '2')).toHaveText(['thoughtful', 'selfless']);
  // a day that ends where it began leaves no mark (model/values.ts logged): still Second since its making
  await expect(selfless.locator('.fs-be-since')).toHaveText('Second since 11 / 6 / 26');

  // the pressed word does nothing
  await five.getByRole('button', { name: 'Second', exact: true }).click();
  await expect(selfless).toHaveAttribute('data-place', '2');
  await expect(words(page, '2')).toHaveText(['thoughtful', 'selfless']);
  // the place survives a reload, and folded the word is its tier's size
  await five.getByRole('button', { name: 'First', exact: true }).click();
  await expect(selfless).toHaveAttribute('data-place', '1');
  await page.reload();
  await be(page);
  await expect(words(page, '1')).toHaveText(['selfless']);
  await expect(words(page, '2')).toHaveText(['thoughtful']);
  expect(await size(row(page, 'selfless').locator('.fs-dichotomy'))).toBe(await px(page, '--fs-manifesto'));
  expect(await size(row(page, 'thoughtful').locator('.fs-dichotomy'))).toBe(await px(page, '--fs-title'));
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await places(row(page, 'thoughtful')).getByRole('button', { name: 'Third', exact: true }).click();
  await expect(row(page, 'thoughtful')).toHaveAttribute('data-place', '3');
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await expect(row(page, 'thoughtful').locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'false');
  expect(await size(row(page, 'thoughtful').locator('.fs-dichotomy'))).toBe(await px(page, '--fs-ink'));
  await expect(land(page, '2')).toHaveCount(1);
  await shot(page, 'sorted', 'day');
  await shot(page, 'sorted', 'night');
});

test('a Legacy row carries the dates it was held, in print grey, where the champions rules would be', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 12, 9, 40) });
  await be(page);
  const thoughtful = row(page, 'thoughtful');
  await thoughtful.locator('.fs-dichotomy').click();
  await places(thoughtful).getByRole('button', { name: 'Legacy', exact: true }).click();
  await expect(thoughtful).toHaveAttribute('data-place', 'legacy');
  await shot(page, 'legacy-open', 'day', thoughtful);
  await shot(page, 'legacy-open', 'night', thoughtful);
  await light(page, 'day');
  await thoughtful.locator('.fs-dichotomy').click();
  await expect(thoughtful.locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'false');
  await expect(thoughtful.locator('.fs-value-dates')).toHaveText('11 / 6 / 26 to 11 / 12 / 26');
  await expect(thoughtful.locator('.fs-spoke, .fs-spoke-none')).toHaveCount(0);
  for (const l of ['day', 'night'] as const) {
    await light(page, l);
    const [word, dates, print] = await thoughtful.evaluate(r => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--print)';
      document.body.append(probe);
      const out = [getComputedStyle(r.querySelector('.a')!).color, getComputedStyle(r.querySelector('.fs-value-dates')!).color, getComputedStyle(probe).color];
      probe.remove();
      return out;
    });
    expect(word).toBe(print);
    expect(dates).toBe(print);
  }
  await shot(page, 'legacy', 'day');
  await shot(page, 'legacy', 'night');
  // closed and opened again, it stays on its shelf after a reload
  await page.reload();
  await be(page);
  await expect(shelf(page, 'Legacy')).toHaveAttribute('aria-expanded', 'false');
  await expect(row(page, 'thoughtful')).toHaveCount(0);
  await shelf(page, 'Legacy').click();
  await expect(row(page, 'thoughtful').locator('.fs-value-dates')).toHaveText('11 / 6 / 26 to 11 / 12 / 26');
  // a deep link to a Legacy value opens its shelf and the value
  await be(page, '#/be/value-px-thoughtful-reactive');
  await expect(row(page, 'thoughtful').locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
});

test('the value sheet is words only: no Status', async ({ page }) => {
  await be(page);
  await row(page, 'selfless').locator('.fs-dichotomy').click();
  await row(page, 'selfless').getByRole('button', { name: 'Edit' }).click();
  const sheet = page.locator('[data-sheet="Value"]');
  await expect(sheet.getByRole('textbox')).toHaveCount(3);
  await expect(sheet.locator('.fs-print')).toHaveText(['Value', 'Shadow', 'What it looks like', ...(await sheet.locator('.fs-print').count() > 3 ? ['Earlier'] : [])]);
  await expect(sheet.getByRole('group', { name: 'Status' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Held' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Resting' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  // a new value lands at the foot of Second
  await page.getByRole('button', { name: 'New value' }).click();
  await sheet.getByRole('textbox', { name: 'Value' }).fill('courage');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(words(page, '2')).toHaveText(['selfless', 'thoughtful', 'courage']);
});

test("in Still, First's words alone; every held word while First is empty; no headings, shelves, words or dates", async ({ page }) => {
  await be(page);
  const thoughtful = row(page, 'thoughtful');
  await thoughtful.locator('.fs-dichotomy').click();
  await places(thoughtful).getByRole('button', { name: 'Legacy', exact: true }).click();
  await expect(thoughtful).toHaveAttribute('data-place', 'legacy');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  // First is empty: every held word (selfless), never the Legacy one
  await expect(page.locator('.fs-values .fs-value')).toHaveText(['selfless']);
  await expect(page.locator('.fs-values .fs-be-tier, .fs-values .fs-be-land, .fs-values .fs-be-shelf, .fs-values .fs-opts, .fs-values .fs-value-dates, .fs-values button')).toHaveCount(0);
  await expect(list(page)).not.toContainText(/\d/);
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-light', 'still');

  // a value carried up to First: Still is that word alone
  // still open on its shelf from before Still
  await expect(thoughtful.locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
  await places(thoughtful).getByRole('button', { name: 'Second', exact: true }).click();
  const selfless = row(page, 'selfless');
  await selfless.locator('.fs-dichotomy').click();
  await places(selfless).getByRole('button', { name: 'First', exact: true }).click();
  await expect(selfless).toHaveAttribute('data-place', '1');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('.fs-be-core')).toHaveText('I determine my core.');
  await expect(page.locator('.fs-values .fs-value')).toHaveText(['selfless']);
  await expect(list(page)).not.toContainText('thoughtful');
  await expect(page.locator('.fs-values .fs-be-tier, .fs-values button')).toHaveCount(0);
  if (shots) await page.screenshot({ path: `${SHOTS}/still.png` });
});

test('on a narrow phone the five words wrap onto the next rule, never off the column', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await be(page);
  const selfless = row(page, 'selfless');
  await selfless.locator('.fs-dichotomy').click();
  const five = places(selfless).getByRole('button');
  await expect(five).toHaveCount(5);
  const [lh, boxes, col] = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('.fs-be-places .fs-opt')].map(b => b.getBoundingClientRect());
    const c = document.querySelector('.fs-be-places')!.getBoundingClientRect();
    return [parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lh-ink')), bs.map(b => ({ top: b.top, left: b.left, right: b.right })), { left: c.left, right: c.right }];
  });
  for (const b of boxes) { expect(b.left).toBeGreaterThanOrEqual(col.left - 0.5); expect(b.right).toBeLessThanOrEqual(col.right + 0.5); }
  const tops = [...new Set(boxes.map(b => Math.round(b.top)))];
  // each line of words a rule below the one before
  for (let i = 1; i < tops.length; i++) expect(Math.abs(tops[i] - tops[i - 1] - lh)).toBeLessThanOrEqual(1);
  if (shots) { await selfless.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SHOTS}/open-320-day.png` }); }
});
