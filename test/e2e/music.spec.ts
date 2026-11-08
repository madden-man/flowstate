// The music tie-in (package 7, V7). With no account the ♪ line is a navigation to the Poems playlist,
// asserted and not followed. Then a Spotify sign-in against mocked Spotify endpoints: the app's own connect
// flow and store write the tokens, /me/playlists lists three owned playlists (and one of someone else's,
// left out), the Poems playlist is ticked by the first read, and Settings ticks master (ii). ♪ opens on the
// list of the two, each with its strip of covers; a name opens its grid in first-song order; a tile plays on
// that playlist's context_uri. Settings ticks the third and its grid appears. With the network off, ♪ still
// opens the list and the grids from the kept covers, a tapped tile does not throw, and the page that heard an
// album shows its cover and lists its pages. Only Spotify's hosts were ever asked for anything.
import { test, expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

const POEMS = '0T6Gzc2hN81u3vGC5IJZ9a';
const PLAYLIST_WEB = `https://open.spotify.com/playlist/${POEMS}`;
const SHOTS = process.env.SHOTS;

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

const track = (uri: string, album: string, artist: string, cover: string) => ({
  item: { type: 'track', uri, album: { uri: `spotify:album:${album}`, name: album, images: [{ url: `https://i.scdn.co/image/${cover}`, width: 640 }] }, artists: [{ name: artist }] },
});
const COLOURS: Record<string, [number, number, number]> = { blue: [70, 96, 150], ember: [176, 92, 60], moss: [96, 128, 84], dusk: [120, 96, 140], sand: [190, 170, 120] };

const listed = (id: string, name: string, owner = 'tommy', count: object = { items: { total: 3 } }) => ({
  id, name, uri: `spotify:playlist:${id}`, snapshot_id: `snap-${id}`, owner: { id: owner }, images: [], ...count,
});
const ITEMS: Record<string, object[]> = {
  [POEMS]: [
    track('spotify:track:1', 'Oneknowing', 'Lena Raine', 'blue'), track('spotify:track:2', 'Oneknowing', 'Lena Raine', 'blue'),
    track('spotify:track:3', 'Pagan', 'CLANN', 'ember'),
  ],
  M: [
    track('spotify:track:m1', 'Takk', 'Sigur Rós', 'moss'), track('spotify:track:m2', 'Pagan', 'CLANN', 'ember'),
    track('spotify:track:m3', 'Takk', 'Sigur Rós', 'moss'), track('spotify:track:m4', 'Oneknowing', 'Lena Raine', 'blue'),
    track('spotify:track:m5', 'Range of Light', 'S. Carey', 'dusk'),
  ],
  S: [track('spotify:track:s1', 'brillion.', 'brillion.', 'sand'), track('spotify:track:s2', 'Takk', 'Sigur Rós', 'moss')],
};

async function mockSpotify(page: Page, base: string, playing: () => object | null, played: string[]) {
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
        listed('M', 'master (ii)', 'tommy', { items: { total: 3120 } }), listed(POEMS, 'For the Poems and the Prose; May They Dance Forever'),
        listed('X', 'Someone else\'s', 'someone'), listed('S', 'staging', 'tommy', { tracks: { total: 2 } }),
      ] } });
    }
    const items = url.match(/\/playlists\/(\w+)\/items/);
    if (items) return route.fulfill({ json: { next: null, items: ITEMS[items[1]] ?? [] } });
    if (url.endsWith('/me/player/play')) { played.push(route.request().postData() ?? ''); return route.fulfill({ status: 204 }); }
    if (url.endsWith('/me/player/currently-playing')) {
      const p = playing();
      return p ? route.fulfill({ json: p }) : route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 404 });
  });
  await page.route('https://i.scdn.co/image/**', route => route.fulfill({
    contentType: 'image/png', body: png(COLOURS[route.request().url().split('/').pop()!] ?? [176, 92, 60]),
  }));
}

async function shoot(page: Page, name: string, target = page.locator('.fs-app')) {
  if (!SHOTS) return;
  for (const l of ['day', 'night', 'still']) {
    await page.evaluate(v => document.documentElement.setAttribute('data-light', v), l);
    await page.waitForTimeout(1400);
    await target.screenshot({ path: `${SHOTS}/${name}-${l}.png` });
  }
}

test('the ♪ line: a link with no account; connected, a list of playlists, each grid plays on its own, offline from kept covers', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  const errors: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // ---- no account: ♪ is a navigation to the Poems playlist, never a fetch. Asserted, not followed.
  const web: string[] = [];
  await page.route('https://open.spotify.com/**', route => { web.push(route.request().url()); return route.fulfill({ status: 204 }); });
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect.poll(() => web).toEqual([PLAYLIST_WEB]);
  await expect(page.locator('[data-sheet="Playlists"]')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/journal$/);

  // ---- connect against mocked Spotify: the code comes back, the URL is cleaned, Settings shows the account
  let nowPlaying: object | null = null;
  const played: string[] = [];
  await mockSpotify(page, baseURL!, () => nowPlaying, played);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Music\s*Connect Spotify/ }).click();
  await expect(page.getByText('Connected as Thomas Madden')).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/#/journal`);
  await expect(page.getByRole('button', { name: /Refresh playlist/ })).toHaveCount(0);
  await expect(page.getByText(/^reading /)).toHaveCount(0);
  await shoot(page, 'settings-music', page.locator('[data-sheet="Settings"]'));

  // ---- Settings, Playlists: every owned playlist with a drawn check, Poems ticked by the first read; tick master (ii)
  await page.getByRole('button', { name: /^Playlists/ }).click();
  const mine = page.locator('[data-sheet="Your playlists"]');
  await expect(mine).toBeVisible();
  await expect(mine.getByRole('checkbox')).toHaveText(['master (ii)', 'For the Poems and the Prose; May They Dance Forever', 'staging']);
  await expect(mine.getByRole('checkbox', { name: 'For the Poems and the Prose; May They Dance Forever' })).toHaveAttribute('aria-checked', 'true');
  await expect(mine.getByRole('checkbox', { name: 'master (ii)' })).toHaveAttribute('aria-checked', 'false');
  await mine.getByRole('checkbox', { name: 'master (ii)' }).click();
  await expect(mine.getByRole('checkbox', { name: 'master (ii)' })).toHaveAttribute('aria-checked', 'true');
  await expect(mine.getByText(/^reading /)).toHaveCount(0);
  await shoot(page, 'settings-playlists', mine);
  await mine.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('[data-sheet="Settings"]')).toBeVisible();
  await page.locator('[data-sheet="Settings"]').getByRole('button', { name: 'Done' }).click();

  // ---- ♪: the list of the two chosen, in Spotify's order, each with its strip of covers; no counts
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  const list = page.locator('[data-sheet="Playlists"]');
  await expect(list).toBeVisible();
  const rows = list.locator('.fs-playlist');
  await expect(rows.locator('.fs-playlist-name')).toHaveText(['master (ii)', 'For the Poems and the Prose; May They Dance Forever']);
  await expect(rows.nth(0).locator('.fs-strip img')).toHaveCount(4);
  await expect(rows.nth(1).locator('.fs-strip img')).toHaveCount(2);
  await expect(list).not.toContainText(/\d/);
  await shoot(page, 'music-list');

  // a name opens its grid in first-song order; a tile plays that playlist from the album's first song
  await rows.nth(0).click();
  const grid = page.locator('[data-sheet="master (ii)"]');
  await expect(grid).toBeVisible();
  await expect(grid.locator('.fs-tile')).toHaveCount(4);
  expect(await grid.locator('.fs-tile').evaluateAll(t => t.map(x => x.getAttribute('aria-label')))).toEqual(['Takk, Sigur Rós', 'Pagan, CLANN', 'Oneknowing, Lena Raine', 'Range of Light, S. Carey']);
  await grid.locator('.fs-tile').nth(1).click();
  await expect.poll(() => played.map(b => JSON.parse(b))).toEqual([{ context_uri: 'spotify:playlist:M', offset: { uri: 'spotify:track:m2' } }]);
  await expect(grid.locator('.fs-tile').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await shoot(page, 'music-grid');
  // Playlists at the head goes back; the playing playlist carries the small cover
  await grid.getByRole('button', { name: 'Playlists' }).click();
  await expect(list).toBeVisible();
  await expect(rows.nth(0).locator('.fs-playlist-now')).toBeVisible();
  await list.getByRole('button', { name: 'Done' }).click();

  // ---- Settings ticks the third: its grid appears under ♪
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /^Playlists/ }).click();
  await mine.getByRole('checkbox', { name: 'staging' }).click();
  await expect(mine.getByRole('checkbox', { name: 'staging' })).toHaveAttribute('aria-checked', 'true');
  await expect(mine.getByText(/^reading /)).toHaveCount(0);
  await mine.getByRole('button', { name: 'Done' }).click();
  await page.locator('[data-sheet="Settings"]').getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(rows.locator('.fs-playlist-name')).toHaveText(['master (ii)', 'For the Poems and the Prose; May They Dance Forever', 'staging']);
  await rows.nth(2).click();
  const staging = page.locator('[data-sheet="staging"]');
  await expect(staging.locator('.fs-tile')).toHaveCount(2);
  expect(await staging.locator('.fs-tile').evaluateAll(t => t.map(x => x.getAttribute('aria-label')))).toEqual(['brillion., brillion.', 'Takk, Sigur Rós']);
  await staging.locator('.fs-tile').first().click();
  await expect.poll(() => played.length).toBe(2);
  expect(JSON.parse(played[1]).context_uri).toBe('spotify:playlist:S');
  await staging.getByRole('button', { name: 'Done' }).click();

  // a page open while an album plays remembers it
  nowPlaying = { is_playing: true, context: { uri: `spotify:playlist:${POEMS}` }, item: { album: { uri: 'spotify:album:Pagan', name: 'Pagan', images: [{ url: 'https://i.scdn.co/image/ember', width: 300 }] }, artists: [{ name: 'CLANN' }] } };
  const today = page.getByRole('textbox', { name: "Today's page" });
  await today.click();
  await today.pressSequentially('Listen to the quiet voices within.', { delay: 2 });
  await today.press('Enter');
  await expect(page.locator('.fs-hdr [data-mini="spotify:album:Pagan"] img')).toBeVisible();

  // ---- the network off
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.fs-msg', { hasText: 'Listen to the quiet voices within.' })).toBeVisible();
  await expect(page.locator('.fs-hdr [data-mini="spotify:album:Pagan"] img')).toBeVisible();

  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(list).toBeVisible();
  await expect(rows).toHaveCount(3);
  await rows.nth(1).click();
  const sheet = page.locator('[data-sheet="For the Poems and the Prose; May They Dance Forever"]');
  await expect(sheet).toBeVisible();
  const tiles = sheet.locator('.fs-tile');
  await expect(tiles).toHaveCount(2);
  await expect(tiles.first()).toHaveAttribute('aria-label', 'Oneknowing, Lena Raine');
  await expect.poll(() => tiles.locator('img').evaluateAll(imgs => imgs.map(i => (i as HTMLImageElement).naturalWidth))).toEqual([8, 8]);
  await tiles.first().click();
  await expect(sheet.getByRole('status')).toHaveText('No connection to Spotify');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  // ♪ opens on the list again, every time
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(list).toBeVisible();
  await list.getByRole('button', { name: 'Done' }).click();
  await expect(list).toHaveCount(0);

  // long press the small cover: the pages that heard Pagan
  const mini = page.locator('.fs-hdr [data-mini="spotify:album:Pagan"]');
  const box = (await mini.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  const pages = page.locator('[data-sheet="Pages with this album"]');
  await expect(pages).toBeVisible();
  await expect(pages.getByRole('link')).toHaveText([/Listen to the quiet voices within\./]);
  await shoot(page, 'album-pages');

  expect(errors).toEqual([]);
  // the ♪ line's first move was the spotify: URI (a navigation the browser hands to the app); covers are
  // local blob: URLs; everything else that left the origin went to Spotify, mocked
  expect(outside).toContain(`spotify:playlist:${POEMS}`);
  expect(outside.filter(u => !u.startsWith(`blob:${baseURL}/`) && !u.startsWith('spotify:playlist:')
    && !/^https:\/\/(accounts|api|open)\.spotify\.com\/|^https:\/\/i\.scdn\.co\//.test(u))).toEqual([]);
});
