// The Energize walkthrough (PLAN-ENERGIZE.md X6): `npm run walkthrough:energize` builds the page and the live app into
// design/energize/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it (an opaque origin: no IndexedDB, no Web Storage, no service worker),
// the app reports ready, a step drives it (the swap puts Jazz piano in the third card), going back starts the step
// before afresh, a tap answers, and nothing is asked of any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('design/energize/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-energize-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#swap"></iframe>');
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

test('energize walkthrough: the live app starts in a sandboxed frame, each step starts afresh, and nothing leaves', async ({ page, context }) => {
  const outside: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    outside.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${base}sandbox.html`);
  const top = page.frameLocator('iframe');
  const app = top.frameLocator('#app');
  const cards = app.locator('.fx-cards .fx-card');
  // ready on the deep-linked step: the phone shows the app, never the plain line
  await expect(top.locator('#counter')).toHaveText('Step 3 of 9');
  await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 10_000 });
  await expect(top.locator('#nolive')).toBeHidden();
  // the step's own taps: the sheet rises on Japan Trip and the Jazz piano row goes into the third card
  await expect(cards.nth(2)).toContainText('Jazz piano', { timeout: 10_000 });
  await expect(app.locator('.fx-deckpeek')).toContainText('Japan Trip');
  await expect(cards.nth(1)).toContainText('Since 8 / 20');
  // Previous starts the step before from its own state: Japan Trip is back in the third card, its sheet up
  await top.getByRole('button', { name: 'Previous' }).click();
  await expect(top.locator('#counter')).toHaveText('Step 2 of 9');
  await expect(app.locator('.fx-sheet .fs-sheet-title h2')).toHaveText('Japan Trip', { timeout: 10_000 });
  await expect(cards.nth(2)).toContainText('Japan Trip');
  // a tap of his own answers: Done puts the sheet away
  await app.locator('.fx-sheet').getByRole('button', { name: 'Done' }).click();
  await expect(app.locator('.fx-sheet .fs-sheet')).toHaveCount(0);
  // What stuck has its ribbons, in the pinned day's months
  await top.locator('#rail a[href="#stuck"]').click();
  await expect(app.locator('.fx-rib')).toHaveCount(6, { timeout: 10_000 });
  await expect(app.locator('.fx-rib').first()).toContainText('East Winds');
  await expect(app.locator('.fx-axis')).toContainText('Aug');
  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
