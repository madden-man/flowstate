// Turns between pages (M2, PLAN-MOTION.md; DESIGN.md rules 28 and 29). With view transitions: a tab, a row into its
// page and the way back each run one named turn, the route changes at the tap, a second tap during a turn lands at
// once (a press begun mid-turn is handed to the page), the mark under the tab follows, and nothing is left named after. No turn on load or on a deep link. Without
// startViewTransition every route still works, Be's spread still opens and closes; under Reduce Motion no turn runs.
import { test, expect, type Page } from '@playwright/test';

const tabs = (p: Page) => p.getByRole('navigation', { name: 'Sections' });

async function cross(page: Page) {
  await expect(page.locator('.fs-page')).toBeAttached();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

/** Counts every view transition started, and the kind it ran under. */
const countTurns = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { turns: string[] };
  w.turns = [];
  const start = Document.prototype.startViewTransition;
  if (!start) return;
  Document.prototype.startViewTransition = function (this: Document, cb: unknown) {
    w.turns.push(document.documentElement.dataset.turn ?? '');
    return start.call(this, cb as () => void);
  } as typeof start;
});
const turns = (page: Page) => page.evaluate(() => (window as unknown as { turns: string[] }).turns);

/** Where the mark under the tab is, against the current tab's word. */
const markUnder = (page: Page) => page.evaluate(() => {
  const mark = document.querySelector<HTMLElement>('.fs-tab-mark')!;
  const tab = document.querySelector('.fs-tab[aria-current="page"]');
  if (!tab) return { gone: mark.dataset.gone !== undefined };
  const r = document.createRange();
  r.selectNodeContents(tab);
  const w = r.getBoundingClientRect(), m = mark.getBoundingClientRect();
  return { gone: mark.dataset.gone !== undefined, dx: Math.abs(m.left - w.left), dw: Math.abs(m.width - w.width), below: m.top >= w.bottom };
});

/** Taps through every route the app has, by its own words and rows. */
async function walkEveryRoute(page: Page) {
  const bar = tabs(page);
  await bar.getByRole('link', { name: 'Council' }).click();
  await expect(page).toHaveURL(/#\/council$/);
  await expect(page.getByRole('button', { name: 'New council' })).toBeVisible();
  await page.getByRole('link', { name: 'Voices' }).click();
  await expect(page).toHaveURL(/#\/voices$/);
  await page.getByRole('link', { name: 'Councils' }).click();
  await expect(page).toHaveURL(/#\/council$/);
  await bar.getByRole('link', { name: 'Questions' }).click();
  await expect(page).toHaveURL(/#\/questions$/);
  await expect(page.getByRole('button', { name: 'New question' })).toBeVisible();
  await bar.getByRole('link', { name: 'Be' }).click();
  await expect(page).toHaveURL(/#\/be$/);
  const row = page.locator('.fs-dichotomy').first();
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.fs-be-fold .fs-spread-pages').first()).toHaveAttribute('data-laid', 'true');
  await expect(page.locator('.fs-be-fold').first()).not.toHaveAttribute('data-fold', /.*/);
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.fs-be-fold')).toHaveCount(0);
  await bar.getByRole('link', { name: 'Flow' }).click();
  await expect(page).toHaveURL(/#\/flow$/);
  await page.locator('.fl-flow:not(.fl-now)').first().click();
  await expect(page).toHaveURL(/#\/flow\/panic$/);
  await expect(page.locator('.fs-flowpage .fl-drawing .fs-cycle')).toBeVisible();
  await page.locator('.fs-hdr').getByRole('link', { name: 'Flow' }).click();
  await expect(page).toHaveURL(/#\/flow$/);
  await page.locator('.fl-now').click();
  await expect(page).toHaveURL(/#\/flow\/now$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/flow$/);
  await expect(page.locator('.fl-flow:not(.fl-now)').first()).toBeVisible();
  await bar.getByRole('link', { name: 'Journal' }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  await page.locator('.fs-hdr').getByRole('link', { name: 'Pages' }).click();
  await expect(page).toHaveURL(/#\/journal\/pages$/);
  await expect(page.getByRole('searchbox', { name: 'Search the pages' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('textbox', { name: "Today's page" })).toBeVisible();
}

test.describe('with view transitions', () => {
  test('a tab, a flow and back each turn; the route changes at the tap; nothing stays named', async ({ page }) => {
    await countTurns(page);
    await page.goto('/#/flow');
    await cross(page);
    await expect(page.locator('.fl-flow:not(.fl-now)').first()).toBeVisible();
    // a deep link and the first load turn nothing; the mark is under Flow, placed
    expect(await turns(page)).toEqual([]);
    await expect.poll(() => markUnder(page)).toMatchObject({ gone: false, below: true });

    // Flow to Journal: toward the left; the hash and the bar change at once, while the turn runs
    await tabs(page).getByRole('link', { name: 'Journal' }).click();
    await expect(page).toHaveURL(/#\/journal$/);
    await expect(tabs(page).getByRole('link', { name: 'Journal' })).toHaveAttribute('aria-current', 'page');
    expect(await turns(page)).toEqual(['tab-left']);
    await expect.poll(async () => (await markUnder(page)).dx ?? 99).toBeLessThan(1);

    // a second tap inside a turn goes at once: the turn ends and the tap lands on the page under it
    const be = (await tabs(page).getByRole('link', { name: 'Be' }).boundingBox())!;
    await tabs(page).getByRole('link', { name: 'Council' }).click();
    await page.waitForFunction(() => document.documentElement.dataset.turn === 'tab-right', undefined, { polling: 10 });
    await page.mouse.click(be.x + be.width / 2, be.y + be.height / 2);
    await expect(page).toHaveURL(/#\/be$/);
    await expect(page.getByRole('button', { name: 'New paradox' })).toBeVisible();
    await expect(tabs(page).getByRole('link', { name: 'Be' })).toHaveAttribute('aria-current', 'page');
    expect(await turns(page)).toEqual(['tab-left', 'tab-right', 'tab-right']);

    // into a flow and back: open and close, the tapped row's drawing named while it travels, and nothing after
    await tabs(page).getByRole('link', { name: 'Flow' }).click();
    await expect(page.locator('.fl-flow:not(.fl-now)').first()).toBeVisible();
    await page.locator('.fl-flow:not(.fl-now)').first().click();
    await expect(page.locator('.fs-flowpage .fl-drawing .fs-cycle')).toBeVisible();
    await page.locator('.fs-hdr').getByRole('link', { name: 'Flow' }).click();
    await expect(page.locator('.fl-flow:not(.fl-now)').first()).toBeVisible();
    expect((await turns(page)).slice(-3)).toEqual(['tab-right', 'open', 'close']);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.turn ?? null)).toBeNull();
    expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[style*="view-transition-name"], [data-paper]')].length)).toBe(0);

    // a step read on a flow's page is the same page: no turn
    await page.locator('.fl-flow:not(.fl-now)').first().click();
    await page.getByRole('button', { name: 'Settling' }).click();
    await expect(page).toHaveURL(/#\/flow\/panic\/3$/);
    expect((await turns(page)).slice(-1)).toEqual(['open']);
  });

  test('every route still works with turns running', async ({ page }) => {
    await page.goto('/');
    await cross(page);
    await walkEveryRoute(page);
  });
});

test('without view transitions every route still works, and Be still opens and closes', async ({ page }) => {
  await page.addInitScript(() => { delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition; });
  await page.goto('/');
  await cross(page);
  expect(await page.evaluate(() => 'startViewTransition' in document)).toBe(false);
  await walkEveryRoute(page);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no turn runs, and the mark and the fold do not move', async ({ page }) => {
    await countTurns(page);
    await page.goto('/');
    await cross(page);
    await walkEveryRoute(page);
    expect(await turns(page)).toEqual([]);
    const mark = page.locator('.fs-tab-mark');
    expect(await mark.evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(d => parseFloat(d) === 0))).toBe(true);
    await expect.poll(async () => (await markUnder(page)).dx ?? 99).toBeLessThan(1);
  });
});
