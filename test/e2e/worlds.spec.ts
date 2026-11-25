// Two notebooks (PLAN-WORLDS.md sections 3 and 4, W1), on the fixture registry (test/fixtures/worlds.json: East Winds,
// a novel; Songbook, songs) put into home's settings row, as the bridge will leave it. The shelf slides under a real
// thumb (CDP touch events on the iPhone viewport, never the mouse) and settles one cover at a time, with the tick and
// the lamp; a tap on the cover in front puts it on, with the soft bell, and its Journal comes up with the world's name
// over the date on every tab; his pages never show there and a world's never show in his; My own pages takes it off;
// the app reopens in the world left; locked in a world, the keypad names it and the ring still opens his own Right now;
// a held cover raises what it wears: five albums at most in the order tapped, plain paper, or a drawing from a file.
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';

const WORLDS = JSON.parse(fs.readFileSync('test/fixtures/worlds.json', 'utf8')) as { id: string; name: string; kind: string }[];

const keypad = (p: Page) => p.getByRole('group', { name: 'PIN' });
const tapKeys = async (p: Page, digits: string, scope = p.locator('body')) => {
  for (const d of digits) await scope.locator('.fs-key', { has: p.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
};
async function enter(page: Page, url: string) {
  await page.goto(url);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

/** Writes into the personal notebook's database as stored rows (no PIN yet, so plain), then reloads. */
async function seedHome(page: Page, extra: { music?: boolean } = {}) {
  await page.evaluate(async ({ worlds, music }) => {
    const square = (hue: number) => new Promise<ArrayBuffer>(r => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d')!; g.fillStyle = `hsl(${hue} 45% 52%)`; g.fillRect(0, 0, 32, 32);
      c.toBlob(b => void b!.arrayBuffer().then(r), 'image/png');
    });
    const albums: { albumUri: string; album: string; artist: string; cover: ArrayBuffer; coverType: string; coverAt: number }[] = [];
    if (music) for (const [i, h] of [215, 280, 140, 30, 0, 50].entries()) albums.push({ albumUri: `spotify:album:ex${i}`, album: `Example ${i + 1}`, artist: 'Example', cover: await square(h), coverType: 'image/png', coverAt: Date.now() });
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('flowstate');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(['settings', 'albums', 'playlists', 'shelves'], 'readwrite');
        const st = tx.objectStore('settings');
        const g = st.get('app');
        g.onsuccess = () => st.put({
          ...g.result, worlds,
          ...(music ? { spotify: { connectedAt: 1, tokens: { accessToken: 'x', refreshToken: 'x', expiresAt: Date.now() + 3.6e6, name: 'Example' } } } : {}),
        });
        if (music) {
          for (const a of albums) tx.objectStore('albums').put(a);
          tx.objectStore('playlists').put({ id: 'pl-ex', name: 'Example playlist', uri: 'spotify:playlist:pl-ex', order: 0, snapshotId: 's', total: 6, chosen: true });
          albums.forEach((a, order) => tx.objectStore('shelves').put({ playlistId: 'pl-ex', albumUri: a.albumUri, order, firstTrackUri: `t${order}` }));
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { worlds: WORLDS, music: !!extra.music });
  await page.reload();
  await expect(page.locator('[data-threshold]')).toHaveCount(0, { timeout: 15_000 });
}

/** A real thumb on the shelf (CDP touch events), and every tick and bell from here on, by name and pitch. */
async function thumb(page: Page, context: BrowserContext) {
  const cdp = await context.newCDPSession(page);
  const box = async () => (await page.locator('.fl-shelf').boundingBox())!;
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y: y! }] });
  return {
    /** Slides the shelf by dx (negative: the covers go left, the next one comes to the middle), and lifts. */
    async slide(dx: number) {
      const b = await box();
      const y = b.y + b.height / 2, x0 = b.x + b.width / 2;
      await touch('touchStart', x0, y);
      const step = 8 * Math.sign(dx);
      for (let d = step; Math.abs(d) <= Math.abs(dx); d += step) { await touch('touchMove', x0 + d, y); await page.waitForTimeout(8); }
      await touch('touchEnd');
      // the covers carry on to their place and stop there; a tap while they still move only stops them, as on a phone
      let was = -1;
      for (let i = 0; i < 40; i++) {
        const now = await page.locator('.fl-shelf').evaluate(el => el.scrollLeft);
        if (now === was) break;
        was = now;
        await page.waitForTimeout(120);
      }
    },
    /** Holds a finger on the cover in front past a long press, and lifts. */
    async hold() {
      const c = (await page.locator('.fl-cover[data-front]').boundingBox())!;
      await touch('touchStart', c.x + c.width / 2, c.y + c.height / 2);
      await page.waitForTimeout(700);
      await touch('touchEnd');
    },
    /** A tap on the cover in front with a finger. */
    async tap() {
      const c = (await page.locator('.fl-cover[data-front]').boundingBox())!;
      await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2);
    },
  };
}
async function listen(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { ticks: string[] };
    w.ticks = [];
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement && n.dataset.tick) w.ticks.push(n.dataset.tick);
    }).observe(document.body, { childList: true });
  });
}
const ticks = (p: Page) => p.evaluate(() => (window as unknown as { ticks: string[] }).ticks);
const pitchesInit = () => {
  const w = window as unknown as { __pitches: number[] };
  w.__pitches = [];
  const make = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function (this: AudioContext) {
    const o = make.call(this);
    queueMicrotask(() => w.__pitches.push(o.frequency.value));
    return o;
  };
};
const pitches = (p: Page) => p.evaluate(() => (window as unknown as { __pitches: number[] }).__pitches);
const front = (p: Page) => p.locator('.fl-cover[data-front]');
const tabTo = (p: Page, name: string) => p.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name, exact: true }).click();

test('the shelf slides under a thumb and settles one cover at a time, with the tick, the lamp and what each offers', async ({ page, context }) => {
  // after sunset, so the lamp is lit and can take a hue
  await page.clock.install({ time: new Date(2026, 10, 25, 21, 30) });
  await enter(page, '/#/journal');
  const today = page.getByRole('textbox', { name: "Today's page" });
  await today.click();
  await today.pressSequentially('It is the pace, not the list.', { delay: 2 });
  await expect(today).toHaveAttribute('data-saved', 'true');
  await seedHome(page);
  await tabTo(page, 'Flow');
  await expect(page).toHaveURL(/#\/flow$/);
  const covers = page.locator('.fl-shelf .fl-cover');
  await expect(covers.locator('.fl-cover-name')).toHaveText(['My own pages', 'East Winds', 'Songbook']);
  await expect(covers.locator('.fl-cover-foot')).toHaveText(['Open', 'A novel', 'Songs of no book']);
  await expect(front(page)).toHaveAttribute('data-book', 'own');
  // the one beside it is smaller and fainter
  const look = (id: string) => page.locator(`.fl-cover[data-book="${id}"]`).evaluate(el => ({ o: Number(getComputedStyle(el).opacity), w: el.getBoundingClientRect().width }));
  const own0 = await look('own'), ew0 = await look('eastwinds');
  expect(ew0.o).toBeLessThan(own0.o);
  expect(ew0.w).toBeLessThan(own0.w);
  await expect(page.locator('a.fl-circle')).toHaveCount(3);
  await expect(page.locator('.fl-lastline')).toContainText('It is the pace, not the list.');
  // nothing moves by itself: at rest, the shelf stays where it is
  const at = await page.locator('.fl-shelf').evaluate(el => el.scrollLeft);
  await page.waitForTimeout(400);
  expect(await page.locator('.fl-shelf').evaluate(el => el.scrollLeft)).toBe(at);

  await listen(page);
  const t = await thumb(page, context);
  await t.slide(-140);
  await expect(front(page)).toHaveAttribute('data-book', 'eastwinds');
  await expect.poll(() => ticks(page)).toEqual(['check']);
  // the lamp takes East Winds' hue by the council's mix; nothing is worn by sliding
  await expect(page.locator('.fs-app')).toHaveAttribute('data-lamp', '');
  expect(await page.locator('.fs-app').evaluate(el => el.style.getPropertyValue('--lamp-voice'))).toContain(' 250)');
  await expect(page.locator('.fl-cover[data-book="own"] .fl-cover-foot')).toHaveText('Open');
  await expect(page.locator('.fs-hdr-world')).toHaveCount(0);
  // under East Winds: its own last line (none yet) and Research; no circles, no Right now
  await expect(page.locator('.fl-under')).toHaveAttribute('data-for', 'eastwinds');
  await expect(page.locator('.fl-lastline')).toHaveText('');
  await expect(page.locator('.fl-under a.fs-row')).toHaveText([/Research/]);
  await expect(page.locator('a.fl-circle')).toHaveCount(0);
  // one more: Songbook, and nothing under it yet
  await t.slide(-140);
  await expect(front(page)).toHaveAttribute('data-book', 'songbook');
  await expect.poll(() => ticks(page)).toEqual(['check', 'check']);
  await expect(page.locator('.fl-under a')).toHaveCount(0);
  // a slide past the last cover settles where it was, with no tick
  await t.slide(-140);
  await page.waitForTimeout(400);
  await expect(front(page)).toHaveAttribute('data-book', 'songbook');
  expect(await ticks(page)).toEqual(['check', 'check']);
  // and back, one cover at a time, however far the thumb goes
  await t.slide(220);
  await expect(front(page)).toHaveAttribute('data-book', 'eastwinds');
  await t.slide(140);
  await expect(front(page)).toHaveAttribute('data-book', 'own');
  await expect(page.locator('a.fl-circle')).toHaveCount(3);
  // Still: no hue on the lamp
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.fs-app')).not.toHaveAttribute('data-lamp', '');
  await page.getByRole('button', { name: 'Leave Still' }).click();
});

test('a tap on the cover in front puts it on: the bell, its Journal, its name over the date on every tab; My own pages takes it off', async ({ page, context }) => {
  await page.addInitScript(pitchesInit);
  await enter(page, '/#/journal');
  const today = page.getByRole('textbox', { name: "Today's page" });
  await today.click();
  await today.pressSequentially('Mine, and only mine.', { delay: 2 });
  await expect(today).toHaveAttribute('data-saved', 'true');
  await seedHome(page);
  await tabTo(page, 'Flow');
  const t = await thumb(page, context);
  await t.slide(-140);
  await expect(front(page)).toHaveAttribute('data-book', 'eastwinds');
  // a slide begun while the tab was still turning raised no sheet (Shelf.tsx: a finger that slid was not holding)
  await expect(page.locator('.fs-sheet')).toHaveCount(0);
  await t.tap();
  await expect(page).toHaveURL(/#\/journal$/);
  // the soft bell (keep close's)
  await expect.poll(() => pitches(page)).toContain(988);
  // his page is not here: East Winds' Journal is blank
  await expect(page.locator('.fs-hdr-world')).toHaveText('East Winds');
  await expect(page.locator('main')).not.toContainText('Mine, and only mine.');
  const ew = page.getByRole('textbox', { name: "Today's page" }).first();
  await ew.click();
  await ew.pressSequentially('What does it cost her to keep it?', { delay: 2 });
  await expect(ew).toHaveAttribute('data-saved', 'true');
  // the name over the date on every tab, and nothing of his own pages on any of them
  for (const [tab, url] of [['Council', /#\/council$/], ['Questions', /#\/questions$/], ['Be', /#\/be$/], ['Flow', /#\/flow$/], ['Journal', /#\/journal$/]] as const) {
    await tabTo(page, tab);
    await expect(page).toHaveURL(url);
    await expect(page.locator('.fs-hdr-world')).toHaveText('East Winds');
    await expect(page.locator('main')).not.toContainText('Mine, and only mine.');
  }
  // Be starts empty in a world (no seeded values), and the council has no seeded voices
  await tabTo(page, 'Be');
  await expect(page.locator('.fs-value')).toHaveCount(0);
  await page.goto('/#/journal/pages');
  await expect(page.locator('main')).toContainText('What does it cost her to keep it?');
  await expect(page.locator('main')).not.toContainText('Mine, and only mine.');
  // his own pages' rooms go back to the shelf while a world is worn
  for (const to of ['/#/flow/now', '/#/flow/meditate', '/#/flow/energize']) {
    await page.goto(to);
    await expect(page).toHaveURL(/#\/flow$/);
  }
  // on the shelf East Winds is in front and says Open
  await expect(front(page)).toHaveAttribute('data-book', 'eastwinds');
  await expect(front(page).locator('.fl-cover-foot')).toHaveText('Open');
  await expect(page.locator('.fl-lastline')).toContainText('What does it cost her to keep it?');
  // My own pages: slide back and tap it, and the world comes off
  await t.slide(140);
  await expect(front(page)).toHaveAttribute('data-book', 'own');
  await expect(page.locator('.fl-lastline')).toContainText('Mine, and only mine.');
  await t.tap();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-hdr-world')).toHaveCount(0);
  await expect(page.locator('main')).toContainText('Mine, and only mine.');
  await expect(page.locator('main')).not.toContainText('What does it cost her');
  // a circle under his cover, from a world, takes the world off on the way
  await tabTo(page, 'Flow');
  await t.slide(-140);
  await t.tap();
  await expect(page.locator('.fs-hdr-world')).toHaveText('East Winds');
  await tabTo(page, 'Flow');
  await t.slide(140);
  await page.locator('a.fl-circle', { hasText: 'Meditate' }).click();
  await expect(page).toHaveURL(/#\/flow\/meditate$/);
  await expect(page.locator('.md-page')).toBeVisible();
  await expect(page.locator('.fs-hdr-world')).toHaveCount(0);
});

test('the app reopens in the world it was left in', async ({ page, context }) => {
  await enter(page, '/#/flow');
  await seedHome(page);
  const t = await thumb(page, context);
  await t.slide(-140);
  await t.tap();
  await expect(page.locator('.fs-hdr-world')).toHaveText('East Winds');
  await page.reload();
  await expect(page.locator('[data-threshold]')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('.fs-hdr-world')).toHaveText('East Winds');
  await tabTo(page, 'Flow');
  await expect(front(page)).toHaveAttribute('data-book', 'eastwinds');
  await expect(front(page).locator('.fl-cover-foot')).toHaveText('Open');
});

test('locked in a world: the keypad names it, the ring opens his own Right now, and the PIN opens his pages', async ({ page, context }) => {
  await enter(page, '/#/flow');
  await seedHome(page);
  const t = await thumb(page, context);
  await t.slide(-140);
  await t.tap();
  await expect(page.locator('.fs-hdr-world')).toHaveText('East Winds');
  await page.locator('.fs-hdr').getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[data-sheet="Settings"]');
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const sheet = page.locator('[data-sheet="Set a PIN"]');
  await tapKeys(page, '3569', sheet);
  await sheet.getByRole('button', { name: 'Next' }).click();
  await tapKeys(page, '3569', sheet);
  await expect(settings.getByRole('button', { name: 'Change PIN' })).toBeVisible({ timeout: 15_000 });
  const door = settings.getByRole('switch', { name: /The ring without the PIN/ });
  await door.click();
  await expect(door).toHaveAttribute('aria-checked', 'true');
  await settings.getByRole('button', { name: 'Done' }).click();

  await page.reload();
  await expect(keypad(page)).toBeVisible();
  await expect(page.locator('.fs-threshold-world')).toHaveText('East Winds');
  await page.getByRole('link', { name: 'the ring' }).click();
  await expect(page).toHaveURL(/#\/flow\/now$/);
  await expect(keypad(page)).toHaveCount(0);
  // his own flows, whatever was worn
  await expect(page.locator('.fl-nowlist a.fl-flow').first().locator('.fs-list-meta')).toHaveText('Panic · Overstimulated');
  await page.getByRole('button', { name: 'Flow', exact: true }).click();
  await tapKeys(page, '3569');
  await expect(page).toHaveURL(/#\/flow$/, { timeout: 15_000 });
  await expect(front(page)).toHaveAttribute('data-book', 'own');
  await expect(page.locator('.fs-hdr-world')).toHaveCount(0);
  // East Winds kept its page, sealed with the same PIN, and opens when put on again
  await page.reload();
  await tapKeys(page, '3569');
  await expect(front(page)).toBeVisible({ timeout: 15_000 });
});

test('what a cover wears: five albums at most in the order tapped, plain paper, or a drawing from a file', async ({ page, context }) => {
  await enter(page, '/#/flow');
  await seedHome(page, { music: true });
  const t = await thumb(page, context);
  await t.slide(-140);
  await expect(front(page)).toHaveAttribute('data-book', 'eastwinds');
  await t.hold();
  const sheet = page.locator('[data-sheet="East Winds wears"]');
  await expect(sheet).toBeVisible();
  // the ticked playlist's kept covers, under its name
  await expect(sheet.locator('.fs-month')).toHaveText(['Example playlist']);
  const tile = (i: number) => sheet.locator(`.fs-tile[data-album="spotify:album:ex${i}"]`);
  await expect(sheet.locator('.fs-tile')).toHaveCount(6);
  for (const i of [3, 0, 4, 1, 2]) await tile(i).click();
  // the others quieten
  await expect(sheet.locator('.fs-tiles')).toHaveClass(/hush/);
  await expect(sheet.locator('.fs-tile-cell[data-chosen]')).toHaveCount(5);
  await expect(sheet.getByText('Five at most.')).toHaveCount(0);
  // a sixth does nothing, and one line says so
  await tile(5).click();
  await expect(tile(5)).toHaveAttribute('aria-pressed', 'false');
  await expect(sheet.getByText('Five at most.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  // the band across the cover's top, in the order tapped, the first the largest
  const band = front(page).locator('.fl-band img');
  await expect(band).toHaveCount(5);
  expect(await band.evaluateAll(es => es.map(e => e.getAttribute('data-album')))).toEqual([3, 0, 4, 1, 2].map(i => `spotify:album:ex${i}`));
  const sizes = await band.evaluateAll(es => es.map(e => e.getBoundingClientRect().width));
  expect(sizes[0]).toBeGreaterThan(sizes[1] * 1.5);
  // kept through a reload (offline: nothing is fetched)
  await page.reload();
  await expect(page.locator('.fl-cover[data-book="eastwinds"] .fl-band img')).toHaveCount(5);
  // untick one: four
  const t2 = await thumb(page, context);
  await t2.slide(-140);
  await t2.hold();
  await expect(sheet).toBeVisible();
  await tile(0).click();
  await expect(sheet.locator('.fs-tile-cell[data-chosen]')).toHaveCount(4);
  // plain paper: no band
  await sheet.getByRole('button', { name: 'Plain paper' }).click();
  await expect(sheet.locator('.fs-tile-cell[data-chosen]')).toHaveCount(0);
  await expect(front(page).locator('.fl-band')).toHaveCount(0);
  // a drawing, from a file
  const chooser = page.waitForEvent('filechooser');
  await sheet.getByText('Upload a drawing').click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBkZGRgYAAQbAf+vJ1y3AAAAAElFTkSuQmCC', 'base64');
  await (await chooser).setFiles({ name: 'drawing.png', mimeType: 'image/png', buffer: png });
  await expect(front(page).locator('.fl-band img[data-drawing]')).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await expect(page.locator('.fl-cover[data-book="eastwinds"] .fl-band img[data-drawing]')).toHaveCount(1);
  // Still: paper and seam, no band
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('.fl-cover[data-book="eastwinds"] .fl-band')).toBeHidden();
  await page.getByRole('button', { name: 'Leave Still' }).click();
});

test('not connected to Spotify, the wears sheet says so and offers Connect', async ({ page, context }) => {
  await enter(page, '/#/flow');
  await seedHome(page);
  const t = await thumb(page, context);
  await t.hold();
  const sheet = page.locator('[data-sheet="My own pages wears"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Not connected to Spotify')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Connect Spotify/ })).toBeVisible();
  await expect(sheet.locator('.fs-tile')).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Plain paper' })).toBeVisible();
});

test('with no registry the shelf is his own cover alone, exactly as before', async ({ page }) => {
  await enter(page, '/#/flow');
  await expect(page.locator('.fl-cover')).toHaveCount(1);
  await expect(front(page).locator('.fl-cover-name')).toHaveText('My own pages');
  await expect(page.locator('.fs-hdr-world')).toHaveCount(0);
});
