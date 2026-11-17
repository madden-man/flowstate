// A stop's page (PLAN-MOUNTAIN.md section 6 and pass 6, R3): #/flow/c/:chakra opens on its place on the mountain; the
// old flows' large drawings are gone from the page (the plate is the drawing) and a flow is named only in its Blockers
// row (PLAN-BLOCKERS.md K3); the gate writes one reading on release; a stale reading is dashed; #/flow/:id for any flow
// lands on its own page, whose way back is the sign; the safety lines stay; Still hides the gate.
import { test, expect, type Page } from '@playwright/test';

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

const readings = (page: Page) => page.evaluate(() => new Promise<{ of: string; value: number; at: number }[]>((resolve, reject) => {
  const req = indexedDB.open('flowstate');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const r = req.result.transaction('readings').objectStore('readings').getAll();
    r.onsuccess = () => { req.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}));

const episodes = (page: Page) => page.evaluate(() => new Promise<{ flowId: string; endedAt?: number; from?: unknown }[]>((resolve, reject) => {
  const req = indexedDB.open('flowstate');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const r = req.result.transaction('episodes').objectStore('episodes').getAll();
    r.onsuccess = () => { req.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}));

/** Every flow name. */
const FLOW_NAMES = ['Panic', 'What if', 'Depress', 'Fight', 'Shame', 'Replay', 'Shutdown', '3 a.m.', 'Energize'];

test('a stop opens on its place, its drawings unnamed, and the gate writes one reading on release', async ({ page }) => {
  await open(page, '#/flow/c/root');
  const body = page.locator('.ck-page');
  await expect(body).toHaveAttribute('data-chakra', 'root');
  await expect(page.locator('.fs-hdr')).toContainText('Root chakra');
  await expect(page.locator('.fs-hdr').getByRole('link', { name: 'Flow' })).toHaveAttribute('href', '#/flow');
  // the plate: the place, the light, the sign that travels from the mountain
  await expect(body.locator('.ck-plate.on-plate[data-fx="fireflies"] canvas.ck-light')).toHaveCount(1);
  await expect(body.locator('.ck-sign')).toHaveAttribute('data-travel', 'mt-sign-root');
  await expect(body.locator('.ck-gloss')).toHaveText('Root · feeling safe');
  // the old flows' large drawings are gone: the plate is the drawing; a flow's small drawing is only on its Blockers row
  await expect(body.locator('.ck-drawing, .fl-drawing')).toHaveCount(0);
  await expect(body.locator('.fs-cycle:not(.bk-row .fs-cycle)')).toHaveCount(0);
  await expect(body.locator('[data-blockers]:not([data-wait]) .bk-row')).toHaveCount(3);
  await expect(body.locator('.ck-steps')).toHaveCount(0);
  // the checklist is gone at rest (PLAN-TASKS.md T1): the place is the page, its touch words on the plate
  await expect(body.locator('.ck-rows, .fl-tip')).toHaveCount(0);
  await expect(body.locator('.ck-touch')).toHaveCount(4);

  // no flow name anywhere on the page but its Blockers rows
  const text = await page.locator('.fs-main').evaluate(el => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll('[data-blockers]').forEach(b => b.remove());
    document.body.append(c);
    const t = c.innerText;
    c.remove();
    return t;
  });
  for (const name of FLOW_NAMES) expect(text, name).not.toContain(name);

  // the gate: dragged, the sign answers live, nothing is written until release, then one reading
  const gate = page.getByRole('slider', { name: 'Root gate' });
  const box = (await gate.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 2, y);
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) await page.mouse.move(box.x + (box.width * 0.7 * k) / 10, y);
  await expect(body.locator('.ck-sign .fs-sign')).not.toHaveAttribute('data-closed', '0.00');
  await expect(page.locator('.fs-gate-pct')).toHaveText(/^\d+%$/);
  expect(await readings(page)).toEqual([]);
  await page.mouse.up();
  await expect.poll(async () => (await readings(page)).length).toBe(1);
  const [r] = await readings(page);
  expect(r.of).toBe('root');
  expect(r.value).toBeGreaterThan(0.6);
  expect(r.value).toBeLessThan(0.8);
  await expect(page.locator('.fs-gate')).not.toHaveAttribute('data-stale', '');
});

test('a reading older than a day is dashed until touched', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('flowstate');
    req.onsuccess = () => {
      const tx = req.result.transaction('readings', 'readwrite');
      tx.objectStore('readings').put({ id: 'old-heart', at: Date.now() - 2 * 24 * 3_600_000, of: 'heart', value: 0.4 });
      tx.oncomplete = () => { req.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  const t = page.locator('[data-threshold]');
  await page.locator('.ck-page').waitFor();
  if (await t.count()) await t.click();
  const gate = page.locator('.fs-gate');
  await expect(gate).toHaveAttribute('data-stale', '');
  await expect(page.locator('.fs-gate-pct')).toHaveText('40%');
  await page.getByRole('slider', { name: 'Heart gate' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(gate).not.toHaveAttribute('data-stale', '');
  await expect.poll(async () => (await readings(page)).filter(r => r.of === 'heart').length).toBe(2);
});

test('#/flow/:id for any flow lands on its own page, whose way back is its sign; Energize keeps Flow', async ({ page }) => {
  await open(page, '#/flow/panic');
  const body = page.locator('.fs-flowpage[data-flow="panic"]');
  await expect(body.locator('.fl-drawing .fs-cycle')).toBeVisible();
  await expect(page.locator('.ck-page')).toHaveCount(0);
  await expect(page.locator('.fs-hdr').getByRole('link', { name: 'Root', exact: true })).toHaveAttribute('href', '#/flow/c/root');
  await page.goto('/#/flow/whatif/2');
  const whatif = page.locator('.fs-flowpage[data-flow="whatif"]');
  await expect(whatif).toHaveAttribute('data-showing', '2');
  await expect(whatif.locator('.fs-cycle-word[aria-pressed="true"]')).toHaveAttribute('aria-label', 'What if');
  // the step's page as the flow page draws it: his line and the said paragraph are back
  await expect(whatif.locator('.fl-step-page')).toHaveAttribute('aria-label', 'What if');
  // a step word read keeps the page and starts nothing; with an episode live (Right now), a word moves the dot
  const before = await whatif.elementHandle();
  await whatif.locator('.fs-cycle-word[data-step="3"]').click();
  await expect(page).toHaveURL(/#\/flow\/whatif\/3$/);
  expect(await before!.evaluate(el => el.isConnected)).toBe(true);
  expect(await episodes(page)).toEqual([]);
  await page.goto('/#/flow/now');
  await page.locator('.fl-nowlist a[href="#/flow/panic/1"]').click();
  await expect(body).toHaveAttribute('data-showing', '1');
  await body.locator('.fs-cycle-word[data-step="2"]').click();
  await expect(page).toHaveURL(/#\/flow\/panic\/2$/);
  await expect(body).toHaveAttribute('data-saved', 'true');
  expect((await episodes(page)).map(e => [e.flowId, e.endedAt !== undefined])).toEqual([['panic', false]]);
  // a flow under no sign goes back to Flow
  await page.goto('/#/flow/energize');
  await expect(page.locator('.fs-flowpage[data-flow="energize"]')).toHaveCount(1);
  await expect(page.locator('.ck-page')).toHaveCount(0);
  await expect(page.locator('.fs-hdr').getByRole('link', { name: 'Flow', exact: true })).toHaveAttribute('href', '#/flow');
  // a sign that is not one goes back to the mountain
  await page.goto('/#/flow/c/spleen');
  await expect(page).toHaveURL(/#\/flow$/);
});

test('the safety lines stay: 988, the doctor line, and hand-offs that read as their sign', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  await expect(page.locator('.ck-safe')).toContainText('call or text 988');
  await page.goto('/#/flow/c/crown');
  await expect(page.locator('.fl-prints')).toContainText('talk to your doctor');
  // on a flow's own page its lines are as the flow page prints them: 3 a.m.'s rest line, a hand-off naming its flow
  await page.goto('/#/flow/night');
  await expect(page.locator('.fs-flowpage[data-flow="night"]')).toContainText('talk to your doctor');
  await page.goto('/#/flow/shame/3');
  const link = page.locator('.fl-prints a.fl-handoff');
  await expect(link).toHaveText("If it's hot: the Fight flow.");
  await link.click();
  await expect(page).toHaveURL(/#\/flow\/fight\/1$/);
  await expect(page.locator('.fs-flowpage[data-flow="fight"]')).toHaveAttribute('data-showing', '1');
  await expect(page.locator('.fs-hdr').getByRole('link', { name: 'Throat', exact: true })).toHaveAttribute('href', '#/flow/c/throat');
});

test('Still: no gate, no percent, the sign open; the safety lines stay', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  await page.getByRole('slider', { name: 'Heart gate' }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.fs-gate-pct')).toHaveText('100%');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.fs-gate')).toBeHidden();
  await expect(page.locator('.ck-sign .fs-sign')).toHaveAttribute('data-closed', '0.00');
  await expect(page.locator('.ck-safe')).toContainText('988');
  await expect(page.getByRole('link', { name: 'Call 988' })).toBeVisible();
  const digits = await page.locator('.ck-page').evaluate(el => {
    const out: string[] = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement?.checkVisibility()) out.push(n.textContent ?? '');
    return out.join(' ');
  });
  expect(digits.replace(/988/g, '')).not.toMatch(/\d/);
});

test('a touch on the gate that becomes a scroll, or a plain tap, leaves the gate as it was and writes nothing', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  const body = page.locator('.ck-page');
  const probe = (cancel: boolean) => page.evaluate(async (cancel) => {
    const rule = document.querySelector('.fs-gate-rule')!;
    const b = rule.getBoundingClientRect();
    const at = (x: number, y: number) => ({ pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: b.left + b.width * x, clientY: b.top + y, button: 0 });
    const wait = () => new Promise(r => setTimeout(r, 60));
    rule.dispatchEvent(new PointerEvent('pointerdown', at(0.6, b.height / 2)));
    await wait();
    const during = document.querySelector('.ck-sign .fs-sign')!.getAttribute('data-closed');
    if (cancel) {
      // the browser takes it for a vertical scroll
      rule.dispatchEvent(new PointerEvent('pointermove', at(0.6, b.height / 2 + 4)));
      rule.dispatchEvent(new PointerEvent('pointercancel', at(0.6, b.height / 2 + 4)));
    } else rule.dispatchEvent(new PointerEvent('pointerup', at(0.6, b.height / 2)));
    await new Promise(r => setTimeout(r, 300));
    return { during, after: document.querySelector('.ck-sign .fs-sign')!.getAttribute('data-closed') };
  }, cancel);
  for (const cancel of [true, false]) {
    const r = await probe(cancel);
    expect(r).toEqual({ during: '0.00', after: '0.00' });
    await expect(page.locator('.fs-gate-pct')).toHaveText('');
    await expect(body).not.toHaveAttribute('data-gating', '');
  }
  expect(await readings(page)).toEqual([]);
});

test('a held arrow on the gate writes one reading', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  const gate = page.getByRole('slider', { name: 'Heart gate' });
  await gate.focus();
  for (let k = 0; k < 8; k++) await page.keyboard.down('ArrowRight');
  await expect(page.locator('.fs-gate-pct')).toHaveText('40%');
  expect(await readings(page)).toEqual([]);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await readings(page)).map(r => r.value)).toEqual([0.4]);
});

test('a hand-off to the other flow under the same sign opens that flow\'s page with the new episode at once', async ({ page }) => {
  await open(page, '#/flow/now');
  await page.locator('.fl-nowlist a[href="#/flow/whatif/1"]').click();
  const body = page.locator('.fs-flowpage[data-flow="whatif"]');
  await expect(body).toHaveAttribute('data-showing', '1');
  for (const n of [2, 3]) {
    await body.locator(`.fs-cycle-word[data-step="${n}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#/flow/whatif/${n}$`));
    await expect(body).toHaveAttribute('data-saved', 'true');
  }
  const link = page.locator('.fl-prints a.fl-handoff');
  await expect(link).toHaveText('If it tips into panic: the Panic flow.');
  await link.click();
  await expect(page).toHaveURL(/#\/flow\/panic\/1$/);
  // no reload: the page shows what was written
  const panic = page.locator('.fs-flowpage[data-flow="panic"]');
  await expect(panic).toHaveAttribute('data-showing', '1');
  await expect(page.getByRole('slider', { name: 'Where you are' })).toHaveAttribute('aria-valuenow', '1');
  await expect(page.locator('.fl-from')).toContainText('From What if · Night before');
  await expect(page.locator('.fs-hdr').getByRole('link', { name: 'Root', exact: true })).toBeVisible();
  expect((await episodes(page)).map(e => [e.flowId, e.endedAt !== undefined]).sort()).toEqual([['panic', false], ['whatif', true]]);
});

test('quick moves never put the step back', async ({ page }) => {
  await open(page, '#/flow/now');
  await page.locator('.fl-nowlist a[href="#/flow/panic/1"]').click();
  const body = page.locator('.fs-flowpage[data-flow="panic"]');
  await expect(body).toHaveAttribute('data-showing', '1');
  await page.evaluate(() => {
    const w = window as unknown as { seen: string[] };
    w.seen = [];
    new MutationObserver(() => { w.seen.push(document.querySelector('.fs-flowpage')?.getAttribute('data-showing') ?? ''); })
      .observe(document.querySelector('.fs-main') ?? document.body, { subtree: true, attributes: true, attributeFilter: ['data-showing'] });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (const n of [2, 3]) {
    await body.locator(`.fs-cycle-word[data-step="${n}"]`).click();
    await expect(body).toHaveAttribute('data-showing', String(n));
  }
  await expect(body).toHaveAttribute('data-saved', 'true');
  await page.waitForTimeout(400);
  const seen = (await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).map(Number);
  for (let i = 1; i < seen.length; i++) expect(seen[i], seen.join(',')).toBeGreaterThanOrEqual(seen[i - 1]);
  await expect(body).toHaveAttribute('data-showing', '3');
});

test('#/flow/c with no sign goes to the Flow tab', async ({ page }) => {
  await open(page, '#/flow/c');
  await expect(page).toHaveURL(/#\/flow$/);
});

test('a tap on each sign on the mountain opens its page, the sign travelling there and back', async ({ page }) => {
  await open(page, '#/flow');
  const ids = ['crown', 'third-eye', 'throat', 'heart', 'solar-plexus', 'sacral', 'root'];
  // the names the turn gives, as it runs: the sign on the plate and the sign on the page share one
  await page.evaluate(() => {
    const w = window as unknown as { named: string[] };
    w.named = [];
    new MutationObserver(() => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-travel]')) {
        const n = el.style.getPropertyValue('view-transition-name');
        if (n) w.named.push(`${el.closest('.ck-plate') ? 'page' : 'mountain'}:${n}`);
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] });
  });
  for (const id of ids) {
    const stop = page.locator(`a.mt-stop[href="#/flow/c/${id}"]`);
    await expect(stop).toBeVisible();
    await stop.click();
    await expect(page).toHaveURL(new RegExp(`#/flow/c/${id}$`));
    await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', id);
    await expect(page.locator('.ck-plate canvas.ck-light')).toHaveCount(1);
    await expect(page.locator('.ck-drawing')).toHaveCount(0);
    await page.locator('.fs-hdr').getByRole('link', { name: 'Flow' }).click();
    await expect(page).toHaveURL(/#\/flow$/);
    await expect(page.locator(`a.mt-stop[href="#/flow/c/${id}"]`)).toBeVisible();
  }
  const named = await page.evaluate(() => (window as unknown as { named: string[] }).named);
  // where the browser runs view transitions, each sign was named on both sides, going and coming back
  if (await page.evaluate(() => 'startViewTransition' in document)) {
    for (const id of ids) {
      expect(named, id).toContain(`mountain:mt-sign-${id}`);
      expect(named, id).toContain(`page:mt-sign-${id}`);
    }
  }
  // and nothing is left named once the turns are over
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-travel]')].filter(el => el.style.getPropertyValue('view-transition-name')).length)).toBe(0);
});
