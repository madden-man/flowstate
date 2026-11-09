// The motion pass's walkthrough (PLAN-MOTION.md M6): `npm run walkthrough:motion` builds the page and the live app
// into design/motion/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it (an opaque origin: no IndexedDB, no Web Storage, no service worker),
// the app reports ready, a step drives it, a tap answers, and nothing is asked of any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('design/motion/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-motion-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#tabs"></iframe>');
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

test('walkthrough: the live app starts in a sandboxed frame, a step drives it, and nothing leaves', async ({ page, context }) => {
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
  const tab = (name: string) => app.locator('.fs-tabs').getByRole('link', { name, exact: true });
  // ready: the phone shows the app, never the plain line
  await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 10_000 });
  await expect(top.locator('#nolive')).toBeHidden();
  await expect(top.locator('#counter')).toHaveText('Step 3 of 12');
  await expect(tab('Journal')).toHaveAttribute('aria-current', 'page');
  await expect(app.getByText('(Example data.)')).toBeVisible();
  // a tap in the app answers; a step from outside drives it
  await tab('Council').click();
  await expect(tab('Council')).toHaveAttribute('aria-current', 'page');
  await top.getByRole('button', { name: 'Next' }).click();
  await expect(top.locator('#counter')).toHaveText('Step 4 of 12');
  await expect(tab('Flow')).toHaveAttribute('aria-current', 'page');
  // the music sheet reads its fixtures, covers from the artifact's own files
  await top.getByRole('button', { name: 'Next' }).click();
  await app.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(app.locator('[data-sheet="Playlists"] .fs-playlist')).toHaveCount(4);
  await expect(app.locator('[data-sheet="Playlists"] .fs-strip img').first()).toHaveAttribute('src', /^covers\//);
  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
