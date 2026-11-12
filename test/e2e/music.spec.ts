// The music tie-in (package 7, V7). With no account the ♪ line raises the sheet on the row that connects
// and the page stays in the app. Then a Spotify sign-in against mocked Spotify endpoints: the app's own connect
// flow and store write the tokens, /me/playlists lists three owned playlists (and one of someone else's,
// left out), the Poems playlist is ticked by the first read, and Settings ticks master (ii). ♪ opens on the
// list of the two, each with its strip of covers; a name opens its grid in first-song order; a tile plays on
// that playlist's context_uri. Settings ticks the third and its grid appears. With the network off, ♪ still
// opens the list and the grids from the kept covers, a tapped tile does not throw, and the page that heard an
// album shows its cover and lists its pages. Only Spotify's hosts were ever asked for anything.
import { test, expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

const POEMS = '0T6Gzc2hN81u3vGC5IJZ9a';
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

/** How the mocked player answers a play: 204 at once unless a test holds it or refuses it. */
type Answer = () => Promise<{ status: number; json?: object }>;
async function mockSpotify(page: Page, base: string, playing: () => object | null, played: string[], answer?: Answer) {
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
    // a tap always asks for the devices first and plays on the phone by its id, with another device active or not
    if (url.endsWith('/me/player/devices')) {
      return route.fulfill({ json: { devices: [
        { id: 'ba6e', name: 'Babe', type: 'Speaker', is_active: true, is_restricted: false },
        { id: 'c7f4', name: 'iPhone', type: 'Smartphone', is_active: false, is_restricted: false },
      ] } });
    }
    if (url.includes('/me/player/play')) {
      expect(url).toContain('device_id=c7f4');
      played.push(route.request().postData() ?? '');
      if (!answer) return route.fulfill({ status: 204 });
      return answer().then(a => route.fulfill(a));
    }
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

test('the ♪ line: the row that connects with no account; connected, a list of playlists, each grid plays on its own, offline from kept covers', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  const errors: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // ---- no account: ♪ raises the sheet on the row that connects; nothing is asked of Spotify and the page stays here
  const web: string[] = [];
  await page.route('https://open.spotify.com/**', route => { web.push(route.request().url()); return route.fulfill({ status: 204 }); });
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  const unconnected = page.locator('[data-sheet="Playlists"]');
  await expect(unconnected.getByRole('button', { name: /Music\s*Connect Spotify/ })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(web).toEqual([]);
  await expect(page).toHaveURL(/#\/journal$/);
  await unconnected.getByRole('button', { name: 'Done' }).click();
  await expect(unconnected).toHaveCount(0);

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

test('an album tapped (M3): answered at the tap, the ring drawn and the cover sent to the ♪ only once Spotify plays it, nothing for a refusal', async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  const played: string[] = [];
  // each play waits for the test to answer it
  let answer: (a: { status: number; json?: object }) => void = () => undefined;
  await mockSpotify(page, baseURL!, () => null, played, () => new Promise(r => { answer = r; }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Music\s*Connect Spotify/ }).click();
  await expect(page.getByText('Connected as Thomas Madden')).toBeVisible();
  await page.getByRole('button', { name: /^Playlists/ }).click();
  const mine = page.locator('[data-sheet="Your playlists"]');
  await mine.getByRole('checkbox', { name: 'master (ii)' }).click();
  await expect(mine.getByText(/^reading /)).toHaveCount(0);
  await mine.getByRole('button', { name: 'Done' }).click();
  await page.locator('[data-sheet="Settings"]').getByRole('button', { name: 'Done' }).click();

  // the rows rise in behind the sheet; a name opens its grid, the strip's covers dealt into it
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  const list = page.locator('[data-sheet="Playlists"]');
  await expect(list.locator('.fs-playlists.rise')).toBeVisible();
  await list.locator('.fs-playlist').first().click();
  const grid = page.locator('[data-sheet="master (ii)"]');
  await expect(grid.locator('.fs-music-screen.deal')).toBeVisible();
  const tiles = grid.locator('.fs-tile');
  await expect(tiles).toHaveCount(4);
  await expect.poll(() => tiles.locator('img').count()).toBe(4);
  const rings = grid.locator('.fs-tile-ring:not(.lift)');

  // down: the cover gives at once
  const box = (await tiles.nth(0).boundingBox())!;
  await page.mouse.move(box.x + box.width * .3, box.y + box.height * .3);
  await page.mouse.down();
  await expect(tiles.nth(0)).toHaveAttribute('data-down', '');
  expect(await tiles.nth(0).evaluate(t => getComputedStyle(t).transform)).not.toBe('none');
  // up: the request leaves, the drop goes out and the others hush, but no ring until Spotify says so
  await page.mouse.up();
  await expect.poll(() => played.length).toBe(1);
  await expect(tiles.nth(0).locator('.fs-tile-drop')).toHaveCount(1);
  const hush = grid.locator('.fs-tiles.hush');
  const cells = grid.locator('.fs-tile-cell');
  await expect(hush).toHaveCount(1);
  await expect(rings).toHaveCount(0);
  // a slow answer: the others stay hushed the whole time it waits, the chosen cover at full strength, no ring yet
  await page.waitForTimeout(2000);
  await expect(hush).toHaveCount(1);
  await expect(cells.nth(0)).toHaveAttribute('data-chosen', '');
  expect(await cells.nth(0).evaluate(c => getComputedStyle(c).opacity)).toBe('1');
  expect(await cells.nth(1).evaluate(c => getComputedStyle(c).opacity)).toBe('0.45');
  await expect(rings).toHaveCount(0);
  await expect(tiles.nth(0)).toHaveAttribute('aria-pressed', 'false');
  // Spotify plays it: the others come back as the ring is drawn round that cover, and a copy of it travels to the small cover by the ♪
  answer({ status: 204 });
  await expect(hush).toHaveCount(0);
  await expect(tiles.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(rings).toHaveCount(1);
  await expect(grid.locator('.fs-tile-cell').nth(0).locator('.fs-tile-ring.drawn')).toHaveCount(1);
  await expect(page.locator('.fs-fly')).toHaveCount(1);
  await expect(page.locator('.fs-fly')).toHaveCount(0);
  const mini = page.locator('.fs-hdr [data-mini="spotify:album:Takk"]');
  await expect(mini).toBeVisible();
  await expect(mini).not.toHaveAttribute('data-landing', '');
  // it landed on the small cover, exactly
  await expect(mini.locator('img')).toBeVisible();

  // a refusal: its note says why, and nothing is drawn; the playing album keeps its ring
  await tiles.nth(1).click();
  await expect.poll(() => played.length).toBe(2);
  await page.waitForTimeout(2000);
  await expect(hush).toHaveCount(1);
  answer({ status: 403, json: { error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' } } });
  await expect(grid.getByRole('status')).toHaveText('Playing from here needs Spotify Premium');
  await expect(hush).toHaveCount(0);
  await expect(grid.locator('[data-chosen]')).toHaveCount(0);
  await expect(rings).toHaveCount(1);
  await expect(tiles.nth(1)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.fs-fly')).toHaveCount(0);

  // an error thrown on the way: the hush holds while it waits and lets go with the note, never left on
  await tiles.nth(1).click();
  await expect.poll(() => played.length).toBe(3);
  await page.waitForTimeout(2000);
  await expect(hush).toHaveCount(1);
  answer({ status: 400, json: { error: { status: 400, message: 'Something else went wrong' } } });
  await expect(grid.getByRole('status')).toHaveText('Spotify did not play it (400)');
  await expect(hush).toHaveCount(0);
  await expect(rings).toHaveCount(1);
  await expect(page.locator('.fs-fly')).toHaveCount(0);

  // a second album plays: its ring is drawn and the first one's is lifted
  await tiles.nth(2).click();
  await expect.poll(() => played.length).toBe(4);
  answer({ status: 204 });
  await expect(tiles.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(grid.locator('.fs-tile-cell').nth(2).locator('.fs-tile-ring.drawn')).toHaveCount(1);
  await expect(grid.locator('.fs-tile-ring')).toHaveCount(1);

  // the album already playing, tapped again: the tap is answered, nothing travels a second time
  await tiles.nth(2).click();
  await expect.poll(() => played.length).toBe(5);
  answer({ status: 204 });
  await page.waitForTimeout(100);
  await expect(page.locator('.fs-fly')).toHaveCount(0);

  // the handle: let go short and slow, the sheet settles back; a flick puts it away short of the line
  const head = (await grid.locator('.fs-grab').boundingBox())!;
  const cx = head.x + head.width / 2, cy = head.y + head.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(cx, cy + i * 8); await page.waitForTimeout(60); }
  expect(Number(await page.locator('.fs-scrim').evaluate(s => (s as HTMLElement).style.opacity))).toBeLessThan(1);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect(grid).toHaveClass(/settle/);
  await expect(grid).toBeVisible();
  // a flick: 50px in the time it takes to send four events (well past FLICK_PX_PER_MS), short of the 80px line
  await grid.locator('.fs-sheet-head').evaluate((h, [x, y]) => {
    const at = (type: string, dy: number) => h.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y + dy, isPrimary: true }));
    at('pointerdown', 0); at('pointermove', 20); at('pointermove', 50); at('pointerup', 50);
  }, [cx, cy]);
  await expect(grid).toHaveCount(0);

  // Reduce Motion: nothing moves, everything still happens
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await list.locator('.fs-playlist').first().click();
  await expect(grid.locator('.fs-music-screen.deal')).toHaveCount(0);
  await tiles.nth(3).click();
  await expect.poll(() => played.length).toBe(6);
  answer({ status: 204 });
  await expect(tiles.nth(3)).toHaveAttribute('aria-pressed', 'true');
  await expect(grid.locator('.fs-tile-cell').nth(3).locator('.fs-tile-ring')).toHaveCount(1);
  await expect(grid.locator('.fs-tile-drop, .fs-tile-ring .bead:visible')).toHaveCount(0);
  await expect(page.locator('.fs-fly')).toHaveCount(0);
  await expect(grid.locator('.fs-tiles.hush')).toHaveCount(0);

  expect(errors).toEqual([]);
});
