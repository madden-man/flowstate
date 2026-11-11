// The values walkthrough (PLAN-VALUES.md C6): `npm run walkthrough:values` builds the page and the live app into
// design/values/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it (an opaque origin: no IndexedDB, no Web Storage, no service worker),
// every one of the eleven steps loads afresh and shows its own screen, driven by its own taps, with no console error
// and no request to any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('design/values/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-values-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#be"></iframe>');
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

test('values walkthrough: each of the eleven steps starts afresh in a sandboxed frame, shows its screen, and nothing leaves', async ({ page, context }) => {
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
    await expect(top.locator('#counter')).toHaveText(`Step ${n} of 11`);
    await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 10_000 });
    await expect(top.locator('#nolive')).toBeHidden();
  };
  const rows = app.locator('.fs-be-row');

  // 1 the list, his order, wonder with the dashed rule
  await at(1);
  await expect(app.locator('.fs-be-core')).toHaveText('I determine my core.');
  await expect(rows.locator('.fs-dichotomy .a')).toHaveText(['honesty', 'selfless', 'thoughtful', 'play', 'discipline', 'wonder'], { timeout: 10_000 });
  await expect(rows.last().locator('.fs-spoke-none')).toHaveCount(1);
  // 2 the value sheet on a new value, typed in
  await next(); await at(2);
  await expect(app.locator('.fs-valuesheet input[aria-label="Shadow"]')).toHaveValue('safety', { timeout: 10_000 });
  await expect(app.locator('.fs-valuesheet input[aria-label="Value"]')).toHaveValue('courage');
  // 3 honesty opened on discretion, its champions with their whys, no record yet
  await next(); await at(3);
  const open = app.locator('.fs-be-row.open');
  await expect(open.locator('.fs-value-open .b')).toHaveText('discretion', { timeout: 10_000 });
  await expect(open.locator('.fs-champ')).toHaveCount(3);
  await expect(open.locator('.fs-champ-why').first()).toHaveValue('I say it to their face, and I stay in the room after.');
  await expect(open.locator('.fs-said-for')).toHaveCount(0);
  // 4 the champion sheet
  await next(); await at(4);
  await expect(app.locator('.fs-sheet-title h2')).toHaveText('Who fights for honesty?', { timeout: 10_000 });
  // 5 the Champions segment
  await next(); await at(5);
  await expect(app.locator('.fs-champ-voice').filter({ hasText: 'Warrior' })).toContainText('honesty, reactive', { timeout: 10_000 });
  // 6 Who sits, honesty chosen for what, its champions seated
  await next(); await at(6);
  await expect(app.getByRole('group', { name: 'For what' }).getByRole('button', { name: 'honesty' })).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  await expect(app.getByRole('group', { name: 'Who sits' }).getByRole('button', { name: 'Warrior', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // 7 a council line tapped and confirmed for honesty
  await next(); await at(7);
  await expect(app.locator('.fs-sp-for')).toHaveText([' · for honesty'], { timeout: 10_000 });
  await expect(app.locator('.fs-composer-wrap').getByRole('group', { name: 'Spoke for' })).toBeVisible();
  // 8 Mystic's line confirmed for the shadow, drawn the same
  await next(); await at(8);
  await expect(app.locator('.fs-sp-for')).toHaveText([' · for honesty', ' · for discretion'], { timeout: 10_000 });
  // 9 the journal row
  await next(); await at(9);
  await expect(app.locator('.fs-col .fs-msg[data-line]').filter({ hasText: 'Call him' }).locator('.fs-sp')).toHaveText('Warrior · for honesty', { timeout: 10_000 });
  // 10 Said for it, dated, and Call a council
  await next(); await at(10);
  await expect(app.locator('.fs-saidline')).toHaveCount(2, { timeout: 10_000 });
  await expect(app.locator('.fs-saidline').first()).toContainText('Then tell him tonight, not in a letter.');
  await expect(app.getByRole('button', { name: 'Call a council' })).toBeVisible();
  // 11 Still: the words alone, nothing to open
  await next(); await at(11);
  await expect(app.locator('.fs-be-row .fs-value')).toHaveCount(6, { timeout: 10_000 });
  await expect(app.locator('.fs-be-row button')).toHaveCount(0);
  await expect(app.locator('.fs-seg')).toBeHidden();

  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
