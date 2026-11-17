// Blockers on a sign's page (PLAN-BLOCKERS.md K3, walkthrough steps 1 to 4 and 14): the word and the rows under the
// gate, over the shelf, each two rules on the page's rules with whole step words; a tap opens the flow's own page, the
// small drawing travelling to the large one, and the way back reads the sign it was opened from; a live episode's row
// comes first with its step in ink; Still shows the names; Right now, a hand-off and a live episode on opening all land
// on the flow's own page.
import { test, expect, type Page } from '@playwright/test';

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

const episodes = (page: Page) => page.evaluate(() => new Promise<{ flowId: string; endedAt?: number; marks: { stepId: string }[] }[]>((resolve, reject) => {
  const req = indexedDB.open('flowstate');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const r = req.result.transaction('episodes').objectStore('episodes').getAll();
    r.onsuccess = () => { req.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}));

test('Root\'s page: Blockers under the gate and over the shelf, two rules a row, whole step words, no border', async ({ page }) => {
  await open(page, '#/flow/c/root');
  const block = page.locator('.ck-page [data-blockers]:not([data-wait])');
  await expect(block.locator('.bk-row')).toHaveCount(3);
  await expect(block.locator('.fs-month')).toHaveText('Blockers');
  await expect(block.locator('.bk-row .fs-list-line')).toHaveText(['Panic', 'What if', '3 a.m.']);
  // under the gate, over the shelf
  const order = await page.evaluate(() => {
    const at = (s: string) => document.querySelector(s)!;
    const gate = at('.ck-page .fs-gate'), bk = at('.ck-page [data-blockers]'), shelf = at('.ck-page .ck-shelf');
    return [gate.compareDocumentPosition(bk) & Node.DOCUMENT_POSITION_FOLLOWING, bk.compareDocumentPosition(shelf) & Node.DOCUMENT_POSITION_FOLLOWING];
  });
  expect(order.every(Boolean)).toBe(true);
  // each row exactly two rules, no border of its own, its top on a rule
  const geo = await page.evaluate(() => {
    const lh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lh-ink'));
    const col = document.querySelector('.ck-page')!;
    // the rules start where the column's background does (its padding)
    const top = col.getBoundingClientRect().top - col.scrollTop + parseFloat(getComputedStyle(col).backgroundPositionY);
    return [...document.querySelectorAll<HTMLElement>('[data-blockers] .bk-row')].map(r => {
      const b = r.getBoundingClientRect(), cs = getComputedStyle(r);
      return { h: b.height / lh, border: cs.borderTopWidth, off: Math.round(((b.top - top) % lh + lh) % lh) };
    });
  });
  for (const g of geo) expect(g).toEqual({ h: 2, border: '0px', off: 0 });
  // whole words: every word shown sits on the first line inside the row's room, and none is cut
  for (const row of await block.locator('.bk-row').all()) {
    const words = await row.locator('.bk-word').evaluateAll(ws => {
      const box = ws[0].parentElement!.getBoundingClientRect();
      const first = ws[0].getBoundingClientRect().top;
      return ws.map(w => { const b = w.getBoundingClientRect(); return { shown: b.top < box.bottom - 1, inside: b.right <= box.right + 0.5, line: Math.round(b.top - first) }; });
    });
    expect(words[0].shown).toBe(true);
    for (const w of words) if (w.shown) expect(w.inside).toBe(true);
    // one line: no word of a second line shows under the first
    for (const w of words) if (w.shown) expect(w.line).toBe(0);
    expect(words.some(w => !w.shown) || words.every(w => w.line === 0)).toBe(true);
  }
  await expect(block.locator('.bk-row').first().locator('.fl-mini .fs-cycle.small')).toBeVisible();
});

test('a tap on a row opens the flow\'s own page, the small drawing travelling; the way back reads the sign and returns to it', async ({ page }) => {
  await open(page, '#/flow/c/crown');
  await page.evaluate(() => {
    const w = window as unknown as { named: string[] };
    w.named = [];
    new MutationObserver(() => {
      for (const el of document.querySelectorAll<HTMLElement>('.fl-mini, .fl-drawing .fs-cycle')) {
        const n = el.style.getPropertyValue('view-transition-name');
        if (n) w.named.push(`${el.closest('.bk') ? 'row' : 'page'}:${n}`);
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] });
  });
  // 3 a.m. is Crown's own; Replay is listed here a second time
  const rows = page.locator('[data-blockers] .bk-row');
  await expect(rows.locator('.fs-list-line')).toHaveText(['Replay', '3 a.m.', 'Gripping']);
  await rows.filter({ hasText: 'Replay' }).click();
  await expect(page).toHaveURL(/#\/flow\/replay$/);
  const body = page.locator('.fs-flowpage[data-flow="replay"]');
  await expect(body.locator('.fl-drawing .fs-cycle')).toBeVisible();
  await expect(page.locator('.ck-page')).toHaveCount(0);
  // the way back is the sign it was opened from, Crown, not its own (Third eye)
  const back = page.locator('.fs-hdr').getByRole('link', { name: 'Crown', exact: true });
  await expect(back).toHaveAttribute('href', '#/flow/c/crown');
  await back.click();
  await expect(page).toHaveURL(/#\/flow\/c\/crown$/);
  await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', 'crown');
  if (await page.evaluate(() => 'startViewTransition' in document)) {
    const named = await page.evaluate(() => (window as unknown as { named: string[] }).named);
    expect(named).toContain('row:fs-drawing');
    expect(named).toContain('page:fs-drawing');
  }
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-travel]')].filter(el => el.style.getPropertyValue('view-transition-name')).length)).toBe(0);
  // opened anywhere else, its way back is its own sign
  await page.goto('/#/flow/replay/2');
  await expect(page.locator('.fs-flowpage[data-flow="replay"]')).toHaveAttribute('data-showing', '2');
  await page.goto('/#/flow/c/root');
  await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', 'root');
  await page.goto('/#/flow/replay');
  await expect(page.locator('.fs-hdr').getByRole('link', { name: 'Third eye', exact: true })).toHaveAttribute('href', '#/flow/c/third-eye');
  // a draft shows its drawing, its step words, and "+ step"
  await page.goto('/#/flow/gripping');
  const draft = page.locator('.fs-flowpage[data-flow="gripping"]');
  await expect(draft).toHaveAttribute('data-draft', '');
  await expect(draft.locator('.fs-cycle-word')).toHaveCount(4);
  await expect(draft.getByRole('button', { name: 'Planning', exact: true })).toBeVisible();
  await expect(draft.getByRole('button', { name: '+ step' })).toBeVisible();
  await expect(page.locator('.fs-hdr').getByRole('link', { name: 'Crown', exact: true })).toBeVisible();
});

test('Right now lands on the flow\'s page; back on its sign the live row is first with its step in ink and the dot', async ({ page }) => {
  await open(page, '#/flow/now');
  await expect(page.locator('.fl-nowlist a[href^="#/flow/gripping/"]')).toHaveCount(0);
  await page.locator('.fl-nowlist a[href="#/flow/whatif/2"]').click();
  await expect(page).toHaveURL(/#\/flow\/whatif\/2$/);
  const body = page.locator('.fs-flowpage[data-flow="whatif"]');
  await expect(body).toHaveAttribute('data-showing', '2');
  await expect(body).toHaveAttribute('data-saved', 'true');
  await expect(page.locator('.ck-page')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Where you are' })).toHaveAttribute('aria-valuenow', '2');
  await expect.poll(async () => (await episodes(page)).map(e => [e.flowId, e.endedAt ?? null])).toEqual([['whatif', null]]);
  await page.locator('.fs-hdr').getByRole('link', { name: 'Root', exact: true }).click();
  await expect(page).toHaveURL(/#\/flow\/c\/root$/);
  const rows = page.locator('[data-blockers]:not([data-wait]) .bk-row');
  await expect(rows.locator('.fs-list-line')).toHaveText(['What if', 'Panic', '3 a.m.']);
  await expect(rows.first()).toHaveAttribute('data-live', 'true');
  await expect(rows.first().locator('.bk-now')).toHaveText('What if');
  await expect(rows.first().locator('.bk-words')).toHaveCount(0);
  await expect(rows.first().locator('.fs-cycle-dot')).toHaveCount(1);
  // in ink, as the name is; the step words of the others are print
  const colour = (sel: string) => rows.first().locator(sel).evaluate(el => getComputedStyle(el).color);
  expect(await colour('.bk-now')).toBe(await colour('.fs-list-line'));
  expect(await rows.nth(1).locator('.bk-words').evaluate(el => getComputedStyle(el).color)).not.toBe(await colour('.fs-list-line'));
  await expect(rows.nth(1).locator('.bk-words')).toBeVisible();

  // a hand-off from What if's third step lands on Panic's own page, and the app opens on the live episode there
  await rows.first().click();
  await expect(page).toHaveURL(/#\/flow\/whatif$/);
  await page.getByRole('button', { name: 'Night before', exact: true }).click();
  await expect(page).toHaveURL(/#\/flow\/whatif\/3$/);
  await page.locator('.fl-prints a.fl-handoff').click();
  await expect(page).toHaveURL(/#\/flow\/panic\/1$/);
  await expect(page.locator('.fs-flowpage[data-flow="panic"]')).toHaveAttribute('data-showing', '1');
  await expect(page.locator('.ck-page')).toHaveCount(0);
  await expect(page.locator('.fl-from')).toContainText('From What if');
  await expect.poll(async () => (await episodes(page)).map(e => [e.flowId, e.endedAt !== undefined]).sort()).toEqual([['panic', false], ['whatif', true]]);
  await page.goto('/#/journal');
  await page.reload();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(page).toHaveURL(/#\/flow\/panic\/1$/);
  await expect(page.locator('.fs-flowpage[data-flow="panic"]')).toBeVisible();
});

test('Still: the word and the names, one rule each, in stored order, no drawing or step words', async ({ page }) => {
  await open(page, '#/flow/now');
  await page.locator('.fl-nowlist a[href="#/flow/whatif/1"]').click();
  await expect(page.locator('.fs-flowpage[data-flow="whatif"]')).toHaveAttribute('data-saved', 'true');
  await page.goto('/#/flow/c/root');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  const block = page.locator('[data-blockers]:not([data-wait])');
  await expect(block.locator('.fs-month')).toBeVisible();
  await expect(block.locator('.bk-row')).toHaveText(['Panic', 'What if', '3 a.m.']);
  await expect(block.locator('.fs-cycle, .bk-words, .bk-now, [data-live]')).toHaveCount(0);
  const hs = await block.locator('.bk-row').evaluateAll(rs => {
    const lh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lh-ink'));
    return rs.map(r => r.getBoundingClientRect().height / lh);
  });
  expect(hs).toEqual([1, 1, 1]);
  await block.locator('.bk-row').first().click();
  await expect(page).toHaveURL(/#\/flow\/panic$/);
});

test('the room is held: nothing under the Blockers moves once they are read', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  await expect(page.locator('[data-blockers]:not([data-wait]) .bk-row')).toHaveCount(2);
  // read once, so its room is kept; a reload's first paint holds it
  await page.evaluate(() => {
    const w = window as unknown as { tops: number[] };
    w.tops = [];
    const look = () => { const s = document.querySelector('.ck-shelf'); if (s) w.tops.push(Math.round(s.getBoundingClientRect().top)); };
    new MutationObserver(look).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await page.goto('/#/flow');
  await page.evaluate(() => { (window as unknown as { tops: number[] }).tops = []; });
  await page.goto('/#/flow/c/heart');
  await expect(page.locator('[data-blockers]:not([data-wait]) .bk-row')).toHaveCount(2);
  await page.waitForTimeout(300);
  const tops = [...new Set(await page.evaluate(() => (window as unknown as { tops: number[] }).tops))];
  expect(tops.length, tops.join(',')).toBe(1);
});
