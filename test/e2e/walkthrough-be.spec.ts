// The Be walkthrough (PLAN-SELF.md S4): `npm run walkthrough:be` builds the page and the live app into design/be/dist
// (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a sandboxed frame, as the
// artifact host serves it (an opaque origin: no IndexedDB, no Web Storage, no service worker), the app reports ready,
// a step drives it (the goal step deletes a goal with two taps and its balance shows the dashed slot), going back
// starts the step before afresh, a tap answers, and nothing is asked of any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('design/be/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-be-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#goal"></iframe>');
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

test('be walkthrough: the live app starts in a sandboxed frame, each step starts afresh, and nothing leaves', async ({ page, context }) => {
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
  const card = app.locator('#be-px-selfless-selfish');
  const creed = app.locator('.fs-who-line');
  // ready on the deep-linked step: the phone shows the app, never the plain line
  await expect(top.locator('#counter')).toHaveText('Step 8 of 10');
  await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 10_000 });
  await expect(top.locator('#nolive')).toBeHidden();
  // the step's own taps: the goal sheet's Delete twice; the goal goes and its balance shows the dashed slot
  await expect(card.locator('[data-slot-for="it-breathing-room"]')).toBeVisible({ timeout: 15_000 });
  await expect(card.locator('[data-goal="it-volunteer"]')).toHaveCount(0);
  await expect(card.locator('[data-goal="it-breathing-room"]')).toHaveCount(1);
  // Previous starts the step before from its own state: five held, the note on a sixth
  await top.getByRole('button', { name: 'Previous' }).click();
  await expect(top.locator('#counter')).toHaveText('Step 7 of 10');
  const sheet = app.locator('[data-sheet="New paradox"]');
  await expect(sheet.getByText('Five are held. This one rests until one of them does.')).toBeVisible({ timeout: 10_000 });
  await expect(sheet.getByRole('textbox', { name: 'Top: value' })).toHaveValue('patient');
  // a tap of his own answers: Done puts the sheet away
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  // the first step: his line in ink, the unwritten one's three words in grey
  await top.locator('#rail a[href="#creed"]').click();
  await expect(creed).toHaveText(['I give, and I keep enough back to give again.', 'thoughtful (obsessive) · deliberate · reactive'], { timeout: 10_000 });
  await expect(app.locator('.fs-who-line.own')).toHaveCount(1);
  // Not me under the spread, the two seeded lines
  await top.locator('#rail a[href="#notme"]').click();
  await expect(card.locator('button.fs-notme-line')).toHaveText(["I don't say yes to fill the silence.", "I don't keep score."], { timeout: 10_000 });
  // the paradox step deletes thoughtful and reactive: the list and the creed lose it
  await top.locator('#rail a[href="#paradox"]').click();
  await expect(app.locator('.fs-dichotomy .a')).toHaveText(['selfless'], { timeout: 15_000 });
  await expect(creed).toHaveText(['I give, and I keep enough back to give again.']);
  // Still: the creed shows, Not me does not, under the open spread
  await top.locator('#rail a[href="#still"]').click();
  await expect(app.locator('html')).toHaveAttribute('data-light', 'still', { timeout: 10_000 });
  await expect(card.locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true', { timeout: 10_000 });
  await expect(creed.first()).toBeVisible();
  await expect(card.locator('.fs-notme')).toBeHidden();
  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
