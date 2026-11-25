// The Sunday question walkthrough (PLAN-PUSH.md N4): `npm run walkthrough:push` builds the page and the live app into
// design/push/dist (and runs the artifact lint and check-dist on it). Served as plain files and opened inside a
// sandboxed frame, as the artifact host serves it (an opaque origin: no IndexedDB, no Web Storage, no service worker),
// the deep-linked step opens, every step's live app reports ready and draws its screen, the drawn lock screen carries
// his line, Next and Previous and the arrows turn the steps, the real controls answer (Allow on iOS's question turns
// Notify me on, the PIN opens the landing, Later puts the line away), the lint passes, and nothing is asked of any
// other host.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = path.resolve('design/push/dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const STEPS = ['question', 'notify', 'sendnow', 'lock', 'pin', 'landing', 'later', 'safari'];
const LINE = 'Is there anything on your mind?';
let server: Server;
let base = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['script/build-push-walkthrough.mjs'], { stdio: 'pipe' });
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/sandbox.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts" src="index.html#notify"></iframe>');
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

test('push walkthrough: the live app starts in a sandboxed frame, every step draws its screen, and nothing leaves', async ({ page, context }) => {
  test.setTimeout(180_000);
  const outside: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/^Blocked autofocusing/.test(m.text())) errors.push(m.text()); });
  await context.route('**/*', route => {
    if (route.request().url().startsWith(base)) return route.continue();
    outside.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${base}sandbox.html`);
  const top = page.frameLocator('iframe');
  const app = top.frameLocator('#app');
  // the deep link: step 2, Notify me tapped and iOS asking over Settings
  await expect(top.locator('#counter')).toHaveText(`Step 2 of ${STEPS.length}`);
  await expect(top.locator('.screen:not(.down)')).toBeVisible({ timeout: 15_000 });
  await expect(top.locator('#nolive')).toBeHidden();
  await expect(top.locator('[data-mock]')).toHaveCount(1);
  const ask = app.locator('[data-ios="permission"]');
  await expect(ask).toContainText('Would Like to Send You Notifications', { timeout: 15_000 });
  // Allow: the real row turns on, with Send one now
  await ask.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(ask).toHaveCount(0);
  await expect(app.locator('[data-push-switch]')).toHaveAttribute('aria-checked', 'true');
  await expect(app.locator('[data-push-send]')).toBeVisible();
  // Previous and Next turn the steps
  await top.getByRole('button', { name: 'Previous' }).click();
  await expect(top.locator('#counter')).toHaveText(`Step 1 of ${STEPS.length}`);
  await top.getByRole('button', { name: 'Next' }).click();
  await expect(top.locator('#counter')).toHaveText(`Step 2 of ${STEPS.length}`);

  for (const [k, id] of STEPS.entries()) {
    await top.locator(`#rail a[href="#${id}"]`).click();
    await expect(top.locator('#counter')).toHaveText(`Step ${k + 1} of ${STEPS.length}`);
    await expect(top.locator(`section.step#${id}.on h2`)).toBeVisible();
    if (id === 'lock') {
      // iOS's lock screen, drawn: one notification, his line, no app loaded
      await expect(top.locator('#lockscreen')).toBeVisible();
      await expect(top.locator('#lockscreen .ls-note')).toHaveCount(1);
      await expect(top.locator('#lockscreen .ls-note p')).toHaveText(LINE);
      await expect(top.locator('#app')).toHaveCount(0);
      continue;
    }
    await expect(top.locator('#lockscreen')).toBeHidden();
    await expect(top.locator('#app')).toHaveAttribute('data-step', id, { timeout: 15_000 });
    const sw = app.locator('[data-push-switch]');
    if (id === 'question') {
      await expect(app.locator('[data-checkin] [data-checkin-question]')).toHaveValue(LINE, { timeout: 15_000 });
      await expect(app.locator('[data-checkin] [data-checkin-time]')).toHaveValue('10:00');
      await expect(sw).toHaveAttribute('aria-checked', 'false');
    }
    if (id === 'notify') await expect(app.locator('[data-ios="permission"]')).toBeVisible({ timeout: 15_000 });
    if (id === 'sendnow') {
      await expect(sw).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
      await expect(app.locator('[data-push-arrived]')).toHaveText('Last arrived Sunday 10:00');
    }
    if (id === 'pin') {
      // the real keypad: 3569 opens the journal and the landing follows
      await expect(app.getByRole('group', { name: 'PIN' })).toBeVisible({ timeout: 15_000 });
      for (const d of '3569') await app.locator('.fs-key', { has: app.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
      await expect(app.locator('.fs-msg p', { hasText: LINE })).toBeVisible({ timeout: 15_000 });
    }
    if (id === 'landing') {
      await expect(app.locator('.fs-msg p', { hasText: LINE })).toBeVisible({ timeout: 15_000 });
      await expect(app.locator('.fs-msg.fs-wise textarea')).toBeVisible();
      await expect(app.locator('[data-backup-nag], [data-checkin-line]')).toHaveCount(0);
    }
    if (id === 'later') {
      const line = app.locator('[data-checkin-line]');
      await expect(line.locator('.fs-quietline-tap')).toHaveText(LINE, { timeout: 15_000 });
      await line.getByRole('button', { name: 'Later' }).click();
      await expect(line).toHaveCount(0);
    }
    if (id === 'safari') {
      await expect(top.locator('#safaribar')).toBeVisible();
      await expect(sw).toBeDisabled({ timeout: 15_000 });
      await expect(app.locator('[data-push="needsHomeScreen"]')).toContainText('Add to Home Screen first');
    } else await expect(top.locator('#safaribar')).toBeHidden();
  }
  // the arrows turn the steps: from the last, right goes round to the first
  await top.locator('header.top h1').click();
  await page.keyboard.press('ArrowRight');
  await expect(top.locator('#counter')).toHaveText(`Step 1 of ${STEPS.length}`);
  await page.keyboard.press('ArrowLeft');
  await expect(top.locator('#counter')).toHaveText(`Step ${STEPS.length} of ${STEPS.length}`);
  // the relight control relights the shown app in place; Still hides the switch's state
  await top.locator('.lights [data-light="still"]').click();
  await expect(app.locator('html')).toHaveAttribute('data-light', 'still');
  await top.locator('.lights [data-light="night"]').click();
  await expect(app.locator('html')).toHaveAttribute('data-light', 'night');
  expect(outside).toEqual([]);
  expect(errors).toEqual([]);
});
