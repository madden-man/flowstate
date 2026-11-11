// The weather and the gates (PLAN-MOUNTAIN.md sections 4 and 5, pass 6; R2): the Depression meter over the plate's sky
// and a gate under each sign's name. A drag writes one reading, on release, and none while it moves; a touch that goes
// down first is the page's scroll and leaves everything as it was; keys move it live and commit once; a reading older
// than a day is dashed until touched; the same reading drives the gate here and on the stop's page; Still shows the
// same plate whatever the readings; Reduce Motion draws it at once; the loop still stops when the page is hidden.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, hash = '#/flow') {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

/** On the Flow tab with the arrival over, so nothing is moving for reasons of its own. */
async function settled(page: Page) {
  await open(page);
  const plate = page.locator('.mt-plate');
  await expect(plate).toBeVisible();
  await plate.click({ position: { x: 4, y: 300 } });
  await expect(plate).toHaveAttribute('data-arrive', 'done');
  return plate;
}

const readings = (page: Page) => page.evaluate(() => new Promise<{ of: string; value: number; at: number }[]>((resolve, reject) => {
  const req = indexedDB.open('flowstate');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const r = req.result.transaction('readings').objectStore('readings').getAll();
    // oldest first (the store is keyed by a random id)
    r.onsuccess = () => { req.result.close(); resolve(r.result.sort((a: { at: number }, b: { at: number }) => a.at - b.at)); };
    r.onerror = () => reject(r.error);
  };
}));

const putReading = (page: Page, r: { id: string; at: number; of: string; value: number }) => page.evaluate(r => new Promise<void>((resolve, reject) => {
  const req = indexedDB.open('flowstate');
  req.onsuccess = () => {
    const tx = req.result.transaction('readings', 'readwrite');
    tx.objectStore('readings').put(r);
    tx.oncomplete = () => { req.result.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), r);

/** Drags a rule's mark from x0 to x1 (fractions of its width) with the mouse, in steps; between steps, during(). */
async function drag(page: Page, name: string, x0: number, x1: number, during?: () => Promise<void>) {
  const rule = page.getByRole('slider', { name, exact: true });
  const box = (await rule.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * x0, y);
  await page.mouse.down();
  for (let k = 1; k <= 12; k++) {
    await page.mouse.move(box.x + box.width * (x0 + ((x1 - x0) * k) / 12), y);
    if (during && k % 4 === 0) await during();
  }
}

test('weather: a meter drag answers live, writes nothing while it moves and one reading on release', async ({ page }) => {
  const plate = await settled(page);
  await expect(plate).toHaveAttribute('data-d', '0.000');
  const meter = page.getByRole('slider', { name: 'Depression', exact: true });
  await expect(meter).toHaveAttribute('aria-valuetext', 'clear');
  const seen: number[] = [];
  await drag(page, 'Depression', 0.02, 0.62, async () => {
    expect(await readings(page)).toEqual([]);
    seen.push(Number(await plate.getAttribute('data-d')));
  });
  // the plate followed the finger, rising
  expect(seen.length).toBeGreaterThan(1);
  for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
  expect(await readings(page)).toEqual([]);
  await page.mouse.up();
  await expect.poll(async () => (await readings(page)).length).toBe(1);
  const [r] = await readings(page);
  expect(r.of).toBe('mountain');
  expect(r.value).toBeGreaterThan(0.45);
  expect(r.value).toBeLessThan(0.7);
  // the plate keeps what was written; no number anywhere on it or the meter (rule 15)
  await expect(plate).toHaveAttribute('data-d', r.value.toFixed(3));
  expect(/\d/.test(await page.locator('.mt-wrap').innerText())).toBe(false);
  // and it is still there after a reload
  await page.reload();
  await open(page);
  await expect(page.locator('.mt-plate')).toHaveAttribute('data-d', r.value.toFixed(3));
  expect(await readings(page)).toHaveLength(1);
});

test('weather: a touch on the meter that goes down first is the page\'s scroll, and a tap writes nothing', async ({ page }) => {
  const plate = await settled(page);
  const probe = (mode: 'scroll' | 'tap') => page.evaluate(async mode => {
    const rule = document.querySelector('.mt-meter-rule')!;
    const b = rule.getBoundingClientRect();
    const at = (x: number, y: number) => ({ pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: b.left + b.width * x, clientY: b.top + y, button: 0 });
    const wait = () => new Promise(r => setTimeout(r, 60));
    rule.dispatchEvent(new PointerEvent('pointerdown', at(0.5, b.height / 2)));
    await wait();
    if (mode === 'scroll') {
      // down, with a little sideways in it: still the page's
      for (let k = 1; k <= 6; k++) { rule.dispatchEvent(new PointerEvent('pointermove', at(0.5 + k * 0.004, b.height / 2 + k * 6))); await wait(); }
      rule.dispatchEvent(new PointerEvent('pointercancel', at(0.52, b.height / 2 + 36)));
    } else rule.dispatchEvent(new PointerEvent('pointerup', at(0.5, b.height / 2)));
    await new Promise(r => setTimeout(r, 300));
    return {
      d: document.querySelector<HTMLElement>('.mt-plate')!.dataset.d,
      value: rule.getAttribute('aria-valuenow'),
      dragging: document.querySelector('.mt-meter')!.hasAttribute('data-drag'),
    };
  }, mode);
  for (const mode of ['scroll', 'tap'] as const) {
    expect(await probe(mode), mode).toEqual({ d: '0.000', value: '0', dragging: false });
  }
  await expect(plate).toHaveAttribute('data-d', '0.000');
  expect(await readings(page)).toEqual([]);
});

test('weather: keys move the meter live and a held arrow writes one reading; Home and End reach the ends', async ({ page }) => {
  const plate = await settled(page);
  const meter = page.getByRole('slider', { name: 'Depression', exact: true });
  await meter.focus();
  for (let k = 0; k < 6; k++) await page.keyboard.down('ArrowRight');
  await expect(plate).toHaveAttribute('data-d', '0.300');
  expect(await readings(page)).toEqual([]);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await readings(page)).map(r => r.value)).toEqual([0.3]);
  await page.keyboard.press('End');
  await expect.poll(async () => (await readings(page)).map(r => r.value)).toEqual([0.3, 1]);
  await expect(meter).toHaveAttribute('aria-valuetext', 'the heaviest');
  await page.keyboard.press('Home');
  await expect(plate).toHaveAttribute('data-d', '0.000');
});

test('weather: a reading older than a day draws its control dashed until touched, and the plate still renders from it', async ({ page }) => {
  await open(page);
  await putReading(page, { id: 'old-mountain', at: Date.now() - 2 * 24 * 3_600_000, of: 'mountain', value: 0.6 });
  await putReading(page, { id: 'old-root', at: Date.now() - 3 * 24 * 3_600_000, of: 'root', value: 0.5 });
  await putReading(page, { id: 'new-heart', at: Date.now() - 60_000, of: 'heart', value: 0.3 });
  await page.reload();
  await open(page);
  const plate = page.locator('.mt-plate');
  await expect(plate).toHaveAttribute('data-d', '0.600');
  await expect(plate).toHaveAttribute('data-gates', '0.000,0.000,0.000,0.300,0.000,0.000,0.500');
  const meter = page.locator('.mt-meter');
  await expect(meter).toHaveAttribute('data-stale', '');
  await expect(page.locator('.mt-gate[data-chakra="root"] .fs-gate')).toHaveAttribute('data-stale', '');
  await expect(page.locator('.mt-gate[data-chakra="heart"] .fs-gate')).not.toHaveAttribute('data-stale', '');
  // dashed, drawn so
  expect(await page.locator('.mt-meter-line').evaluate(l => getComputedStyle(l).strokeDasharray)).not.toBe('none');
  await page.getByRole('slider', { name: 'Depression', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(meter).not.toHaveAttribute('data-stale', '');
  await expect.poll(async () => (await readings(page)).filter(r => r.of === 'mountain').length).toBe(2);
});

test('gates: a gate on the mountain shuts toward the stream, writes one reading on release, and the stop\'s page shows it', async ({ page }) => {
  const plate = await settled(page);
  // Root's name is on the right of its sign, so its rule shuts leftward, toward the stream
  await expect(page.locator('.mt-gate[data-chakra="root"] .fs-gate')).toHaveClass(/leftward/);
  await expect(page.locator('.mt-gate[data-chakra="heart"] .fs-gate')).not.toHaveClass(/leftward/);
  await drag(page, 'Heart gate', 0.05, 0.75, async () => { expect(await readings(page)).toEqual([]); });
  // the sign empties under the finger, before anything is written
  await expect(plate.locator('a.mt-stop[data-chakra="heart"] .fs-sign')).not.toHaveAttribute('data-closed', '0.00');
  expect(await readings(page)).toEqual([]);
  await page.mouse.up();
  await expect.poll(async () => (await readings(page)).length).toBe(1);
  const [r] = await readings(page);
  expect(r.of).toBe('heart');
  expect(r.value).toBeGreaterThan(0.4);
  // the percent is a state he sets, printed in grey at the rule
  await expect(page.locator('.mt-gate[data-chakra="heart"] .fs-gate-pct')).toHaveText(`${Math.round(r.value * 100)}%`);
  // the water below the heart thins (it is carried down, so give it the time the water takes)
  const widths = () => page.locator('.mt-chan').evaluateAll(ps => ps.map(p => Number(p.getAttribute('stroke-width'))));
  await expect.poll(async () => { const w = await widths(); return w[4] < w[3] - 0.5 && w[7] < w[3] - 0.5; }, { timeout: 10_000 }).toBe(true);
  // the stop's page carries the same gate
  await plate.getByRole('link', { name: 'Heart' }).click();
  await expect(page).toHaveURL(/#\/flow\/c\/heart$/);
  await expect(page.getByRole('slider', { name: 'Heart gate' })).toHaveAttribute('aria-valuenow', String(Math.round(r.value * 100)));
});

test('gates: a gate changed on the stop\'s page shows on the mountain', async ({ page }) => {
  await open(page, '#/flow/c/sacral');
  const gate = page.getByRole('slider', { name: 'Sacral gate' });
  await gate.focus();
  await page.keyboard.press('End');
  await expect.poll(async () => (await readings(page)).map(r => `${r.of} ${r.value}`)).toEqual(['sacral 1']);
  await page.locator('.fs-hdr').getByRole('link', { name: 'Flow' }).click();
  const plate = page.locator('.mt-plate');
  await expect(plate).toHaveAttribute('data-gates', '0.000,0.000,0.000,0.000,0.000,1.000,0.000');
  await expect(page.getByRole('slider', { name: 'Sacral gate' })).toHaveAttribute('aria-valuenow', '100');
  await expect(plate.locator('a.mt-stop[data-chakra="sacral"] .fs-sign')).toHaveAttribute('data-closed', '1.00');
});

test('gates: a touch on a gate that becomes a scroll leaves the plate as it was and writes nothing', async ({ page }) => {
  const plate = await settled(page);
  const after = await page.evaluate(async () => {
    const rule = document.querySelector('.mt-gate[data-chakra="throat"] .fs-gate-rule')!;
    const b = rule.getBoundingClientRect();
    const at = (x: number, y: number) => ({ pointerId: 5, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: b.left + b.width * x, clientY: b.top + y, button: 0 });
    rule.dispatchEvent(new PointerEvent('pointerdown', at(0.8, b.height / 2)));
    for (let k = 1; k <= 5; k++) rule.dispatchEvent(new PointerEvent('pointermove', at(0.8, b.height / 2 + k * 7)));
    rule.dispatchEvent(new PointerEvent('pointercancel', at(0.8, b.height / 2 + 35)));
    await new Promise(r => setTimeout(r, 300));
    return document.querySelector<HTMLElement>('.mt-plate')!.dataset.gates;
  });
  expect(after).toBe('0.000,0.000,0.000,0.000,0.000,0.000,0.000');
  await expect(plate).not.toHaveAttribute('data-held', /.*/);
  expect(await readings(page)).toEqual([]);
});

test('weather: Still has no meter and no gates, and its plate is the same picture whatever the readings', async ({ page }) => {
  // with Reduce Motion the Still water stands, so two pictures can be compared pixel for pixel
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.mt-meter')).toBeHidden();
  await expect(page.locator('.mt-gate .fs-gate')).toHaveCount(7);
  for (const g of await page.locator('.mt-gate .fs-gate').all()) await expect(g).toBeHidden();
  const plate = page.locator('.mt-plate');
  await page.waitForTimeout(1500);
  const clear = await plate.screenshot();
  await page.evaluate(() => (window as unknown as { __mountain: { set: (d: number, g: number[]) => void } }).__mountain.set(1, [0, 0, 0.9, 0.5, 0, 1, 0]));
  await expect(plate).toHaveAttribute('data-d', '1.000');
  await page.waitForTimeout(1500);
  const heavy = await plate.screenshot();
  expect(heavy.equals(clear)).toBe(true);
  expect(/\d/.test(await plate.innerText())).toBe(false);
  await page.getByRole('button', { name: 'Leave Still' }).click();
});

test.describe('with Reduce Motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('weather: the meter and a gate are drawn at once, with nothing running and no surge', async ({ page }) => {
    await open(page);
    const plate = page.locator('.mt-plate');
    await expect(plate).toHaveAttribute('data-arrive', 'done');
    const canvas = page.locator('.mt-light');
    await expect(canvas).not.toHaveAttribute('data-running', /.*/);
    const meter = page.getByRole('slider', { name: 'Depression', exact: true });
    await meter.focus();
    await page.keyboard.press('End');
    await expect.poll(async () => (await readings(page)).length).toBe(1);
    // the channel widths alone still tell it: every stretch thinner than a clear day's
    const widths = () => page.locator('.mt-chan').evaluateAll(ps => ps.map(p => Number(p.getAttribute('stroke-width'))));
    await expect.poll(async () => (await widths()).every(w => w < 2)).toBe(true);
    await page.getByRole('slider', { name: 'Root gate' }).focus();
    await page.keyboard.press('End');
    await expect.poll(async () => { const w = await widths(); return w[7] < w[6]; }).toBe(true);
    await expect(canvas).not.toHaveAttribute('data-running', /.*/);
    expect(await plate.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  });
});

test('weather: the loop stops when the page is hidden, mid-drag of the meter too', async ({ page }) => {
  await settled(page);
  const canvas = page.locator('.mt-light');
  await expect(canvas).toHaveAttribute('data-running', '');
  await drag(page, 'Depression', 0.02, 0.5);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(canvas).not.toHaveAttribute('data-running', /.*/);
  await page.mouse.up();
  await expect.poll(async () => (await readings(page)).length).toBe(1);
  await expect(canvas).not.toHaveAttribute('data-running', /.*/);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(canvas).toHaveAttribute('data-running', '');
});
