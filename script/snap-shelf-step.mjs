#!/usr/bin/env node
// The main walkthrough's Flow step (CLAUDE.md rule 5, PLAN-WORLDS.md WF): the real Flow tab, the shelf with his own
// cover and the ways in under it, taken from the app's own build (dist, from npm run build) at 358 CSS px, the
// walkthrough's phone width, with one example line on yesterday's page and the clock fixed on 11 / 25 / 26. Its markup
// is kept as rendered (links stripped, nothing focusable) and replaces what sits between the <!-- shelf:start --> and
// <!-- shelf:end --> marks in design/walkthrough.html; then design/index.html is copied from it.
// Usage: npm run build && node script/snap-shelf-step.mjs
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
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  try { res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(path.join(dir, file))); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 358, height: 722 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const tab = await ctx.newPage();
await tab.clock.setFixedTime(new Date(2026, 10, 25, 10, 0));
await tab.goto(`${base}#/flow`);
await tab.locator('.fs-app').waitFor();
// one line on yesterday's page (example data), written as the journal writes it
await tab.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction(['pages', 'messages'], 'readwrite');
    const at = new Date(2026, 10, 24, 21, 40).getTime();
    tx.objectStore('pages').put({ id: 'pg-example', kind: 'entry', createdAt: at, updatedAt: at, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] });
    tx.objectStore('messages').put({ id: 'm-example', pageId: 'pg-example', at, text: 'Then the answer is not a list of people. It is the pace.', kept: false });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}));
await tab.reload();
await tab.locator('.fl-lastline[data-read]').waitFor();
await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
const markup = await tab.evaluate(() => {
  const copy = document.querySelector('.fs-app').cloneNode(true);
  // a picture of the screen: no links go anywhere, nothing takes focus, nothing is named for a view transition
  copy.querySelectorAll('a[href]').forEach(a => a.removeAttribute('href'));
  copy.querySelectorAll('[data-travel]').forEach(e => e.removeAttribute('data-travel'));
  copy.querySelectorAll('[tabindex]').forEach(e => e.setAttribute('tabindex', '-1'));
  // the ring that stands in for the moon in Still, as every other screen of the walkthrough carries it
  copy.querySelector('.fs-moon')?.insertAdjacentHTML('beforeend', '<span class="fs-ring-mark"></span>');
  return copy.outerHTML;
});
await browser.close();
server.close();

const built = [
  ['Gone', 'The mountain, the signs, their pages, questions, albums and animations (PLAN-WORLDS.md 4.1). Their rows stay in the notebook and its backups, unread.'],
  ['Cover', '<code>ui/flow/Shelf.tsx</code>: name in the serif, a voice hue on the spine, paper in that hue. Still: paper and seam. A tap opens the Journal.'],
  ['Under it', 'The newest journal line (<code>model/pages.ts lastLine</code>); the three circles open their pages as before; Right now reaches every flow.'],
  ['Next', 'W1 slides the worlds onto this shelf (<code>model/notebooks.ts</code>).'],
];
const step = `<!-- shelf:start (script/snap-shelf-step.mjs: the real Flow tab, PLAN-WORLDS.md WF) -->
<link rel="stylesheet" href="shelf.css">
<section class="step" id="flow" data-name="Flow: your own pages">
  <h2>Flow: your own pages</h2>
  <p class="line">Your notebook in front, its ways in beneath.</p>
  <div class="phone" data-mock><div class="screen" data-light="day" data-step="flow"><div class="island"></div>
    <div class="status"><span>10:00</span><span>Flow</span></div>
    ${markup}
  </div></div>
  <details><summary>How this is built</summary><table>
${built.map(([a, b]) => `    <tr><td>${a}</td><td>${b}</td></tr>`).join('\n')}
  </table></details>
</section>
<!-- shelf:end -->`;

const html = await readFile(page, 'utf8');
const a = html.indexOf('<!-- shelf:start'), b = html.indexOf('<!-- shelf:end -->');
if (a < 0 || b < 0) { console.error('design/walkthrough.html has no shelf marks'); process.exit(1); }
await writeFile(page, html.slice(0, a) + step + html.slice(b + '<!-- shelf:end -->'.length));
await copyFile(page, path.join(root, 'design/index.html'));
console.log(`design/walkthrough.html: the Flow step, ${Math.round(step.length / 1024)} KB; design/index.html copied`);
