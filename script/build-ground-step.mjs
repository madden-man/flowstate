#!/usr/bin/env node
// Builds the grounding question's step of design/walkthrough.html (PLAN-SIGN-LINES.md L2) from the running app, as the
// shelf steps are (script/build-shelf-steps.mjs): the vite dev server, Playwright at the walkthrough's 358x722 screen, a
// fixed November 2026 clock by Night, the starter albums' covers from design/tasks/ kept as the ♪ grid would keep them.
// Root's page is scrolled to its shelf: the grounding question first, the deck's three under it with Resolve, the
// 988 line. Its .fs-app markup goes into the step's data-mock phone: links stripped, covers inlined, the plate's canvas
// kept as one still per light. The block between the L2 markers is replaced (the first time it goes after the last
// step), design/index.html is copied from the page, Asks.css is copied to design/asks.css, and the artifact lint runs.
//   node script/build-ground-step.mjs        (PORT, default 4252)
//   SHOTS=dir node script/build-ground-step.mjs   also screenshots Root's page and its door at 390 wide in three lights
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page_ = path.join(root, 'design/walkthrough.html');
const port = Number(process.env.PORT ?? 4252);
const base = `http://127.0.0.1:${port}`;
const SHOTS = process.env.SHOTS;
const BEGIN = '<!-- L2 ground: begin (script/build-ground-step.mjs) -->';
const END = '<!-- L2 ground: end -->';
const SIGN = 'root';

// ---- Root's starter covers, read from the source as build-shelf-steps.mjs reads them
const acts = fs.readFileSync(path.join(root, 'src/model/acts.ts'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'src/db/seed/picks.ts'), 'utf8');
const ids = new Map([
  ...[...seed.matchAll(/album\('[^']+', '((?:[^'\\]|\\.)+)', '((?:[^'\\]|\\.)+)', '([A-Za-z0-9]{22})'\)/g)]
    .map(m => [m[2].replace(/\\'/g, "'"), { by: m[1], id: m[3] }]),
  ...[...acts.matchAll(/\{ by: '((?:[^'\\]|\\.)+)', title: '((?:[^'\\]|\\.)+)', albumId: '([A-Za-z0-9]{22})' \}/g)]
    .map(m => [m[2].replace(/\\'/g, "'"), { by: m[1], id: m[3] }]),
]);
const block = acts.slice(acts.indexOf('STARTER_TITLES'), acts.indexOf('};', acts.indexOf('STARTER_TITLES')));
const titles = [...block.matchAll(/'?([a-z-]+)'?: \[([^\]]+)\]/g)].find(m => m[1] === SIGN)[2];
const ALBUMS = [...titles.matchAll(/'((?:[^'\\]|\\.)+)'/g)].map((t, i) => {
  const title = t[1].replace(/\\'/g, "'");
  const a = ids.get(title);
  if (!a) throw new Error(`no seeded album ${title}`);
  return { title, by: a.by, id: a.id, file: path.join(root, `design/tasks/c-${SIGN}-${i + 1}.jpg`) };
});
const PLAYLIST = 'L2ground0000000000000';

// ---- serve
const vite = path.join(root, 'node_modules/vite/bin/vite.js');
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stop);
for (let k = 0; ; k++) {
  try { if ((await fetch(base)).ok) break; } catch { /* not yet */ }
  if (k > 150) { console.error('vite did not start'); process.exit(1); }
  await new Promise(r => setTimeout(r, 200));
}

const browser = await chromium.launch();
const errors = [];
async function open(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true });
  await context.route('**/*', r => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  const page = await context.newPage();
  await page.clock.install({ time: new Date(2026, 10, 11, 21, 30) });
  await page.clock.resume();
  page.on('pageerror', e => errors.push(String(e)));
  const enter = async hash => {
    await page.goto(`${base}/${hash}`);
    await page.locator('.fs-app').waitFor({ timeout: 60_000 });
    const t = page.locator('[data-threshold]');
    if (await t.count()) await t.click();
    await t.waitFor({ state: 'detached' });
  };
  await enter('#/journal');
  const albums = ALBUMS.map(a => ({ ...a, b64: fs.readFileSync(a.file).toString('base64') }));
  await page.evaluate(async ({ albums, pl }) => {
    const db = await new Promise((res, rej) => { const o = indexedDB.open('flowstate'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
    const at = Date.now();
    const tx = db.transaction(['settings', 'playlists', 'albums', 'shelves'], 'readwrite');
    const s = tx.objectStore('settings');
    const app = await new Promise(r => { const g = s.get('app'); g.onsuccess = () => r(g.result); });
    s.put({ ...app, spotify: { tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: at + 864e5 * 365, name: 'Tommy' }, connectedAt: at, ticked: [pl] } });
    tx.objectStore('playlists').put({ id: pl, name: 'master (ii)', uri: `spotify:playlist:${pl}`, order: 0, snapshotId: 's', total: albums.length, chosen: true, readAt: at });
    albums.forEach((a, i) => {
      const bin = Uint8Array.from(atob(a.b64), c => c.charCodeAt(0));
      tx.objectStore('albums').put({ albumUri: `spotify:album:${a.id}`, album: a.title, artist: a.by, cover: bin.buffer, coverType: 'image/jpeg', coverAt: at });
      tx.objectStore('shelves').put({ playlistId: pl, albumUri: `spotify:album:${a.id}`, order: i, firstTrackUri: `spotify:track:${a.id}` });
    });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, { albums, pl: PLAYLIST });
  await page.reload();
  await enter('#/journal');
  return { page, enter, context };
}

/** Root's page, read, scrolled to its shelf, its questions and its 988 line. */
async function signPage(page) {
  await page.evaluate(h => { location.hash = h; }, `#/flow/c/${SIGN}`);
  await page.locator(`.ck-page[data-chakra="${SIGN}"] .fs-gate`).waitFor();
  await page.locator(`[data-asks="${SIGN}"] [data-ground]`).waitFor();
  await page.locator('.ck-shelf .fs-tile').first().waitFor();
  await page.waitForTimeout(600);
  // the shelf at the top of the sheet, so the questions and the 988 line under them fill the screen
  await page.locator('.ck-shelf').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
}

/** The screen's markup, links stripped, covers and the plate's canvases inlined (a canvas as a still per light). */
async function capture(page) {
  const stills = [];
  for (const l of ['day', 'night', 'still']) {
    await page.evaluate(v => document.documentElement.setAttribute('data-light', v), l);
    await page.waitForTimeout(1500);
    stills.push(await page.evaluate(() => [...document.querySelectorAll('.fs-app canvas')].map(c => c.toDataURL('image/png'))));
  }
  await page.evaluate(() => document.documentElement.setAttribute('data-light', 'night'));
  await page.waitForTimeout(1500);
  return page.evaluate(async stills => {
    const live = document.querySelector('.fs-app');
    // the page scrolls in its own sheet and the phone's screen is shorter than the page: the copy is drawn from the
    // top, so it carries a shift that puts the shelf at the top of the sheet (past where the live page can scroll)
    const scroller = live.querySelector('.fs-sheetof');
    const shelf = live.querySelector('.ck-shelf');
    const shift = scroller && shelf
      ? Math.round(shelf.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - parseFloat(getComputedStyle(scroller).paddingTop))
      : 0;
    const app = live.cloneNode(true);
    app.querySelectorAll('[href]').forEach(a => a.removeAttribute('href'));
    app.querySelectorAll('.fs-sheet').forEach(s => s.removeAttribute('tabindex'));
    app.querySelectorAll('[style*="visibility"]').forEach(s => { s.style.visibility = ''; });
    // the sheet keeps its box and the header; what is on it moves up by the scroll, rules and all
    const copy = app.querySelector('.fs-sheetof');
    if (copy && shift && copy.firstElementChild) {
      copy.firstElementChild.style.marginTop = `-${shift}px`;
      copy.style.backgroundPositionY = `calc(var(--s1) - ${shift}px)`;
    }
    const asData = async src => {
      const b = await (await fetch(src)).blob();
      return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
    };
    for (const img of app.querySelectorAll('img[src^="blob:"]')) img.setAttribute('src', await asData(img.getAttribute('src')));
    app.querySelectorAll('canvas').forEach((c, i) => {
      const box = live.querySelectorAll('canvas')[i];
      const cls = c.getAttribute('class') ?? '';
      const imgs = ['day', 'night', 'still'].map((l, k) =>
        `<img class="${cls}" data-l="${l}" alt="" src="${stills[k][i]}" style="width:${box.clientWidth}px;height:${box.clientHeight}px">`).join('');
      c.outerHTML = imgs;
    });
    return app.outerHTML;
  }, stills);
}

// ---- the walkthrough's screen
const w = await open(358, 722);
await signPage(w.page);
const groundShot = await capture(w.page);
await w.context.close();

// ---- the look at 390 wide in the three lights, and through the door
if (SHOTS) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const s = await open(390, 844);
  const three = async name => {
    for (const l of ['day', 'night', 'still']) {
      await s.page.evaluate(v => document.documentElement.setAttribute('data-light', v), l);
      await s.page.waitForTimeout(1500);
      await s.page.screenshot({ path: path.join(SHOTS, `${name}-${l}.png`) });
    }
  };
  await signPage(s.page);
  await three('ground');
  await s.context.close();
}
await browser.close();
stop();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

// ---- the block
const STEPS = [
  ['ground', 'One always shows', 'Do it, then answer.', 'night', '21:30', 'Flow', groundShot],
];
const html = `${BEGIN}
<link rel="stylesheet" href="asks.css">
${STEPS.map(([id, title, line, light, time, where, shot]) => `<section class="step" id="${id}" data-name="${title}">
  <h2>${title}</h2>
  <p class="line">${line}</p>
  <div class="phone" data-mock><div class="screen" data-light="${light}"><div class="island"></div>
    <div class="status"><span>${time}</span><span>${where}</span></div>
    ${shot}
  </div></div>
</section>`).join('\n')}
${END}
`;
let doc = fs.readFileSync(page_, 'utf8');
const a = doc.indexOf(BEGIN), z = doc.indexOf(END);
if (a >= 0 && z > a) doc = doc.slice(0, a) + html.trimEnd() + doc.slice(z + END.length);
else {
  // first time: after the last step, before the Previous and Next row
  const at = doc.indexOf('<div class="ctl">');
  doc = `${doc.slice(0, at)}${html}\n${doc.slice(at)}`;
}
fs.writeFileSync(page_, doc);
fs.copyFileSync(page_, path.join(root, 'design/index.html'));
fs.copyFileSync(path.join(root, 'src/ui/flow/chakra/Asks.css'), path.join(root, 'design/asks.css'));
console.log(`wrote the L2 block: ${STEPS.length} step, ${(html.length / 1024).toFixed(0)} KB`);
const lint = path.join(os.homedir(), '.claude/hooks/artifact-lint.mjs');
if (fs.existsSync(lint)) execFileSync(process.execPath, [lint, page_], { stdio: 'inherit' });
