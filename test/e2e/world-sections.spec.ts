// The sections in a world (PLAN-WORLDS.md section 4 and 5, W4), on a stubbed bridge function with an example pocket
// (East Winds, example data): the year dial on the cover, dragged with a real thumb (CDP touch events, never the
// mouse) before stepping in, with the ages under it following and the shelf not sliding; the waiting question, a tap
// on which puts the world on and opens it; the header's year and its sheet; the year stamped on a new page and the
// three chips under it; a kept line's own chips, filled at keeping and sent up with it; the council's seats with ages,
// dimmed when not alive, About or In the story, the whole book; a bible question answered and resolved here going up
// as rows Novel Companion can read; Research this; and his own pages showing none of it.
import { test, expect, type Page, type BrowserContext, type CDPSession } from '@playwright/test';

const FN = '/.netlify/functions/bridge';
type Env = { world: string; table: string; id: string; rev: number; deleted?: true; row?: Record<string, unknown> };
const T0 = new Date(2026, 9, 11, 10, 0).getTime();

/** Example data: a novel's pocket as Novel Companion publishes it (docs/BRIDGE.md). */
const POCKET = {
  kind: 'novel', storyYear: 2071, span: { from: 2040, to: 2080 },
  characters: [
    { id: 'ren', fullName: 'Abbot Ren', firstName: 'Ren', familyColour: '#8a6a4a', born: 2010, died: 2069 },
    { id: 'li', fullName: 'Mrs. Li', firstName: 'Li', familyColour: '#8a5ac0', born: 2033 },
    { id: 'sydney', fullName: 'Sydney', firstName: 'Sydney', familyColour: '#d04848', born: 2037 },
    { id: 'siyuan', fullName: 'Siyuan', firstName: 'Siyuan', familyColour: '#3a70d0', born: 2041 },
    { id: 'dawn', fullName: 'Dawn Li', firstName: 'Dawn', familyColour: '#3a9a5a', born: 2062 },
  ],
  places: [{ id: 'gate', name: 'the temple gate' }],
  chapters: [{ id: 'ch12', title: 'The flood', year: 2071 }],
  events: [{ id: 'ev1', title: 'The spring flood', year: 2071 }],
  questions: [
    { id: 'q-who', question: 'Who raises Dawn after 2065?', state: 'open', changedAt: T0 + 2 },
    { id: 'q-leave', question: 'Does Siyuan leave before the flood, or after?', state: 'open', changedAt: T0 + 1 },
    { id: 'q-intro', question: 'Which year is the Introduction?', state: 'decided', decision: '2071, the spring.', changedAt: T0 },
  ],
};

async function stubBridge(context: BrowserContext) {
  const up = new Map<string, Env>();
  await context.route(`**${FN}**`, async route => {
    const req = route.request();
    if (req.headers().authorization !== 'Bearer test-token') return route.fulfill({ status: 401, json: {} });
    const op = new URL(req.url()).searchParams.get('op');
    if (op === 'worlds') return route.fulfill({ json: { worlds: [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }] } });
    if (op === 'pocket') return route.fulfill({ json: { world: 'eastwinds', stamp: 's1', pocket: POCKET } });
    const body = req.postDataJSON() as { envelopes: Env[] };
    const acks = body.envelopes.map(e => {
      const k = `${e.table}:${e.id}`;
      const cur = up.get(k);
      const result = cur && cur.rev > e.rev ? 'older' : cur && cur.rev === e.rev ? 'same' : 'stored';
      if (result === 'stored') up.set(k, e);
      return { table: e.table, id: e.id, rev: e.rev, result };
    });
    return route.fulfill({ json: { acks } });
  });
  return up;
}

/** The token saved and the registry on home's row, as Settings leaves them; then a reload. */
async function setUp(page: Page, world?: string) {
  await page.goto('/#/flow');
  await page.locator('.fl-cover').first().waitFor();
  await expect(page.locator('[data-threshold]')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(w => new Promise<void>((resolve, reject) => {
    const r = indexedDB.open('flowstate');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('settings', 'readwrite');
      const st = tx.objectStore('settings');
      const g = st.get('app');
      g.onsuccess = () => st.put({ ...g.result, bridge: { token: 'test-token' }, worlds: [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }], ...(w ? { world: w } : {}) });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), world);
  await page.reload();
  await expect(page.locator('[data-threshold]')).toHaveCount(0, { timeout: 15_000 });
  // worn: the pocket has come down once the header names its year
  if (world) await expect(page.locator('.fs-hdr-year')).toBeVisible({ timeout: 10_000 });
}

/** A drag with one finger, from one point to another, in small steps, as CDP touch events. */
async function drag(cdp: CDPSession, page: Page, from: { x: number; y: number }, toX: number) {
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y: from.y }] });
  await touch('touchStart', from.x);
  const step = 6 * Math.sign(toX - from.x);
  for (let x = from.x + step; Math.abs(toX - x) >= Math.abs(step); x += step) { await touch('touchMove', x); await page.waitForTimeout(8); }
  await touch('touchMove', toX);
  await touch('touchEnd');
}

/** Where a year stands on a dial's track, in page coordinates. */
async function yearPoint(track: ReturnType<Page['locator']>, year: number) {
  // where it stands once it has stopped moving (a sheet rises over --t-page)
  let b = (await track.boundingBox())!;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 50));
    const n = (await track.boundingBox())!;
    if (n.x === b.x && n.y === b.y && n.width === b.width) break;
    b = n;
  }
  return { x: b.x + ((year - 2040) / 40) * b.width, y: b.y + b.height / 2 };
}

const today$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });
async function hold(page: Page, text: string) {
  // a sheet going down still lies over the page until it has gone
  await expect(page.locator('.fs-sheet')).toHaveCount(0);
  // saved and written out as a line (a line still waiting for its save is a field, and a field is not held)
  await expect(page.locator('.fs-msg p', { hasText: text })).toBeVisible();
  const box = (await page.locator('.fs-msg', { hasText: text }).last().boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator('[data-sheet="This line"]')).toBeVisible();
}

test('the year dial on the cover: dragged by a thumb before stepping in, the ages follow and the shelf stays; Waiting opens the question', async ({ page, context }) => {
  await stubBridge(context);
  // worn once, so the pocket comes down and the year starts from the bible's story year; then his own pages again
  await setUp(page, 'eastwinds');
  await expect(page.locator('.fs-hdr-year')).toHaveText('2071');
  await page.locator('.fl-cover[data-book="own"]').click();
  await expect(page.locator('.fl-cover[data-book="own"]')).toHaveAttribute('data-front', '');
  await page.locator('.fl-cover[data-book="own"]').click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-hdr-world')).toHaveCount(0);
  await page.goto('/#/flow');

  // slide to East Winds with a thumb
  const cdp = await context.newCDPSession(page);
  const shelf = page.locator('.fl-shelf');
  const sb = (await shelf.boundingBox())!;
  await drag(cdp, page, { x: sb.x + sb.width / 2, y: sb.y + 40 }, sb.x + sb.width / 2 - 160);
  const cover = page.locator('.fl-cover[data-book="eastwinds"]');
  await expect(cover).toHaveAttribute('data-front', '');
  const track = cover.getByRole('slider', { name: 'Story year' });
  await expect(track).toHaveAttribute('aria-valuenow', '2071');
  await expect(page.locator('.wd-ages')).toHaveText('Mrs. Li 38 · Sydney 34 · Siyuan 30 · Dawn Li 9');
  await expect(page.locator('.wd-waiting')).toContainText('Who raises Dawn after 2065?');
  const scrolled = await shelf.evaluate(el => el.scrollLeft);

  // a thumb on the dial moves the year, never the shelf, and opens nothing
  await drag(cdp, page, await yearPoint(track, 2071), (await yearPoint(track, 2065)).x);
  await expect(track).toHaveAttribute('aria-valuenow', '2065');
  await expect(page.locator('.wd-ages')).toHaveText('Abbot Ren 55 · Mrs. Li 32 · Sydney 28 · Siyuan 24 · Dawn Li 3');
  expect(await shelf.evaluate(el => el.scrollLeft)).toBe(scrolled);
  await expect(page).toHaveURL(/#\/flow$/);
  await expect(cover).not.toHaveAttribute('aria-current', 'true');
  // written: read again, it stands
  await page.reload();
  await drag(cdp, page, { x: sb.x + sb.width / 2, y: sb.y + 40 }, sb.x + sb.width / 2 - 160);
  await expect(page.locator('.fl-cover[data-book="eastwinds"]').getByRole('slider')).toHaveAttribute('aria-valuenow', '2065');

  // the waiting question: a tap puts the world on and opens it, the header naming the year worn
  await page.locator('.wd-waiting a').click();
  await expect(page).toHaveURL(/#\/questions\/q-who$/);
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue('Who raises Dawn after 2065?');
  await expect(page.locator('.fs-hdr-world')).toHaveText('East Winds · 2065');
});

test('the header\'s year raises the dial; a new page takes the year worn and its chips; a kept line goes up with chips of its own', async ({ page, context }) => {
  const up = await stubBridge(context);
  await setUp(page, 'eastwinds');
  await page.goto('/#/journal');
  await expect(page.locator('.fs-hdr-year')).toHaveText('2071');

  // the year sheet: the dial with the year's chapter and event named under it; a thumb moves the year worn
  await page.locator('.fs-hdr-year').click();
  const sheet = page.locator('[data-sheet="The year"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.wd-inyear')).toHaveText(['Chapter The flood', 'Event The spring flood']);
  await expect(sheet.locator('.wd-mark')).toHaveCount(2);
  const track = sheet.getByRole('slider', { name: 'Story year' });
  const cdp = await context.newCDPSession(page);
  await drag(cdp, page, await yearPoint(track, 2071), (await yearPoint(track, 2072)).x);
  await expect(page.locator('.fs-hdr-year')).toHaveText('2072');
  await sheet.getByRole('button', { name: 'Done' }).click();

  // a new page takes the year worn; the chips under it
  const box = today$(page);
  await box.click();
  await box.pressSequentially('Siyuan leaves the temple, the spring after the flood.', { delay: 2 });
  await box.press('Enter');
  await page.getByRole('textbox', { name: "Today's page" }).pressSequentially('He tells nobody but Dawn. She is nine and keeps it for a year.', { delay: 2 });
  await page.getByRole('textbox', { name: "Today's page" }).press('Enter');
  const chips = page.getByRole('group', { name: 'What this page is about' });
  await expect(chips.getByRole('button', { name: 'Year 2072' })).toBeVisible();
  // a character chip for the page: Siyuan
  await chips.getByRole('button', { name: '+ character' }).click();
  const about = page.locator('[data-sheet="This page is about"]');
  await about.getByRole('group', { name: 'Characters' }).getByRole('button', { name: 'Siyuan' }).click();
  await about.getByRole('button', { name: 'Done' }).click();
  await expect(chips.getByRole('button', { name: 'Siyuan' })).toHaveAttribute('aria-pressed', 'true');

  // keep the second line: its own chips are the page's and the names the page uses
  const line = 'He tells nobody but Dawn. She is nine and keeps it for a year.';
  await hold(page, line);
  await page.getByRole('switch', { name: /Keep close/ }).click();
  await hold(page, line);
  const own = page.locator('[data-sheet="This line"] [aria-label="Characters"]');
  await expect(own.getByRole('button', { name: 'Siyuan' })).toHaveAttribute('aria-pressed', 'true');
  await expect(own.getByRole('button', { name: 'Dawn Li' })).toHaveAttribute('aria-pressed', 'true');
  await expect(own.getByRole('button', { name: 'Sydney' })).toHaveAttribute('aria-pressed', 'false');
  // changed on the sheet: Siyuan off
  await own.getByRole('button', { name: 'Siyuan' }).click();
  await expect(own.getByRole('button', { name: 'Siyuan' })).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-sheet="This line"]').getByRole('button', { name: 'Done' }).click();
  await expect.poll(() => [...up.values()].find(e => e.row?.text === line)?.row, { timeout: 10_000 })
    .toMatchObject({ kind: 'kept', year: 2072, chips: { characterIds: ['dawn'], placeIds: [] } });
  // the page and its other line stayed on the phone
  expect([...up.values()].some(e => e.row?.text === 'Siyuan leaves the temple, the spring after the flood.' || e.row?.kind === 'entry')).toBe(false);
});

test('the council in a world: seats with ages, the dead dimmed and seatable; About or In the story; the whole book; it goes up', async ({ page, context }) => {
  const up = await stubBridge(context);
  await setUp(page, 'eastwinds');
  await page.goto('/#/council');
  await page.getByRole('button', { name: 'New council' }).click();
  const seats = page.getByRole('group', { name: 'Who sits' });
  await expect(seats.getByRole('button', { name: 'Dawn Li, 9' })).toBeVisible();
  await expect(seats.getByRole('button', { name: 'Siyuan, 30' })).toBeVisible();
  const ren = seats.getByRole('button', { name: 'Abbot Ren, d. 2069' });
  await expect(ren).toHaveAttribute('data-gone', '');
  await ren.click();
  await expect(ren).toHaveAttribute('aria-pressed', 'true');
  await seats.getByRole('button', { name: 'Dawn Li, 9' }).click();

  const reading = page.getByRole('group', { name: 'This council is' });
  const setIn = page.getByRole('group', { name: 'Set in' });
  await expect(reading.getByRole('button', { name: 'About the story' })).toHaveAttribute('aria-pressed', 'true');
  // about the story: the whole book, and the ages leave the seats
  await setIn.getByRole('button', { name: 'The whole book' }).click();
  await expect(setIn.getByRole('button', { name: 'The whole book' })).toHaveAttribute('aria-pressed', 'true');
  await expect(seats.getByRole('button', { name: 'Dawn Li', exact: true })).toBeVisible();
  // in the story: a year again, and the whole book is not offered
  await reading.getByRole('button', { name: 'In the story' }).click();
  await expect(setIn.getByRole('button', { name: 'Year 2071' })).toHaveAttribute('aria-pressed', 'true');
  await expect(setIn.getByRole('button', { name: 'The whole book' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Begin' }).click();
  const msg = page.getByRole('textbox', { name: 'Message' });
  await msg.fill('You packed the grey coat.');
  await msg.press('Enter');
  await expect(page.locator('.wd-reading')).toHaveText('In the story 2071');
  await expect.poll(() => [...up.values()].find(e => e.table === 'pages' && e.row?.kind === 'council')?.row, { timeout: 10_000 })
    .toMatchObject({ reading: 'in', year: 2071 });

  // changeable later: the line at the top brings the seat row, where it turns back to About
  await page.locator('.wd-reading a').click();
  await page.getByRole('group', { name: 'This council is' }).getByRole('button', { name: 'About the story' }).click();
  await expect(page.locator('.wd-reading')).toHaveText('About the story 2071');
  await expect.poll(() => [...up.values()].find(e => e.table === 'pages' && e.row?.kind === 'council')?.row?.reading, { timeout: 10_000 }).toBe('about');
});

test('questions both ways, and Research this; his own pages show none of it', async ({ page, context }) => {
  const up = await stubBridge(context);
  await setUp(page, 'eastwinds');
  await page.goto('/#/questions');
  await expect(page.getByText('Does Siyuan leave before the flood, or after?')).toBeVisible();
  // decided in the bible: under Answered, the decision as its wise line
  await page.goto('/#/questions/q-intro');
  await expect(page.locator('.fs-msg.fs-wise')).toHaveText('2071, the spring.');

  // This answers it on a bible question
  await page.goto('/#/questions/q-leave');
  const box = page.getByRole('textbox', { name: "This page" }).or(page.getByRole('textbox', { name: "Today's page" })).first();
  await box.click();
  await box.pressSequentially('After. He stays one season too long.', { delay: 2 });
  await box.press('Enter');
  await hold(page, 'After. He stays one season too long.');
  await page.getByRole('button', { name: 'This answers it' }).click();
  await expect.poll(() => up.get('pages:q-leave')?.row, { timeout: 10_000 }).toMatchObject({ kind: 'question', state: 'answered' });
  await expect.poll(() => [...up.values()].find(e => e.table === 'messages' && e.row?.pageId === 'q-leave')?.row, { timeout: 10_000 })
    .toMatchObject({ wise: true, text: 'After. He stays one season too long.' });

  // Resolve, and a question asked here
  await page.goto('/#/questions/q-who');
  await page.getByRole('checkbox', { name: 'Resolved' }).click();
  await expect.poll(() => up.get('pages:q-who')?.row, { timeout: 10_000 }).toMatchObject({ state: 'answered', resolvedByTap: true });

  // Research this: the question carried to the Research page
  await page.getByRole('button', { name: 'Research this' }).click();
  await expect(page).toHaveURL(/#\/flow\/research\?from=q-who$/);
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue('Who raises Dawn after 2065?');

  // his own pages: no year, no chips, no Research this, no story on his cover
  await page.goto('/#/flow');
  await page.locator('.fl-cover[data-book="own"]').click();
  await expect(page.locator('.fl-cover[data-book="own"]')).toHaveAttribute('data-front', '');
  await page.locator('.fl-cover[data-book="own"]').click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-hdr-world')).toHaveCount(0);
  await today$(page).pressSequentially('Dawn is a word here too.', { delay: 2 });
  await today$(page).press('Enter');
  await expect(page.getByRole('group', { name: 'What this page is about' })).toHaveCount(0);
  await page.goto('/#/council');
  await page.getByRole('button', { name: 'New council' }).click();
  await expect(page.getByRole('group', { name: 'This council is' })).toHaveCount(0);
  await page.goto('/#/flow');
  await expect(page.locator('.wd-ages, .wd-waiting, .fl-cover[data-book="own"] .wd-dial')).toHaveCount(0);
});
