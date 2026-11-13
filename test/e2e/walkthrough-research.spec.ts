// The Research walkthrough (PLAN-RESEARCH.md Q6): `npm run walkthrough:research` builds the page and the live app into
// design/research/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it, every one of the fourteen steps loads afresh and shows its own
// screen: Ask's page really plays the recorded run (test/fixtures/research/run-writing.json) through the app's own
// run, titles written in, the check lifting one; a chip quiets a side; Abstract, Write about it and To Council turn
// as they do in the app. No key is checked, no console error, and no request to any other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('design/research/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const QUESTION = 'Does expressive writing help mental health?';
const PAPER = 'doi:10.1111/famp.70206';
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-research-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#sea"></iframe>');
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

test('Research walkthrough: each of the fourteen steps starts afresh in a sandboxed frame, Ask plays the recorded run, and nothing leaves', async ({ page, context }) => {
  test.setTimeout(180_000);
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
    await expect(top.locator('#counter')).toHaveText(`Step ${n} of 14`);
    await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 10_000 });
    await expect(top.locator('#nolive')).toBeHidden();
  };
  const T = { timeout: 10_000 };
  const RUN = { timeout: 30_000 };
  const standing = app.locator('.rs-line:not(.rs-lifting):not(.rs-hush)');

  // 1 the sea's third circle
  await at(1);
  await expect(app.locator('.mt-plate a.mt-circle', { hasText: 'Research' })).toHaveAttribute('href', '#/flow/research', T);
  // 2 no key: where it goes, and Settings under the thumb
  await next(); await at(2);
  await expect(app.locator('[data-print="key"]')).toHaveText('The key goes in Settings.', T);
  await expect(app.getByRole('button', { name: 'Ask' })).toHaveCount(0);
  // 3 Settings opens and the key is typed in and saved
  await next(); await at(3);
  await expect(app.locator('[data-sheet="Settings"] [data-research-last]')).toHaveText('Ends in 0000', RUN);
  // 4 the blank page, the question typed in
  await next(); await at(4);
  await expect(app.locator('[data-print="leaves"]')).toHaveText('This question leaves the phone.', T);
  await expect(app.getByRole('textbox', { name: 'Question' })).toHaveValue(QUESTION, RUN);
  await expect(app.getByRole('button', { name: 'Ask' })).toBeEnabled();
  // 5 the recorded run plays: Looking, a chip breathing, titles landing, then the check lifts the one ruled neither
  await next(); await at(5);
  await expect(app.locator('p.rs-q')).toHaveText(QUESTION, T);
  await expect(app.locator('[data-print="looking"]')).toHaveText('Looking', T);
  await expect(app.locator('.rs-side[data-looking]').first()).toBeAttached(T);
  await expect(app.locator('.rs-line').first()).toBeVisible(T);
  await expect(app.locator('[data-research="question"]')).toHaveAttribute('data-state', 'done', RUN);
  await expect(app.locator('.rs-line:not(.rs-lifting)')).toHaveCount(4, T);
  await expect(app.locator('.rs-line[data-paper-id="doi:10.1111/acer.70412"]')).toHaveCount(0, T);
  await expect(app.locator('.rs-side[data-looking]')).toHaveCount(0);
  // 6 both sides, each title a link to its paper
  await next(); await at(6);
  await expect(app.locator('.rs-line[data-side="for"]')).toHaveCount(3, T);
  await expect(app.locator('.rs-line[data-side="against"] .rs-sp')).toHaveText('− · Acta psychologica · 2026 · Journal article');
  await expect(app.locator(`.rs-line[data-paper-id="${PAPER}"] a.rs-link`)).toHaveAttribute('href', 'https://doi.org/10.1111/famp.70206');
  expect(await app.locator('.fs-app').innerText()).not.toMatch(/NEVER-SHOWN|MODEL-/);
  // 7 − alone
  await next(); await at(7);
  await expect(app.locator('.rs-side[data-side="against"]')).toHaveAttribute('aria-pressed', 'true', T);
  await expect(standing).toHaveCount(1);
  // 8 Abstract turns to the paper's page
  await next(); await at(8);
  await expect(app.locator('[data-research="paper"]')).toBeVisible(T);
  await expect(app.locator('.rs-words > *')).toHaveText(['Open the paper', 'Write about it', 'To Council']);
  await expect(app.locator('.rs-section').first()).toBeVisible();
  // 9 Write about it: today's page, From and the question, the title in its side's voice
  await next(); await at(9);
  await expect(app.locator('.rs-from a')).toHaveText(QUESTION, T);
  await expect(app.locator('.rs-carried a.rs-link')).toHaveAttribute('href', 'https://doi.org/10.1111/famp.70206');
  // 10 To Council: About the question, the title its first line
  await next(); await at(10);
  await expect(app.locator('.fs-from', { hasText: 'About' }).locator('a')).toHaveText(QUESTION, T);
  await expect(app.locator('.rs-carried a.rs-link')).toHaveAttribute('href', 'https://doi.org/10.1111/famp.70206');
  // 11 the lower question: nothing for +, a preprint on −
  await next(); await at(11);
  await expect(app.locator('[data-none="for"]')).toHaveText('Nothing found for +.', T);
  await expect(app.locator('.rs-line[data-side="against"]')).toHaveAttribute('data-tier', '2');
  await expect(app.locator('.rs-line[data-side="against"] .rs-sp')).toContainText('Preprint, not peer reviewed');
  // 12 Asked: both questions, newest first
  await next(); await at(12);
  await expect(app.locator('.rs-asked .fs-list-line')).toHaveText([QUESTION, 'Does writing about a loss lower grief?'], T);
  // 13 Ask again: the old lines struck, the recording played again under them
  await next(); await at(13);
  await expect(app.locator('.rs-earlier .rs-line')).toHaveCount(4, RUN);
  await expect(app.locator('[data-research="question"]')).toHaveAttribute('data-state', 'done', RUN);
  await expect(app.locator('.rs-line:not(.rs-lifting)')).toHaveCount(8, T);
  // 14 Still: the question and the titles, nothing to begin or stop
  await next(); await at(14);
  await expect(app.locator('.rs-line')).toHaveCount(4, T);
  await expect(app.locator('.fs-chips .fs-word')).toHaveCount(0);

  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
