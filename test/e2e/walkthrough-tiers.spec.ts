// The tiers walkthrough (PLAN-TIERS.md B3): `npm run walkthrough:tiers` builds the page and the live app into
// design/tiers/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it, every one of the nine steps loads afresh and shows its own screen:
// the lifted steps hold a real row mid-drag where the driver's touch pointer events left it. No console error and no
// request to any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('design/tiers/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-tiers-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#start"></iframe>');
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

test('tiers walkthrough: each of the nine steps starts afresh in a sandboxed frame, shows its screen, and nothing leaves', async ({ page, context }) => {
  test.setTimeout(120_000);
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
    await expect(top.locator('#counter')).toHaveText(`Step ${n} of 9`);
    await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 10_000 });
    await expect(top.locator('#nolive')).toBeHidden();
  };
  const words = (place: string) => app.locator(`.fs-values .fs-be-row[data-place="${place}"] > .fs-dichotomy .a`);
  const lifted = app.locator('.fs-values .fs-be-row.lift');
  const T = { timeout: 10_000 };

  // 1 every value in Second, First and Third on their landing rules, both shelves shut
  await at(1);
  await expect(words('2')).toHaveText(['honesty', 'courage', 'presence', 'patience', 'craft'], T);
  await expect(app.locator('[data-land]')).toHaveCount(2);
  await expect(app.locator('.fs-be-shelf button')).toHaveText(['Resting', 'Legacy']);
  // 2 honesty held: nothing open, a rule at the end of every tier and at the head of both shelves
  await next(); await at(2);
  await expect(lifted.locator('.a')).toHaveText('honesty', T);
  await expect(app.locator('[data-land]')).toHaveCount(5);
  await expect(app.locator('.fs-value-body')).toHaveCount(0);
  // 3 carried over Second's heading into First
  await next(); await at(3);
  await expect(lifted).toHaveAttribute('data-place', '1', T);
  // 4 the sorted list
  await next(); await at(4);
  await expect(words('1')).toHaveText(['honesty', 'courage'], T);
  await expect(words('2')).toHaveText(['presence', 'patience']);
  await expect(words('3')).toHaveText(['craft']);
  // 5 honesty open: the five words, First pressed, and since when
  await next(); await at(5);
  await expect(app.getByRole('group', { name: 'Place' }).getByRole('button', { name: 'First' })).toHaveAttribute('aria-pressed', 'true', T);
  await expect(app.locator('.fs-be-since')).toHaveText('First since 11 / 12 / 26');
  // 6 craft held over Resting
  await next(); await at(6);
  await expect(lifted).toHaveAttribute('data-place', 'resting', T);
  await expect(lifted.locator('.a')).toHaveText('craft');
  // 7 patience held over Legacy
  await next(); await at(7);
  await expect(lifted).toHaveAttribute('data-place', 'legacy', T);
  await expect(lifted.locator('.a')).toHaveText('patience');
  // 8 Legacy open, each with its dates
  await next(); await at(8);
  await expect(app.locator('.fs-value-dates')).toHaveText(['8 / 3 / 26 to 11 / 12 / 26', '11 / 6 / 26 to 11 / 12 / 26'], T);
  // 9 Still: First's words alone, nothing to open
  await next(); await at(9);
  await expect(app.locator('.fs-be-row .fs-value')).toHaveText(['honesty', 'courage'], T);
  await expect(app.locator('.fs-be-row button')).toHaveCount(0);

  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
