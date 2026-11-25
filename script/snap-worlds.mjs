#!/usr/bin/env node
// Screens of the worlds on the shelf (PLAN-WORLDS.md W1), from the app's own build (dist, from npm run build), on the
// fixture registry (test/fixtures/worlds.json) with example lines and stand-in album covers drawn as plain squares
// of one voice colour each (example data, never a real album's art), at the walkthrough's phone width, in a light.
// Used by the walkthrough step builder and for the PR's screenshots.
// Usage: node script/snap-worlds.mjs <out dir> [day|night|still]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from './worlds-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const out = path.resolve(process.argv[2] ?? 'shots');
const lights = process.argv[3] ? [process.argv[3]] : ['day', 'night', 'still'];
await mkdir(out, { recursive: true });
const dir = path.join(root, 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  try { res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(path.join(dir, file))); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

for (const light of lights) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, isMobile: true });
  const tab = await ctx.newPage();
  await tab.clock.setFixedTime(new Date(2026, 10, 25, light === 'day' ? 10 : 21, 30));
  await tab.goto(`${base}#/flow`);
  await tab.locator('.fs-app').waitFor();
  await seed(tab);
  // East Winds once, so it has a line and a cover of its own (written as the app writes them)
  await tab.reload();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  const pin = async l => {
    if (l === 'still') { if (!(await tab.locator('html[data-light="still"]').count())) await tab.getByRole('button', { name: 'Still', exact: true }).click(); return; }
    await tab.locator('.fs-hdr').getByRole('button', { name: 'Settings' }).click();
    await tab.locator('[data-sheet="Settings"]').getByRole('button', { name: l === 'day' ? 'Day' : 'Night', exact: true }).click();
    await tab.locator('[data-sheet="Settings"]').getByRole('button', { name: 'Done' }).click();
    await tab.locator('[data-sheet="Settings"]').waitFor({ state: 'detached' });
  };
  // Still is entered once and kept: every screen below is taken in it
  await pin(light);
  const snap = async name => { await tab.waitForTimeout(450); await tab.screenshot({ path: path.join(out, `${name}-${light}.png`) }); };
  const cover = id => tab.locator(`.fl-cover[data-book="${id}"]`);
  // his own in front
  await tab.locator('.fl-lastline[data-read]').waitFor();
  await snap('shelf-own');
  // a world in front: a thumb slides the shelf one cover to the left, and East Winds settles in the middle
  const cdp = await ctx.newCDPSession(tab);
  const box = await tab.locator('.fl-shelf').boundingBox();
  const y = box.y + box.height / 2, x0 = box.x + box.width * .7;
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y }] });
  await touch('touchStart', x0);
  for (let dx = 8; dx <= 140; dx += 8) { await touch('touchMove', x0 - dx); await tab.waitForTimeout(8); }
  await touch('touchEnd');
  await tab.locator('.fl-cover[data-book="eastwinds"][data-front]').waitFor();
  // dress East Winds: hold, tick five
  await cover('eastwinds').hover();
  await tab.mouse.down(); await tab.waitForTimeout(650); await tab.mouse.up();
  const sheet = tab.locator('[data-sheet="East Winds wears"]');
  await sheet.waitFor();
  for (const i of [0, 1, 2, 3, 4]) await sheet.locator(`.fs-tile[data-album="spotify:album:ex${i}"]`).click();
  await sheet.locator(`.fs-tile[data-album="spotify:album:ex5"]`).click();
  await snap('wears');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await sheet.waitFor({ state: 'detached' });
  await snap('shelf-world');
  // put East Winds on: its Journal, the name over the date
  await cover('eastwinds').click();
  await tab.waitForURL(/#\/journal$/);
  const today = tab.getByRole('textbox', { name: "Today's page" }).first();
  await today.click();
  await today.pressSequentially('What does it cost her to keep it?', { delay: 2 });
  await tab.locator('[data-saved="true"]').first().waitFor();
  await tab.locator('.fs-hdr-world').first().waitFor();
  await snap('journal-world');
  // the lock screen in a world
  await tab.locator('.fs-hdr').getByRole('button', { name: 'Settings' }).click();
  const settings = tab.locator('[data-sheet="Settings"]');
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const ps = tab.locator('[data-sheet="Set a PIN"]');
  const key = async d => { for (const c of d) await ps.locator('.fs-key', { has: tab.locator('b', { hasText: new RegExp(`^${c}$`) }) }).click(); };
  await key('3569'); await ps.getByRole('button', { name: 'Next' }).click(); await key('3569');
  await settings.getByRole('button', { name: 'Change PIN' }).waitFor({ timeout: 20_000 });
  await tab.reload();
  await tab.getByRole('group', { name: 'PIN' }).waitFor();
  await snap('lock-world');
  await ctx.close();
}
await browser.close();
server.close();
console.log(`shots in ${out}`);
