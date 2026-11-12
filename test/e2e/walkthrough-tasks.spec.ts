// The tasks walkthrough (PLAN-TASKS.md T6): `npm run walkthrough:tasks` builds the page and the live app into
// design/tasks/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it (an opaque origin: no IndexedDB, no Web Storage, no service worker),
// the deep-linked step opens, every step's live app reports ready and draws its screen, Next and Previous and the
// arrows turn the steps, a step drives the real controls (Grieve's stone, Feel's surge, Ask landing on the journal with
// the sign beside the date, the door), the covers load from their own files, the lint passes, and nothing is asked of
// any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = path.resolve('design/tasks/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const STEPS = ['held', 'place', 'grieve', 'look-far', 'basics', 'surge', 'ask', 'back', 'stand-on', 'send', 'i-will', 'shelf', 'signs', 'door', 'sea'];
/** What each step's app shows once it has drawn. */
const SHOWS: Record<string, string> = {
  held: '.mt-plate', signs: '.fs-page', door: '.ck-page[data-door] .ck-plate', sea: '.ck-page .ck-plate, .mt-plate',
};
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-tasks-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#grieve"></iframe>');
      return;
    }
    const file = path.join(dir, path.normalize(url.pathname).replace(/^\/+/, ''));
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}/`;
});
test.afterAll(() => new Promise<void>(r => server.close(() => r())));

test('the built page passes the artifact lint', () => {
  const lint = path.join(os.homedir(), '.claude/hooks/artifact-lint.mjs');
  test.skip(!existsSync(lint), 'artifact-lint not on this machine');
  const out = execFileSync(process.execPath, [lint, path.join(dir, 'index.html')], { encoding: 'utf8' });
  expect(out).toMatch(/^PASS/);
});

test('tasks walkthrough: the live app starts in a sandboxed frame, every step draws its screen, and nothing leaves', async ({ page, context }) => {
  test.setTimeout(180_000);
  const outside: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  // Chrome's own notice that the out-of-app rules' autofocus is not honoured in a cross-origin frame (the artifact
  // host's): the rule is still there to tap, so it is not the app's error
  page.on('console', m => { if (m.type() === 'error' && !/^Blocked autofocusing/.test(m.text())) errors.push(m.text()); });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    outside.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${base}sandbox.html`);
  const top = page.frameLocator('iframe');
  const app = top.frameLocator('#app');
  // the deep link: step 3, Grieve, and the phone shows the app, never the plain line
  await expect(top.locator('#counter')).toHaveText(`Step 3 of ${STEPS.length}`);
  await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 15_000 });
  await expect(top.locator('#nolive')).toBeHidden();
  await expect(top.locator('[data-mock]')).toHaveCount(1);
  // the step's own touch: the name typed on the rule sinks and stays as a stone, and the gate asks
  await expect(app.locator('.ck-stage [data-stone]')).toHaveCount(1, { timeout: 15_000 });
  await expect(app.locator('.fs-gate')).toHaveAttribute('data-stale', '');
  // Previous and Next turn the steps, and each starts from its own state
  await top.getByRole('button', { name: 'Previous' }).click();
  await expect(top.locator('#counter')).toHaveText(`Step 2 of ${STEPS.length}`);
  await expect(app.locator('.ck-page[data-chakra="heart"] .ck-touch[data-lit]')).toHaveAttribute('data-touch', 'grieve', { timeout: 15_000 });
  await expect(app.locator('.ck-stage [data-stone]')).toHaveCount(0);
  await top.getByRole('button', { name: 'Next' }).click();
  await expect(top.locator('#counter')).toHaveText(`Step 3 of ${STEPS.length}`);

  // every step, from the rail: its own screen drawn in the one phone
  for (const [k, id] of STEPS.entries()) {
    await top.locator(`#rail a[href="#${id}"]`).click();
    await expect(top.locator('#counter')).toHaveText(`Step ${k + 1} of ${STEPS.length}`);
    await expect(top.locator(`section.step#${id}.on h2`)).toBeVisible();
    await expect(top.locator('#app')).toHaveAttribute('data-step', id, { timeout: 15_000 });
    await expect(app.locator(SHOWS[id] ?? '.ck-page .ck-plate').first()).toBeVisible({ timeout: 15_000 });
    if (id === 'surge') await expect(app.locator('.ck-light')).toHaveAttribute('data-surge', '', { timeout: 15_000 });
    if (id === 'ask') {
      await expect(app.locator('.fs-msg p', { hasText: 'What am I not seeing?' })).toBeVisible({ timeout: 15_000 });
      await expect(app.locator('.fs-hdr-r [data-sign-back="third-eye"]')).toBeVisible();
    }
    if (id === 'send') await expect(app.locator('.ck-stage [data-out="send"] a.out-go')).toHaveText('Ali', { timeout: 15_000 });
    if (id === 'door') {
      expect(await app.locator('.ck-touch').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.touch))).toEqual(['five', 'breathe']);
      await expect(app.locator('.fs-gate, .ck-shelf')).toHaveCount(0);
    }
    if (id === 'signs') {
      await expect(app.locator('.ck-signs .ck-sign-row')).toHaveCount(7, { timeout: 15_000 });
      // the covers are their own files beside the page, loaded
      const img = app.locator('.ck-signs img[src="c-heart-2.jpg"]');
      await expect(img).toBeVisible();
      expect(await img.evaluate(i => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
  }
  // the arrows turn the steps: from the last, right goes round to the first
  await top.locator('header.top h1').click();
  await page.keyboard.press('ArrowRight');
  await expect(top.locator('#counter')).toHaveText(`Step 1 of ${STEPS.length}`);
  await page.keyboard.press('ArrowLeft');
  await expect(top.locator('#counter')).toHaveText(`Step ${STEPS.length} of ${STEPS.length}`);
  // the relight control relights the shown app in place
  await top.locator('.lights [data-light="day"]').click();
  await expect(app.locator('html')).toHaveAttribute('data-light', 'day');
  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
