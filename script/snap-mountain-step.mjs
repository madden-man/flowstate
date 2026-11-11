#!/usr/bin/env node
// The main walkthrough's Flow step (CLAUDE.md rule 5, PLAN-MOUNTAIN.md R5): design/walkthrough.html draws every
// screen from the app's own markup and CSS (design/parts.css), and the mountain is no exception. This takes the real
// Flow tab from the mountain walkthrough's live app (design/mountain/dist, built by npm run walkthrough:mountain) at
// rest in each light, keeps its markup as rendered, and stands in for its two canvases (the light and the air) with
// a still frame of each, one per light, chosen by the screen's data-light. The result replaces what sits between the
// <!-- mountain:start --> and <!-- mountain:end --> marks in design/walkthrough.html; then copy it to design/index.html.
// Usage: npm run walkthrough:mountain && node script/snap-mountain-step.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const dir = path.join(root, 'design/mountain/dist');
const page = path.join(root, 'design/walkthrough.html');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  try { res.writeHead(200, { 'Content-Type': TYPES[path.extname(url.pathname)] ?? 'application/octet-stream' }).end(await readFile(path.join(dir, url.pathname))); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
// the walkthrough's phone screen is 358 CSS px wide
const tab = await browser.newPage({ viewport: { width: 358, height: 760 }, deviceScaleFactor: 2 });

let markup = '';
const stills = [];
for (const light of ['day', 'night', 'still']) {
  await tab.goto(`${base}app.html?step=water&light=${light}&n=1`);
  await tab.locator('.mt-plate[data-arrive="done"]').waitFor();
  // the water has run a while: the steady state
  await tab.waitForTimeout(4000);
  const got = await tab.evaluate(l => {
    const app = document.querySelector('.fs-app');
    const shot = [...app.querySelectorAll('canvas')].map(c => ({ cls: c.className, src: c.toDataURL('image/webp', 0.7) }));
    if (l !== 'day') return { shot };
    const copy = app.cloneNode(true);
    copy.querySelectorAll('canvas').forEach(c => { const m = document.createElement('i'); m.className = c.className; m.setAttribute('data-still-of', c.className); c.replaceWith(m); });
    // a picture of the screen: no links go anywhere, nothing takes focus
    copy.querySelectorAll('a[href]').forEach(a => a.removeAttribute('href'));
    // the ring that stands in for the moon in Still, as every other screen of the walkthrough carries it
    copy.querySelector('.fs-moon')?.insertAdjacentHTML('beforeend', '<span class="fs-ring-mark"></span>');
    copy.querySelectorAll('[tabindex]').forEach(e => e.setAttribute('tabindex', '-1'));
    return { shot, html: copy.outerHTML };
  }, light);
  if (got.html) markup = got.html;
  stills.push({ light, shot: got.shot });
}
await browser.close();
server.close();

// each canvas becomes one img per light, in the canvas's own place and class
for (const cls of ['mt-air', 'mt-light']) {
  const imgs = stills.map(s => {
    const c = s.shot.find(x => x.cls === cls);
    return c ? `<img class="${cls}" data-l="${s.light}" alt="" src="${c.src}">` : '';
  }).join('');
  markup = markup.replace(`<i class="${cls}" data-still-of="${cls}"></i>`, imgs);
}

const step = `<!-- mountain:start (script/snap-mountain-step.mjs: the real Flow tab, its canvases as stills per light) -->
<section class="step" id="mountain" data-name="Flow: the mountain">
  <h2>Flow: the mountain</h2>
  <p class="line">Seven signs, one stream.</p>
  <div class="phone" data-mock><div class="screen" data-light="night" data-step="mountain"><div class="island"></div>
    <div class="status"><span>21:15</span><span>Flow</span></div>
    ${markup}
  </div></div>
</section>
<!-- mountain:end -->`;

const html = await readFile(page, 'utf8');
const a = html.indexOf('<!-- mountain:start'), b = html.indexOf('<!-- mountain:end -->');
if (a < 0 || b < 0) { console.error('design/walkthrough.html has no mountain marks'); process.exit(1); }
await writeFile(page, html.slice(0, a) + step + html.slice(b + '<!-- mountain:end -->'.length));
console.log(`design/walkthrough.html: the mountain step, ${Math.round(step.length / 1024)} KB`);
