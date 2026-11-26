// Songs (PLAN-WORLDS.md section 6, W6), on a stubbed bridge function and a stubbed microphone (example data: East
// Winds, a novel, and Songbook). The microphone is an oscillator singing a known tune into a MediaStream, so the pitch
// line and the key guess have answers; the hold is a real thumb (CDP touch events, never the mouse), and a cancelled
// hold ends the take cleanly. A song is written line by line, a section named from the chips, a take pinned to the
// line the caret is on and drawn as it is sung, Tap tempo, the Character chip; the song and the take go up as rows and
// the take's audio as a clip after its row; a loose hum becomes a song when given a title; a song moves to Songbook
// from the Move to sheet, which never offers his own pages; and his own pages have no Songs at all.
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const FN = '/.netlify/functions/bridge';
type Env = { world: string; table: string; id: string; rev: number; deleted?: true; row?: Record<string, unknown> };
const WORLDS = [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }, { id: 'songbook', name: 'Songbook', kind: 'songs' }];
/** When Songbook's Low tide last changed on the Mac (its pocket lyricAt). */
const MAC_AT = 1_790_000_000_000;
/** Example data: a novel's pocket (docs/BRIDGE.md). */
const POCKET = {
  kind: 'novel', storyYear: 2071, span: { from: 2040, to: 2080 },
  characters: [
    { id: 'siyuan', fullName: 'Siyuan', firstName: 'Siyuan', familyColour: '#3a70d0', born: 2041 },
    { id: 'dawn', fullName: 'Dawn Li', firstName: 'Dawn', familyColour: '#3a9a5a', born: 2062 },
  ],
  places: [], chapters: [], events: [], questions: [],
};

/** The microphone: an oscillator singing G3 B flat3 D4 ... (a tune in G minor), 300 ms a note, round and round. */
const fakeMic = () => {
  const notes = [55, 58, 62, 58, 55, 62, 60, 58, 57, 55];
  navigator.mediaDevices.getUserMedia = async () => {
    const a = new AudioContext();
    const o = a.createOscillator();
    const g = a.createGain();
    g.gain.value = 0.3;
    const dest = a.createMediaStreamDestination();
    o.connect(g).connect(dest);
    let i = 0;
    const next = () => { o.frequency.setValueAtTime(440 * 2 ** ((notes[i++ % notes.length] - 69) / 12), a.currentTime); };
    next();
    const t = setInterval(next, 300);
    o.start();
    dest.stream.getTracks()[0].addEventListener('ended', () => clearInterval(t));
    const stop = dest.stream.getTracks()[0].stop.bind(dest.stream.getTracks()[0]);
    dest.stream.getTracks()[0].stop = () => { clearInterval(t); stop(); void a.close(); };
    return dest.stream;
  };
};

async function stubBridge(context: BrowserContext) {
  const up: Env[] = [];
  const clips: { world: string; take: string; rev: number; type: string; bytes: number; afterRow: boolean }[] = [];
  await context.route(`**${FN}**`, async route => {
    const req = route.request();
    if (req.headers().authorization !== 'Bearer test-token') return route.fulfill({ status: 401, json: {} });
    const q = new URL(req.url()).searchParams;
    const op = q.get('op');
    if (op === 'worlds') return route.fulfill({ json: { worlds: WORLDS } });
    if (op === 'pocket') {
      const w = q.get('world');
      return route.fulfill({ json: w === 'eastwinds' ? { world: w, stamp: 's1', pocket: POCKET } : { world: w, stamp: 's1', pocket: { kind: 'songs', songs: [{ id: 'mac-1', title: '2026-11-20 Low tide', lyric: '[Verse]\nthe water goes out\nand comes back', lyricAt: MAC_AT }] } } });
    }
    if (op === 'clip') {
      const take = q.get('take')!;
      clips.push({ world: q.get('world')!, take, rev: Number(q.get('rev')), type: req.headers()['content-type'], bytes: req.postDataBuffer()?.byteLength ?? 0, afterRow: up.some(e => e.table === 'takes' && e.id === take) });
      return route.fulfill({ json: { take, result: 'stored' } });
    }
    const body = req.postDataJSON() as { envelopes: Env[] };
    up.push(...body.envelopes);
    return route.fulfill({ json: { acks: body.envelopes.map(e => ({ table: e.table, id: e.id, rev: e.rev, result: 'stored' })) } });
  });
  return { up, clips };
}

/** The token saved, the registry on home's row and a world worn (or none), as Settings and the shelf leave them. */
async function setUp(page: Page, world?: string) {
  await page.goto('/#/flow');
  await page.locator('.fl-cover').first().waitFor();
  await expect(page.locator('[data-threshold]')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(({ w, worlds }) => new Promise<void>((resolve, reject) => {
    const r = indexedDB.open('flowstate');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('settings', 'readwrite');
      const st = tx.objectStore('settings');
      const g = st.get('app');
      g.onsuccess = () => st.put({ ...g.result, bridge: { token: 'test-token' }, worlds, ...(w ? { world: w } : {}) });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), { w: world, worlds: WORLDS });
  await page.reload();
  await expect(page.locator('[data-threshold]')).toHaveCount(0, { timeout: 15_000 });
  if (world === 'eastwinds') await expect(page.locator('.fs-hdr-year')).toBeVisible({ timeout: 10_000 });
}

const rows = (page: Page, db: string, table: string) => page.evaluate(({ db, table }) => new Promise<Record<string, unknown>[]>((resolve, reject) => {
  const r = indexedDB.open(db);
  r.onerror = () => reject(r.error);
  r.onsuccess = () => {
    const g = r.result.transaction(table).objectStore(table).getAll();
    g.onsuccess = () => { r.result.close(); resolve(g.result); };
  };
}), { db, table });

/** A finger on an element (CDP touch events): down, held, and lifted or cancelled. */
async function finger(page: Page, context: BrowserContext) {
  const cdp = await context.newCDPSession(page);
  const at = async (sel: string) => { const b = (await page.locator(sel).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  return {
    async down(sel: string) { const p = await at(sel); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); },
    async up() { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    async cancel() { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); },
    async tap(sel: string) {
      // where it stands once it has stopped moving (a sheet rises over --t-page)
      let b = await page.locator(sel).boundingBox();
      for (let i = 0; i < 40; i++) { await page.waitForTimeout(50); const n = await page.locator(sel).boundingBox(); if (n && b && n.x === b.x && n.y === b.y) break; b = n; }
      const p = await at(sel); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
  };
}

const HUM = 'button.sg-hum';

test('a song in East Winds: lines, a section, a hum on the line the caret is on, drawn as sung; it goes up, then its clip', async ({ page, context }) => {
  await page.addInitScript(fakeMic);
  const bridge = await stubBridge(context);
  await setUp(page, 'eastwinds');
  // the Songs row under East Winds' cover, before Research
  await expect(page.locator('.fl-under a.fs-row .fs-list-line')).toHaveText(['Songs', 'Research']);
  await page.locator('.fl-under a.fs-row', { hasText: 'Songs' }).click();
  await expect(page).toHaveURL(/#\/flow\/songs$/);
  await expect(page.locator('.sg-list .fs-list-line')).toHaveText(['Hum', 'New song']);
  await page.locator('.sg-list a', { hasText: 'New song' }).click();
  await expect(page).toHaveURL(/#\/flow\/songs\/[0-9a-f-]{36}$/);
  // the header: the way back, and the world over the date
  await expect(page.locator('.fs-hdr-l .fs-word').first()).toHaveText('Songs');
  await expect(page.locator('.fs-hdr-world')).toContainText('East Winds');

  await page.getByRole('textbox', { name: 'Title' }).fill('The grey coat');
  await page.getByRole('textbox', { name: 'Title' }).press('Enter');
  // Enter starts the next rule and the caret goes to it; each line is typed once the caret is there
  const lineN = (n: number) => page.getByRole('textbox', { name: `Line ${n}` });
  await expect(lineN(1)).toBeFocused();
  await page.keyboard.type('You only wear that one to leave');
  await page.keyboard.press('Enter');
  await expect(lineN(2)).toBeFocused();
  await page.keyboard.type('so leave it on the nail');
  await page.keyboard.press('Enter');
  await expect(lineN(3)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(lineN(4)).toBeFocused();
  await page.keyboard.type('Keep this for me, one year');
  await expect(page.locator('.sg-line')).toHaveCount(4);
  // a section named from the chips, with the caret in it
  await page.getByRole('textbox', { name: 'Line 4' }).click();
  await page.getByRole('group', { name: 'This song' }).getByRole('button', { name: 'Chorus' }).click();
  await page.getByRole('textbox', { name: 'Line 1' }).click();
  await page.getByRole('group', { name: 'This song' }).getByRole('button', { name: 'Verse' }).click();
  await expect(page.locator('.wd-sec')).toHaveText(['Verse', 'Chorus']);
  // no counts of any kind on the page (rule 15): no syllables, no numbers beside the lines
  await expect(page.locator('.sg-page')).not.toContainText(/syllable/i);

  // the caret on line 2, then a thumb holds Hold to hum
  await page.getByRole('textbox', { name: 'Line 2' }).click();
  const f = await finger(page, context);
  await f.down(HUM);
  await expect(page.locator(HUM)).toHaveText('Lift to stop');
  // drawn as it is sung: the line grows while the thumb is still down
  const live = page.locator('.sg-live path');
  await expect.poll(async () => ((await live.getAttribute('d')) ?? '').length, { timeout: 5000 }).toBeGreaterThan(40);
  const early = ((await live.getAttribute('d')) ?? '').length;
  await page.waitForTimeout(3200);
  expect(((await live.getAttribute('d')) ?? '').length).toBeGreaterThan(early);
  await f.up();
  await expect(page.locator(HUM)).toHaveText('Hold to hum');
  // the take stands under line 2, with the key guess and its length in print
  const take = page.locator('.sg-line[data-line="1"] + .wd-take');
  await expect(take).toBeVisible({ timeout: 10_000 });
  await expect(take.locator('small')).toHaveText(/^G minor · 0:0[3-5]$/);
  expect(((await take.locator('path').getAttribute('d')) ?? '').length).toBeGreaterThan(100);
  const stored = (await rows(page, 'flowstate-w-eastwinds', 'takes'))[0];
  expect(stored).toMatchObject({ lineId: '1', key: 'G minor' });
  expect((stored.pitch as number[]).filter(m => m > 0).every(m => m > 50 && m < 66)).toBe(true);

  // Tap tempo, and the Character chip
  const chips = page.getByRole('group', { name: 'This song' });
  for (let i = 0; i < 4; i++) { await chips.getByRole('button', { name: 'Tap tempo' }).click(); await page.waitForTimeout(500); }
  await expect(chips.getByRole('button', { name: 'Tap tempo' })).toHaveText(/^\d+ BPM$/);
  await chips.getByRole('button', { name: '+ character' }).click();
  const whose = page.locator('[data-sheet="Whose song"]');
  await whose.getByRole('button', { name: 'Dawn Li' }).click();
  await whose.getByRole('button', { name: 'Done' }).click();
  await expect(chips.getByRole('button', { name: 'Dawn Li' })).toHaveAttribute('aria-pressed', 'true');

  // up: the song, the take (no audio in it), then the take's audio as a clip, after its row
  await expect.poll(() => bridge.up.find(e => e.table === 'songs' && (e.row?.characterIds as string[] | undefined)?.includes('dawn'))?.row, { timeout: 15_000 })
    .toMatchObject({ title: 'The grey coat', lyric: 'You only wear that one to leave\nso leave it on the nail\n\nKeep this for me, one year', sections: [{ line: 0, name: 'Verse' }, { line: 3, name: 'Chorus' }] });
  const takeRow = bridge.up.find(e => e.table === 'takes')!.row!;
  expect(takeRow).toMatchObject({ lineId: '1', lineText: 'so leave it on the nail', key: 'G minor' });
  expect(takeRow).not.toHaveProperty('audio');
  expect(JSON.stringify(takeRow.audioType)).toMatch(/audio\//);
  await expect.poll(() => bridge.clips.length, { timeout: 15_000 }).toBe(1);
  expect(bridge.clips[0]).toMatchObject({ world: 'eastwinds', take: takeRow.id, rev: takeRow.at, afterRow: true });
  expect(bridge.clips[0].type).toMatch(/^audio\//);
  expect(bridge.clips[0].bytes).toBeGreaterThan(1000);
  console.log(`clip content type in Chromium: ${bridge.clips[0].type}`);
});

test('a cancelled hold ends the take cleanly; a hold lifted at once keeps nothing', async ({ page, context }) => {
  await page.addInitScript(fakeMic);
  await stubBridge(context);
  await setUp(page, 'songbook');
  await page.goto('/#/flow/hum');
  const f = await finger(page, context);
  await f.down(HUM);
  await expect(page.locator(HUM)).toHaveText('Lift to stop');
  await page.waitForTimeout(1500);
  await f.cancel();
  await expect(page.locator(HUM)).toHaveText('Hold to hum');
  await expect(page.locator('.sg-hum-row')).toHaveCount(1, { timeout: 10_000 });
  // a press and lift with no time to sing makes no take
  await f.tap(HUM);
  await page.waitForTimeout(1500);
  await expect(page.locator('.sg-hum-row')).toHaveCount(1);
  await expect(page.locator(HUM)).toHaveText('Hold to hum');
});

test('a loose hum becomes a song when it is given a title; Songbook lists the Mac\'s songs too', async ({ page, context }) => {
  await page.addInitScript(fakeMic);
  await stubBridge(context);
  await setUp(page, 'songbook');
  // under Songbook's cover, Songs is the first and only row
  await expect(page.locator('.fl-under a.fs-row .fs-list-line')).toHaveText(['Songs']);
  await page.locator('.fl-under a.fs-row', { hasText: 'Songs' }).click();
  await expect(page.locator('.sg-list .fs-list-line')).toHaveText(['Hum', 'New song', 'Low tide'], { timeout: 10_000 });
  await page.locator('.sg-list a', { hasText: 'Hum' }).click();
  await expect(page).toHaveURL(/#\/flow\/hum$/);
  const f = await finger(page, context);
  await f.down(HUM);
  await page.waitForTimeout(2500);
  await f.up();
  await expect(page.locator('.sg-hum-row')).toHaveCount(1, { timeout: 10_000 });
  const name = page.getByRole('textbox', { name: 'Give it a title' });
  await name.fill('Slow train');
  await name.press('Enter');
  await expect(page).toHaveURL(/#\/flow\/songs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Slow train');
  // loose on its song: at the foot
  await expect(page.locator('.sg-page > .wd-take')).toHaveCount(1);
  await page.getByRole('link', { name: 'Songs' }).click();
  await expect(page.locator('.sg-list .fs-list-line')).toHaveText(['Hum', 'New song', 'Slow train', 'Low tide']);
});

test('Move to: a song and its take go to Songbook with the same ids, by a thumb on the sheet; his own pages are never offered', async ({ page, context }) => {
  await page.addInitScript(fakeMic);
  const bridge = await stubBridge(context);
  await setUp(page, 'eastwinds');
  await page.goto('/#/flow/songs/new');
  await page.getByRole('textbox', { name: 'Title' }).fill('The grey coat');
  await page.getByRole('textbox', { name: 'Title' }).press('Enter');
  await expect(page.getByRole('textbox', { name: 'Line 1' })).toBeFocused();
  await page.keyboard.type('so leave it on the nail');
  const f = await finger(page, context);
  await f.down(HUM);
  await page.waitForTimeout(2000);
  await f.up();
  await expect(page.locator('.wd-take:not(.sg-live)')).toHaveCount(1, { timeout: 10_000 });
  const id = page.url().split('/').pop()!;
  await expect.poll(() => bridge.clips.length, { timeout: 15_000 }).toBe(1);

  await page.getByRole('button', { name: 'Move to…' }).click();
  const sheet = page.locator('[data-sheet="Move to"]');
  await expect(sheet.locator('.fs-row span')).toHaveText(['Songbook']);
  await expect(sheet).not.toContainText('My own pages');
  await expect(sheet).not.toContainText('East Winds');
  await f.tap('[data-sheet="Move to"] .fs-row[data-world="songbook"]');
  await expect(page).toHaveURL(/#\/flow\/songs$/);
  await expect(page.locator('.sg-list .fs-list-line')).toHaveText(['Hum', 'New song']);
  // in Songbook's notebook, the same ids; none left in East Winds'
  await expect.poll(async () => (await rows(page, 'flowstate-w-songbook', 'songs')).map(r => r.id)).toEqual([id]);
  expect((await rows(page, 'flowstate-w-eastwinds', 'songs'))).toEqual([]);
  const takeId = (await rows(page, 'flowstate-w-songbook', 'takes'))[0].id;
  expect(await rows(page, 'flowstate-w-eastwinds', 'takes')).toEqual([]);
  // up: deletes under East Winds, rows under Songbook (no characters it does not know); the clip is not sent again
  await expect.poll(() => bridge.up.filter(e => e.world === 'eastwinds' && e.deleted).map(e => `${e.table}:${e.id}`).sort(), { timeout: 15_000 })
    .toEqual([`songs:${id}`, `takes:${takeId}`].sort());
  await expect.poll(() => bridge.up.filter(e => e.world === 'songbook' && !e.deleted).map(e => `${e.table}:${e.id}`).sort(), { timeout: 15_000 })
    .toEqual([`songs:${id}`, `takes:${takeId}`].sort());
  expect(bridge.clips).toHaveLength(1);
  // and it is there when Songbook is worn
  await setUp(page, 'songbook');
  await page.goto('/#/flow/songs');
  await expect(page.locator('.sg-list .fs-list-line')).toHaveText(['Hum', 'New song', 'The grey coat', 'Low tide'], { timeout: 10_000 });
});

test('his own pages have no Songs: no row under his cover, and the routes go back to the shelf', async ({ page, context }) => {
  await stubBridge(context);
  await setUp(page);
  await expect(page.locator('.fl-cover[data-front]')).toHaveAttribute('data-book', 'own');
  await expect(page.locator('.fl-under')).not.toContainText('Songs');
  for (const h of ['/#/flow/songs', '/#/flow/hum', '/#/flow/songs/new']) {
    await page.goto(h);
    await expect(page).toHaveURL(/#\/flow$/);
  }
});

test('typed straight on after Enter, with no wait, every word lands on its own rule', async ({ page, context }) => {
  await stubBridge(context);
  await setUp(page, 'songbook');
  await page.goto('/#/flow/songs/new');
  await page.getByRole('textbox', { name: 'Title' }).fill('Fast hands');
  await page.getByRole('textbox', { name: 'Title' }).press('Enter');
  // one burst: Enter is pressed between the words with nothing waited for (Playwright types \n as Enter)
  await page.keyboard.type('one two\nthree four\n\nfive\nsix seven', { delay: 0 });
  await expect(page.locator('.sg-line textarea')).toHaveCount(5);
  const lines = await page.locator('.sg-line textarea').evaluateAll(els => els.map(e => (e as HTMLTextAreaElement).value));
  expect(lines).toEqual(['one two', 'three four', '', 'five', 'six seven']);
  // and a split in the middle of a line, typed on at once
  await page.getByRole('textbox', { name: 'Line 1' }).click();
  await page.keyboard.press('End');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('\nX', { delay: 0 });
  const after = await page.locator('.sg-line textarea').evaluateAll(els => els.map(e => (e as HTMLTextAreaElement).value));
  expect(after.slice(0, 2)).toEqual(['one', 'X two']);
});

test('the page sits on the rules: every line, a section name and a take under a line land on the ruled grid', async ({ page, context }) => {
  await page.addInitScript(fakeMic);
  await stubBridge(context);
  await setUp(page, 'eastwinds');
  await page.goto('/#/flow/songs/new');
  await page.getByRole('textbox', { name: 'Title' }).fill('On the rules');
  await page.getByRole('textbox', { name: 'Title' }).press('Enter');
  await page.keyboard.type('first line\nsecond line\nthird line\n\nfourth line');
  await page.getByRole('textbox', { name: 'Line 5' }).click();
  await page.getByRole('group', { name: 'This song' }).getByRole('button', { name: 'Chorus' }).click();
  await page.getByRole('textbox', { name: 'Line 1' }).click();
  const f = await finger(page, context);
  await f.down(HUM);
  await page.waitForTimeout(1500);
  await f.up();
  await expect(page.locator('.sg-line[data-line="0"] + .wd-take:not(.sg-live)')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.sg-live')).toHaveCount(0);
  const off = await page.evaluate(() => {
    const sheet = document.querySelector('.sg-page') as HTMLElement;
    const cs = getComputedStyle(sheet);
    const lh = parseFloat(getComputedStyle(document.querySelector('.sg-line textarea')!).lineHeight);
    const origin = sheet.getBoundingClientRect().top + parseFloat(cs.backgroundPositionY) - sheet.scrollTop;
    const els = [...sheet.querySelectorAll('.sg-title, .sg-line, .wd-sec, .wd-take')] as HTMLElement[];
    return els.map(e => {
      const r = e.getBoundingClientRect();
      const top = ((r.top - origin) % lh + lh) % lh, h = r.height % lh;
      return { cls: e.className, top: Math.min(top, lh - top), h: Math.min(h, lh - h) };
    });
  });
  for (const o of off) expect(o, o.cls).toMatchObject({ top: expect.closeTo(0, 0), h: expect.closeTo(0, 0) });
});

test('at phone width the chips under a song wrap onto rows: nothing is cut and nothing scrolls sideways', async ({ page, context }) => {
  await stubBridge(context);
  await setUp(page, 'eastwinds');
  await page.goto('/#/flow/songs/new');
  await page.getByRole('textbox', { name: 'Title' }).fill('Wide chips');
  await page.getByRole('textbox', { name: 'Title' }).press('Enter');
  await page.keyboard.type('a line');
  const chips = page.getByRole('group', { name: 'This song' });
  for (let i = 0; i < 4; i++) { await chips.getByRole('button', { name: 'Tap tempo' }).click(); await page.waitForTimeout(400); }
  await expect(chips.getByRole('button', { name: 'Tap tempo' })).toHaveText(/BPM$/);
  const box = await chips.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, right: Math.max(...[...el.children].map(c => c.getBoundingClientRect().right)), edge: el.getBoundingClientRect().right }));
  expect(box.sw).toBeLessThanOrEqual(box.cw);
  expect(box.right).toBeLessThanOrEqual(box.edge);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('opening a song and leaving it untouched writes nothing and sends nothing; a Mac song is written only once he writes', async ({ page, context }) => {
  const bridge = await stubBridge(context);
  await setUp(page, 'songbook');
  await page.goto('/#/flow/songs');
  await page.locator('.sg-list a', { hasText: 'Low tide' }).click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Low tide');
  await page.getByRole('link', { name: 'Songs' }).click();
  await expect(page).toHaveURL(/#\/flow\/songs$/);
  await page.waitForTimeout(2500);
  expect(await rows(page, 'flowstate-w-songbook', 'songs')).toEqual([]);
  expect(bridge.up.filter(e => e.table === 'songs')).toEqual([]);
  // a song of his, opened and left: no second row goes up
  await page.goto('/#/flow/songs/new');
  await page.getByRole('textbox', { name: 'Title' }).fill('Mine');
  await page.getByRole('textbox', { name: 'Title' }).press('Enter');
  await page.keyboard.type('a line');
  await page.getByRole('link', { name: 'Songs' }).click();
  await expect.poll(() => bridge.up.filter(e => e.table === 'songs').length, { timeout: 15_000 }).toBe(1);
  await page.locator('.sg-list a', { hasText: 'Mine' }).click();
  await expect(page.getByRole('textbox', { name: 'Line 1' })).toHaveValue('a line');
  await page.getByRole('link', { name: 'Songs' }).click();
  await page.waitForTimeout(3000);
  expect(bridge.up.filter(e => e.table === 'songs')).toHaveLength(1);
});

test('the microphone refused: the page says so in print and keeps nothing; allowed again, the hum works and the line goes', async ({ page, context }) => {
  await page.addInitScript(fakeMic);
  await page.addInitScript(() => {
    const real = navigator.mediaDevices.getUserMedia;
    let refuse = true;
    (window as unknown as { allowMic: () => void }).allowMic = () => { refuse = false; };
    navigator.mediaDevices.getUserMedia = async (c?: MediaStreamConstraints) => { if (refuse) throw new DOMException('Permission denied', 'NotAllowedError'); return real.call(navigator.mediaDevices, c); };
  });
  await stubBridge(context);
  await setUp(page, 'songbook');
  await page.goto('/#/flow/hum');
  const f = await finger(page, context);
  await f.down(HUM);
  await expect(page.locator('.sg-said')).toHaveText('The microphone is off for FlowState.');
  await f.up();
  await expect(page.locator(HUM)).toHaveText('Hold to hum');
  await expect(page.locator('.sg-hum-row')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { allowMic: () => void }).allowMic());
  await f.down(HUM);
  await page.waitForTimeout(1500);
  await f.up();
  await expect(page.locator('.sg-hum-row')).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator('.sg-said')).toHaveCount(0);
});

test('a section named from a chip is a lyric change: the row goes up with a newer lyricAt, from the Mac text it started from', async ({ page, context }) => {
  const bridge = await stubBridge(context);
  await setUp(page, 'songbook');
  await page.goto('/#/flow/songs');
  await page.locator('.sg-list a', { hasText: 'Low tide' }).click();
  // the Mac's [Verse] line is the section name over its first line, not text
  await expect(page.getByRole('textbox', { name: 'Line 1' })).toHaveValue('the water goes out');
  await expect(page.locator('.wd-sec')).toHaveText(['Verse']);
  await page.getByRole('textbox', { name: 'Line 2' }).click();
  await page.getByRole('group', { name: 'This song' }).getByRole('button', { name: 'Chorus' }).click();
  await page.getByRole('link', { name: 'Songs' }).click();
  await expect.poll(() => bridge.up.find(e => e.table === 'songs' && e.id === 'mac-1')?.row, { timeout: 15_000 })
    .toMatchObject({ lyric: 'the water goes out\nand comes back', sections: [{ line: 0, name: 'Chorus' }], lyricFrom: MAC_AT });
  const row = bridge.up.find(e => e.table === 'songs' && e.id === 'mac-1')!.row!;
  expect(row.lyricAt as number).toBeGreaterThan(MAC_AT);
});

test('a hum too large to carry says so under its line, in print, and the carry goes on', async ({ page, context }) => {
  await page.addInitScript(fakeMic);
  const bridge = await stubBridge(context);
  // the function answers this clip 413, as it would one over its limit (registered last, so it is asked first)
  await context.route(url => url.searchParams.get('op') === 'clip', route => route.fulfill({ status: 413, json: {} }));
  await setUp(page, 'songbook');
  await page.goto('/#/flow/songs/new');
  await page.getByRole('textbox', { name: 'Title' }).fill('Too long');
  await page.getByRole('textbox', { name: 'Title' }).press('Enter');
  await page.keyboard.type('one line');
  const f = await finger(page, context);
  await f.down(HUM);
  await page.waitForTimeout(1500);
  await f.up();
  await expect(page.locator('.wd-take:not(.sg-live)')).toHaveCount(1, { timeout: 10_000 });
  await expect.poll(() => bridge.up.some(e => e.table === 'takes'), { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => ((await rows(page, 'flowstate-w-songbook', 'takes'))[0]?.clip as { aside?: string } | undefined)?.aside, { timeout: 15_000 }).toBe('size');
  // reopened, the take carries its print line
  await page.getByRole('link', { name: 'Songs' }).click();
  await page.locator('.sg-list a', { hasText: 'Too long' }).click();
  await expect(page.locator('.sg-aside')).toHaveText('Too long to carry; it stays on this phone.', { timeout: 15_000 });
});

test('Move to on a Songbook song still only in the pocket: it is written on the phone first, then moved', async ({ page, context }) => {
  const bridge = await stubBridge(context);
  await setUp(page, 'songbook');
  await page.goto('/#/flow/songs');
  await page.locator('.sg-list a', { hasText: 'Low tide' }).click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Low tide');
  await page.getByRole('button', { name: 'Move to…' }).click();
  const f = await finger(page, context);
  await f.tap('[data-sheet="Move to"] .fs-row[data-world="eastwinds"]');
  await expect(page).toHaveURL(/#\/flow\/songs$/);
  await expect.poll(async () => (await rows(page, 'flowstate-w-eastwinds', 'songs')).map(r => r.id)).toEqual(['mac-1']);
  // it goes up under East Winds with the Mac's id and the Mac's text, the [Verse] line its section
  await expect.poll(() => bridge.up.find(e => e.world === 'eastwinds' && e.table === 'songs' && e.id === 'mac-1')?.row, { timeout: 15_000 })
    .toMatchObject({ title: 'Low tide', lyric: 'the water goes out\nand comes back', sections: [{ line: 0, name: 'Verse' }], lyricFrom: MAC_AT });
});
