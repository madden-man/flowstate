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
  // R3: Panic opens on the Root's page; his line, the said paragraph and "Usually" leave it (PLAN-MOUNTAIN.md section 6)
  await expect(pageBody).toHaveAttribute('data-chakra', 'root');
  await expect(pageBody.locator('.fl-step-page > .fl-line, .fl-step-page > .fl-said, .fl-step-page > .fl-usual')).toHaveCount(0);
  const dot = page.getByRole('slider', { name: 'Where you are' }).first();
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
  await expect(pageBody.locator('.fl-step-page > .fl-said, .fl-step-page > .fl-usual')).toHaveCount(0);
  await expect(pageBody.locator('.fl-mid .fs-stillonly')).toHaveText('a few minutes in');
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
  // F4: one left arrow from the wave is Overstimulated, not rest; the episode stays open
  await expect(dot).toHaveAttribute('aria-valuenow', '1');
  await expect(dot).toHaveAttribute('aria-valuetext', 'Overstimulated');
  await expect(pageBody).toHaveAttribute('data-saved', 'true');
  expect((await episodes(page))[0].endedAt ?? null).toBeNull();
  await dot.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(dot).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(async () => (await episodes(page))[0].endedAt ?? null).not.toBeNull();
  await expect(page).toHaveURL(/#\/flow\/panic$/);
  // R3: "Last time" leaves the page with the copy; the page is at rest, its one list of rows
  await expect(pageBody.locator('.fl-last')).toHaveCount(0);
  await expect(pageBody.locator('.ck-rows')).toHaveAttribute('aria-label', 'At rest');
});

const episode = async (page: Page) => (await page.evaluate(() => new Promise<{ done: { tipId: string }[]; pageId?: string; endedAt?: number }[]>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const r = open.result.transaction('episodes').objectStore('episodes').getAll();
    r.onsuccess = () => { open.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
})))[0];

test('what to do (F2): a tick persists offline, the Still row settles, the journal links both ways, the step sheet strikes', async ({ page }) => {
  await page.goto('/#/flow/panic/1');
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-flowpage').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
  const dot = page.getByRole('slider', { name: 'Where you are' }).first();

  // at rest a tick only draws (walk it once): nothing is written
  const cold = page.getByRole('checkbox', { name: /Cold water on your wrists/ });
  await cold.click();
  await expect(cold).toHaveAttribute('aria-checked', 'true');
  expect(await episode(page)).toBeUndefined();
  await cold.click();

  // the dot onto Overstimulated: the clock in the middle, and a tick is written on the episode
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '1');
  await expect(page.locator('.fl-mid .fs-notstill').first()).toHaveText(/minute in$/);
  await cold.click();
  await expect.poll(async () => (await episode(page))?.done.map(d => d.tipId)).toEqual(['panic-1-cold']);

  // offline, a reload keeps the tick
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  if (await t.count()) await t.click();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.context().setOffline(true);
  await page.reload();
  if (await t.count()) await t.click();
  await expect(page.getByRole('checkbox', { name: /Cold water on your wrists/ })).toHaveAttribute('aria-checked', 'true');

  // the Still row settles: Still comes on, where the row has nothing left to do and goes (F4); out of Still it is ticked
  await page.getByRole('checkbox', { name: /^Less coming in/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.getByRole('checkbox', { name: /^Less coming in|^Less coming/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(page.getByRole('checkbox', { name: /^Less coming in/ })).toHaveAttribute('aria-checked', 'true');

  // the peak shows one thing at a time; Next brings the next
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '2');
  await expect(page.locator('.fl-one [data-tip]')).toHaveCount(1);
  await expect(page.locator('.fl-one [data-tip]')).toHaveAttribute('data-tip', 'panic-2-ring');
  await page.getByRole('button', { name: 'Next ›' }).click();
  await expect(page.locator('.fl-one [data-tip]')).toHaveAttribute('data-tip', 'panic-2-cold');
  // a thumb held on the middle runs the breath
  const mid = page.getByRole('button', { name: 'Hold to breathe' });
  const b = (await mid.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect(page.locator('.fl-mid-breath')).toHaveText('in');
  await expect(page.locator('.fs-cycle-halo.held')).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('.fl-mid-breath')).toHaveCount(0);

  // the journal row: today's page, linked; the page links back to the flow on its step
  await page.keyboard.press('ArrowRight');
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '4');
  await page.getByRole('checkbox', { name: /Write it down, later/ }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  const link = page.locator('.fl-journal-link a');
  await expect(link).toContainText('Flow · Panic');
  await expect(link).toContainText('under the skin, now');
  await expect.poll(async () => !!(await episode(page))?.pageId).toBe(true);
  await link.click();
  await expect(page).toHaveURL(/#\/flow\/panic\/4$/);

  // back on rest: R3, what helped is no sentence now; it heads the Root's rest list, in the order it was ticked
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(async () => (await episode(page))?.endedAt ?? null).not.toBeNull();
  await expect(page.locator('.fl-helped')).toHaveCount(0);
  await expect.poll(() => page.locator('.ck-rows[aria-label="At rest"] [data-tip]').evaluateAll(els => els.slice(0, 2).map(e => (e as HTMLElement).dataset.tip)))
    .toEqual(['panic-1-cold', 'panic-1-less']);

  // the step sheet: strike a tip; Earlier shows it struck, and the page no longer does
  await page.getByRole('button', { name: 'Overstimulated' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const sheet = page.locator('.fs-sheet');
  await sheet.getByRole('button', { name: 'Strike Cold water on your wrists and face' }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Cold water on your wrists/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(sheet.locator('[aria-label="Earlier"] [data-struck]')).toContainText(['Cold water on your wrists and face']);
});

test('the ring by keys (F4): right walks the steps, and right from Under the skin wraps to rest and ends it', async ({ page }) => {
  await page.goto('/#/flow/panic');
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-flowpage').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
  const body = page.locator('.fs-flowpage');
  const dot = page.getByRole('slider', { name: 'Where you are' }).first();
  await expect(dot).toHaveAttribute('aria-valuenow', '0');
  for (const [k, name] of [[1, 'Overstimulated'], [2, 'The wave'], [3, 'Settling'], [4, 'Under the skin']] as const) {
    await dot.focus();
    await page.keyboard.press('ArrowRight');
    await expect(dot).toHaveAttribute('aria-valuenow', String(k));
    await expect(dot).toHaveAttribute('aria-valuetext', name);
    await expect(body).toHaveAttribute('data-saved', 'true');
  }
  await expect.poll(async () => (await episodes(page)).map(e => e.marks.map(m => m.stepId))).toEqual([['panic-1', 'panic-2', 'panic-3', 'panic-4']]);
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '0');
  await expect(dot).toHaveAttribute('aria-valuetext', 'At rest');
  await expect.poll(async () => (await episodes(page))[0].endedAt ?? null).not.toBeNull();
});
