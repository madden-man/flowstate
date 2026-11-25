#!/usr/bin/env node
// The main walkthrough's World step (CLAUDE.md rule 5, PLAN-WORLDS.md W2): the real Settings sheet with the World row,
// a bridge token saved and the last carry at 10:00, taken from the app's own build (dist, from npm run build) at 358 CSS
// px, the walkthrough's phone width, with East Winds worn and the clock fixed on 11 / 25 / 26. The token, the world and
// the time are example data written into the notebook before the load; no request reaches a real function (the bridge
// path answers 404 here). Its markup is kept as rendered (links stripped, nothing focusable) and replaces what sits
// between the <!-- world:start --> and <!-- world:end --> marks in design/walkthrough.html, or goes in before the
// "Keep it yours" step the first time; then design/index.html is copied from it.
// Usage: npm run build && node script/snap-world-step.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const dir = path.join(root, 'dist');
const page = path.join(root, 'design/walkthrough.html');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname.startsWith('/.netlify/')) { res.writeHead(404).end(); return; }
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  try { res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(path.join(dir, file))); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 358, height: 722 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const tab = await ctx.newPage();
await tab.clock.setFixedTime(new Date(2026, 10, 25, 10, 20));
await tab.goto(`${base}#/journal`);
await tab.locator('.fs-app').waitFor();
// the first open seeds and writes its settings row; the example data goes in after that, or the seed writes over it
await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
await tab.waitForTimeout(1000);
// example data: a token saved, carried at 10:00, East Winds worn (home's row names it, as the app reopens in it)
await tab.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction(['settings'], 'readwrite');
    const st = tx.objectStore('settings');
    const g = st.get('app');
    g.onsuccess = () => st.put({
      ...g.result, world: 'eastwinds',
      worlds: [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }, { id: 'songbook', name: 'Songbook', kind: 'songs' }],
      bridge: { token: 'example-token', upAt: new Date(2026, 10, 25, 10, 0).getTime() },
    });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}));
await tab.reload();
await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
await tab.getByRole('button', { name: 'Settings' }).click();
const row = tab.locator('[data-sheet="Settings"] [data-world]');
await row.waitFor();
await tab.locator('[data-world] [data-carried]').filter({ hasText: 'Carried 10:00' }).waitFor();
const markup = await tab.evaluate(() => {
  const copy = document.querySelector('.fs-app').cloneNode(true);
  copy.querySelectorAll('a[href]').forEach(a => a.removeAttribute('href'));
  copy.querySelectorAll('[data-travel]').forEach(e => e.removeAttribute('data-travel'));
  copy.querySelectorAll('[tabindex]').forEach(e => e.setAttribute('tabindex', '-1'));
  copy.querySelector('.fs-moon')?.insertAdjacentHTML('beforeend', '<span class="fs-ring-mark"></span>');
  // the sheet as scrolled down to the World row: the rows above Research are scrolled out of sight, so left out
  const research = copy.querySelector('[data-research]');
  const rows = research?.parentElement;
  if (rows) while (rows.firstElementChild && rows.firstElementChild !== research) rows.firstElementChild.remove();
  // and below Voices, out of sight too (the Right now shortcut row would print this server's own address)
  const voices = rows?.querySelector('[data-world]')?.nextElementSibling;
  if (voices) while (voices.nextElementSibling) voices.nextElementSibling.remove();
  return copy.outerHTML;
});
await browser.close();
server.close();

const built = [
  ['Token', 'Sealed with the PIN on home\'s settings row (<code>settings.bridge</code>), through <code>model/carry.ts</code>. Locked, the row is not drawn.'],
  ['Carried', 'When the function last acknowledged a batch (<code>bridge.upAt</code>). No count of what went (rule 15).'],
  ['Carry now', 'The registry, then the outbox up and the pocket down for the world worn (<code>src/bridge/up.ts</code>, <code>down.ts</code>).'],
  ['Opt-in', 'Nothing is sent until a token is saved and a world is worn. The function is <code>/.netlify/functions/bridge</code>, same origin (docs/BRIDGE.md).'],
];
const step = `<!-- world:start (script/snap-world-step.mjs: the real Settings sheet, PLAN-WORLDS.md W2) -->
<section class="step" id="world" data-name="Carry a world">
  <h2>Carry a world</h2>
  <p class="line">Paste the token once; Carry now sends what waits.</p>
  <div class="phone" data-mock><div class="screen" data-light="day" data-step="settings"><div class="island"></div>
    <div class="status"><span>10:20</span><span>Journal</span></div>
    ${markup}
  </div></div>
  <details><summary>How this is built</summary><table>
${built.map(([a, b]) => `    <tr><td>${a}</td><td>${b}</td></tr>`).join('\n')}
  </table></details>
</section>
<!-- world:end -->`;

let html = await readFile(page, 'utf8');
const a = html.indexOf('<!-- world:start'), b = html.indexOf('<!-- world:end -->');
if (a >= 0 && b >= 0) html = html.slice(0, a) + step + html.slice(b + '<!-- world:end -->'.length);
else {
  const at = html.indexOf('<section class="step" id="yours"');
  if (at < 0) { console.error('design/walkthrough.html has no "Keep it yours" step to go before'); process.exit(1); }
  const mark = html.lastIndexOf('<!--', at);
  const cut = mark >= 0 && html.slice(mark, at).trim().endsWith('-->') ? mark : at;
  html = html.slice(0, cut) + step + '\n\n' + html.slice(cut);
}
await writeFile(page, html);
await copyFile(page, path.join(root, 'design/index.html'));
console.log(`design/walkthrough.html: the World step, ${Math.round(step.length / 1024)} KB; design/index.html copied`);
