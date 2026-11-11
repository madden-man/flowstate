// The missed five (F4, PLAN-FLOWS.md section 6). On the signs' pages (no flow drawing there since 2026-11-11): a deep
// link reads Shame's verdict; on a live Shame episode the hand-off line opens Fight with the link row at the top, the
// new episode carries `from`, and an offline reload keeps both; 3 a.m. live in Still shows no digit. On the flow page
// (the flows taken off their signs, ./no-sign.ts): Shame's fork and the 3 a.m. clock, quiet, with no digit in Still.
// The Flow tab scrolls to "+ flow".
import { test, expect, type Page } from '@playwright/test';
import { offItsSign } from './no-sign';

const threshold = async (page: Page) => {
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click().catch(() => {});
  await expect(t).toHaveCount(0);
};

type Ep = { id: string; flowId: string; endedAt?: number; from?: string; marks: { stepId: string }[] };
const episodes = (page: Page) => page.evaluate(() => new Promise<Ep[]>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const r = open.result.transaction('episodes').objectStore('episodes').getAll();
    r.onsuccess = () => { open.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}));

test('Shame on its sign\'s page: the verdict read, and the hand-off to Fight keeps where it came from, offline too', async ({ page }) => {
  await page.goto('/#/flow/shame/2');
  await page.locator('.ck-page').waitFor();
  await threshold(page);
  const body = page.locator('.ck-page');
  const current = page.locator('.ck-steps .ck-step[aria-current="step"]');
  await expect(body).toHaveAttribute('data-showing', '2');
  await expect(body).toHaveAttribute('data-chakra', 'solar-plexus');
  await expect(body).toHaveAttribute('data-front', 'shame');
  await expect(current).toHaveText("I'm worthless");
  // no drawing on a sign's page, and the said paragraph leaves it (PLAN-MOUNTAIN.md section 6)
  await expect(body.locator('.fs-cycle, .fl-drawing')).toHaveCount(0);
  await expect(body.locator('.fl-said:not(.fl-print)')).toHaveCount(0);

  // the service worker takes the page over from the next load
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await threshold(page);

  // Right now starts Shame, and the step words walk it to the fork: a live episode on Shame
  await page.goto('/#/flow/now');
  await page.locator('.fl-nowlist a[href="#/flow/shame/1"]').click();
  await expect(body).toHaveAttribute('data-front', 'shame');
  for (let i = 1; i <= 3; i++) {
    if (i > 1) await page.locator('.ck-steps .ck-step').nth(i - 1).click();
    await expect(page).toHaveURL(new RegExp(`#/flow/shame/${i}$`));
    await expect(body).toHaveAttribute('data-showing', String(i));
    await expect(body).toHaveAttribute('data-saved', 'true');
    await expect.poll(async () => (await episodes(page)).flatMap(e => e.marks).length).toBe(i);
  }
  await expect(current).toHaveText('Hide or hit back');
  await expect.poll(async () => (await episodes(page)).map(e => [e.flowId, e.marks.at(-1)!.stepId])).toEqual([['shame', 'shame-3']]);

  // the hand-off is a printed line, not a row, and a tap opens Fight on its trigger
  const line = body.locator('.fl-print a.fl-handoff');
  // the hand-off reads as the sign it lands on
  await expect(line).toHaveText("If it's hot: the Throat chakra.");
  await expect(body.locator('[role="checkbox"]', { hasText: 'the Throat chakra' })).toHaveCount(0);
  await line.click();
  await expect(page).toHaveURL(/#\/flow\/fight\/1$/);
  const from = page.locator('.fl-from a.fs-link');
  await expect(from).toContainText(/From Solar plexus chakra · Hide or hit back · \d\d:\d\d/i);
  await expect(from).toHaveAttribute('href', '#/flow/shame/3');
  await expect(body).toHaveAttribute('data-chakra', 'throat');
  await expect(body).toHaveAttribute('data-front', 'fight');
  await expect(current).toHaveText('Trigger');
  const check = async () => {
    const es = await episodes(page);
    const shame = es.find(e => e.flowId === 'shame')!, fight = es.find(e => e.flowId === 'fight')!;
    expect(shame.endedAt).toBeTruthy();
    expect(fight.from).toBe(shame.id);
    expect(fight.endedAt).toBeUndefined();
    expect(fight.marks.map(m => m.stepId)).toEqual(['fight-1']);
  };
  await expect.poll(async () => (await episodes(page)).length).toBe(2);
  await check();

  // offline, a reload keeps the episode, its `from` and the link row
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.context().setOffline(true);
  await page.reload();
  await threshold(page);
  await expect(page).toHaveURL(/#\/flow\/fight\/1$/);
  await expect(page.locator('.fl-from a.fs-link')).toContainText('From Solar plexus chakra · Hide or hit back');
  await check();

  // the link row leads back to the step it left, which reads
  await page.locator('.fl-from a.fs-link').click();
  await expect(page).toHaveURL(/#\/flow\/shame\/3$/);
  await expect(body).toHaveAttribute('data-chakra', 'solar-plexus');
  await expect(body).toHaveAttribute('data-showing', '3');
  await expect(current).toHaveText('Hide or hit back');
});

test('Shame under no sign: the fork is drawn, with the said paragraph under it', async ({ page }) => {
  await page.goto('/#/flow');
  await page.locator('.fs-app').waitFor();
  await threshold(page);
  await offItsSign(page, 'shame');
  await page.goto('/#/flow/shame/2');
  const body = page.locator('.fs-flowpage');
  await expect(body).toHaveAttribute('data-showing', '2');
  await expect(page.locator('.ck-page')).toHaveCount(0);
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="fork"]')).toBeVisible();
  await expect(page.getByRole('button', { name: "I'm worthless" })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fs-cycle text.hand')).toHaveText(['hide', 'hit back', 'I can fix it']);
  await expect(body.locator('.fl-said').first()).toContainText('has a door in it');
});

test('3 a.m. on its sign\'s page, live in Still: no digit on the page; the Flow tab scrolls to "+ flow"', async ({ page }) => {
  await page.goto('/#/flow/night/3');
  await page.locator('.ck-page').waitFor();
  await threshold(page);
  const body = page.locator('.ck-page');
  await expect(body).toHaveAttribute('data-front', 'night');
  await expect(body).toHaveAttribute('data-showing', '3');
  // no clock face on a sign's page, and "Usually" leaves it with the copy
  await expect(body.locator('.fs-cycle, .fl-drawing, .fl-mid')).toHaveCount(0);
  await expect(body.locator('.fl-step-page > .fl-usual')).toHaveCount(0);
  // a live episode, walked to the third step
  await page.goto('/#/flow/now');
  await page.locator('.fl-nowlist a[href="#/flow/night/1"]').click();
  for (let k = 1; k <= 3; k++) {
    if (k > 1) await page.locator('.ck-steps .ck-step').nth(k - 1).click();
    await expect(body).toHaveAttribute('data-showing', String(k));
    await expect(body).toHaveAttribute('data-saved', 'true');
    await expect.poll(async () => (await episodes(page)).flatMap(e => e.marks).length).toBe(k);
  }
  // Still by the moon (rule 13): no digit anywhere on the page
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(body.locator('.fl-step-page > .fl-usual')).toHaveCount(0);
  await expect.poll(() => body.evaluate(el => (el as HTMLElement).innerText)).not.toMatch(/\d/);
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // the Flow tab is the mountain since R1 (test/e2e/mountain.spec.ts); "+ flow" is under it, reached by scrolling
  await page.goto('/#/flow');
  const list = page.locator('.fs-flows');
  await expect(list.locator('.mt-plate a.mt-stop')).toHaveCount(7);
  await expect(list.locator('a.fl-flow:not(.fl-now)')).toHaveCount(0);
  const add = page.getByRole('button', { name: '+ flow' });
  await add.scrollIntoViewIfNeeded();
  await expect(add).toBeInViewport();
});

test('3 a.m. under no sign: the clock face, quiet on a live episode, and no digit on the page in Still', async ({ page }) => {
  await page.goto('/#/flow');
  await page.locator('.fs-app').waitFor();
  await threshold(page);
  await offItsSign(page, 'night');
  await page.goto('/#/flow/night/3');
  const body = page.locator('.fs-flowpage');
  await expect(page.locator('.ck-page')).toHaveCount(0);
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="clock"]')).toBeVisible();
  await expect(page.locator('.fs-flowpage .fl-usual.fs-notstill')).toContainText('twenty minutes');
  await expect(page.locator('.fs-cycle text.num')).toHaveText(['12', '7']);
  // the quiet clock (F4): on a live episode the middle reads in words in Day too, never minutes in digits
  await page.goto('/#/flow/night');
  const dot = page.getByRole('slider', { name: 'Where you are' });
  for (let k = 1; k <= 3; k++) {
    await dot.focus();
    await page.keyboard.press('ArrowRight');
    await expect(dot).toHaveAttribute('aria-valuenow', String(k));
    await expect(body).toHaveAttribute('data-saved', 'true');
    await expect.poll(async () => (await episodes(page)).flatMap(e => e.marks).length).toBe(k);
  }
  await expect(page.locator('.fl-mid .fl-quiet')).toHaveText(/minute|minutes in|a few|under/i);
  await expect.poll(() => page.locator('.fl-mid').evaluate(el => (el as HTMLElement).innerText)).not.toMatch(/\d/);
  // Still by the moon (rule 13): the drawing's numeral and the step numbers go, the words-only line comes
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(body.locator('.fl-step-page > .fl-usual.fs-stillonly')).toHaveText('The bed is for sleeping.');
  await expect.poll(() => body.evaluate(el => (el as HTMLElement).innerText)).not.toMatch(/\d/);
  await page.getByRole('button', { name: 'Leave Still' }).click();
});
