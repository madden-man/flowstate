// The bridge (PLAN-WORLDS.md section 5, W2) on a stubbed function: Playwright answers /.netlify/functions/bridge in the
// test with an in-memory bridge_up, as netlify/lib/bridge.ts would. With no token, nothing leaves the origin and the
// function is never asked, on any tab, in Settings, or with a world worn. With a token and a fixture world: a council
// line arrives in bridge_up; a journal line arrives only once kept and leaves when unkept; offline, the outbox waits,
// and online it drains. A world is worn the way the app reopens in one (home's settings row names it; W1's init).
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const FN = '/.netlify/functions/bridge';
type Env = { world: string; table: string; id: string; rev: number; deleted?: true; row?: Record<string, unknown> };

/** The function, stubbed: one novel world, its pocket, and bridge_up kept in memory, newest rev winning. */
async function stubBridge(context: BrowserContext) {
  const calls: string[] = [];
  const up = new Map<string, Env>();
  const log: Env[] = [];
  const state = { offline: false };
  await context.route(`**${FN}**`, async route => {
    const req = route.request();
    calls.push(req.url());
    if (state.offline) return route.abort('internetdisconnected');
    if (req.headers().authorization !== 'Bearer test-token') return route.fulfill({ status: 401, json: { error: 'unauthorized' } });
    const op = new URL(req.url()).searchParams.get('op');
    if (op === 'worlds') return route.fulfill({ json: { worlds: [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }] }, headers: { 'cache-control': 'no-store' } });
    if (op === 'pocket') {
      return route.fulfill({ json: { world: 'eastwinds', stamp: 's1', pocket: {
        kind: 'novel', places: [], chapters: [], events: [], storyYear: 2071,
        characters: [{ id: 'dawn', fullName: 'Dawn Li', firstName: 'Dawn', familyColour: '#d04040' }],
        questions: [{ id: 'q-river', question: 'Does the river freeze in 2071?', state: 'open', changedAt: 1 }],
      } } });
    }
    const body = req.postDataJSON() as { world: string; envelopes: Env[] };
    const acks = body.envelopes.map(e => {
      const k = `${e.world}:${e.table}:${e.id}`;
      const cur = up.get(k);
      const result = cur && cur.rev > e.rev ? 'older' : cur && cur.rev === e.rev ? 'same' : 'stored';
      if (result === 'stored') { up.set(k, e); log.push(e); }
      return { table: e.table, id: e.id, rev: e.rev, result };
    });
    return route.fulfill({ json: { acks } });
  });
  return { calls, up, log, state };
}

/** Wears a world as the app reopens in one: home's settings row names it, and the next load opens its notebook. */
async function wear(page: Page, world: string) {
  await page.evaluate(w => new Promise<void>((resolve, reject) => {
    const r = indexedDB.open('flowstate');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('settings', 'readwrite');
      const st = tx.objectStore('settings');
      const g = st.get('app');
      g.onsuccess = () => st.put({ ...g.result, world: w });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), world);
  await page.reload();
}

const today$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });
async function hold(page: Page, text: string) {
  const box = (await page.locator('.fs-msg', { hasText: text }).last().boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator('[data-sheet="This line"]')).toBeVisible();
}
async function say(page: Page, text: string) {
  const box = today$(page);
  await box.click();
  await box.pressSequentially(text, { delay: 2 });
  await box.press('Enter');
  await expect(page.locator('.fs-msg p', { hasText: text })).toBeVisible();
}
async function council(page: Page, text: string) {
  await page.goto('/#/council');
  await page.getByRole('button', { name: 'New council' }).click();
  await expect(page).toHaveURL(/#\/council\/[\w-]+$/);
  await page.getByRole('button', { name: 'Begin' }).click();
  const box = page.getByRole('textbox', { name: 'Message' });
  await box.fill(text);
  await box.press('Enter');
  await expect(page.locator('.fs-msg').last()).toContainText(text);
}
const walk = async (page: Page) => {
  const tabs = page.getByRole('navigation', { name: 'Sections' });
  for (const slug of ['council', 'questions', 'be', 'flow', 'journal']) {
    const t = tabs.locator(`a[href="#/${slug}"]`);
    await t.click();
    await expect(t).toHaveAttribute('aria-current', 'page');
  }
  for (const r of ['/#/flow/meditate', '/#/flow/energize', '/#/flow/research', '/#/flow/now', '/#/voices', '/#/journal/pages']) await page.goto(r);
  await page.goto('/#/journal');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[data-sheet="Settings"] [data-world]')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
};

test('with no token, nothing leaves the origin and the function is never asked, worn or not', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });
  const bridge = await stubBridge(context);
  const asked: string[] = [];
  context.on('request', r => { if (r.url().includes('/.netlify/')) asked.push(r.url()); });

  await page.goto('/');
  await expect(today$(page)).toBeEnabled();
  await walk(page);
  // the World row offers a place for the token and sends nothing for it
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[data-world] [data-world-token]')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // wear a world, and write in it: still nothing, with no token
  await wear(page, 'eastwinds');
  await expect(today$(page)).toBeEnabled();
  await say(page, 'A line in the world, never kept');
  await council(page, 'A council in the world, with no token');
  await walk(page);
  await page.waitForTimeout(2500);

  expect(bridge.calls).toEqual([]);
  expect(asked).toEqual([]);
  expect(outside).toEqual([]);
});

test('with a token and a world worn: a council line arrives, a journal line only while kept, and the outbox drains after offline', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });
  const bridge = await stubBridge(context);

  await page.goto('/');
  await expect(today$(page)).toBeEnabled();
  // paste the token: the registry is asked for, nothing else
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('[data-world-token]').fill('test-token');
  await page.locator('[data-world-save]').click();
  await expect(page.locator('[data-world] [data-carried]')).toHaveText('Not yet');
  expect(bridge.calls.map(c => new URL(c).searchParams.get('op'))).toEqual(['worlds']);
  await page.getByRole('button', { name: 'Done' }).click();
  // his own pages: writing a council there sends nothing
  await council(page, 'His own council stays home');
  await page.waitForTimeout(2500);
  expect(bridge.log).toEqual([]);

  // wear East Winds: on opening, the pocket comes down; the bible's question is on the Questions list
  await wear(page, 'eastwinds');
  await expect.poll(() => bridge.calls.some(c => c.includes('op=pocket&world=eastwinds'))).toBe(true);
  await page.goto('/#/questions');
  await expect(page.getByText('Does the river freeze in 2071?')).toBeVisible();

  // a council line arrives in bridge_up
  await council(page, 'Dawn would not have said that');
  await expect.poll(() => bridge.log.some(e => e.table === 'messages' && e.row?.text === 'Dawn would not have said that'), { timeout: 10_000 }).toBe(true);
  expect(bridge.log.some(e => e.table === 'pages' && e.row?.kind === 'council')).toBe(true);
  expect(bridge.log.some(e => e.row?.text === 'His own council stays home')).toBe(false);

  // a journal line: nothing until it is kept
  await page.goto('/#/journal');
  const line = 'She keeps it for a year';
  await say(page, line);
  await page.waitForTimeout(2500);
  expect(bridge.log.some(e => e.row?.text === line)).toBe(false);
  await hold(page, line);
  await page.getByRole('switch', { name: /Keep close/ }).click();
  await expect(page.locator('.fs-msg', { hasText: line }).locator('.fs-kept')).toBeVisible();
  await expect.poll(() => bridge.log.find(e => e.row?.text === line)?.row?.kind, { timeout: 10_000 }).toBe('kept');
  const keptId = bridge.log.find(e => e.row?.text === line)!.id;
  // the page itself and its other lines never went
  expect(bridge.log.some(e => e.table === 'pages' && e.row?.kind === 'entry')).toBe(false);
  // unkept: it leaves the bible as a delete
  await hold(page, line);
  await page.getByRole('switch', { name: /Keep close/ }).click();
  await expect.poll(() => bridge.up.get(`eastwinds:messages:${keptId}`)?.deleted, { timeout: 10_000 }).toBe(true);

  // offline: the line waits in the outbox; online again, Carry now drains it
  bridge.state.offline = true;
  await council(page, 'Said in a tunnel');
  await page.waitForTimeout(2500);
  expect(bridge.log.some(e => e.row?.text === 'Said in a tunnel')).toBe(false);
  bridge.state.offline = false;
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('[data-carry-now]').click();
  await expect.poll(() => bridge.log.some(e => e.row?.text === 'Said in a tunnel'), { timeout: 10_000 }).toBe(true);
  await expect(page.locator('[data-world] [data-carried]')).toHaveText(/^Carried \d\d:\d\d$/);

  // every request was this origin's, and every bridge request was the one path
  expect(outside).toEqual([]);
  for (const c of bridge.calls) expect(new URL(c).pathname).toBe(FN);
});
