// Meditate (PLAN-MEDITATE.md, S1 and S2): the Flow list's second row opens #/flow/meditate; a tap on the circle sits
// (the header and the tabs leave, the page says it is sitting) and a tap comes back; the chosen sound and length survive
// a reload offline; with Reduce Motion the circle does not breathe; and "meditate" is never read as a flow's id. S2: a
// sit with an end draws its line and closes on the bell, the page after it links today's page, a sit of a minute or
// more is written and one under it is not, "last sat" shows on the row and the page, and Still shows none of it. The
// sits run on Quiet, whose clock is the page's own, so Playwright's clock can move them on without waiting minutes.
// Nobody can hear a headless browser: the sound itself is the iPhone check in the plan.
import { test, expect, type Page } from '@playwright/test';

/** The sits table, read straight from IndexedDB. */
const sits = (page: Page) => page.evaluate(() => new Promise<Record<string, unknown>[]>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const r = open.result.transaction('sits').objectStore('sits').getAll();
    r.onsuccess = () => { open.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}));
const offset = (page: Page) => page.locator('.md-circle .sat').evaluate(el => Number((el as SVGPathElement).style.strokeDashoffset));

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

test('meditate: the row, a sit and back, the sound kept offline', async ({ page }) => {
  await open(page, '#/flow');
  // the second row of the list, under Right now and above the flows
  const rows = page.locator('.fs-flows > a.fl-flow');
  await expect(rows.nth(0)).toHaveAttribute('href', '#/flow/now');
  await expect(rows.nth(1)).toHaveAttribute('href', '#/flow/meditate');
  await expect(rows.nth(1).locator('.fs-list-line')).toHaveText('Meditate');
  await expect(rows.nth(1).locator('.fs-list-meta')).toHaveText('The circle');
  await expect(rows.nth(1).locator('.fl-mini [data-circle="row"] path.arc')).toHaveCount(1);
  await expect(rows.nth(2)).toHaveAttribute('href', '#/flow/panic');
  await rows.nth(1).click();
  await expect(page).toHaveURL(/#\/flow\/meditate$/);

  // at rest: the circle with "begin", the five chips, rain chosen
  const md = page.locator('.md-page');
  await expect(md).toHaveAttribute('data-state', 'rest');
  const circle = page.getByRole('button', { name: 'Begin' });
  await expect(circle.locator('.md-mid')).toHaveText('begin');
  await expect(page.locator('.md-sounds .fs-chip')).toHaveText(['Rain', 'Ocean', 'Forest', 'Bowl', 'Quiet']);
  await expect(page.getByRole('button', { name: 'Rain' })).toHaveAttribute('aria-pressed', 'true');
  const box = await circle.boundingBox();

  // a tap sits: only the circle is left, in the same place
  await circle.click();
  await expect(md).toHaveAttribute('data-state', 'sitting');
  await expect(page.locator('.fs-app')).toHaveAttribute('data-sitting', 'true');
  const gone = (sel: string) => expect.poll(() => page.locator(sel).first().evaluate(el => getComputedStyle(el).opacity)).toBe('0');
  await gone('.fs-hdr');
  await gone('.fs-tabs');
  await gone('.md-quiet');
  await gone('.md-mid');
  expect(await page.locator('.md-circle').boundingBox()).toEqual(box);
  // the circle is on the sound's clock now, not the CSS breath
  expect(await page.locator('.md-breath').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect.poll(() => page.locator('.md-breath').evaluate(el => el.style.transform)).toMatch(/^scale\(/);
  // the light never changes because of a sit
  const light = await page.locator('html').getAttribute('data-light');

  // a tap comes back
  await page.getByRole('button', { name: 'End the sit' }).click();
  await expect(md).toHaveAttribute('data-state', 'rest');
  await expect(page.locator('.fs-app')).not.toHaveAttribute('data-sitting', /.*/);
  await expect.poll(() => page.locator('.fs-tabs').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  expect(await page.locator('html').getAttribute('data-light')).toBe(light);

  // hidden mid-sit, the sit ends
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(md).toHaveAttribute('data-state', 'sitting');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(md).toHaveAttribute('data-state', 'rest');
  await page.evaluate(() => { delete (document as unknown as Record<string, unknown>).visibilityState; });

  // the ocean and ten minutes, chosen, survive a reload offline
  await page.getByRole('button', { name: '10', exact: true }).click();
  await expect(page.getByRole('button', { name: '10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Ocean' }).click();
  await expect(page.getByRole('button', { name: 'Ocean' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Rain' })).toHaveAttribute('aria-pressed', 'false');
  // written to the settings row before the reload
  await expect.poll(() => page.evaluate(() => new Promise<string | undefined>((resolve, reject) => {
    const open = indexedDB.open('flowstate');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const r = open.result.transaction('settings').objectStore('settings').get('app');
      r.onsuccess = () => { open.result.close(); resolve(r.result?.sitSound); };
      r.onerror = () => reject(r.error);
    };
  }))).toBe('ocean');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.context().setOffline(true);
  await page.reload();
  if (await t.count()) await t.click();
  await expect(page).toHaveURL(/#\/flow\/meditate$/);
  await expect(page.getByRole('button', { name: 'Ocean' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.md-page')).toHaveAttribute('data-sound', 'ocean');
  await expect(page.getByRole('button', { name: '10', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toHaveAttribute('aria-pressed', 'false');

  // a route away mid-sit ends it, and the frame comes back
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('.fs-app')).toHaveAttribute('data-sitting', 'true');
  await page.evaluate(() => { location.hash = '#/flow'; });
  await expect(page.locator('.fs-flows')).toBeVisible();
  await expect(page.locator('.fs-app')).not.toHaveAttribute('data-sitting', /.*/);
});

test('meditate: a sit with an end draws round, the bell closes it, and the page after it writes it down', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 9, 7, 39) });
  // every oscillator's pitch, so the closing bell can be seen to be struck
  await page.addInitScript(() => {
    const w = window as unknown as { __pitches: number[] };
    w.__pitches = [];
    const make = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      const o = make.call(this);
      queueMicrotask(() => w.__pitches.push(o.frequency.value));
      return o;
    };
  });
  await open(page, '#/flow/meditate');
  const md = page.locator('.md-page');
  // at rest: the Minutes chips under the sounds, open chosen; nothing sat yet, so no "last sat"
  await expect(page.locator('.md-lengths .fs-chip')).toHaveText(['Open', '5', '10', '20']);
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.md-quiet .fl-last')).toHaveCount(0);
  await page.getByRole('button', { name: 'Quiet' }).click();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await expect(page.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(md).not.toHaveAttribute('data-ending', /.*/);
  await expect(page.locator('.md-circle .sat')).toBeHidden();
  const box = await page.locator('.md-circle').boundingBox();

  // sitting: the ink line is drawn, nothing of it yet, and it goes round on the sit's clock; no number on screen
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(md).toHaveAttribute('data-state', 'sitting');
  await expect(md).toHaveAttribute('data-ending', 'true');
  await expect.poll(() => offset(page)).toBeGreaterThan(0.99);
  await page.clock.fastForward(150_000);
  await expect.poll(() => offset(page)).toBeLessThan(0.55);
  expect(await offset(page)).toBeGreaterThan(0.45);
  expect(await page.locator('.md-circle').boundingBox()).toEqual(box);
  expect(await md.evaluate(el => /\d/.test((el as HTMLElement).innerText.replace(/Minutes|Open|5|10|20/g, '')))).toBe(false);

  // the circle closes: the bell, the page comes back as the page after the sit, the line lifted
  expect(await page.evaluate(() => (window as unknown as { __pitches: number[] }).__pitches)).not.toContain(528);
  await page.clock.fastForward(155_000);
  await expect(md).toHaveAttribute('data-state', 'after');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pitches: number[] }).__pitches)).toContain(528);
  await expect(md).not.toHaveAttribute('data-ending', /.*/);
  await expect(page.locator('.fs-app')).not.toHaveAttribute('data-sitting', /.*/);
  await expect(page.locator('.md-after .fl-last')).toHaveText('Sat · 5 minutes · quiet');
  await expect(page.locator('.md-quiet')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('button', { name: 'Begin' }).locator('.md-mid')).toHaveText('begin');
  await expect.poll(() => page.locator('.md-circle').boundingBox()).toEqual(box);
  const rows = await sits(page);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ sound: 'quiet', minutes: 5 });

  // "Write it down" opens today's page, linked to the sit both ways
  await page.getByRole('link', { name: /Write it down/ }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fl-journal-link')).toContainText('Sat');
  await expect(page.locator('.fl-journal-link')).toContainText('quiet');
  await expect.poll(async () => (await sits(page))[0].pageId).toBeTruthy();

  // the list row and the page at rest say when the last sit was, a date and a sound
  await page.evaluate(() => { location.hash = '#/flow'; });
  await expect(page.locator('.md-row .fs-list-meta')).toHaveText('The circle · last sat 11 / 9');
  await page.evaluate(() => { location.hash = '#/flow/meditate'; });
  await expect(md).toHaveAttribute('data-state', 'rest');
  await expect(page.locator('.md-quiet .fl-last')).toHaveText('Last sat · 11 / 9 · quiet');
});

test('meditate: an open sit of a minute is kept and comes back after; under a minute is not', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 9, 21, 10) });
  await open(page, '#/flow/meditate');
  const md = page.locator('.md-page');
  await page.getByRole('button', { name: 'Quiet' }).click();
  const box = await page.locator('.md-circle').boundingBox();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(md).not.toHaveAttribute('data-ending', /.*/);
  await page.clock.fastForward(70_000);
  await page.getByRole('button', { name: 'End the sit' }).click();
  await expect(md).toHaveAttribute('data-state', 'after');
  await expect(page.locator('.md-after .fl-last')).toHaveText('Sat · 1 minute · quiet');
  expect(await page.locator('.md-circle').boundingBox()).toEqual(box);
  let rows = await sits(page);
  expect(rows).toHaveLength(1);
  expect(rows[0]).not.toHaveProperty('minutes');

  // the circle on the page after still begins a new sit; this one ends inside its first minute: rest, nothing written
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(md).toHaveAttribute('data-state', 'sitting');
  await page.clock.fastForward(20_000);
  await page.getByRole('button', { name: 'End the sit' }).click();
  await expect(md).toHaveAttribute('data-state', 'rest');
  rows = await sits(page);
  expect(rows).toHaveLength(1);
  await expect(page.locator('.md-quiet .fl-last')).toHaveText('Last sat · 11 / 9 · quiet');

  // a sit of a minute ended by the page being hidden is written too, and leaving the page and coming back is rest
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.clock.fastForward(90_000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(md).toHaveAttribute('data-state', 'after');
  await page.evaluate(() => { delete (document as unknown as Record<string, unknown>).visibilityState; });
  await expect.poll(async () => (await sits(page)).length).toBe(2);
  await page.evaluate(() => { location.hash = '#/flow'; });
  await expect(page.locator('.fs-flows')).toBeVisible();
  await page.evaluate(() => { location.hash = '#/flow/meditate'; });
  await expect(md).toHaveAttribute('data-state', 'rest');
});

test('meditate: in Still a sit is open, and nothing about the last one shows', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 9, 23, 5) });
  await open(page, '#/flow/meditate');
  await page.getByRole('button', { name: 'Quiet' }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  // one sit in Day first, so there is a last one to hide
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.clock.fastForward(65_000);
  await page.getByRole('button', { name: 'End the sit' }).click();
  await expect(page.locator('.md-page')).toHaveAttribute('data-state', 'after');
  await page.evaluate(() => { location.hash = '#/flow'; });
  await expect(page.locator('.md-row .fs-list-meta')).toHaveText('The circle · last sat 11 / 9');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.md-row .fs-list-meta')).toHaveText('The circle · last sat 11 / 9');
  await expect(page.locator('.md-row .fs-list-meta .fs-notstill')).toBeHidden();
  await page.evaluate(() => { location.hash = '#/flow/meditate'; });
  const md = page.locator('.md-page');
  await expect(page.locator('.md-sounds .fs-chip')).toHaveCount(5);
  await expect(page.locator('.md-lengths')).toBeHidden();
  await expect(page.locator('.md-quiet .fl-last')).toBeHidden();
  // ten minutes were chosen, but a sit begun in Still is open: no line, no bell, no page after, still written
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(md).toHaveAttribute('data-state', 'sitting');
  await expect(md).not.toHaveAttribute('data-ending', /.*/);
  await page.clock.fastForward(70_000);
  await page.getByRole('button', { name: 'End the sit' }).click();
  await expect(md).toHaveAttribute('data-state', 'rest');
  await expect(page.locator('.md-after .fl-last')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  const rows = await sits(page);
  expect(rows).toHaveLength(2);
  expect(rows.find(r => !('minutes' in r))).toBeTruthy();
});

test('meditate: in Still the page is the circle and the sounds', async ({ page }) => {
  await open(page, '#/flow/meditate');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  await expect(page.locator('.md-sounds .fs-chip')).toHaveCount(5);
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('.md-page')).toHaveAttribute('data-state', 'sitting');
  await page.getByRole('button', { name: 'End the sit' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
});

test('meditate is not a flow id', async ({ page }) => {
  await open(page, '#/flow/meditate/1');
  await expect(page).toHaveURL(/#\/flow\/meditate$/);
  await expect(page.locator('.md-page')).toBeVisible();
  await expect(page.locator('.fs-flowpage')).toHaveCount(0);
  await expect(page.locator('.fs-hdr-r')).toContainText('Meditate');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the circle does not breathe, at rest or sitting', async ({ page }) => {
    await open(page, '#/flow/meditate');
    const breath = page.locator('.md-breath');
    expect(await breath.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('.md-page')).toHaveAttribute('data-state', 'sitting');
    await page.waitForTimeout(500);
    expect(await breath.evaluate(el => el.style.transform)).toBe('');
    expect(await breath.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    // the frame still leaves, at once
    expect(await page.locator('.fs-tabs').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
  });
});
