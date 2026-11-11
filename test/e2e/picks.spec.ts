// The On sheet (PLAN-PICKS.md P1). Against mocked Spotify (music.spec.ts's pattern): the Poems playlist holds two of
// Under the skin's three albums, so those two are covers and the third, with no kept cover, is a written line. On a live
// episode at Under the skin the On row opens the sheet: two covers, the three lines and the written album, no digits.
// Ticking New Girl writes episodes.on and ticks the row, which reads "An album, or the TV: New Girl"; a cover plays on
// its playlist from its first song and writes episodes.music; offline, a reload keeps the pick. In Still only the covers
// stay. Only Spotify's hosts were ever asked for anything, and the sheet never asks for a cover itself.
import { test, expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

const POEMS = '0T6Gzc2hN81u3vGC5IJZ9a';
const SHOTS = process.env.SHOTS;
const LONESOME = '2ZDjruwuzzzT8JMJRXvLtl';
const HEAD_HEART = '3MhJ8lLj98SPgtiH16ZmXo';

/** A tiny solid PNG, made here, so no image is downloaded from anywhere. */
function png(rgb: [number, number, number], size = 8): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const COLOURS: Record<string, [number, number, number]> = { moss: [96, 128, 84], dusk: [120, 96, 140], blue: [70, 96, 150] };

const track = (uri: string, id: string, name: string, artist: string, cover: string) => ({
  item: { type: 'track', uri, album: { uri: `spotify:album:${id}`, name, images: [{ url: `https://i.scdn.co/image/${cover}`, width: 300 }] }, artists: [{ name: artist }] },
});
const ITEMS = [
  track('spotify:track:p1', 'Other', 'Oneknowing', 'Lena Raine', 'blue'),
  track('spotify:track:p2', LONESOME, 'Lonesome Dreams', 'Lord Huron', 'moss'),
  track('spotify:track:p3', LONESOME, 'Lonesome Dreams', 'Lord Huron', 'moss'),
  track('spotify:track:p4', HEAD_HEART, 'The Head and the Heart', 'The Head And The Heart', 'dusk'),
];

async function mockSpotify(page: Page, base: string, played: string[]) {
  await page.route('https://accounts.spotify.com/authorize**', route => {
    const state = new URL(route.request().url()).searchParams.get('state');
    return route.fulfill({ status: 302, headers: { Location: `${base}/?code=TESTCODE&state=${state}` } });
  });
  await page.route('https://accounts.spotify.com/api/token', route => route.fulfill({ json: { access_token: 'A', refresh_token: 'R', expires_in: 3600 } }));
  await page.route('https://api.spotify.com/v1/**', route => {
    const url = route.request().url();
    if (url.endsWith('/v1/me')) return route.fulfill({ json: { id: 'tommy', display_name: 'Thomas Madden' } });
    if (url.includes('/v1/me/playlists')) {
      return route.fulfill({ json: { next: null, items: [
        { id: POEMS, name: 'For the Poems and the Prose; May They Dance Forever', uri: `spotify:playlist:${POEMS}`, snapshot_id: 's', owner: { id: 'tommy' }, images: [], items: { total: 4 } },
      ] } });
    }
    if (url.includes(`/playlists/${POEMS}/items`)) return route.fulfill({ json: { next: null, items: ITEMS } });
    // a tap asks for the devices first and plays on the phone by its id (PR #49)
    if (url.endsWith('/me/player/devices')) return route.fulfill({ json: { devices: [{ id: 'c7f4', name: 'iPhone', type: 'Smartphone', is_active: false, is_restricted: false }] } });
    if (url.includes('/me/player/play')) { played.push(route.request().postData() ?? ''); return route.fulfill({ status: 204 }); }
    if (url.endsWith('/me/player/currently-playing')) return route.fulfill({ status: 204 });
    return route.fulfill({ status: 404 });
  });
  await page.route('https://i.scdn.co/image/**', route => route.fulfill({
    contentType: 'image/png', body: png(COLOURS[route.request().url().split('/').pop()!] ?? [176, 92, 60]),
  }));
}

type Row = Record<string, unknown> & { id: string };
const all = (page: Page, table: string) => page.evaluate(t => new Promise<Row[]>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const r = open.result.transaction(t).objectStore(t).getAll();
    r.onsuccess = () => { open.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}), table);

async function shoot(page: Page, name: string, target = page.locator('.fs-app')) {
  if (!SHOTS) return;
  for (const l of ['day', 'night', 'still']) {
    await page.evaluate(v => document.documentElement.setAttribute('data-light', v), l);
    await page.waitForTimeout(1400);
    await target.screenshot({ path: `${SHOTS}/${name}-${l}.png` });
  }
  await page.evaluate(() => document.documentElement.setAttribute('data-light', 'day'));
  await page.waitForTimeout(1400);
}

test('the On sheet: covers from the kept cache, lines as check rows, a tick names the row and survives offline, a cover plays', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  // blob: is a kept cover drawn from its bytes, not a request anywhere
  context.on('request', r => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith('blob:')) outside.push(r.url()); });
  await page.goto('/');
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // connect against mocked Spotify; the first read ticks the Poems playlist and keeps its covers
  const played: string[] = [];
  await mockSpotify(page, baseURL!, played);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Music\s*Connect Spotify/ }).click();
  await expect(page.getByText('Connected as Thomas Madden')).toBeVisible();
  await expect(page.getByText(/^reading /)).toHaveCount(0);
  await expect.poll(async () => (await all(page, 'albums')).filter(a => a.cover).map(a => a.albumUri).sort())
    .toEqual([`spotify:album:${HEAD_HEART}`, `spotify:album:${LONESOME}`, 'spotify:album:Other'].sort());
  await page.locator('[data-sheet="Settings"]').getByRole('button', { name: 'Done' }).click();

  // a live episode at Under the skin
  await page.goto('/#/flow/panic');
  const dot = page.getByRole('slider', { name: 'Where you are' }).first();
  await dot.focus();
  for (const n of ['1', '2', '3', '4']) {
    await page.keyboard.press('ArrowRight');
    await expect(dot).toHaveAttribute('aria-valuenow', n);
    await expect(page.locator('.fs-flowpage')).toHaveAttribute('data-saved', 'true');
  }

  // the On row: its word is On, and a tap opens the sheet without ticking it
  const row = page.locator('[data-tip="panic-4-album"] .fs-check');
  await expect(row).toHaveText(/^An album, or the TV\s*On$/);
  await row.click();
  const sheet = page.locator('[data-sheet="An album, or the TV"]');
  await expect(sheet).toBeVisible();
  await expect(row).toHaveAttribute('aria-checked', 'false');
  const tiles = sheet.locator('.fs-tile');
  await expect(tiles).toHaveCount(2);
  expect(await tiles.evaluateAll(x => x.map(e => e.getAttribute('aria-label')))).toEqual(['Lonesome Dreams, Lord Huron', 'The Head and the Heart, The Head And The Heart']);
  await expect.poll(() => tiles.locator('img').evaluateAll(imgs => imgs.map(i => (i as HTMLImageElement).naturalWidth))).toEqual([8, 8]);
  // the album with no kept cover is a written line, after the three
  const lines = sheet.getByRole('checkbox');
  await expect(lines).toHaveText([/^New Girl\s*Show$/, /^Ferris Bueller's Day Off\s*Film$/, /^A Short Hike\s*Switch$/, /^My Head Is An Animal \(The Cabin Sessions\)\s*Album$/]);
  await expect(sheet).not.toContainText(/\d/);
  await expect(sheet.getByRole('button', { name: '♪' })).toBeVisible();
  await shoot(page, 'on-sheet');

  // tick New Girl: episodes.on, the row ticked and reading its pick
  await lines.first().click();
  await expect(lines.first()).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => {
    const e = (await all(page, 'episodes')).find(x => x.flowId === 'panic' && x.endedAt === undefined)!;
    return [(e.on as { pickId: string } | undefined)?.pickId, (e.done as { tipId: string }[]).map(d => d.tipId)];
  }).toEqual(['pk-panic-4-new-girl', ['panic-4-album']]);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(row).toHaveAttribute('aria-checked', 'true');
  await expect(row).toHaveText(/^An album, or the TV: New Girl\s*On$/);
  await shoot(page, 'on-row', page.locator('.fl-tips'));

  // a cover plays as a ♪ tile does: its playlist, from the album's first song; the episode keeps the album
  await row.click();
  await expect(sheet).toBeVisible();
  await expect(lines.first()).toHaveAttribute('aria-checked', 'true');
  await tiles.first().click();
  await expect.poll(() => played.map(b => JSON.parse(b))).toEqual([{ context_uri: `spotify:playlist:${POEMS}`, offset: { uri: 'spotify:track:p2' } }]);
  await expect(tiles.first()).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => ((await all(page, 'episodes')).find(x => x.flowId === 'panic' && x.endedAt === undefined)!.music as { albumUri: string } | undefined)?.albumUri)
    .toBe(`spotify:album:${LONESOME}`);
  await sheet.getByRole('button', { name: 'Done' }).click();

  // offline, a reload keeps the pick on the row
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.fs-flowpage')).toHaveAttribute('data-showing', '4');
  await expect(row).toHaveAttribute('aria-checked', 'true');
  await expect(row).toHaveText(/^An album, or the TV: New Girl\s*On$/);
  // the sheet opens offline from the kept covers, the line still ticked
  await row.click();
  await expect(tiles).toHaveCount(2);
  await expect(lines.first()).toHaveAttribute('aria-checked', 'true');
  // in Still the lines leave and the covers stay
  await page.evaluate(() => document.documentElement.setAttribute('data-light', 'still'));
  await expect(sheet.locator('.fl-tips')).toBeHidden();
  await expect(tiles.first()).toBeVisible();
  await expect(sheet.locator('.fs-tiles')).toBeVisible();

  expect(outside.filter(u => !/^https:\/\/(accounts|api)\.spotify\.com\/|^https:\/\/i\.scdn\.co\/image\//.test(u))).toEqual([]);
  // the sheet asked for no cover: every cover fetched was one the read asked for, before the flow page opened
  expect(outside.filter(u => u.startsWith('https://i.scdn.co/')).sort()).toEqual(['https://i.scdn.co/image/blue', 'https://i.scdn.co/image/dusk', 'https://i.scdn.co/image/moss']);
});

test('make it yours: the step sheet strikes a pick, adds a line with its kind, rewrites the printed line; the On sheet follows', async ({ page }) => {
  await page.goto('/#/flow/depress/4');
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const sheet = page.locator('[data-sheet="The bottom"]');
  await expect(sheet).toBeVisible();
  const printed = sheet.getByRole('textbox', { name: 'What the On sheet says' });
  await expect(printed).toHaveValue('One that keeps you company, then one that lifts.');
  await printed.fill('One that stays.');
  const on = sheet.getByRole('list', { name: 'On' });
  await expect(on.getByRole('listitem')).toHaveText([/^Atlas: I, Sleeping At Last/, /^Carrie & Lowell, Sufjan Stevens/, /^Birthplace, Novo Amor/]);
  // unconnected, "+ album" is not offered (♪ would leave the app); "+ line" is a title and its kind
  await expect(sheet.getByRole('button', { name: '+ album' })).toHaveCount(0);
  await on.getByRole('button', { name: 'Strike Carrie & Lowell, Sufjan Stevens' }).click();
  await sheet.getByRole('button', { name: '+ line' }).click();
  const title = sheet.getByRole('textbox', { name: 'A title' });
  await title.fill('Paddington 2');
  await title.blur();
  await on.getByRole('listitem').last().getByRole('button', { name: 'Show' }).click();
  await sheet.getByRole('group', { name: 'Kind' }).getByRole('button', { name: 'Film' }).click();
  await expect(on.getByRole('listitem')).toHaveText([/^Atlas: I/, /^Birthplace/, /^Paddington 2\s*Film/]);
  // struck, never deleted: Earlier holds it, struck through
  await expect(sheet.locator('.fs-was', { hasText: 'Carrie & Lowell' }).locator('s')).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);

  // the On sheet: the new printed line, no struck cover; unconnected, every album is a written line, and so is his.
  // The bottom is the peak, so its rows come one at a time: Next to the On row.
  const row = page.locator('[data-tip="depress-4-music"] .fs-check');
  for (let k = 0; k < 6 && !(await row.count()); k++) await page.getByRole('button', { name: /^Next/ }).click();
  await row.click({ position: { x: 60, y: 14 } });
  const onSheet = page.locator('[data-sheet="Music you choose"]');
  await expect(onSheet.locator('.fl-said')).toHaveText('One that stays.');
  await expect(onSheet.getByRole('checkbox')).toHaveText([/^Paddington 2\s*Film$/, /^Atlas: I\s*Album$/, /^Birthplace\s*Album$/]);
});
