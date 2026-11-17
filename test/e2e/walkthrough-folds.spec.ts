// The folds walkthrough (PLAN-FOLDS.md G3): `npm run walkthrough:folds` builds the page and the live app into
// design/folds/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it, every one of the ten steps loads afresh and shows its own state:
// the folds set by the app's settings and by taps on the headings, the held steps a real row mid-drag where the
// driver's touch pointer events left it, and landed the row let go. No console error and no request to any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('design/folds/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-folds-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#places"></iframe>');
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

test('folds walkthrough: each of the ten steps starts afresh in a sandboxed frame, shows its state, and nothing leaves', async ({ page, context }) => {
  test.setTimeout(150_000);
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
  const next = () => top.getByRole('button', { name: 'Next' }).click();
  const at = async (n: number) => {
    await expect(top.locator('#counter')).toHaveText(`Step ${n} of 10`);
    await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 10_000 });
    await expect(top.locator('#nolive')).toBeHidden();
  };
  const T = { timeout: 10_000 };
  const head = (place: string) => app.locator(`.fs-values [data-heading="${place}"]`);
  const run = (place: string) => head(place).locator('.run');
  const words = (place: string) => app.locator(`.fs-values .fs-be-row[data-place="${place}"] > .fs-dichotomy .a`);
  const folded = app.locator('.fs-values .fs-be-head[data-folded]');
  const lifted = app.locator('.fs-values .fs-be-row.lift');

  // 1 five headings; the three tiers open with their strokes, Resting and Legacy folded into their words
  await at(1);
  await expect(app.locator('.fs-be-head .w')).toHaveText(['First', 'Second', 'Third', 'Resting', 'Legacy'], T);
  await expect(app.locator('.fs-be-head .stroke')).toHaveCount(3);
  await expect(words('1')).toHaveText(['honesty', 'courage']);
  await expect(run('resting')).toHaveText('play');
  await expect(run('legacy')).toHaveText('perfection');
  // 2 Second folded by a tap on its heading: its words on its one line
  await next(); await at(2);
  await expect(head('2').locator('button')).toHaveAttribute('aria-expanded', 'false', T);
  await expect(run('2')).toHaveText('presence·patience');
  await expect(words('2')).toHaveCount(0);
  // 3 all five folded: five lines, no row
  await next(); await at(3);
  await expect(folded).toHaveCount(5, T);
  await expect(app.locator('.fs-values .fs-be-row')).toHaveCount(0);
  await expect(run('1')).toHaveText('honesty·courage');
  // 4 craft held where it was: open places end in a landing rule, folded lines dashed, and the folds kept
  await next(); await at(4);
  await expect(lifted.locator('.a')).toHaveText('craft', T);
  await expect(lifted).toHaveAttribute('data-place', '3');
  await expect(app.locator('.fs-values .fs-be-head.folded.land')).toHaveCount(3);
  await expect(app.locator('.fs-values [data-land]')).toHaveCount(2);
  // 5 carried into First, between honesty and courage, at First's size
  await next(); await at(5);
  await expect(lifted).toHaveAttribute('data-place', '1', T);
  await expect(words('1')).toHaveText(['honesty', 'craft', 'courage']);
  await expect(lifted.locator('.fs-value-t1')).toHaveCount(1);
  // 6 over Second's folded line: it rides alone under the line, its word last in the run, in italic
  await next(); await at(6);
  await expect(lifted).toHaveAttribute('data-place', '2', T);
  await expect(lifted).toHaveClass(/\binfold\b/);
  await expect(run('2').locator('.riding')).toHaveText('craft');
  await expect(run('2')).toHaveText('presence·patience·craft');
  // 7 let go: Second still folded, one word longer; Third empty on its dashed rule
  await next(); await at(7);
  await expect(run('2')).toHaveText('presence·patience·craft', T);
  await expect(lifted).toHaveCount(0);
  await expect(app.locator('.fs-values [data-land="3"]')).toHaveCount(1);
  await expect(head('2')).toHaveAttribute('data-folded', '');
  // 8 honesty open, Second and Third folded below it
  await next(); await at(8);
  await expect(app.getByRole('group', { name: 'Place' }).getByRole('button', { name: 'First' })).toHaveAttribute('aria-pressed', 'true', T);
  await expect(app.locator('.fs-be-since')).toHaveText('First since 11 / 12 / 26');
  await expect(folded).toHaveCount(4);
  // 9 in Night, the tiers folded and the shelves opened by taps: a dashed and a dotted stroke, Legacy's dates
  await next(); await at(9);
  await expect(app.locator('html')).toHaveAttribute('data-light', 'night', T);
  await expect(head('resting').locator('.stroke')).toHaveCount(1, T);
  await expect(head('legacy').locator('.stroke')).toHaveCount(1);
  await expect(words('resting')).toHaveText(['play']);
  await expect(app.locator('.fs-value-dates')).toHaveText(['8 / 3 / 26 to 11 / 12 / 26']);
  // 10 Still: First's words alone though First is folded, nothing to open
  await next(); await at(10);
  await expect(app.locator('.fs-be-row .fs-value')).toHaveText(['honesty', 'courage'], T);
  await expect(app.locator('.fs-values .fs-be-head, .fs-values button')).toHaveCount(0);

  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
