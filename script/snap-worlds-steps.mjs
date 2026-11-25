#!/usr/bin/env node
// The main walkthrough's worlds steps (CLAUDE.md rule 5, PLAN-WORLDS.md W1): the real Flow tab sliding to East Winds,
// a cover held and dressed, and East Winds worn with its name over the date, taken from the app's own build (dist,
// from npm run build) at 358 CSS px, the walkthrough's phone width, on the fixture registry and example data
// (script/worlds-fixture.mjs). Each screen's markup is kept as rendered (links stripped, nothing focusable, the kept
// covers inlined as data URLs) and replaces what sits between the <!-- worlds:start --> and <!-- worlds:end --> marks
// in design/walkthrough.html; then design/index.html is copied from it.
// Usage: npm run build && node script/snap-shelf-step.mjs && node script/snap-worlds-steps.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from './worlds-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const dir = path.join(root, 'dist');
const page = path.join(root, 'design/walkthrough.html');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  try { res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(path.join(dir, file))); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

/** The screen as markup: a picture of it, nothing that goes anywhere, the kept covers inlined. */
const capture = (tab, sel = '.fs-app') => tab.evaluate(async sel => {
  const live = document.querySelector(sel);
  const copy = live.cloneNode(true);
  const inline = async src => {
    const blob = await (await fetch(src)).blob();
    return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
  };
  // a picture cannot keep where a row was slid to: the slide is kept as the first cover's margin, and the row is still
  const shelf = live.querySelector('.fl-shelf'), row = copy.querySelector('.fl-shelf');
  if (shelf && row) {
    row.style.overflow = 'hidden';
    row.querySelector('.fl-cover').style.marginLeft = `${-shelf.scrollLeft}px`;
  }
  for (const img of copy.querySelectorAll('img[src^="blob:"]')) img.setAttribute('src', await inline(img.getAttribute('src')));
  copy.querySelectorAll('a[href]').forEach(a => a.removeAttribute('href'));
  copy.querySelectorAll('[data-travel]').forEach(e => e.removeAttribute('data-travel'));
  copy.querySelectorAll('[tabindex]').forEach(e => e.setAttribute('tabindex', '-1'));
  copy.querySelectorAll('input[type="file"]').forEach(e => e.remove());
  copy.querySelector('.fs-moon')?.insertAdjacentHTML('beforeend', '<span class="fs-ring-mark"></span>');
  return copy.outerHTML;
}, sel);

const shots = {};
async function session(light, hour, run) {
  const ctx = await browser.newContext({ viewport: { width: 358, height: 722 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, isMobile: true });
  const tab = await ctx.newPage();
  await tab.clock.setFixedTime(new Date(2026, 10, 25, hour, 30));
  await tab.goto(`${base}#/flow`);
  await tab.locator('.fl-cover').first().waitFor();
  await seed(tab);
  await tab.reload();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  await tab.locator('.fl-lastline[data-read]').waitFor();
  const cdp = await ctx.newCDPSession(tab);
  const slide = async dx => {
    const b = await tab.locator('.fl-shelf').boundingBox();
    const y = b.y + b.height / 2, x0 = b.x + b.width / 2;
    const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y }] });
    await touch('touchStart', x0);
    for (let d = 8 * Math.sign(dx); Math.abs(d) <= Math.abs(dx); d += 8 * Math.sign(dx)) { await touch('touchMove', x0 + d); await tab.waitForTimeout(8); }
    await touch('touchEnd');
    await tab.waitForTimeout(700);
  };
  // the thumb again, should the first slide have been taken for a tap while the page came up
  const toWorld = async () => {
    for (let i = 0; i < 4 && !(await tab.locator('.fl-cover[data-book="eastwinds"][data-front]').count()); i++) await slide(-140);
  };
  await run(tab, toWorld);
  await ctx.close();
}

// East Winds dressed first (as he would have), then slid to by night: the lamp takes its hue
await session('night', 21, async (tab, toWorld) => {
  await toWorld();
  await tab.locator('.fl-cover[data-book="eastwinds"][data-front]').waitFor();
  const c = await tab.locator('.fl-cover[data-front]').boundingBox();
  await tab.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await tab.mouse.down(); await tab.waitForTimeout(650); await tab.mouse.up();
  const sheet = tab.locator('[data-sheet="East Winds wears"]');
  await sheet.waitFor();
  for (const i of [0, 1, 2, 3, 4]) await sheet.locator(`.fs-tile[data-album="spotify:album:ex${i}"]`).click();
  await sheet.locator('.fs-tile[data-album="spotify:album:ex5"]').click();
  await tab.waitForTimeout(500);
  shots.wears = await capture(tab);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await sheet.waitFor({ state: 'detached' });
  await tab.waitForTimeout(400);
  shots.slide = await capture(tab);
});
// put on by day: its Journal, its name over the date
await session('day', 10, async (tab, toWorld) => {
  await toWorld();
  await tab.locator('.fl-cover[data-book="eastwinds"][data-front]').click();
  await tab.waitForURL(/#\/journal$/);
  const today = tab.getByRole('textbox', { name: "Today's page" }).first();
  await today.click();
  await today.pressSequentially('What does it cost her to keep it?', { delay: 2 });
  await tab.locator('[data-saved="true"]').first().waitFor();
  await tab.locator('body').click({ position: { x: 300, y: 600 } });
  await tab.waitForTimeout(500);
  shots.worn = await capture(tab);
});
await browser.close();
server.close();

// one sentence a step, and the engineering behind the last step's one disclosure (the page's word budget is shared by
// every step of the main walkthrough)
const STEPS = [
  { id: 'worlds', name: 'Slide the shelf', line: 'The lamp takes its colour.', light: 'night', time: '21:30', tab: 'Flow', html: shots.slide },
  { id: 'wears', name: 'Hold a cover', line: 'Albums, or a drawing.', light: 'night', time: '21:31', tab: 'Flow', html: shots.wears },
  { id: 'worn', name: 'Tap to put it on', line: 'Its name over the date.', light: 'day', time: '10:31', tab: 'Journal', html: shots.worn, built: [
    ['Shelf', '<code>ui/flow/Shelf.tsx</code>: scroll snap, one cover a stop; each cover\'s distance from the middle (<code>--d</code>, <code>--s</code>) makes it smaller, fainter, turned. Settling: one <code>check</code> tick, and the lamp takes the cover\'s hue by the council\'s mix (none by day, none in Still). The phone\'s tilt leans it (<code>tilt.ts</code>, asked on the first tap).'],
    ['Worlds', 'From <code>settings.worlds</code> on home\'s row (the bridge, W2). With none, his cover alone.'],
    ['Wears', 'Hold a cover: the ticked ♪ playlists\' kept covers, offline, five at most in the order tapped; or a drawing, sealed in that notebook\'s row and its backup; or plain paper.'],
    ['Notebooks', '<code>db/fields.ts</code>: <code>home</code> and <code>book</code>; a world is its own database, <code>flowstate-w-&lt;id&gt;</code>, sealed with the same key. Its own settings fields on its row; the lock, light, sounds, Spotify and Research on home\'s.'],
    ['Reopening', 'The app opens in the world left. Locked, the keypad names it; the ring still opens his own Right now.'],
  ] },
];
const step = s => `<section class="step" id="${s.id}" data-name="${s.name}">
  <h2>${s.name}</h2>
  <p class="line">${s.line}</p>
  <div class="phone" data-mock><div class="screen" data-light="${s.light}" data-step="${s.id}"><div class="island"></div>
    <div class="status"><span>${s.time}</span><span>${s.tab}</span></div>
    ${s.html}
  </div></div>
${s.built ? `  <details><summary>How this is built</summary><table>
${s.built.map(([a, b]) => `    <tr><td>${a}</td><td>${b}</td></tr>`).join('\n')}
  </table></details>\n` : ''}</section>`;
const block = `<!-- worlds:start (script/snap-worlds-steps.mjs: the real shelf and a world worn, PLAN-WORLDS.md W1) -->
${STEPS.map(step).join('\n')}
<!-- worlds:end -->`;

let html = await readFile(page, 'utf8');
const a = html.indexOf('<!-- worlds:start'), b = html.indexOf('<!-- worlds:end -->');
if (a >= 0 && b >= 0) html = html.slice(0, a) + block + html.slice(b + '<!-- worlds:end -->'.length);
else {
  const end = html.indexOf('<!-- shelf:end -->');
  if (end < 0) { console.error('design/walkthrough.html has no shelf marks'); process.exit(1); }
  const at = end + '<!-- shelf:end -->'.length;
  html = html.slice(0, at) + '\n' + block + html.slice(at);
}
await writeFile(page, html);
await copyFile(page, path.join(root, 'design/index.html'));
console.log(`design/walkthrough.html: the worlds steps, ${Math.round(block.length / 1024)} KB; design/index.html copied`);
