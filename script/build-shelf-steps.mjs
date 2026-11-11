#!/usr/bin/env node
// Builds the shelf steps of design/walkthrough.html (PLAN-TASKS.md T5) from the running app, the way the picks steps
// were (script/build-picks-walkthrough.mjs): the vite dev server, Playwright at the walkthrough's 358x722 screen, a
// fixed November 2026 clock, a journal given Spotify tokens that go nowhere (every request off the dev host is
// aborted) and the starter albums' covers from design/tasks/ kept as the ♪ grid would keep them. The sign's page
// does not hold its shelf yet (the rebuilt page leaves it a slot), so script/shelf-slot.tsx renders the real
// SignShelf under the gate. Each step's .fs-app markup goes into its data-mock phone: links stripped, covers inlined,
// the plate's canvas kept as one still per light. The block between the T5 markers is replaced, design/index.html is
// copied from the page, and the artifact lint runs.
//   node script/build-shelf-steps.mjs        (PORT, default 4251)
//   SHOTS=dir node script/build-shelf-steps.mjs   also screenshots at 390 wide in the three lights
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page_ = path.join(root, 'design/walkthrough.html');
const port = Number(process.env.PORT ?? 4251);
const base = `http://127.0.0.1:${port}`;
const SHOTS = process.env.SHOTS;
const BEGIN = '<!-- T5 shelves: begin (script/build-shelf-steps.mjs) -->';
const END = '<!-- T5 shelves: end -->';

// ---- the starters, read from the source: each sign's three titles, their Spotify ids, their covers in design/tasks
const acts = fs.readFileSync(path.join(root, 'src/model/acts.ts'), 'utf8');
const seed = fs.readFileSync(path.join(root, 'src/db/seed/picks.ts'), 'utf8');
const ids = new Map([...seed.matchAll(/album\('[^']+', '((?:[^'\\]|\\.)+)', '((?:[^'\\]|\\.)+)', '([A-Za-z0-9]{22})'\)/g)]
  .map(m => [m[2].replace(/\\'/g, "'"), { by: m[1], id: m[3] }]));
const block = acts.slice(acts.indexOf('STARTER_TITLES'), acts.indexOf('};', acts.indexOf('STARTER_TITLES')));
const STARTERS = [...block.matchAll(/'?([a-z-]+)'?: \[([^\]]+)\]/g)].map(m => ({
  sign: m[1], titles: [...m[2].matchAll(/'((?:[^'\\]|\\.)+)'/g)].map(t => t[1].replace(/\\'/g, "'")),
}));
const ALBUMS = STARTERS.flatMap(s => s.titles.map((title, i) => {
  const a = ids.get(title);
  if (!a) throw new Error(`no seeded album ${title}`);
  return { title, by: a.by, id: a.id, file: path.join(root, `design/tasks/c-${s.sign}-${i + 1}.jpg`) };
}));
const PLAYLIST = 'T5signs00000000000000';

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

/** The sign's page with its shelf under the gate. */
async function signPage(page, sign) {
  await page.evaluate(h => { location.hash = h; }, `#/flow/c/${sign}`);
  await page.locator(`.ck-page[data-chakra="${sign}"] .fs-gate`).waitFor();
  await page.evaluate(async s => { (await import('/script/shelf-slot.tsx')).mount(s); }, sign);
  await page.locator('.ck-shelf .fs-tile').first().waitFor();
  await page.waitForTimeout(600);
}
async function signsSheet(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => { location.hash = '#/journal'; });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.locator('.fs-music-seg').getByRole('button', { name: 'Signs' }).click();
  await page.locator('.ck-signs .fs-tile').first().waitFor();
  await page.waitForTimeout(900);
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
    const app = live.cloneNode(true);
    app.querySelectorAll('[href]').forEach(a => a.removeAttribute('href'));
    app.querySelectorAll('.fs-sheet').forEach(s => s.removeAttribute('tabindex'));
    app.querySelectorAll('[style*="visibility"]').forEach(s => { s.style.visibility = ''; });
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

// ---- the walkthrough's two screens
const w = await open(358, 722);
await signPage(w.page, 'heart');
await w.page.locator('.ck-shelf').evaluate(el => el.scrollIntoView({ block: 'center' }));
const shelfShot = await capture(w.page);
await signsSheet(w.page);
const signsShot = await capture(w.page);
await w.context.close();

// ---- the look at 390 wide in the three lights
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
  await signPage(s.page, 'heart');
  await s.page.locator('.ck-shelf').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await three('shelf');
  // lifted: a long press on the second cover, let go where it was
  const t = s.page.locator('.ck-shelf .fs-tile').nth(1);
  const b = await t.boundingBox();
  await s.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await s.page.mouse.down();
  await s.page.waitForTimeout(700);
  await s.page.mouse.up();
  await three('shelf-lifted');
  await s.page.keyboard.press('Escape');
  await signsSheet(s.page);
  await three('signs');
  await s.context.close();
}
await browser.close();
stop();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

// ---- the block
const STEPS = [
  ['shelf', 'A shelf on every sign', 'Tap plays; hold lifts.', 'night', '21:30', 'Flow', shelfShot],
  ['signs', 'All seven under ♪', 'A name opens its sign.', 'night', '21:31', 'Journal', signsShot],
];
const html = `${BEGIN}
<link rel="stylesheet" href="sign-shelf.css">
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
fs.copyFileSync(path.join(root, 'src/ui/flow/chakra/SignShelf.css'), path.join(root, 'design/sign-shelf.css'));
console.log(`wrote the T5 block: ${STEPS.length} steps, ${(html.length / 1024).toFixed(0)} KB`);
const lint = path.join(os.homedir(), '.claude/hooks/artifact-lint.mjs');
if (fs.existsSync(lint)) execFileSync(process.execPath, [lint, page_], { stdio: 'inherit' });
