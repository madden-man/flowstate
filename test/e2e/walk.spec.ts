// The walk (DESIGN.md rule 33): the flow's short list at rest; a step's things one at a time, the thing to do first
// under the thumb and the page's print after it; the strip follows a drag and lands on a card; a Calendar card and an
// unnamed Person card on Depress; Still keeps the cards and drops the marks.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-flowpage').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('the walk: the short list at rest, one card at a time, the strip lands on a card, links out, Still', async ({ page }) => {
  await open(page, '#/flow/panic');
  // at rest: the whole flow on four lines, each step with the first thing to do there
  const rows = page.locator('.fl-short .fl-short-row');
  await expect(rows).toHaveText([/^Overstimulated\s*Less coming in$/, /^The wave\s*Breathe with the ring$/, /^Settling\s*Five things you can see$/, /^Under the skin\s*Water, then food$/]);
  await rows.nth(2).click();
  await expect(page).toHaveURL(/#\/flow\/panic\/3$/);
  await expect(page.locator('.fl-short')).toHaveCount(0);

  // a step: the first card is in front, and what to do comes before what the page says
  const front = page.locator('.fl-card[aria-current="step"]');
  await expect(front).toHaveAttribute('data-tip', 'panic-3-five');
  const order = await page.locator('.fl-step-page').evaluate(el => Array.from(el.children).map(c => c.className.split(' ')[0]));
  expect(order.indexOf('fl-tips')).toBeLessThan(order.indexOf('fl-said'));
  // every card is the width of the strip, and the strip is as tall as the card in front
  const deck = page.locator('.fl-deck');
  const sizes = await deck.evaluate(el => ({ w: el.clientWidth, cards: Array.from(el.children).map(c => (c as HTMLElement).offsetWidth), h: el.clientHeight, front: (el.children[0] as HTMLElement).offsetHeight }));
  expect(sizes.cards.every(w => w === sizes.w)).toBe(true);
  expect(sizes.h).toBe(sizes.front);

  // the strip follows a drag and lands on one card: scrolled most of the way, it snaps to the next
  await deck.evaluate(el => { el.scrollTo({ left: el.clientWidth * 0.8 }); });
  await expect(front).toHaveAttribute('data-tip', 'panic-3-window');
  await expect.poll(() => deck.evaluate(el => el.scrollLeft / el.clientWidth)).toBe(1);
  await expect(page.locator('.fl-pips i.here')).toHaveCount(1);
  // another step starts again from its first card
  await page.getByRole('button', { name: 'Under the skin', exact: true }).click();
  await expect(front).toHaveAttribute('data-tip', 'panic-4-water');
  await expect.poll(() => deck.evaluate(el => el.scrollLeft)).toBe(0);

  // Depress: the calendar card is a link to the phone's Calendar; a tap draws its check
  await open(page, '#/flow/depress/1');
  const look = page.locator('[data-tip="depress-1-look"] a.fl-link');
  await expect(look).toHaveAttribute('href', 'calshow:');
  await expect(look).toHaveText(/^Put one thing you look forward to on the calendar\s*Calendar$/);
  await look.evaluate(a => a.addEventListener('click', e => e.preventDefault()));
  await look.click();
  await expect(look).toHaveClass(/done/);
  // "Message one person" is a Person card now: no name yet, so it is the slot to fill
  await open(page, '#/flow/depress/2');
  await expect(page.locator('[data-tip="depress-2-person"] .fl-person-empty')).toHaveText(/Someone, written when calm/);

  // Still: the cards stay, in their short words; the marks (a state) leave
  await open(page, '#/flow/panic/2');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(front).toHaveText(/^Breathe with the ring\s*Ring/);
  await expect(page.locator('.fl-pips')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Next ›' })).toBeVisible();
});

test('the walk keeps to one card with Reduce Motion: Next is a change, not a travel', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 393, height: 659 } });
  const page = await ctx.newPage();
  await open(page, '#/flow/panic/1');
  await page.getByRole('button', { name: 'Next ›' }).click();
  expect(await page.locator('.fl-deck').evaluate(el => el.scrollLeft / el.clientWidth)).toBe(1);
  await expect(page.locator('.fl-card[aria-current="step"]')).toHaveAttribute('data-tip', 'panic-1-album');
  await ctx.close();
});
