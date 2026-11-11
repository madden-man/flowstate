#!/usr/bin/env node
// The main walkthrough's sign's-page steps (PLAN-TASKS.md T1; CLAUDE.md rule 5): the real Heart page at rest, and the
// real Root page through the door, taken from the app's own build (dist, from npm run build) at 358 CSS px, the
// walkthrough's phone width. Their markup is kept as rendered; the plate's canvas (the water's light) becomes one still
// per light, chosen by the screen's data-light, as script/snap-mountain-step.mjs does for the mountain. The result
// replaces what sits between the <!-- tasks-t1:start --> and <!-- tasks-t1:end --> marks in design/walkthrough.html;
// then copy it to design/index.html.
// Usage: npm run build && node script/snap-tasks-step.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const dir = path.join(root, 'dist');
const page = path.join(root, 'design/walkthrough.html');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const file = url.pathname === '/' ? 'index.html' : url.pathname;
  try { res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(path.join(dir, file))); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const TIMES = { day: '2026-11-11T12:00:00', night: '2026-11-11T21:30:00', still: '2026-11-11T21:30:00' };

async function enter(tab, hash) {
  await tab.goto(`${base}${hash}`);
  await tab.locator('.fs-page').first().waitFor();
  const t = tab.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await tab.locator('.ck-page').waitFor();
}

/** The PIN and the door on, then a reload: the app is locked and lets the sign's page through. */
async function lockWithDoor(tab) {
  const tap = async (digits, scope) => {
    for (const d of digits) await scope.locator('.fs-key', { has: tab.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
  };
  await tab.getByRole('button', { name: 'Settings' }).click();
  const settings = tab.locator('[data-sheet="Settings"]');
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const sheet = tab.locator('[data-sheet="Set a PIN"]');
  await tap('3569', sheet);
  await sheet.getByRole('button', { name: 'Next' }).click();
  await tap('3569', sheet);
  await settings.getByRole('button', { name: 'Change PIN' }).waitFor({ timeout: 15_000 });
  await settings.getByRole('switch', { name: /The ring without the PIN/ }).click();
  await settings.getByRole('button', { name: 'Done' }).click();
  await tab.reload();
  await tab.locator('.ck-page[data-door]').waitFor();
}

/** One sign's page in the three lights: its markup (taken by Night) and a still of its canvas per light. */
async function snap(hash, door) {
  let markup = '';
  const stills = [];
  for (const light of ['day', 'night', 'still']) {
    const ctx = await browser.newContext({ viewport: { width: 358, height: 760 }, deviceScaleFactor: 2 });
    const tab = await ctx.newPage();
    await tab.clock.install({ time: new Date(TIMES[light]) });
    await enter(tab, hash);
    // through the door the moon asks for the PIN, so there is no Still behind it: the door's Still frame is the same
    // plate, open, on the unlocked page in Still (the markup is taken by Night, through the door)
    if (door && light !== 'still') await lockWithDoor(tab);
    if (light === 'still') await tab.getByRole('button', { name: 'Still', exact: true }).click();
    // the plate drawn and the water run a while: the steady state
    await tab.clock.runFor(6000);
    await tab.waitForTimeout(800);
    const got = await tab.evaluate(l => {
      const app = document.querySelector('.fs-app');
      const shot = [...app.querySelectorAll('canvas')].map(c => ({ cls: c.className, src: c.toDataURL('image/webp', 0.45) }));
      if (l !== 'night') return { shot };
      const copy = app.cloneNode(true);
      copy.querySelectorAll('canvas').forEach(c => { const m = document.createElement('i'); m.className = c.className; m.setAttribute('data-still-of', c.className); c.replaceWith(m); });
      // a picture of the screen: no links go anywhere, nothing takes focus
      copy.querySelectorAll('a[href]').forEach(a => a.removeAttribute('href'));
      copy.querySelector('.fs-moon')?.insertAdjacentHTML('beforeend', '<span class="fs-ring-mark"></span>');
      copy.querySelectorAll('[tabindex]').forEach(e => e.setAttribute('tabindex', '-1'));
      copy.querySelectorAll('[data-down]').forEach(e => e.removeAttribute('data-down'));
      return { shot, html: copy.outerHTML };
    }, light);
    if (got.html) markup = got.html;
    stills.push({ light, shot: got.shot });
    await ctx.close();
  }
  const imgs = stills.map(s => {
    const c = s.shot.find(x => x.cls === 'ck-light');
    return c ? `<img class="ck-light" data-l="${s.light}" alt="" src="${c.src}">` : '';
  }).join('');
  return markup.replace('<i class="ck-light" data-still-of="ck-light"></i>', imgs);
}

const heart = await snap('#/flow/c/heart', false);
const door = await snap('#/flow/c/root', true);
await browser.close();
server.close();

const step = `<!-- tasks-t1:start (script/snap-tasks-step.mjs: the real sign's page, PLAN-TASKS.md T1) -->
<link rel="stylesheet" href="chakra.css">
<section class="step" id="place" data-name="A sign is a place">
  <h2>A sign is a place</h2>
  <p class="line">Touch a word.</p>
  <div class="phone" data-mock><div class="screen" data-light="night" data-step="place"><div class="island"></div>
    <div class="status"><span>21:30</span><span>Flow</span></div>
    ${heart}
  </div></div>
  <details><summary>How this is built</summary><table>
    <tr><td>Words</td><td><code>model/acts.ts touchesOf</code>, placed by <code>chakra/words.ts</code>, drawn by <code>chakra/Touches.tsx</code>.</td></tr>
    <tr><td>Touch</td><td><code>chakra/touch.ts onTouch</code>; T2 to T4 register handlers in <code>chakra/handlers/</code>.</td></tr>
    <tr><td>Foot</td><td>Gloss, gate, the shelf slot (T5), the 988 line on Heart and Root.</td></tr>
    <tr><td>Door</td><td><code>model/door.ts doorPasses</code> lets <code>#/flow/c/:chakra</code> through; <code>DoorChakraPage</code> prints the touches with <code>door: true</code> (next step).</td></tr>
  </table></details>
</section>
<section class="step" id="place-door" data-name="Through the door">
  <h2>Through the door</h2>
  <p class="line">Nothing written.</p>
  <div class="phone" data-mock><div class="screen" data-light="night" data-step="place-door"><div class="island"></div>
    <div class="status"><span>21:30</span><span>&nbsp;</span></div>
    ${door}
  </div></div>
</section>
<!-- tasks-t1:end -->`;

const html = await readFile(page, 'utf8');
const a = html.indexOf('<!-- tasks-t1:start'), b = html.indexOf('<!-- tasks-t1:end -->');
if (a < 0 || b < 0) { console.error('design/walkthrough.html has no tasks-t1 marks'); process.exit(1); }
await writeFile(page, html.slice(0, a) + step + html.slice(b + '<!-- tasks-t1:end -->'.length));
