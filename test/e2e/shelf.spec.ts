// A sign's shelf with no Spotify account (PLAN-TASKS.md section 4; Mountain R4), in the production build, on the Heart
// (its 988 line is printed under the shelf). Four things the first end-to-end walk found or R4 adds:
//   room: the shelf holds its height before it has been read, so the 988 line never moves, and a shelf he has added
//     lines to holds that much on the next load;
//   covers: an album whose cover was kept shows it with no account; one with none is the empty tile with its title on
//     it, never a written row, and the plus is there to write a line with;
//   books and art: the plus raises a small sheet, a title written there under Book or Art is a line on the shelf, kept
//     over a reload, and a long press then the struck place takes it off;
//   lifted: a long press rings the cover in ink and dims the rest, by Day and by Night, and does nothing in Still.
// SHOTS=dir also writes 390x844 screenshots of each state in the three lights.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = process.env.SHOTS;
const TIMES = { day: '2026-11-11T12:00:00', night: '2026-11-11T21:30:00' } as const;
type Light = 'day' | 'night' | 'still';
const HEART = [
  { id: '1E9iqjfSf5I5hPNfI1DRIh', title: 'Atlas: I', by: 'Sleeping At Last', file: 'c-heart-1.jpg' },
  { id: '0U8DeqqKDgIhIiWOdqiQXE', title: 'Carrie & Lowell', by: 'Sufjan Stevens', file: 'c-heart-2.jpg' },
  { id: '0tWckYjFI6ioZptLr42J3p', title: 'Birthplace', by: 'Novo Amor', file: 'c-heart-3.jpg' },
];

test.use({ viewport: { width: 390, height: 844 } });

/** Records, at every change to the page, where the 988 line stands and whether the shelf is still waiting to be read. */
const watch = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as { __tops: { top: number; wait: boolean }[] };
  w.__tops = [];
  const look = () => {
    const line = document.querySelector('.ck-safe-line');
    if (!line) return;
    const top = Math.round(line.getBoundingClientRect().top + scrollY);
    const wait = !!document.querySelector('.ck-shelf.wait');
    const last = w.__tops[w.__tops.length - 1];
    if (!last || last.top !== top || last.wait !== wait) w.__tops.push({ top, wait });
  };
  new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true });
  const frame = () => { look(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
});
const tops = (page: Page) => page.evaluate(() => (window as unknown as { __tops: { top: number; wait: boolean }[] }).__tops);

async function enter(page: Page, light: Light = 'day') {
  await page.clock.install({ time: new Date(light === 'day' ? TIMES.day : TIMES.night) });
  await page.goto('/#/flow/c/heart');
  await page.locator('.fs-page').first().waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
  await expect(page.locator('[data-shelf="heart"]')).toBeVisible();
  if (light === 'still') {
    await page.getByRole('button', { name: 'Still', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  } else await expect(page.locator('html')).toHaveAttribute('data-light', light);
}

/** Into Still by the moon, from Day or Night. */
async function toStill(page: Page) {
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
}

/** The page again after a reload, past the threshold. */
async function again(page: Page) {
  await page.reload();
  await page.locator('.fs-page').first().waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(page.locator('[data-shelf="heart"]')).toBeVisible();
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.locator('[data-shelf="heart"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

/** Keeps the Heart's three covers as the ♪ grid would have, with no account. */
async function keepCovers(page: Page) {
  const albums = HEART.map(a => ({ ...a, b64: fs.readFileSync(path.join(process.cwd(), 'design/tasks', a.file)).toString('base64') }));
  await page.evaluate(async list => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const o = indexedDB.open('flowstate'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
    const tx = db.transaction(['albums'], 'readwrite');
    for (const a of list) {
      const bin = Uint8Array.from(atob(a.b64), c => c.charCodeAt(0));
      tx.objectStore('albums').put({ albumUri: `spotify:album:${a.id}`, album: a.title, artist: a.by, cover: bin.buffer, coverType: 'image/jpeg', coverAt: Date.now() });
    }
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, albums);
}

/** A long press on a thing on the shelf, let go where it was: it stays lifted. */
async function hold(page: Page, pick: ReturnType<Page['locator']>) {
  const box = (await pick.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(pick).toHaveClass(/\blift\b/);
  await page.mouse.up();
}

async function addLine(page: Page, title: string, kind: 'Book' | 'Art') {
  await page.getByRole('button', { name: 'Add to the shelf' }).click();
  const sheet = page.locator('[data-sheet="On the shelf"]');
  await expect(sheet).toBeVisible();
  // nothing to add until something is written
  await expect(sheet.getByRole('button', { name: 'Add', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await sheet.getByLabel('A title').fill(title);
  await sheet.getByRole('button', { name: kind, exact: true }).click();
  await expect(sheet.getByRole('button', { name: kind, exact: true })).toHaveAttribute('aria-pressed', 'true');
  return sheet;
}

test('the shelf holds its room from first paint: the 988 line never moves', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await watch(page);
  await enter(page);
  await expect(page.locator('[data-shelf="heart"] .fs-tile')).toHaveCount(3);
  await page.waitForTimeout(400);
  let seen = await tops(page);
  // the line was on the page while the shelf was still unread, and it stood where it stands now
  expect(seen.some(s => s.wait), JSON.stringify(seen)).toBe(true);
  expect(new Set(seen.map(s => s.top)).size, JSON.stringify(seen)).toBe(1);

  // a shelf he has written two lines on holds that much on the next load
  await (await addLine(page, 'The Remains of the Day', 'Book')).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.ck-shelf-line')).toHaveCount(1);
  await (await addLine(page, 'Nighthawks', 'Art')).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.ck-shelf-line')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('fs-shelf-room') ?? '{}').heart)).toEqual({ rows: 1, lines: 2 });
  await again(page);
  await expect(page.locator('.ck-shelf-line')).toHaveCount(2);
  await page.waitForTimeout(400);
  seen = await tops(page);
  expect(seen.some(s => s.wait), JSON.stringify(seen)).toBe(true);
  expect(new Set(seen.map(s => s.top)).size, JSON.stringify(seen)).toBe(1);
  expect(errors).toEqual([]);
});

test('with no account: a title on an empty tile where no cover is kept, the cover where one is, never a written row', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith('blob:')) outside.push(r.url()); });
  await enter(page);
  const shelf = page.locator('[data-shelf="heart"]');
  // the three starters: tiles in the shelf's rhythm, each with its title on it and its name for a reader, then the plus
  await expect(shelf.locator('.ck-shelf-cover.blank')).toHaveCount(3);
  await expect(shelf.locator('.ck-shelf-name')).toHaveText(HEART.map(a => a.title));
  await expect(shelf.locator('.fs-tile')).toHaveCount(3);
  await expect(shelf.locator('.fs-tile img')).toHaveCount(0);
  await expect(shelf.getByRole('button', { name: 'Atlas: I, Sleeping At Last' })).toBeVisible();
  await expect(shelf.locator('.ck-shelf-line')).toHaveCount(0);
  await expect(shelf.locator('.ck-shelf-plus')).toBeVisible();
  const size = await shelf.locator('.ck-shelf-cover').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  expect(size).toEqual([[66, 66], [66, 66], [66, 66]]);

  // covers kept on the phone show with no account
  await keepCovers(page);
  await again(page);
  await expect(shelf.locator('.fs-tile img')).toHaveCount(3);
  await expect(shelf.locator('.ck-shelf-cover.blank')).toHaveCount(0);
  await expect(shelf.locator('.ck-shelf-covers')).toHaveText('+');
  // Still: the covers stay and the plus leaves
  await toStill(page);
  await expect(shelf.locator('.fs-tile img')).toHaveCount(3);
  await expect(shelf.locator('.ck-shelf-plus')).toBeHidden();
  expect(outside).toEqual([]);
});

test('a book and a piece of art are written on the shelf from its plus, and taken off as a cover is', async ({ page }) => {
  await enter(page);
  await keepCovers(page);
  const shelf = page.locator('[data-shelf="heart"]');
  let sheet = await addLine(page, 'The Remains of the Day', 'Book');
  // with no account the sheet offers the written kinds only
  await expect(sheet.locator('.fs-opt')).toHaveText(['Book', 'Art', 'Show', 'Film', 'Switch', 'Phone']);
  await expect(sheet.getByRole('button', { name: '+ album' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  sheet = await addLine(page, 'Nighthawks', 'Art');
  await sheet.getByLabel('A title').press('Enter');
  await expect(shelf.locator('.ck-shelf-line')).toHaveText(['The Remains of the Day Book', 'Nighthawks Art']);

  // kept: there after a reload, under the covers
  await again(page);
  await expect(shelf.locator('.ck-shelf-line')).toHaveText(['The Remains of the Day Book', 'Nighthawks Art']);
  await expect(shelf.locator('.fs-tile img')).toHaveCount(3);

  // a long press lifts the book; the struck place takes it off
  const book = shelf.locator('.ck-shelf-linecell', { hasText: 'The Remains of the Day' });
  await hold(page, book);
  await shelf.getByRole('button', { name: 'Off the shelf' }).click();
  await expect(shelf.locator('.ck-shelf-line')).toHaveText(['Nighthawks Art']);
  // and the art by its keys
  await shelf.locator('.ck-shelf-line').focus();
  await page.keyboard.press('Delete');
  await expect(shelf.locator('.ck-shelf-line')).toHaveCount(0);
  await again(page);
  await expect(shelf.locator('.fs-tile')).toHaveCount(3);
  await expect(shelf.locator('.ck-shelf-line')).toHaveCount(0);
});

test('in Still the empty tiles stay as covers do; their titles, the written lines and the plus leave', async ({ page }) => {
  await enter(page, 'night');
  const shelf = page.locator('[data-shelf="heart"]');
  await (await addLine(page, 'Nighthawks', 'Art')).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(shelf.locator('.ck-shelf-line')).toHaveText(['Nighthawks Art']);
  const before = await page.locator('.ck-safe-line').evaluate(el => el.getBoundingClientRect().top + scrollY);
  await toStill(page);
  await expect(shelf.locator('.fs-tile')).toHaveCount(3);
  await expect(shelf.locator('.ck-shelf-name').first()).toBeHidden();
  await expect(shelf.locator('.ck-shelf-line')).toBeHidden();
  await expect(shelf.locator('.ck-shelf-plus')).toBeHidden();
  // the row of tiles is still the shelf's room
  expect((await shelf.boundingBox())!.height).toBeGreaterThanOrEqual(66);
  expect(before).toBeGreaterThan(0);
});

for (const light of ['day', 'night'] as const) {
  test(`a lifted cover is ringed in ink and the rest dim, by ${light}`, async ({ page }) => {
    await enter(page, light);
    await keepCovers(page);
    await again(page);
    const shelf = page.locator('[data-shelf="heart"]');
    await expect(shelf.locator('.fs-tile img')).toHaveCount(3);
    const cells = shelf.locator('.ck-shelf-cover');
    await hold(page, cells.nth(1));
    const ink = await page.evaluate(() => { const p = document.createElement('p'); p.style.color = 'var(--ink)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
    const ring = await cells.nth(1).locator('.fs-tile').evaluate(el => { const s = getComputedStyle(el); return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor }; });
    expect(ring).toEqual({ style: 'solid', width: '2px', color: ink });
    await expect(cells.nth(0)).toHaveCSS('opacity', '0.45');
    await expect(cells.nth(2)).toHaveCSS('opacity', '0.45');
    await expect(cells.nth(1)).toHaveCSS('opacity', '1');
    // the place the plus held is struck, in ink
    await expect(shelf.locator('.ck-shelf-plus')).toHaveCount(0);
    await expect(shelf.locator('.ck-shelf-off')).toBeVisible();
    // a tap on itself puts it down, and nothing was taken off
    await cells.nth(1).click();
    await expect(shelf.locator('.lift')).toHaveCount(0);
    await expect(cells.nth(0)).toHaveCSS('opacity', '1');
    await expect(shelf.locator('.fs-tile')).toHaveCount(3);
  });
}

test('in Still nothing lifts, and a cover lifted when the light turns is put down', async ({ page }) => {
  await enter(page, 'night');
  await keepCovers(page);
  await again(page);
  const shelf = page.locator('[data-shelf="heart"]');
  const cells = shelf.locator('.ck-shelf-cover');
  await expect(shelf.locator('.fs-tile img')).toHaveCount(3);
  await hold(page, cells.nth(0));
  await toStill(page);
  await expect(shelf.locator('.lift')).toHaveCount(0);
  await expect(shelf.locator('.ck-shelf-off')).toHaveCount(0);
  const box = (await cells.nth(0).boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await expect(shelf.locator('.lift')).toHaveCount(0);
  await page.mouse.up();
  await expect(shelf.locator('.fs-tile')).toHaveCount(3);
});

// The looks, for a reader: SHOTS=dir writes each state at 390x844 in the three lights. Not run otherwise.
for (const light of ['day', 'night', 'still'] as const) {
  const lit = light === 'still' ? 'night' : light;
  test(`looks: no cover kept, in ${light}`, async ({ page }) => {
    test.skip(!SHOTS, 'screenshots only when SHOTS is set');
    await enter(page, lit);
    if (light === 'still') await toStill(page);
    await shot(page, `blank-${light}`);
  });
  test(`looks: covers, a book and a piece of art, lifted, in ${light}`, async ({ page }) => {
    test.skip(!SHOTS, 'screenshots only when SHOTS is set');
    const shelf = page.locator('[data-shelf="heart"]');
    await enter(page, lit);
    await keepCovers(page);
    await again(page);
    const sheet = await addLine(page, 'The Remains of the Day', 'Book');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS!, `add-sheet-${light}.png`) });
    await sheet.getByRole('button', { name: 'Add', exact: true }).click();
    await (await addLine(page, 'Nighthawks', 'Art')).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(shelf.locator('.ck-shelf-line')).toHaveCount(2);
    await expect(page.locator('[data-sheet="On the shelf"]')).toHaveCount(0);
    if (light === 'still') { await toStill(page); await shot(page, 'lines-still'); return; }
    await shot(page, `lines-${light}`);
    await hold(page, shelf.locator('.ck-shelf-cover').nth(1));
    await shot(page, `lifted-${light}`);
    await page.keyboard.press('Escape');
    await hold(page, shelf.locator('.ck-shelf-linecell').first());
    await shot(page, `line-lifted-${light}`);
  });
}
