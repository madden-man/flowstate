// The missed five (F4, PLAN-FLOWS.md section 6): a deep link to Shame's verdict shows the fork; on a live Shame
// episode the hand-off line opens Fight with the link row at the top, the new episode carries `from`, and an offline
// reload keeps both; the 3 a.m. page in Still shows no digit; the list of nine scrolls to "+ flow".
import { test, expect, type Page } from '@playwright/test';

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

test('Shame: the fork, and the hand-off to Fight keeps where it came from, offline too', async ({ page }) => {
  await page.goto('/#/flow/shame/2');
  await page.locator('.fs-flowpage').waitFor();
  await threshold(page);
  const body = page.locator('.fs-flowpage');
  await expect(body).toHaveAttribute('data-showing', '2');
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="fork"]')).toBeVisible();
  await expect(page.getByRole('button', { name: "I'm worthless" })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fs-cycle text.hand')).toHaveText(['hide', 'hit back', 'I can fix it']);
  // R3: a flow under a sign opens on its sign's page, and the said paragraph leaves it (PLAN-MOUNTAIN.md section 6)
  await expect(body).toHaveAttribute('data-chakra', 'solar-plexus');
  await expect(body.locator('.fl-said:not(.fl-print)')).toHaveCount(0);

  // the service worker takes the page over from the next load
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await threshold(page);

  // the dot walks to the fork: a live episode on Shame
  const dot = page.getByRole('slider', { name: 'Where you are' });
  await dot.focus();
  for (let i = 1; i <= 3; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(dot).toHaveAttribute('aria-valuenow', String(i));
    await expect(body).toHaveAttribute('data-saved', 'true');
    await expect.poll(async () => (await episodes(page)).flatMap(e => e.marks).length).toBe(i);
  }
  await expect(dot).toHaveAttribute('aria-valuetext', 'Hide or hit back');
  await expect.poll(async () => (await episodes(page)).map(e => [e.flowId, e.marks.at(-1)!.stepId])).toEqual([['shame', 'shame-3']]);

  // the hand-off is a printed line, not a row, and a tap opens Fight on its trigger
  const line = body.locator('.fl-print a.fl-handoff');
  // R3: the hand-off reads as the sign it lands on
  await expect(line).toHaveText("If it's hot: the Throat chakra.");
  await expect(body.locator('[role="checkbox"]', { hasText: 'the Throat chakra' })).toHaveCount(0);
  await line.click();
  await expect(page).toHaveURL(/#\/flow\/fight\/1$/);
  const from = page.locator('.fl-from a.fs-link');
  await expect(from).toContainText(/From Solar plexus chakra · Hide or hit back · \d\d:\d\d/i);
  await expect(from).toHaveAttribute('href', '#/flow/shame/3');
  await expect(page.getByRole('slider', { name: 'Where you are' })).toHaveAttribute('aria-valuetext', 'Trigger');
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
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="fork"]')).toBeVisible();
});

test('3 a.m. in Still: the clock with no digit on the page; the list of nine scrolls to "+ flow"', async ({ page }) => {
  await page.goto('/#/flow/night/3');
  await page.locator('.fs-flowpage').waitFor();
  await threshold(page);
  const body = page.locator('.fs-flowpage');
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="clock"]')).toBeVisible();
  // R3: "Usually" leaves the page with the copy
  await expect(page.locator('.fs-flowpage .fl-step-page > .fl-usual')).toHaveCount(0);
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
