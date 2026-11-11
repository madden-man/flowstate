// The mountain walkthrough (PLAN-MOUNTAIN.md R5): `npm run walkthrough:mountain` builds the page and the live app into
// design/mountain/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it (an opaque origin: no IndexedDB, no Web Storage, no service worker),
// the app reports ready, a step drives it through the real controls (the Heart's gate shut, the meter raised, a sign
// tapped into its page), going back starts the step before afresh, Still hides every state, and nothing is asked of
// any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('design/mountain/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-mountain-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#close"></iframe>');
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

test('mountain walkthrough: the live app starts in a sandboxed frame, each step drives the real mountain, and nothing leaves', async ({ page, context }) => {
  test.setTimeout(90_000);
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
  const plate = app.locator('.mt-plate');
  // ready on the deep-linked step: the phone shows the app, never the plain line
  await expect(top.locator('#counter')).toHaveText('Step 4 of 11');
  await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 10_000 });
  await expect(top.locator('#nolive')).toBeHidden();
  await expect(plate.locator('a.mt-stop')).toHaveCount(7);
  // the step's own touch: the Heart's gate shut to .9 through its own keys, its sign emptied, one reading written
  await expect(plate).toHaveAttribute('data-gates', '0.000,0.000,0.000,0.900,0.000,0.000,0.000', { timeout: 15_000 });
  await expect(plate.locator('a.mt-stop[data-chakra="heart"] .fs-sign')).toHaveAttribute('data-closed', '0.90');
  // Previous starts the step before from its own state: every gate open, and the meter raised to .7
  await top.getByRole('button', { name: 'Previous' }).click();
  await expect(top.locator('#counter')).toHaveText('Step 3 of 11');
  await expect(plate).toHaveAttribute('data-d', '0.700', { timeout: 15_000 });
  await expect(plate).toHaveAttribute('data-gates', '0.000,0.000,0.000,0.000,0.000,0.000,0.000');
  // the tap step: the Heart opens its own page
  await top.locator('#rail a[href="#tap"]').click();
  await expect(app.locator('.ck-page[data-chakra="heart"] .ck-plate')).toBeVisible({ timeout: 15_000 });
  // after a click inside the phone the arrows still turn the steps: step 7 is another sign's page, the Throat's
  await app.locator('.fs-hdr-r').click();
  await page.keyboard.press('ArrowRight');
  await expect(top.locator('#counter')).toHaveText('Step 7 of 11');
  await expect(app.locator('.ck-page[data-chakra="throat"] .ck-plate')).toBeVisible({ timeout: 15_000 });
  // the live step: the dot at The bottom, and the 988 line on the page
  await top.locator('#rail a[href="#live"]').click();
  await expect(app.locator('.ck-page[data-front="depress"] [data-tip="depress-4-988"]')).toBeVisible({ timeout: 15_000 });
  // Still: the stored heavy day shows nothing of itself, no meter and no gates
  await top.locator('#rail a[href="#still"]').click();
  await expect(app.locator('html')).toHaveAttribute('data-light', 'still', { timeout: 15_000 });
  await expect(app.locator('.mt-plate')).toBeVisible();
  await expect(app.locator('.mt-meter')).toBeHidden();
  await expect(app.locator('.mt-gate').first()).toBeHidden();
  // the relight control relights the shown app in place
  await top.locator('.lights [data-light="day"]').click();
  await expect(app.locator('html')).toHaveAttribute('data-light', 'day');
  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
