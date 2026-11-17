// The blockers walkthrough (PLAN-BLOCKERS.md K6): `npm run walkthrough:blockers` builds the page and the live app into
// design/blockers/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it (an opaque origin: no IndexedDB, no Web Storage, no service worker),
// the deep-linked step opens, every step's live app reports ready and draws its screen, Next and Previous and the
// arrows turn the steps, a step drives the real controls (a Blockers row opening Panic, a step word, the long press
// that raises Root blockers and strikes 3 a.m., Resolve, Edit's deck sheet), the lint passes, and nothing is asked of
// any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = path.resolve('design/blockers/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const STEPS = ['blockers', 'drawing', 'walk', 'running', 'decide', 'draft', 'asks', 'resolve', 'next', 'deck', 'journal', 'qtab', 'qpage', 'still', 'door'];
const GROUND = 'Feel your feet on the floor. What are five things you can see?';
const DECK = ['What is true right here, in this room?', 'What do you need in the next hour?', 'What has held before when it felt like this?'];
/** What each step's app shows once it has drawn. */
const SHOWS: Record<string, string> = {
  drawing: '.fs-flowpage[data-flow="panic"] .fl-drawing', walk: '.fs-flowpage[data-flow="panic"] .fl-drawing',
  draft: '.fs-flowpage[data-flow="gripping"][data-draft]', journal: '.fs-col .fs-msg.fs-wise', qtab: '.fs-qlist .fs-qitem',
  qpage: '.fs-qtitle', door: '.ck-page[data-door] .ck-plate',
};
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-blockers-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#decide"></iframe>');
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

test('blockers walkthrough: the live app starts in a sandboxed frame, every step draws its screen, and nothing leaves', async ({ page, context }) => {
  test.setTimeout(180_000);
  const outside: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  // Chrome's own notice that autofocus is not honoured in a cross-origin frame (the artifact host's): not the app's error
  page.on('console', m => { if (m.type() === 'error' && !/^Blocked autofocusing/.test(m.text())) errors.push(m.text()); });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    outside.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${base}sandbox.html`);
  const top = page.frameLocator('iframe');
  const app = top.frameLocator('#app');
  // the deep link: step 5, the sheet a long press raises, and the phone shows the app, never the plain line
  await expect(top.locator('#counter')).toHaveText(`Step 5 of ${STEPS.length}`);
  await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 15_000 });
  await expect(top.locator('#nolive')).toBeHidden();
  await expect(top.locator('[data-mock]')).toHaveCount(1);
  // the step's own touch: the long press raised Root blockers, 3 a.m. is struck there and gone from the page
  const sheet = app.locator('.fs-sheet[data-sheet="Root blockers"]');
  await expect(sheet.locator('.bk-pick[data-flow="night"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  await expect(sheet.locator('.bk-pick[data-flow="night"] .bk-tag')).toHaveText('also Crown');
  await expect(app.locator('[data-blockers]:not([data-wait]) .bk-row .fs-list-line')).toHaveText(['Panic', 'What if']);
  // Previous and Next turn the steps, and each starts from its own state
  await top.getByRole('button', { name: 'Previous' }).click();
  await expect(top.locator('#counter')).toHaveText(`Step 4 of ${STEPS.length}`);
  await top.getByRole('button', { name: 'Next' }).click();
  await expect(top.locator('#counter')).toHaveText(`Step 5 of ${STEPS.length}`);

  // every step, from the rail: its own screen drawn in the one phone
  for (const [k, id] of STEPS.entries()) {
    await top.locator(`#rail a[href="#${id}"]`).click();
    await expect(top.locator('#counter')).toHaveText(`Step ${k + 1} of ${STEPS.length}`);
    await expect(top.locator(`section.step#${id}.on h2`)).toBeVisible();
    await expect(top.locator('#app')).toHaveAttribute('data-step', id, { timeout: 15_000 });
    await expect(app.locator(SHOWS[id] ?? '.ck-page .ck-plate').first()).toBeVisible({ timeout: 15_000 });
    const rows = app.locator('[data-blockers]:not([data-wait]) .bk-row');
    if (id === 'blockers') {
      await expect(rows.locator('.fs-list-line')).toHaveText(['Panic', 'What if', '3 a.m.'], { timeout: 15_000 });
      await expect(app.locator('.ck-for[data-for="root"] [data-versus]')).toHaveText('Safetyvs.fear');
      // the shelf's covers are their own files beside the page, loaded
      const img = app.locator('.ck-shelf img[src="c-root-1.jpg"]');
      await expect(img).toBeVisible({ timeout: 15_000 });
      expect(await img.evaluate(i => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    if (id === 'drawing') {
      await expect(app.locator('.fs-flowpage[data-flow="panic"]')).toBeVisible({ timeout: 15_000 });
      await expect(app.locator('.fs-hdr').getByRole('link', { name: 'Root', exact: true })).toBeVisible();
    }
    if (id === 'walk') await expect(app.locator('.fs-flowpage[data-flow="panic"]')).toHaveAttribute('data-showing', '2', { timeout: 15_000 });
    if (id === 'running') {
      await expect(rows.first()).toHaveAttribute('data-live', 'true', { timeout: 15_000 });
      await expect(rows.first().locator('.bk-now')).toHaveText('Night before');
    }
    if (id === 'draft') await expect(app.getByRole('button', { name: '+ step' })).toBeVisible();
    if (id === 'asks') {
      await expect(app.locator('[data-asks="root"] [data-ground="root"]')).toHaveText(GROUND, { timeout: 15_000 });
      await expect(app.locator('[data-asks="root"] .ck-ask')).toHaveText(DECK);
    }
    if (id === 'resolve') await expect(app.locator('[data-asks="root"] .ck-ask-row').first()).toHaveClass(/\bdone\b/, { timeout: 15_000 });
    if (id === 'next') await expect(app.locator('[data-asks="root"] .ck-ask').first()).toHaveText('Where in the body is it quiet?', { timeout: 15_000 });
    if (id === 'deck') {
      const deck = app.locator('[data-sheet="Root asks"]');
      await expect(deck.getByRole('textbox', { name: 'The line' })).toHaveValue('You want to be safe. The alarm rings when nothing is wrong.', { timeout: 15_000 });
      await expect(deck.locator('.ck-deck-done')).toHaveCount(2);
    }
    if (id === 'journal') await expect(app.locator('.fs-msg.fs-wise', { hasText: DECK[1] }).getByRole('checkbox', { name: 'Resolved' })).toBeVisible();
    if (id === 'qtab') await expect(app.getByRole('group', { name: 'Resolved' }).locator('.fs-list-line')).toHaveText(['Is the Tuesday class worth keeping?']);
    if (id === 'qpage') await expect(app.locator('.fs-qtitle').getByRole('checkbox', { name: 'Resolved' })).toHaveText('Resolve');
    if (id === 'still') {
      await expect(app.locator('html')).toHaveAttribute('data-light', 'still');
      await expect(rows).toHaveText(['Panic', 'What if', '3 a.m.'], { timeout: 15_000 });
    }
    if (id === 'door') {
      await expect(app.locator('.ck-page[data-door] [data-ground="root"]')).toHaveText(GROUND);
      await expect(app.locator('.fs-gate, .ck-shelf, [data-blockers]')).toHaveCount(0);
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
