// The place is the page (PLAN-TASKS.md T1): a sign's page is its taller plate with that sign's touch words printed on
// it, the lead one lit; each word a thumb-sized button that, for now, only lights; the paper foot holds the gloss, the
// gate, the shelf's slot and, on Heart and Root, the 988 line with Call and Text in every light. A live episode still
// shows its step words. Through the door the place shows only the touches that write nothing.
import { test, expect, type Page } from '@playwright/test';

const TOUCHES: Record<string, string[]> = {
  crown: ['let-go', 'core', 'kept-line', 'sit'],
  'third-eye': ['look-far', 'ask', 'bring-it', 'questions'],
  throat: ['say-it-here', 'a-voice', 'send', 'call'],
  heart: ['grieve', 'hold', 'letter', 'reach'],
  'solar-plexus': ['reword', 'stand-on', 'spark-it', 'i-will'],
  sacral: ['feel', 'hold', 'write-from-it', 'move'],
  root: ['five', 'breathe', 'basics', 'reach'],
};

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

const count = (page: Page, store: string) => page.evaluate(s => new Promise<number>((resolve, reject) => {
  const req = indexedDB.open('flowstate');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const r = req.result.transaction(s).objectStore(s).count();
    r.onsuccess = () => { req.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}), store);

test('each sign prints its touch words on its plate, thumb-sized, the lead lit; a tap only lights and writes nothing', async ({ page }) => {
  await open(page, '#/flow/c/crown');
  const width = page.viewportSize()!.width;
  for (const [c, ids] of Object.entries(TOUCHES)) {
    await page.goto(`/#/flow/c/${c}`);
    const body = page.locator('.ck-page');
    await expect(body).toHaveAttribute('data-chakra', c);
    const words = body.locator('.ck-plate .ck-touches button.ck-touch');
    await expect(words).toHaveCount(ids.length);
    expect(await words.evaluateAll(els => els.map(e => (e as HTMLElement).dataset.touch))).toEqual(ids);
    await expect(body.locator('.ck-touch[data-lit]')).toHaveAttribute('data-touch', ids[0]);
    const plate = (await body.locator('.ck-plate').boundingBox())!;
    for (let k = 0; k < ids.length; k++) {
      const b = (await words.nth(k).boundingBox())!;
      expect(b.height, `${c} ${ids[k]}`).toBeGreaterThanOrEqual(44);
      expect(b.x, `${c} ${ids[k]}`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, `${c} ${ids[k]}`).toBeLessThanOrEqual(width);
      expect(b.y, `${c} ${ids[k]}`).toBeGreaterThanOrEqual(plate.y);
      expect(b.y + b.height, `${c} ${ids[k]}`).toBeLessThanOrEqual(plate.y + plate.height);
    }
    // the plate is the taller one: twelve rules
    expect(plate.height).toBeGreaterThan(330);
    // the foot: gloss, gate, the sign's shelf (T5) under the gate
    await expect(body.locator('.ck-gloss + .fs-gate')).toHaveCount(1);
    await expect(body.locator(`.fs-gate + .ck-shelf[data-shelf="${c}"]`)).toHaveCount(1);
  }
  // a tap lights the word and marks it pressed; nothing is written, nothing leaves
  await page.goto('/#/flow/c/heart');
  const before = [await count(page, 'marks'), await count(page, 'readings'), await count(page, 'episodes')];
  const reach = page.getByRole('button', { name: 'Reach, Messages' });
  await reach.click();
  await expect(reach).toHaveAttribute('aria-pressed', 'true');
  await expect(reach).toHaveAttribute('data-lit', '');
  await expect(page.locator('.ck-touch[data-lit]')).toHaveCount(1);
  await expect(page).toHaveURL(/#\/flow\/c\/heart$/);
  await page.getByRole('button', { name: 'Grieve' }).click();
  await expect(reach).toHaveAttribute('aria-pressed', 'false');
  expect([await count(page, 'marks'), await count(page, 'readings'), await count(page, 'episodes')]).toEqual(before);
});

for (const light of ['day', 'night', 'still'] as const) {
  test(`the 988 line with Call and Text on Heart and Root, not elsewhere, in ${light}`, async ({ page }) => {
    await page.clock.install({ time: new Date(light === 'day' ? '2026-11-11T12:00:00' : '2026-11-11T21:30:00') });
    await open(page, '#/flow/c/heart');
    if (light === 'still') await page.getByRole('button', { name: 'Still', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-light', light);
    for (const c of ['heart', 'root']) {
      await page.goto(`/#/flow/c/${c}`);
      await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', c);
      await expect(page.locator('.ck-safe-line')).toBeVisible();
      await expect(page.locator('.ck-safe-line')).toContainText('call or text 988');
      await expect(page.getByRole('link', { name: 'Call 988' })).toHaveAttribute('href', 'tel:988');
      await expect(page.getByRole('link', { name: 'Text 988' })).toHaveAttribute('href', 'sms:988');
      // printed once, not again among the flows' lines
      expect(await page.locator('.ck-page').getByText(/call or text 988/).count()).toBe(1);
      // the touch words stay in Still, with no hue
      await expect(page.locator('.ck-touch')).toHaveCount(4);
    }
    await page.goto('/#/flow/c/crown');
    await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', 'crown');
    await expect(page.locator('.ck-safe')).toHaveCount(0);
  });
}

test('a live episode still shows its step words beside the place, and Done ends it with no checklist at rest', async ({ page }) => {
  await open(page, '#/flow/now');
  await page.locator('.fl-nowlist a[href="#/flow/depress/1"]').click();
  const body = page.locator('.ck-page');
  await expect(body).toHaveAttribute('data-chakra', 'heart');
  await expect(body.locator('.ck-steps .ck-step[aria-current="step"]')).toHaveCount(1);
  await expect(body.locator('.ck-touch')).toHaveCount(4);
  // on the step that prints its own 988 line, the line stays there, once, with Call and Text under it
  await body.locator('.ck-steps .ck-step').nth(3).click();
  await expect(page).toHaveURL(/#\/flow\/depress\/4$/);
  await expect(body).toHaveAttribute('data-saved', 'true');
  await expect(body.locator('[data-tip="depress-4-988"]')).toBeVisible();
  expect(await body.getByText(/call or text 988/).count()).toBe(1);
  await expect(page.getByRole('link', { name: 'Text 988' })).toBeVisible();
  await body.locator('.ck-done').click();
  // #/flow/depress keeps its step words to read, as mountain-fixes left it; nothing is live and no checklist shows
  await expect(body).toHaveAttribute('data-showing', '0');
  await expect(body.locator('.ck-done, .ck-rows')).toHaveCount(0);
});

test('through the door the place shows only the touches that write nothing, no gate, and the 988 line', async ({ page }) => {
  await open(page, '#/journal');
  const tap = async (digits: string, scope = page.locator('body')) => {
    for (const d of digits) await scope.locator('.fs-key', { has: page.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
  };
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[data-sheet="Settings"]');
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const sheet = page.locator('[data-sheet="Set a PIN"]');
  await tap('3569', sheet);
  await sheet.getByRole('button', { name: 'Next' }).click();
  await tap('3569', sheet);
  await expect(settings.getByRole('button', { name: 'Change PIN' })).toBeVisible({ timeout: 15_000 });
  await settings.getByRole('switch', { name: /The ring without the PIN/ }).click();
  await settings.getByRole('button', { name: 'Done' }).click();

  await page.goto('/#/flow/c/root');
  await page.reload();
  const body = page.locator('.ck-page[data-door]');
  await expect(body).toHaveAttribute('data-chakra', 'root');
  await expect(page.getByRole('group', { name: 'PIN' })).toHaveCount(0);
  expect(await body.locator('.ck-touch').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.touch))).toEqual(['five', 'breathe']);
  await expect(body.locator('.ck-touch[data-lit]')).toHaveAttribute('data-touch', 'five');
  await expect(body.locator('.fs-gate, .ck-shelf, .ck-rows, .ck-steps')).toHaveCount(0);
  await expect(body.locator('.ck-gloss')).toHaveText('Root · feeling safe');
  await expect(page.getByRole('link', { name: 'Call 988' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);
  await body.getByRole('button', { name: 'Breathe' }).click();
  await expect(body.getByRole('button', { name: 'Breathe' })).toHaveAttribute('aria-pressed', 'true');
  // a sign with no such touch shows its place and no word; a sign that is not one is the keypad's
  await page.goto('/#/flow/c/throat');
  await expect(page.locator('.ck-page[data-door]')).toHaveAttribute('data-chakra', 'throat');
  await expect(page.locator('.ck-touch')).toHaveCount(0);
  await page.goto('/#/flow/c/spleen');
  await expect(page.getByRole('group', { name: 'PIN' })).toBeVisible();
});
