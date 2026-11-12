// The fixes found walking "the tasks become the water" end to end (PLAN-TASKS.md section 11):
//   the header fits a 390pt and a 375pt phone in all three lights, with "Solar plexus chakra" on it and with the sign a
//   touch carried printed by the date (and with the small cover by the ♪, stood in for here since no Spotify answers);
//   ♪ with no account raises the music sheet on the row that connects, and the page never leaves the app;
//   Root's four lantern words stand clear of each other and of the next lantern, inside the screen.
import { test, expect, type Page } from '@playwright/test';

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

/** Nothing in the header reaches past the page's gutters, the two sides do not touch, and the page does not scroll sideways. */
const fits = async (page: Page, what: string) => {
  const m = await page.evaluate(() => {
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width }; };
    const hdr = document.querySelector('.fs-hdr')!;
    const left = [...hdr.querySelectorAll('.fs-hdr-l > *')].map(box).filter(b => b.w > 0);
    const right = [...hdr.querySelectorAll('.fs-hdr-r > *')].map(box).filter(b => b.w > 0);
    return {
      vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, hsw: hdr.scrollWidth,
      gutter: parseFloat(getComputedStyle(hdr).paddingRight),
      leftEnd: Math.max(...left.map(b => b.r)), rightStart: Math.min(...right.map(b => b.l)), rightEnd: Math.max(...right.map(b => b.r)),
    };
  });
  expect(m.sw, `${what}: the page scrolls sideways`).toBeLessThanOrEqual(m.vw);
  expect(m.hsw, `${what}: the header overflows`).toBeLessThanOrEqual(m.vw);
  expect(m.rightEnd, `${what}: the date reaches into the gutter`).toBeLessThanOrEqual(m.vw - m.gutter + 0.5);
  expect(m.leftEnd, `${what}: the header's two sides touch`).toBeLessThanOrEqual(m.rightStart);
};

const LIGHTS = ['day', 'night', 'still'] as const;
const relight = (page: Page, l: string) => page.evaluate(x => document.documentElement.setAttribute('data-light', x), l);
/** The small cover by the ♪ (MusicLine's .fs-mini), stood in for: it shows only while Spotify is playing. */
const cover = (page: Page) => page.evaluate(() => {
  const b = document.createElement('button');
  b.className = 'fs-mini';
  b.append(document.createElement('span'));
  document.querySelector('.fs-hdr-l')!.append(b);
});

for (const width of [390, 375]) {
  test.describe(`${width}pt wide`, () => {
    test.use({ viewport: { width, height: 844 } });

    test('the header fits with "Solar plexus chakra" on it, in every light, with and without the cover', async ({ page }) => {
      await open(page, '#/flow/c/solar-plexus');
      await expect(page.locator('.fs-hdr-label')).toHaveText('Solar plexus chakra');
      // the way back takes Settings' place on a sign's page; the ♪ stays
      await expect(page.locator('.fs-hdr').getByRole('button', { name: 'Settings' })).toHaveCount(0);
      await expect(page.locator('.fs-hdr').getByRole('button', { name: 'Music', exact: true })).toBeVisible();
      for (const l of LIGHTS) { await relight(page, l); await fits(page, `solar plexus, ${l}`); }
      await cover(page);
      for (const l of LIGHTS) { await relight(page, l); await fits(page, `solar plexus with a cover, ${l}`); }
      await page.screenshot({ path: `test-results/fixes-header-solar-${width}.png`, clip: { x: 0, y: 0, width, height: 80 } });
    });

    test('the header fits with a carried sign by the date, in every light, with and without the cover', async ({ page }) => {
      await open(page, '#/flow/c/third-eye');
      await page.getByRole('button', { name: 'Ask, Journal' }).click();
      const rule = page.locator('.ck-stage [data-into="ask"] input');
      await rule.pressSequentially('What am I not seeing?', { delay: 2 });
      await rule.press('Enter');
      await expect(page).toHaveURL(/#\/journal$/);
      const sign = page.locator('.fs-hdr-r [data-sign-back="third-eye"]');
      await expect(sign).toBeVisible();
      for (const l of LIGHTS) { await relight(page, l); await expect(sign).toBeVisible(); await fits(page, `journal with the sign, ${l}`); }
      await cover(page);
      for (const l of LIGHTS) { await relight(page, l); await fits(page, `journal with the sign and a cover, ${l}`); }
      // the cover is still whole: its target gave, not the cover
      const c = (await page.locator('.fs-hdr-l > .fs-mini span').boundingBox())!;
      const b = (await page.locator('.fs-hdr-l > .fs-mini').boundingBox())!;
      expect(c.width).toBeGreaterThanOrEqual(24);
      expect(b.width).toBeGreaterThanOrEqual(c.width);
      await page.screenshot({ path: `test-results/fixes-header-sign-${width}.png`, clip: { x: 0, y: 0, width, height: 80 } });
    });

    test('Root, Basics: the four lantern words stand clear of each other, of the other lanterns and of the screen\'s edges', async ({ page }) => {
      await open(page, '#/flow/c/root');
      await page.locator('.ck-touch[data-touch="basics"]').click();
      await expect(page.locator('.pl-lantern')).toHaveCount(4);
      const m = await page.evaluate(() => [...document.querySelectorAll('.pl-lantern')].map(el => {
        const r = (e: Element) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
        return { id: el.getAttribute('data-basic'), word: r(el.querySelector('.pl-lantern-word')!), body: r(el.querySelector('.pl-body')!) };
      }));
      const apart = (a: { l: number; r: number; t: number; b: number }, b: typeof a, by: number) =>
        a.r + by <= b.l || b.r + by <= a.l || a.b + by <= b.t || b.b + by <= a.t;
      for (const a of m) {
        expect(a.word.l, `${a.id} at the left edge`).toBeGreaterThanOrEqual(8);
        expect(a.word.r, `${a.id} at the right edge`).toBeLessThanOrEqual(width - 8);
        for (const b of m) {
          if (a === b) continue;
          expect(apart(a.word, b.word, 8), `${a.id} and ${b.id}: the words`).toBe(true);
          expect(apart(a.word, b.body, 4), `${a.id} on ${b.id}'s lantern`).toBe(true);
        }
      }
      // and clear of the plate's own touch words
      const touches = await page.evaluate(() => [...document.querySelectorAll('.ck-touch')].map(e => {
        const range = document.createRange(); range.selectNodeContents(e);
        const b = range.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom };
      }));
      for (const a of m) for (const t of touches) expect(apart(a.word, t, 2), `${a.id} on a touch word`).toBe(true);
      await page.screenshot({ path: `test-results/fixes-root-basics-${width}.png`, clip: { x: 0, y: 0, width, height: 420 } });
    });
  });
}

test('♪ with no account: the music sheet rises on the row that connects, and the page stays in the app', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });
  const left: string[] = [];
  page.on('framenavigated', f => { if (f === page.mainFrame() && !f.url().startsWith(baseURL!)) left.push(f.url()); });
  for (const hash of ['#/journal', '#/flow/c/sacral']) {
    await open(page, hash);
    await page.getByRole('button', { name: 'Music', exact: true }).click();
    const sheet = page.locator('[data-sheet="Playlists"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: /Music\s*Connect Spotify/ })).toBeVisible();
    // Signs is there with no account too: the seven shelves
    await sheet.getByRole('button', { name: 'Signs' }).click();
    await expect(page.locator('[data-sheet="Signs"] .ck-sign-row')).toHaveCount(7);
    // longer than the old hop to the web player waited (1.2 s) before it went
    await page.waitForTimeout(1600);
    expect(page.url()).toBe(`${baseURL}/${hash}`);
    await page.locator('[data-sheet="Signs"]').getByRole('button', { name: 'Playlists' }).click();
    await page.locator('[data-sheet="Playlists"]').getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('[data-sheet="Playlists"]')).toHaveCount(0);
  }
  expect(left).toEqual([]);
  expect(outside).toEqual([]);
});
