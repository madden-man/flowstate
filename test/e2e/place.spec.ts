// In the place (PLAN-TASKS.md T2): a written touch keeps its line and draws it in its place, with its rule clear of the
// keyboard on a 390 by 844 screen; a held touch runs on the breath; and a touch done behind a part-shut gate surges:
// the plate runs it, the gate asks (dashed) until set, and the first return to the mountain runs it to the sea, once.
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

/** The iPhone's keyboard with its predictive bar, on a 390 by 844 screen. */
const KEYBOARD_PX = 380;

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

const all = (page: Page, store: string) => page.evaluate(s => new Promise<Record<string, unknown>[]>((resolve, reject) => {
  const req = indexedDB.open('flowstate');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const r = req.result.transaction(s).objectStore(s).getAll();
    r.onsuccess = () => { req.result.close(); resolve(r.result as Record<string, unknown>[]); };
    r.onerror = () => reject(r.error);
  };
}), store);

test('a written touch: the name sinks into the tarn and stays as a stone; every rule on a plate clears the keyboard', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  await page.getByRole('button', { name: 'Grieve' }).click();
  const rule = page.getByRole('textbox', { name: 'Grieve' });
  await expect(rule).toBeFocused();
  await rule.fill('Grandpa Joe');
  await rule.press('Enter');
  await expect(rule).toHaveValue('');
  await expect.poll(async () => (await all(page, 'marks')).length).toBe(1);
  await expect(page.locator('.ck-stage [data-stone]')).toHaveCount(1);
  // on a later visit the stone is still there
  await page.goto('/#/flow/c/crown');
  await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', 'crown');
  await page.goto('/#/flow/c/heart');
  await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', 'heart');
  await page.getByRole('button', { name: 'Grieve' }).click();
  await expect(page.locator('.ck-stage [data-stone]')).toHaveCount(1);

  const rules: [string, string, string][] = [
    ['crown', 'Let go', 'Let go'], ['throat', 'Say it here', 'Say it here'], ['heart', 'Grieve', 'Grieve'],
    ['solar-plexus', 'Reword', 'Reword, the verdict'], ['sacral', 'Feel', 'Feel'], ['root', 'Five', 'Five'],
  ];
  for (const [c, word, name] of rules) {
    await page.goto(`/#/flow/c/${c}`);
    await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', c);
    await page.getByRole('button', { name: word, exact: true }).click();
    const box = page.getByRole('textbox', { name });
    await box.focus();
    const b = (await box.boundingBox())!;
    expect(b.y, c).toBeGreaterThan(0);
    expect(b.y + b.height, `${c}: the rule stays above the keyboard`).toBeLessThanOrEqual(844 - KEYBOARD_PX);
  }
  // Let go keeps nothing
  await page.goto('/#/flow/c/crown');
  await page.getByRole('button', { name: 'Let go' }).click();
  await page.getByRole('textbox', { name: 'Let go' }).fill('needing to know how it ends');
  await page.getByRole('textbox', { name: 'Let go' }).press('Enter');
  await expect(page.locator('.pl-letgo')).toHaveCount(1);
  expect((await all(page, 'marks')).length).toBe(1);
});

test('a held touch surges behind a part-shut gate: the gate asks, and the mountain runs the surge once', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T21:30:00') });
  await open(page, '#/flow/c/sacral');
  // the gate part shut, as he sets it (one reading)
  const slider = page.getByRole('slider', { name: 'Sacral gate' });
  await slider.focus();
  for (let k = 0; k < 10; k++) await page.keyboard.press('ArrowRight');
  await slider.blur();
  await expect.poll(async () => (await all(page, 'readings')).length).toBeGreaterThan(0);
  await page.clock.runFor(500);
  const set = (await all(page, 'readings')).length;
  const gate = page.locator('.fs-gate');
  await expect(gate).not.toHaveAttribute('data-stale', '');

  await page.getByRole('button', { name: 'Hold', exact: true }).click();
  const surface = page.locator('.ck-stage .pl-thumb');
  await expect(surface).toHaveAttribute('data-touch-of', 'Hold');
  const s = (await surface.boundingBox())!;
  await page.mouse.move(s.x + s.width / 2, s.y + s.height * 0.7);
  await page.mouse.down();
  await expect(surface).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(4_500);
  await expect(page.locator('.ck-stage .pl-ripple')).toHaveCount(1);
  await page.clock.runFor(6_000);
  await page.mouse.up();
  // the touch done: the plate lets a share of the pool go, and the gate asks
  await expect(page.locator('.ck-light')).toHaveAttribute('data-surge', '');
  await expect(gate).toHaveAttribute('data-stale', '');
  // nothing was written for him: only the readings he set, no mark
  expect((await all(page, 'readings')).length).toBe(set);
  expect((await all(page, 'marks')).length).toBe(0);

  // the first return to the mountain runs it from the Sacral to the sea
  await page.goto('/#/flow');
  await page.locator('.mt-plate').waitFor();
  const surging = () => page.evaluate(() => {
    const w = (window as unknown as { __mountain?: { plate: { water: { surgeAmp: Float32Array; surgeFrom: Float32Array } } } }).__mountain;
    return w ? Array.from(w.plate.water.surgeAmp).some(a => a > 0) : false;
  });
  let seen = false;
  for (let k = 0; k < 24 && !seen; k++) { await page.clock.runFor(400); seen = await surging(); }
  expect(seen).toBe(true);
  // once: back again, nothing is owed
  await page.clock.runFor(8_000);
  expect(await surging()).toBe(false);
  await page.goto('/#/flow/c/sacral');
  await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', 'sacral');
  // leaving the page settled the gate's ask
  await expect(page.locator('.fs-gate')).not.toHaveAttribute('data-stale', '');
  await page.goto('/#/flow');
  await page.locator('.mt-plate').waitFor();
  for (let k = 0; k < 6; k++) { await page.clock.runFor(400); expect(await surging()).toBe(false); }
});

test('in Still a touch works and nothing surges or asks', async ({ page }) => {
  await open(page, '#/flow/c/sacral');
  const slider = page.getByRole('slider', { name: 'Sacral gate' });
  await slider.focus();
  for (let k = 0; k < 10; k++) await page.keyboard.press('ArrowRight');
  await slider.blur();
  await expect.poll(async () => (await all(page, 'readings')).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await page.getByRole('button', { name: 'Feel', exact: true }).click();
  const rule = page.getByRole('textbox', { name: 'Feel' });
  await rule.fill('restless');
  await rule.press('Enter');
  await expect.poll(async () => (await all(page, 'marks')).length).toBe(1);
  await expect(page.locator('[data-afloat]')).toHaveText('restless');
  await page.waitForTimeout(500);
  await expect(page.locator('.ck-light')).not.toHaveAttribute('data-surge', '');
});

/** Shuts this sign's gate part way, as he would (keys on the slider, a reading written). */
const shutPart = async (page: Page, name: string) => {
  const slider = page.getByRole('slider', { name: `${name} gate` });
  await slider.focus();
  for (let k = 0; k < 10; k++) await page.keyboard.press('ArrowRight');
  await slider.blur();
  await expect.poll(async () => (await all(page, 'readings')).length).toBeGreaterThan(0);
};

test('a touch into the app surges when he comes back: Ask lands on the journal, the sign beside the date returns, the gate asks', async ({ page }) => {
  await open(page, '#/flow/c/third-eye');
  await shutPart(page, 'Third eye');
  await expect(page.locator('.fs-gate')).not.toHaveAttribute('data-stale', '');
  await page.getByRole('button', { name: 'Ask, Journal' }).click();
  const rule = page.locator('.ck-stage [data-into="ask"] input');
  await rule.pressSequentially('What am I not seeing?', { delay: 2 });
  await rule.press('Enter');
  await expect(page).toHaveURL(/#\/journal$/);
  // nothing surges as he goes
  await page.locator('.fs-hdr-r [data-sign-back="third-eye"]').click();
  await expect(page).toHaveURL(/#\/flow\/c\/third-eye$/);
  await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', 'third-eye');
  // back on the sign: its plate runs the surge, and the gate asks
  await expect(page.locator('.ck-light')).toHaveAttribute('data-surge', '');
  await expect(page.locator('.fs-gate')).toHaveAttribute('data-stale', '');
});

test('a touch out of the app surges when he comes back: Throat Send, Messages in front, then the sign again', async ({ page }) => {
  await open(page, '#/flow/c/throat');
  await shutPart(page, 'Throat');
  await page.locator('.ck-touch[data-touch="send"]').click();
  const sheet = page.locator('[data-sheet="One person"]');
  await sheet.getByRole('textbox', { name: 'Who' }).fill('Ali');
  await sheet.getByRole('textbox', { name: 'Their number' }).fill('555 010 4471');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  const stage = page.locator('.ck-stage [data-out="send"]');
  await stage.getByRole('textbox', { name: 'Your sentence' }).fill('I miss you');
  // the link would open Messages: kept on the page here, and the other app in front faked by the page's visibility
  await page.evaluate(() => {
    document.addEventListener('click', e => { if ((e.target as Element).closest?.('a.out-go')) e.preventDefault(); }, true);
    let state: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    (window as unknown as { __seen: (s: DocumentVisibilityState) => void }).__seen = s => { state = s; document.dispatchEvent(new Event('visibilitychange')); };
  });
  await stage.locator('a.out-go').click();
  await expect(page.locator('.ck-light')).not.toHaveAttribute('data-surge', '');
  await page.evaluate(() => (window as unknown as { __seen: (s: string) => void }).__seen('hidden'));
  await page.evaluate(() => (window as unknown as { __seen: (s: string) => void }).__seen('visible'));
  await expect(page.locator('.ck-light')).toHaveAttribute('data-surge', '');
  await expect(page.locator('.fs-gate')).toHaveAttribute('data-stale', '');
});
