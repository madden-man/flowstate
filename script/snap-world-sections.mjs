#!/usr/bin/env node
// The sections in a world (CLAUDE.md rule 5, PLAN-WORLDS.md W4), a walkthrough of its own: design/in-a-world.html.
// The main walkthrough (design/walkthrough.html) is at its word budget, so this path, wearing a novel and writing in
// it, is a second walkthrough (the artifact rule's split by path); its last step links back to the main one.
//
// Every screen is the real app from its own build (dist, from npm run build) at 358 CSS px, the walkthrough's phone
// width, on example data: East Winds and its pocket (characters, places, a chapter, an event, three questions) come
// down from a stubbed bridge function exactly as the phone fetches them, and the pages written in the world are put
// into its notebook as the app stores them with no PIN. Each screen's markup is kept as rendered (links stripped,
// nothing focusable). The page's shell (its rail, lights and script) is the main walkthrough's own.
// Usage: npm run build && node script/snap-world-sections.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const dir = path.join(root, 'dist');
const out = path.join(root, 'design/in-a-world.html');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  try { res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(path.join(dir, file))); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

// ---- example data ----
const T = (d, h, m) => new Date(2026, 10, d, h, m).getTime();
const POCKET = {
  kind: 'novel', storyYear: 2071, span: { from: 2040, to: 2080 },
  characters: [
    { id: 'ren', fullName: 'Abbot Ren', firstName: 'Ren', familyColour: '#8a6a4a', born: 2010, died: 2069 },
    { id: 'li', fullName: 'Mrs. Li', firstName: 'Li', familyColour: '#8a5ac0', born: 2033 },
    { id: 'sydney', fullName: 'Sydney', firstName: 'Sydney', familyColour: '#d04848', born: 2037 },
    { id: 'siyuan', fullName: 'Siyuan', firstName: 'Siyuan', familyColour: '#3a70d0', born: 2041 },
    { id: 'dawn', fullName: 'Dawn Li', firstName: 'Dawn', familyColour: '#3a9a5a', born: 2062 },
  ],
  places: [{ id: 'gate', name: 'the temple gate' }, { id: 'river', name: 'the river' }],
  chapters: [{ id: 'ch12', title: 'The flood', year: 2071 }],
  events: [{ id: 'ev1', title: 'The spring flood', year: 2071 }],
  questions: [
    { id: 'q-who', question: 'Who raises Dawn after 2065?', state: 'open', changedAt: T(11, 10, 2) },
    { id: 'q-leave', question: 'Does Siyuan leave before the flood, or after?', state: 'open', changedAt: T(11, 10, 1) },
    { id: 'q-intro', question: 'Which year is the Introduction?', state: 'decided', decision: '2071, the spring.', changedAt: T(11, 10, 0) },
  ],
};
const page = (id, kind, at, extra = {}) => ({ id, kind, createdAt: at, updatedAt: at, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [], ...extra });
const line = (id, pageId, at, text, extra = {}) => ({ id, pageId, at, updatedAt: at, text, kept: false, ...extra });
const ROWS = {
  pages: [
    page('pg-day', 'entry', T(25, 9, 30), { year: 2071, chips: { characterIds: ['siyuan', 'dawn'], placeIds: [] } }),
    page('q-leave', 'question', T(11, 10, 1), { title: 'Does Siyuan leave before the flood, or after?', state: 'answered', answeredAt: T(25, 21, 39), updatedAt: T(25, 21, 39) }),
    page('pg-in', 'council', T(25, 22, 20), { year: 2071, reading: 'in', seats: ['c:dawn', 'c:siyuan'] }),
  ],
  messages: [
    line('m1', 'pg-day', T(25, 9, 31), 'Trying the leaving again. Maybe it is quieter than I had it.'),
    line('m2', 'pg-day', T(25, 9, 33), 'Siyuan leaves the temple in 2071, the spring after the flood.', { kept: true, chips: { characterIds: ['siyuan'], placeIds: ['gate'] } }),
    line('m3', 'pg-day', T(25, 9, 35), 'He tells nobody but Dawn. She is nine and keeps it for a year.', { kept: true, chips: { characterIds: ['siyuan', 'dawn'], placeIds: [] } }),
    line('m4', 'pg-day', T(25, 9, 38), 'Not sure about the coat yet.'),
    line('c1', 'pg-in', T(25, 22, 21), 'You packed the grey coat. You only wear that one to leave.', { voiceId: 'c:dawn' }),
    line('c2', 'pg-in', T(25, 22, 22), 'I am walking to the river and back.', { voiceId: 'c:siyuan' }),
    line('c3', 'pg-in', T(25, 22, 23), 'Then leave the coat.', { voiceId: 'c:dawn' }),
    line('c4', 'pg-in', T(25, 22, 24), 'Keep this for me. One year.', { voiceId: 'c:siyuan' }),
    line('a1', 'q-leave', T(25, 21, 38), 'Before is cleaner. After is truer to him.'),
    line('a2', 'q-leave', T(25, 21, 39), 'After. He stays one season too long, and that is the wound.', { wise: true }),
  ],
};

/** The screen as markup: a picture of it, nothing that goes anywhere. */
const capture = tab => tab.evaluate(() => {
  const live = document.querySelector('.fs-app');
  const copy = live.cloneNode(true);
  const shelf = live.querySelector('.fl-shelf'), row = copy.querySelector('.fl-shelf');
  if (shelf && row) { row.style.overflow = 'hidden'; row.querySelector('.fl-cover').style.marginLeft = `${-shelf.scrollLeft}px`; }
  copy.querySelectorAll('a[href]').forEach(a => a.removeAttribute('href'));
  copy.querySelectorAll('[data-travel]').forEach(e => e.removeAttribute('data-travel'));
  copy.querySelectorAll('[tabindex]').forEach(e => e.setAttribute('tabindex', '-1'));
  copy.querySelectorAll('textarea').forEach(t => t.setAttribute('tabindex', '-1'));
  copy.querySelector('.fs-moon')?.insertAdjacentHTML('beforeend', '<span class="fs-ring-mark"></span>');
  return copy.outerHTML;
});

const put = (tab, name, rows) => tab.evaluate(({ name, rows }) => new Promise((resolve, reject) => {
  const open = indexedDB.open(name);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction(Object.keys(rows), 'readwrite');
    for (const [s, rs] of Object.entries(rows)) for (const r of rs) {
      if (r.patch) { const st = tx.objectStore(s); const g = st.get('app'); g.onsuccess = () => st.put({ ...g.result, ...r.patch }); }
      else tx.objectStore(s).put(r);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), { name, rows });

const shots = {};
async function session(light, hour, run) {
  const ctx = await browser.newContext({ viewport: { width: 358, height: 722 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, isMobile: true });
  await ctx.route('**/.netlify/functions/bridge**', route => {
    const op = new URL(route.request().url()).searchParams.get('op');
    if (op === 'worlds') return route.fulfill({ json: { worlds: [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }] } });
    if (op === 'pocket') return route.fulfill({ json: { world: 'eastwinds', stamp: 'example', pocket: POCKET } });
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { acks: body.envelopes.map(e => ({ table: e.table, id: e.id, rev: e.rev, result: 'stored' })) } });
  });
  const tab = await ctx.newPage();
  await tab.clock.setFixedTime(new Date(2026, 10, 25, hour, 30));
  await tab.goto(`${base}#/flow`);
  await tab.locator('.fl-cover').first().waitFor();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  await put(tab, 'flowstate', { settings: [{ patch: { bridge: { token: 'example' }, worlds: [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }], world: 'eastwinds' } }] });
  await tab.reload();
  await tab.locator('.fs-hdr-year').waitFor();
  await put(tab, 'flowstate-w-eastwinds', ROWS);
  await tab.reload();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  await tab.locator('.fs-hdr-year').waitFor();
  await run(tab, ctx);
  await ctx.close();
}
const settle = tab => tab.waitForTimeout(600);

await session('night', 21, async tab => {
  await tab.locator('.fl-cover[data-book="eastwinds"] [role="slider"]').waitFor();
  await tab.locator('.wd-waiting').waitFor();
  await settle(tab);
  shots.dial = await capture(tab);
  await tab.locator('.fs-hdr-year').click();
  await tab.locator('[data-sheet="The year"]').waitFor();
  await settle(tab);
  shots.year = await capture(tab);
  await tab.locator('[data-sheet="The year"]').getByRole('button', { name: 'Done' }).click();
  await tab.goto(`${base}#/council`);
  await tab.getByRole('button', { name: 'New council' }).click();
  await tab.getByRole('group', { name: 'Who sits' }).getByRole('button', { name: 'Siyuan, 30' }).click();
  await tab.getByRole('group', { name: 'Who sits' }).getByRole('button', { name: 'Sydney, 34' }).click();
  await tab.getByRole('group', { name: 'Who sits' }).getByRole('button', { name: 'Dawn Li, 9' }).click();
  await settle(tab);
  shots.seats = await capture(tab);
  await tab.goto(`${base}#/council/pg-in`);
  await tab.locator('.wd-reading').waitFor();
  await settle(tab);
  shots.in = await capture(tab);
  await tab.goto(`${base}#/questions/q-leave`);
  await tab.locator('.fs-msg.fs-wise').first().waitFor();
  await settle(tab);
  shots.answer = await capture(tab);
});
await session('day', 9, async tab => {
  await tab.goto(`${base}#/journal`);
  await tab.getByRole('group', { name: 'What this page is about' }).waitFor();
  await tab.locator('body').click({ position: { x: 200, y: 140 } }).catch(() => undefined);
  await settle(tab);
  shots.journal = await capture(tab);
  const box = await tab.locator('.fs-msg', { hasText: 'He tells nobody' }).boundingBox();
  await tab.mouse.move(box.x + 30, box.y + 12);
  await tab.mouse.down(); await tab.waitForTimeout(650); await tab.mouse.up();
  await tab.locator('[data-sheet="This line"]').waitFor();
  await settle(tab);
  shots.kept = await capture(tab);
});
await browser.close();
server.close();

// ---- the page: the main walkthrough's shell, these steps ----
const STEPS = [
  { id: 'dial', name: 'Drag the year', line: 'Everyone alive then is on the line.', light: 'night', time: '21:30', tab: 'Flow', html: shots.dial },
  { id: 'year', name: 'Tap the year', line: 'Its chapters and events are marked.', light: 'night', time: '21:31', tab: 'Flow', html: shots.year },
  { id: 'journal', name: 'Write about the book', line: 'Only kept lines go to the bible.', light: 'day', time: '09:40', tab: 'Journal', html: shots.journal },
  { id: 'kept', name: 'Keep a line', line: 'It carries its own chips.', light: 'day', time: '09:41', tab: 'Journal', html: shots.kept },
  { id: 'seats', name: 'Seat the characters', line: 'Each at their age that year.', light: 'night', time: '22:10', tab: 'Council', html: shots.seats },
  { id: 'in', name: 'Or set it in the story', line: 'Dialogue is never offered as fact.', light: 'night', time: '22:31', tab: 'Council', html: shots.in },
  { id: 'answer', name: 'Answer the bible\'s question', line: 'Research this carries it further.', light: 'night', time: '21:40', tab: 'Questions', html: shots.answer, back: true, built: [
    ['Year', '<code>model/story.ts</code>: started once from the pocket\'s story year, then the phone\'s own; stamped on every new page and council.'],
    ['Chips', 'Filled at keeping from the page\'s chips and every name its lines use (<code>keepLine</code>).'],
    ['Up', 'The outbox as built: a question page and its wise line, a council with <code>reading</code> and <code>year</code>.'],
  ] },
];
const step = s => `<section class="step" id="${s.id}" data-name="${s.name.replace(/"/g, '&quot;')}">
  <h2>${s.name}</h2>
  <p class="line">${s.line}</p>
  <div class="phone" data-mock><div class="screen" data-light="${s.light}" data-step="${s.id}"><div class="island"></div>
    <div class="status"><span>${s.time}</span><span>${s.tab}</span></div>
    ${s.html}
  </div></div>
${s.back ? '  <p class="line"><a href="walkthrough.html#worn">Back to the shelf</a></p>\n' : ''}${s.built ? `  <details><summary>How this is built</summary><table>
${s.built.map(([a, b]) => `    <tr><td>${a}</td><td>${b}</td></tr>`).join('\n')}
  </table></details>\n` : ''}</section>`;

const main = await readFile(path.join(root, 'design/walkthrough.html'), 'utf8');
const at = main.indexOf('<main id="main">') + '<main id="main">'.length;
const tail = main.indexOf('<div class="ctl">');
let head = main.slice(0, at)
  .replace(/<title>[^<]*<\/title>/, '<title>FlowState: in a world</title>')
  .replace(/<h1>[^<]*<\/h1>/, '<h1>FlowState: in a world</h1>')
  .replace('<link rel="stylesheet" href="parts.css">', '<link rel="stylesheet" href="parts.css">\n<link rel="stylesheet" href="shelf.css">\n<link rel="stylesheet" href="world.css">');
const html = `${head}\n<!-- script/snap-world-sections.mjs: the real app in a world, PLAN-WORLDS.md W4 -->\n${STEPS.map(step).join('\n')}\n\n${main.slice(tail)}`;
await writeFile(out, html);
console.log(`design/in-a-world.html: ${STEPS.length} steps, ${Math.round(html.length / 1024)} KB`);
