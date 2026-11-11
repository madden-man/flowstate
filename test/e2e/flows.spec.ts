// The flows (F1, PLAN-FLOWS.md section 6). On a sign's page (a flow under a sign; the old drawing is gone from it since
// 2026-11-11): a deep link reads a step and starts nothing; Right now starts the episode and a step word moves the dot;
// a reload offline keeps the marks and the app opens on the live episode instead of the journal; the mountain carries
// the dot; Still shows no digits on the page; Done ends it. On a flow under no sign (the flow page, with the drawing;
// Panic taken off its sign, ./no-sign.ts): dragging the dot to a detent starts an episode, the keys walk the ring, the
// clock reads in the middle and a thumb held there runs the breath.
import { test, expect, type Page } from '@playwright/test';
import { offItsSign } from './no-sign';

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

const enter = async (page: Page, url: string) => {
  await page.goto(url);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

/** The words a person can see inside the page body. */
const visibleWords = (page: Page) => page.locator('.fs-flowpage').evaluate(el => {
  const out: string[] = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement?.checkVisibility()) out.push(n.textContent ?? '');
  return out.join(' ');
});

test('flows on a sign\'s page: a deep link reads a step, Right now starts the episode, an offline reload opens on it, Still has no digits, Done ends it', async ({ page }) => {
  await enter(page, '/#/flow/panic/2');
  const t = page.locator('[data-threshold]');

  // the deep link reads step 2 on the Root's page; nothing is started (walk it once), and no drawing is on the page
  const pageBody = page.locator('.ck-page');
  await expect(pageBody).toHaveAttribute('data-showing', '2');
  await expect(pageBody).toHaveAttribute('data-chakra', 'root');
  await expect(pageBody).toHaveAttribute('data-front', 'panic');
  // his line, the said paragraph and "Usually" leave a sign's page (PLAN-MOUNTAIN.md section 6)
  await expect(pageBody.locator('.fl-step-page > .fl-line, .fl-step-page > .fl-said, .fl-step-page > .fl-usual')).toHaveCount(0);
  await expect(pageBody.locator('.fl-drawing, .fs-cycle, .fl-stream')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Where you are' })).toHaveCount(0);
  const steps = pageBody.locator('.ck-steps .ck-step:not(.ck-done)');
  await expect(steps).toHaveText(['Overstimulated', 'The wave', 'Settling', 'Under the skin']);
  await expect(pageBody.locator('.ck-steps .ck-step[aria-current="step"]')).toHaveText('The wave');
  await expect(pageBody.locator('.ck-done')).toHaveCount(0);

  // a tap on a step word only reads it
  await steps.nth(2).click();
  await expect(page).toHaveURL(/#\/flow\/panic\/3$/);
  await expect(pageBody).toHaveAttribute('data-showing', '3');
  expect(await episodes(page)).toEqual([]);

  // Right now starts the episode on Overstimulated, and the mark persists
  await page.goto('/#/flow/now');
  await page.locator('.fl-nowlist a[href="#/flow/panic/1"]').click();
  await expect(page).toHaveURL(/#\/flow\/panic\/1$/);
  await expect(pageBody).toHaveAttribute('data-showing', '1');
  await expect(pageBody).toHaveAttribute('data-saved', 'true');
  await expect.poll(async () => (await episodes(page)).map(e => [e.flowId, e.endedAt ?? null, e.marks.map(m => m.stepId)]))
    .toEqual([['panic', null, ['panic-1']]]);
  await expect(pageBody.locator('.ck-done')).toHaveText('Done');

  // with the episode live a step word moves the dot: the wave
  await steps.nth(1).click();
  await expect(page).toHaveURL(/#\/flow\/panic\/2$/);
  await expect(pageBody.locator('.ck-steps .ck-step[aria-current="step"]')).toHaveText('The wave');
  await expect.poll(async () => (await episodes(page))[0].marks.map(m => m.stepId)).toEqual(['panic-1', 'panic-2']);

  // the mountain: Panic's sign (the root) carries the dot and its halo while the episode is open
  await page.getByRole('link', { name: 'Flow', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/flow$/);
  await expect(page.locator('a.mt-stop[data-chakra="root"]')).toHaveAttribute('data-live', 'true');
  await expect(page.locator('a.mt-stop[data-chakra="root"] .mt-dot')).toHaveCount(1);
  await expect(page.locator('a.mt-stop[data-live]')).toHaveCount(1);

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
  await expect(pageBody).toHaveAttribute('data-front', 'panic');
  await expect(pageBody).toHaveAttribute('data-showing', '2');
  expect((await episodes(page))[0].marks.map(m => m.stepId)).toEqual(['panic-1', 'panic-2']);

  // Still: the step words and the rows; no said line, and no digit anywhere on the page
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(pageBody.locator('.fl-step-page > .fl-said, .fl-step-page > .fl-usual')).toHaveCount(0);
  const shown = await visibleWords(page);
  expect(shown).toContain('The wave');
  expect(shown).not.toMatch(/\d/);

  // Done: the episode ends, and the page is at rest on its one list of rows ("Last time" left with the copy)
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await pageBody.locator('.ck-done').click();
  await expect.poll(async () => (await episodes(page))[0].endedAt ?? null).not.toBeNull();
  await expect(page).toHaveURL(/#\/flow\/panic$/);
  await expect(pageBody).toHaveAttribute('data-showing', '0');
  await expect(pageBody.locator('.ck-done')).toHaveCount(0);
  await expect(pageBody.locator('.fl-last')).toHaveCount(0);
  await expect(pageBody.locator('.ck-rows')).toHaveAttribute('aria-label', 'At rest');
});

test('flows under no sign: the drawing, a drag to a detent, the keys, the clock and the held breath, Still\'s words, last time', async ({ page }) => {
  await enter(page, '/#/flow');
  await offItsSign(page, 'panic');
  await page.goto('/#/flow/panic/2');

  // off its sign Panic is the flow page: the deep link reads step 2 with his line, the said paragraph and "Usually"
  const pageBody = page.locator('.fs-flowpage');
  await expect(pageBody).toHaveAttribute('data-showing', '2');
  await expect(page.locator('.ck-page')).toHaveCount(0);
  await expect(pageBody.locator('.fs-cycle')).toHaveCount(1);
  await expect(pageBody.locator('.fl-step-page > .fl-line')).toHaveText('The wave. Loud, fast, certain.');
  await expect(pageBody.locator('.fl-step-page > .fl-said')).toContainText("it's already on its way out");
  await expect(pageBody.locator('.fl-step-page > .fl-usual').first()).toContainText('Usually:');
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
  // the clock in the middle of the drawing
  await expect(page.locator('.fl-mid .fs-notstill').first()).toHaveText(/minute in$/);

  // a key walks it on a detent: the wave
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '2');
  await expect.poll(async () => (await episodes(page))[0].marks.map(m => m.stepId)).toEqual(['panic-1', 'panic-2']);

  // a thumb held on the middle runs the breath
  const mid = page.getByRole('button', { name: 'Hold to breathe' });
  const b = (await mid.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect(page.locator('.fl-mid-breath')).toHaveText('in');
  await expect(page.locator('.fs-cycle-halo.held')).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('.fl-mid-breath')).toHaveCount(0);

  // Still: the drawing, the line and the words-only usual; no said line, and no digit anywhere on the page
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(pageBody.locator('.fl-step-page > .fl-said')).toBeHidden();
  await expect(pageBody.locator('.fl-step-page > .fl-usual.fs-stillonly')).toHaveText('It peaks, and it passes.');
  await expect(pageBody.locator('.fl-mid .fs-stillonly')).toHaveText('a few minutes in');
  const shown = await visibleWords(page);
  expect(shown).toContain('The wave');
  expect(shown).not.toMatch(/\d/);

  // back along the ring: the episode ends at rest; in Day there is one last-time line
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
  await expect(pageBody.locator('.fl-last')).toHaveText(/^Last time · \d+ \/ \d+/);
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

test('what to do (F2) on a sign\'s page: a tick persists offline, the Still row settles, the journal links both ways, the step sheet strikes', async ({ page }) => {
  await enter(page, '/#/flow/panic/1');
  const t = page.locator('[data-threshold]');
  const body = page.locator('.ck-page');
  const steps = body.locator('.ck-steps .ck-step:not(.ck-done)');
  await expect(body).toHaveAttribute('data-showing', '1');

  // at rest a tick only draws (walk it once): nothing is written
  const cold = page.getByRole('checkbox', { name: /Cold water on your wrists/ });
  await cold.click();
  await expect(cold).toHaveAttribute('aria-checked', 'true');
  expect(await episode(page)).toBeUndefined();
  await cold.click();

  // Right now puts the dot on Overstimulated, and a tick is written on the episode
  await page.goto('/#/flow/now');
  await page.locator('.fl-nowlist a[href="#/flow/panic/1"]').click();
  await expect(body).toHaveAttribute('data-showing', '1');
  await expect(body).toHaveAttribute('data-saved', 'true');
  await expect.poll(async () => (await episode(page))?.endedAt ?? null).toBeNull();
  await expect(body.locator('.ck-done')).toBeVisible();
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
  await steps.nth(1).click();
  await expect(body).toHaveAttribute('data-showing', '2');
  await expect(body).toHaveAttribute('data-saved', 'true');
  await expect(page.locator('.fl-one [data-tip]')).toHaveCount(1);
  await expect(page.locator('.fl-one [data-tip]')).toHaveAttribute('data-tip', 'panic-2-ring');
  await page.getByRole('button', { name: 'Next ›' }).click();
  await expect(page.locator('.fl-one [data-tip]')).toHaveAttribute('data-tip', 'panic-2-cold');

  // the journal row: today's page, linked; the page links back to the flow on its step
  await steps.nth(3).click();
  await expect(body).toHaveAttribute('data-showing', '4');
  await expect(body).toHaveAttribute('data-saved', 'true');
  await page.getByRole('checkbox', { name: /Write it down, later/ }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  const link = page.locator('.fl-journal-link a');
  await expect(link).toContainText('Flow · Panic');
  await expect(link).toContainText('under the skin, now');
  await expect.poll(async () => !!(await episode(page))?.pageId).toBe(true);
  await link.click();
  await expect(page).toHaveURL(/#\/flow\/panic\/4$/);

  // Done, back on rest: what helped is no sentence; it heads the Root's rest list, in the order it was ticked
  await body.locator('.ck-done').click();
  await expect.poll(async () => (await episode(page))?.endedAt ?? null).not.toBeNull();
  await expect(page).toHaveURL(/#\/flow\/panic$/);
  await expect(page.locator('.fl-helped')).toHaveCount(0);
  await expect.poll(() => page.locator('.ck-rows[aria-label="At rest"] [data-tip]').evaluateAll(els => els.slice(0, 2).map(e => (e as HTMLElement).dataset.tip)))
    .toEqual(['panic-1-cold', 'panic-1-less']);

  // the step sheet: strike a tip; Earlier shows it struck, and the page no longer does
  await steps.first().click();
  await expect(body).toHaveAttribute('data-showing', '1');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const sheet = page.locator('.fs-sheet');
  await sheet.getByRole('button', { name: 'Strike Cold water on your wrists and face' }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Cold water on your wrists/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(sheet.locator('[aria-label="Earlier"] [data-struck]')).toContainText(['Cold water on your wrists and face']);
});

test('the ring by keys (F4), on a flow under no sign: right walks the steps, and right from Under the skin wraps to rest and ends it', async ({ page }) => {
  await enter(page, '/#/flow');
  await offItsSign(page, 'panic');
  await page.goto('/#/flow/panic');
  const body = page.locator('.fs-flowpage');
  await expect(page.locator('.ck-page')).toHaveCount(0);
  const dot = page.getByRole('slider', { name: 'Where you are' });
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
