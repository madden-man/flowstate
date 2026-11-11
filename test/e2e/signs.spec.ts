// The ♪ sheet's Signs segment (PLAN-TASKS.md section 4, T5) in the production build. A journal given Spotify tokens,
// one chosen playlist holding the 21 starter albums and their kept covers (design/tasks/c-*.jpg), as the ♪ grid would
// have kept them. ♪ opens on Playlists; Signs beside it shows seven rows summit to foot, each name on its hue and
// its three covers, wordless, then a plus. A cover plays on the playlist that holds it; the plus opens the grid on
// Playlists; a name opens its sign's page and the sheet goes down. Only Spotify's API was asked for anything.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const PL = 'T5signs00000000000000';
const root = process.cwd();
const acts = fs.readFileSync(path.join(root, 'src/model/acts.ts'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'src/db/seed/picks.ts'), 'utf8');
const ids = new Map([...seed.matchAll(/album\('[^']+', '((?:[^'\\]|\\.)+)', '((?:[^'\\]|\\.)+)', '([A-Za-z0-9]{22})'\)/g)]
  .map(m => [m[2].replace(/\\'/g, "'"), { by: m[1], id: m[3] }]));
const block = acts.slice(acts.indexOf('STARTER_TITLES'), acts.indexOf('};', acts.indexOf('STARTER_TITLES')));
const STARTERS = [...block.matchAll(/'?([a-z-]+)'?: \[([^\]]+)\]/g)].map(m => ({
  sign: m[1], titles: [...m[2].matchAll(/'((?:[^'\\]|\\.)+)'/g)].map(t => t[1].replace(/\\'/g, "'")),
}));
const ALBUMS = STARTERS.flatMap(s => s.titles.map((title, i) => ({
  title, ...ids.get(title)!, b64: fs.readFileSync(path.join(root, `design/tasks/c-${s.sign}-${i + 1}.jpg`)).toString('base64'),
})));
const NAMES = ['Crown', 'Third eye', 'Throat', 'Heart', 'Solar plexus', 'Sacral', 'Root'];

test.use({ viewport: { width: 390, height: 844 } });

test('Signs beside Playlists: seven shelves, a cover plays, a name opens its sign', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  const errors: string[] = [];
  const played: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(new URL(r.url()).host); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://api.spotify.com/v1/**', route => {
    const url = route.request().url();
    if (url.endsWith('/v1/me')) return route.fulfill({ json: { id: 'tommy', display_name: 'Tommy' } });
    if (url.includes('/v1/me/playlists')) return route.fulfill({ json: { next: null, items: [
      { id: PL, name: 'master (ii)', uri: `spotify:playlist:${PL}`, snapshot_id: 's', owner: { id: 'tommy' }, images: [], items: { total: 21 } },
    ] } });
    // the first ♪ of a load reads the chosen playlist again: it holds the 21, in this order
    if (url.includes(`/playlists/${PL}/items`)) return route.fulfill({ json: { next: null, items: ALBUMS.map(a => ({
      item: { type: 'track', uri: `spotify:track:${a.id}`, album: { uri: `spotify:album:${a.id}`, name: a.title, images: [] }, artists: [{ name: a.by }] },
    })) } });
    if (url.endsWith('/me/player/devices')) return route.fulfill({ json: { devices: [{ id: 'c7f4', name: 'iPhone', type: 'Smartphone', is_active: true, is_restricted: false }] } });
    if (url.includes('/me/player/play')) { played.push(route.request().postData() ?? ''); return route.fulfill({ status: 204 }); }
    return route.fulfill({ status: 204 });
  });

  await page.goto('/#/journal');
  await page.locator('.fs-app').waitFor();
  await page.evaluate(async ({ albums, pl }) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const o = indexedDB.open('flowstate'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
    const at = Date.now();
    const tx = db.transaction(['settings', 'playlists', 'albums', 'shelves'], 'readwrite');
    const s = tx.objectStore('settings');
    const app = await new Promise<object>(r => { const g = s.get('app'); g.onsuccess = () => r(g.result); });
    s.put({ ...app, spotify: { tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: at + 864e5, name: 'Tommy' }, connectedAt: at, ticked: [pl] } });
    tx.objectStore('playlists').put({ id: pl, name: 'master (ii)', uri: `spotify:playlist:${pl}`, order: 0, snapshotId: 's', total: albums.length, chosen: true, readAt: at });
    albums.forEach((a, i) => {
      const bin = Uint8Array.from(atob(a.b64), c => c.charCodeAt(0));
      tx.objectStore('albums').put({ albumUri: `spotify:album:${a.id}`, album: a.title, artist: a.by, cover: bin.buffer, coverType: 'image/jpeg', coverAt: at });
      tx.objectStore('shelves').put({ playlistId: pl, albumUri: `spotify:album:${a.id}`, order: i, firstTrackUri: `spotify:track:${a.id}` });
    });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, { albums: ALBUMS, pl: PL });
  await page.reload();
  await page.locator('.fs-app').waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();

  // ♪ opens on Playlists, with Signs beside it
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  const seg = page.locator('.fs-music-seg');
  await expect(page.locator('[data-sheet="Playlists"]')).toBeVisible();
  await expect(seg.getByRole('button')).toHaveText(['Signs', 'Playlists']);
  await seg.getByRole('button', { name: 'Signs' }).click();
  const sheet = page.locator('[data-sheet="Signs"]');
  await expect(sheet).toBeVisible();
  const rows = sheet.locator('.ck-sign-row');
  await expect(rows.locator('.ck-sign-name')).toHaveText(NAMES);
  for (let i = 0; i < 7; i++) {
    await expect(rows.nth(i).locator('.fs-tile img')).toHaveCount(3);
    await expect(rows.nth(i).locator('.ck-shelf-plus')).toHaveCount(1);
  }
  await expect(sheet.locator('.ck-signs')).not.toContainText(/\d/);
  // the hue is the sign's, on its rule; Still takes it away
  const hue = (i: number) => rows.nth(i).evaluate(el => getComputedStyle(el).borderLeftColor);
  expect(await hue(0)).not.toBe(await hue(6));

  // a cover plays on the playlist that holds it
  const heart = ALBUMS.find(a => a.title === 'Carrie & Lowell')!;
  await rows.nth(3).locator(`.fs-tile[data-album="spotify:album:${heart.id}"]`).click();
  await expect.poll(() => played.map(b => JSON.parse(b))).toEqual([{ context_uri: `spotify:playlist:${PL}`, offset: { uri: `spotify:track:${heart.id}` } }]);
  await expect(rows.nth(3).locator('.fs-tile').nth(1)).toHaveAttribute('aria-pressed', 'true');

  // the plus opens the grid on Playlists, the segment words gone while choosing
  await rows.nth(0).locator('.ck-shelf-plus').click();
  await expect(page.locator('[data-sheet="Playlists"]')).toBeVisible();
  await expect(seg).toHaveCount(0);
  await page.locator('[data-sheet="Playlists"]').locator('.fs-playlist').first().click();
  await page.locator('[data-sheet="master (ii)"] .fs-tile').nth(3).click();
  await expect(page.locator('.fs-sheet')).toHaveCount(0);
  expect(played).toHaveLength(1);

  // ♪ again opens on Signs, Crown's shelf a cover longer; a name opens its sign and the sheet goes down
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(sheet).toBeVisible();
  await expect(rows.nth(0).locator('.fs-tile')).toHaveCount(4);
  await expect(rows.nth(0).locator('.fs-tile').nth(3)).toHaveAttribute('data-album', `spotify:album:${ALBUMS[3].id}`);
  await rows.nth(3).getByRole('link', { name: 'Heart' }).click();
  await expect(page).toHaveURL(/#\/flow\/c\/heart$/);
  await expect(page.locator('.fs-sheet')).toHaveCount(0);

  // a long press lifts a cover: dragged along it takes its new place, dragged off the shelf it is taken off
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(sheet).toBeVisible();
  // the sheet settled before a cover is measured
  await page.waitForTimeout(800);
  const order = (i: number) => rows.nth(i).locator('.fs-tile').evaluateAll(t => t.map(x => x.getAttribute('data-album')));
  const before = await order(1);
  const drag = async (i: number, k: number, dx: number, dy: number) => {
    const b = (await rows.nth(i).locator('.fs-tile').nth(k).boundingBox())!;
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await expect(rows.nth(i).locator('.ck-shelf-cover.lift')).toHaveCount(1);
    for (let n = 1; n <= 8; n++) await page.mouse.move(x + (dx * n) / 8, y + (dy * n) / 8);
    await page.mouse.up();
  };
  await drag(1, 0, 120, 0);
  await expect.poll(() => order(1)).toEqual([before[1], before[2], before[0]]);
  expect(played).toHaveLength(1);
  await drag(6, 0, 0, -160);
  await expect(rows.nth(6).locator('.fs-tile')).toHaveCount(2);
  await expect(rows.nth(6).locator('.lift')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Done' }).click();

  // Still: the names without their hue
  await page.locator('.fs-moon').first().click();
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(sheet).toBeVisible();
  await expect(rows.nth(0).locator('.ck-shelf-plus')).toBeHidden();
  expect(await hue(0)).toBe(await hue(6));

  expect([...new Set(outside)].every(h => h === 'api.spotify.com')).toBe(true);
  expect(errors).toEqual([]);
});
