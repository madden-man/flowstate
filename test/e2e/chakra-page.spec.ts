// A stop's page (PLAN-MOUNTAIN.md section 6 and pass 6, R3): #/flow/c/:chakra opens on its place on the mountain; the
// drawings under the sign carry no flow name; the gate writes one reading on release; a stale reading is dashed;
// #/flow/:id for a flow under a sign lands on its sign's page; the safety lines stay; Still hides the gate.
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

/** Every flow name, less any that is also a step's word on the page (What if's second step is "What if"). */
const FLOW_NAMES = ['Panic', 'What if', 'Depress', 'Fight', 'Shame', 'Replay', 'Shutdown', '3 a.m.', 'Energize'];

test('a stop opens on its place, its drawings unnamed, and the gate writes one reading on release', async ({ page }) => {
  await open(page, '#/flow/c/root');
  const body = page.locator('.ck-page');
  await expect(body).toHaveAttribute('data-chakra', 'root');
  await expect(page.locator('.fs-hdr')).toContainText('Root chakra');
  await expect(page.locator('.fs-hdr').getByRole('link', { name: 'Flow' })).toHaveAttribute('href', '#/flow');
  // the plate: the place, the light, the sign that travels from the mountain
  await expect(body.locator('.ck-plate.on-plate[data-fx="fireflies"] canvas.ck-light')).toHaveCount(1);
  await expect(body.locator('.ck-sign')).toHaveCSS('view-transition-name', 'mt-sign-root');
  await expect(body.locator('.ck-gloss')).toHaveText('Root · feeling safe');
  // how it gets blocked: the ring, then the curve
  await expect(body.locator('.ck-drawing')).toHaveCount(2);
  expect(await body.locator('.ck-drawing').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.flow))).toEqual(['panic', 'whatif']);
  await expect(body.locator('.ck-drawing .fs-cycle')).toHaveCount(2);
  // the rows at rest: one list of up to six, one On row among them
  const rows = body.locator('.ck-rows .fl-tip');
  expect(await rows.count()).toBeGreaterThan(0);
  expect(await rows.count()).toBeLessThanOrEqual(6);

  // no flow name anywhere on the page
  const text = await page.locator('.fs-main').innerText();
  const stepWords = await body.locator('.fs-cycle').allInnerTexts();
  for (const name of FLOW_NAMES) {
    if (stepWords.some(w => w.includes(name))) continue;
    expect(text, name).not.toContain(name);
  }

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

test('#/flow/:id for a flow under a sign lands on its page, that drawing in front; Energize keeps its own', async ({ page }) => {
  await open(page, '#/flow/panic');
  await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', 'root');
  await expect(page.locator('.ck-page')).toHaveAttribute('data-front', 'panic');
  await page.goto('/#/flow/whatif/2');
  await expect(page.locator('.ck-page')).toHaveAttribute('data-front', 'whatif');
  await expect(page.locator('.ck-page')).toHaveAttribute('data-showing', '2');
  await expect(page.locator('.ck-drawing[data-flow="whatif"]')).toBeInViewport();
  // the step's rows, without its said paragraph, "Usually" or his own line
  await expect(page.locator('.ck-rows')).toHaveAttribute('aria-label', 'What if');
  await expect(page.locator('.ck-rows > .fl-said, .ck-rows > .fl-usual, .ck-rows > .fl-line, .ck-page .fl-note')).toHaveCount(0);
  // a dot moved keeps the page, and starts an episode on that drawing's flow
  const dot = page.locator('.ck-drawing[data-flow="panic"]').getByRole('slider', { name: 'Where you are' });
  const before = await page.locator('.ck-page').elementHandle();
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#\/flow\/panic\/1$/);
  await expect(page.locator('.ck-page')).toHaveAttribute('data-front', 'panic');
  expect(await before!.evaluate(el => el.isConnected)).toBe(true);
  // a flow under no sign keeps the flow page
  await page.goto('/#/flow/energize');
  await expect(page.locator('.fs-flowpage')).toHaveCount(1);
  await expect(page.locator('.ck-page')).toHaveCount(0);
  // a sign that is not one goes back to the mountain
  await page.goto('/#/flow/c/spleen');
  await expect(page).toHaveURL(/#\/flow$/);
});

test('the safety lines stay: 988, the doctor line, and hand-offs that read as their sign', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  await expect(page.locator('.fl-prints')).toContainText('call or text 988');
  await page.goto('/#/flow/c/crown');
  await expect(page.locator('.fl-prints')).toContainText('talk to your doctor');
  await page.goto('/#/flow/night/1');
  await expect(page.locator('.fl-prints')).toContainText('talk to your doctor');
  await page.goto('/#/flow/shame/3');
  const link = page.locator('.fl-prints a.fl-handoff');
  await expect(link).toHaveText("If it's hot: the Throat chakra.");
  await link.click();
  await expect(page).toHaveURL(/#\/flow\/fight\/1$/);
  await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', 'throat');
});

test('Still: no gate, no percent, the sign open; the drawings and safety lines stay', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  await page.getByRole('slider', { name: 'Heart gate' }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.fs-gate-pct')).toHaveText('100%');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.fs-gate')).toBeHidden();
  await expect(page.locator('.ck-sign .fs-sign')).toHaveAttribute('data-closed', '0.00');
  await expect(page.locator('.ck-drawing')).toHaveCount(1);
  await expect(page.locator('.fl-prints')).toContainText('988');
  const digits = await page.locator('.ck-page').evaluate(el => {
    const out: string[] = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement?.checkVisibility()) out.push(n.textContent ?? '');
    return out.join(' ');
  });
  expect(digits.replace(/988/g, '')).not.toMatch(/\d/);
});
