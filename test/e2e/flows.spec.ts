// The flows (F1, PLAN-FLOWS.md section 6): a deep link reads a step with the dot at rest; dragging the dot to a
// detent starts an episode and the mark persists; a reload offline keeps the mark and the app opens on the live
// episode instead of the journal; the list carries the dot; Still shows no digits on the page.
import { test, expect, type Page } from '@playwright/test';

/** Screen points along the drawing's walk, from the page's own geometry (the ring's circle in its viewBox). */
const along = (page: Page, from: number, to: number, steps = 12) => page.evaluate(([a, b, k]) => {
  const svg = document.querySelector<SVGSVGElement>('.fs-flowpage .fs-cycle svg')!;
  const m = svg.getScreenCTM()!;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= k; i++) {
    const t = a + ((b - a) * i) / k, ang = (t * 360 - 90) * Math.PI / 180;
    const p = new DOMPoint(164 + 72 * Math.cos(ang), 112 + 72 * Math.sin(ang)).matrixTransform(m);
    out.push({ x: p.x, y: p.y });
  }
  return out;
}, [from, to, steps] as const);

const episodes = (page: Page) => page.evaluate(() => new Promise<{ flowId: string; endedAt?: number; marks: { stepId: string }[] }[]>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const r = open.result.transaction('episodes').objectStore('episodes').getAll();
    r.onsuccess = () => { open.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}));

test('flows: deep link, drag to a detent, offline reload opens on the live episode, Still has no digits', async ({ page }) => {
  await page.goto('/#/flow/panic/2');
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-flowpage').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);

  // the deep link reads step 2; the dot stays at rest (walk it once)
  const pageBody = page.locator('.fs-flowpage');
  await expect(pageBody).toHaveAttribute('data-showing', '2');
  await expect(pageBody.locator('.fl-line')).toHaveText('The wave. Loud, fast, certain.');
  await expect(pageBody.locator('.fl-said')).toContainText("it's already on its way out");
  await expect(pageBody.locator('.fl-usual').first()).toContainText('Usually:');
  const dot = page.getByRole('slider', { name: 'Where you are' });
  await expect(dot).toHaveAttribute('aria-valuenow', '0');
  await expect(dot).toHaveAttribute('aria-valuetext', 'At rest');

  // a tap on a step word only reads it
  await page.getByRole('button', { name: 'Settling' }).click();
  await expect(page).toHaveURL(/#\/flow\/panic\/3$/);
  await expect(dot).toHaveAttribute('aria-valuenow', '0');
  expect(await episodes(page)).toEqual([]);

  // drag the dot from rest (7/8 of the way round) up onto Overstimulated (the top)
  const path = await along(page, 7 / 8, 1);
  await page.mouse.move(path[0].x, path[0].y);
  await page.mouse.down();
  for (const p of path.slice(1)) await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  await expect(dot).toHaveAttribute('aria-valuenow', '1');
  await expect(dot).toHaveAttribute('aria-valuetext', 'Overstimulated');
  await expect(page).toHaveURL(/#\/flow\/panic\/1$/);
  await expect(pageBody).toHaveAttribute('data-saved', 'true');
  await expect.poll(async () => (await episodes(page)).map(e => [e.flowId, e.endedAt ?? null, e.marks.map(m => m.stepId)]))
    .toEqual([['panic', null, ['panic-1']]]);

  // a key walks it on a detent: the wave
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '2');
  await expect.poll(async () => (await episodes(page))[0].marks.map(m => m.stepId)).toEqual(['panic-1', 'panic-2']);

  // the list: the row carries the dot while the episode is open
  await page.getByRole('link', { name: 'Flow', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/flow$/);
  await expect(page.locator('a.fl-flow[href="#/flow/panic"]')).toHaveAttribute('data-live', 'true');
  await expect(page.locator('a.fl-flow[href="#/flow/panic"] .fs-list-meta')).toHaveText('The ring');

  // offline, a reload on the journal opens on the live episode instead
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // the worker takes the page over from the next load
  await page.reload();
  if (await t.count()) await t.click();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.context().setOffline(true);
  await page.goto('/#/journal');
  await page.reload();
  if (await t.count()) await t.click();
  await expect(page).toHaveURL(/#\/flow\/panic\/2$/);
  await expect(dot).toHaveAttribute('aria-valuenow', '2');
  expect((await episodes(page))[0].marks.map(m => m.stepId)).toEqual(['panic-1', 'panic-2']);

  // Still: the drawing, the line and the words-only usual; no said line, and no digit anywhere on the page
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(pageBody.locator('.fl-said')).toBeHidden();
  await expect(pageBody.locator('.fs-stillonly')).toHaveText('It peaks, and it passes.');
  const shown = await pageBody.evaluate(el => {
    const out: string[] = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement?.checkVisibility()) out.push(n.textContent ?? '');
    return out.join(' ');
  });
  expect(shown).toContain('The wave');
  expect(shown).not.toMatch(/\d/);

  // drag back onto the way out: the episode ends; at rest in Day there is one last-time line
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await dot.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(dot).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(async () => (await episodes(page))[0].endedAt ?? null).not.toBeNull();
  await expect(page).toHaveURL(/#\/flow\/panic$/);
  await expect(pageBody.locator('.fl-last')).toHaveText(/^Last time · \d+ \/ \d+/);
});
