#!/usr/bin/env node
// Songs (CLAUDE.md rule 5, PLAN-WORLDS.md W6), a walkthrough of its own: design/songs.html. The main walkthrough is at
// its word budget and the plan's W8 wants "Songs" as its own walkthrough, so this path is a third file, split by path
// as design/in-a-world.html is (script/snap-world-sections.mjs); its last step links back to the main one.
//
// Every screen is the real app from its own build (dist, from npm run build) at 358 CSS px, on example data: East Winds
// and Songbook come down from a stubbed bridge function as the phone fetches them, a song and its takes are put into
// East Winds' notebook as the app stores them with no PIN, and the hum held mid-song is sung by an oscillator standing
// in for the microphone. Each screen's markup is kept as rendered (links stripped, nothing focusable).
// Usage: npm run build && node script/snap-songs.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const dir = path.join(root, 'dist');
const out = path.join(root, 'design/songs.html');
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
const WORLDS = [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }, { id: 'songbook', name: 'Songbook', kind: 'songs' }];
const POCKET = {
  kind: 'novel', storyYear: 2071, span: { from: 2040, to: 2080 },
  characters: [
    { id: 'siyuan', fullName: 'Siyuan', firstName: 'Siyuan', familyColour: '#3a70d0', born: 2041 },
    { id: 'dawn', fullName: 'Dawn Li', firstName: 'Dawn', familyColour: '#3a9a5a', born: 2062 },
    { id: 'li', fullName: 'Mrs. Li', firstName: 'Li', familyColour: '#8a5ac0', born: 2033 },
  ],
  places: [], chapters: [], events: [], questions: [],
};
const SONGBOOK = { kind: 'songs', songs: [{ id: 'mac-tide', title: '2026-11-19 Low tide' }] };
/** A sung line: notes (MIDI) held for a few frames each, with a little drift, and a breath between phrases. */
const sung = (notes, each = 6) => notes.flatMap((m, i) => (m === 0 ? Array(4).fill(0) : Array.from({ length: each }, (_, k) => Math.round((m + Math.sin((i * each + k) / 2) * 0.15) * 100) / 100)));
const SONG = {
  id: 'song-grey', createdAt: T(25, 22, 50), updatedAt: T(25, 23, 4), title: 'The grey coat',
  lyric: 'You only wear that one to leave\nso leave it on the nail\n\nKeep this for me, one year\nand I will keep the spring',
  sections: [{ line: 0, name: 'Verse' }, { line: 3, name: 'Chorus' }], bpm: 72, characterIds: ['dawn'],
};
const TAKES = [
  { id: 'take-nail', songId: 'song-grey', at: T(25, 23, 5), seconds: 14, audio: new ArrayBuffer(0), audioType: 'audio/mp4', key: 'G minor', bpm: 72, lineId: '1', lineText: 'so leave it on the nail',
    pitch: sung([55, 58, 62, 62, 60, 58, 0, 57, 58, 55, 55, 0, 58, 62, 67, 65, 62, 58, 57, 55]) },
];
const LOOSE = [
  { id: 'hum-train', at: T(19, 7, 40), seconds: 22, audio: new ArrayBuffer(0), audioType: 'audio/mp4', key: 'D major', pitch: sung([62, 66, 69, 69, 71, 69, 66, 0, 64, 66, 62, 62, 0, 69, 74, 73, 71, 69, 66, 64, 62]) },
  { id: 'hum-porch', at: T(24, 21, 12), seconds: 9, audio: new ArrayBuffer(0), audioType: 'audio/mp4', pitch: sung([60, 60, 62, 64, 0, 64, 62, 60]) },
];

const fakeMic = () => {
  const notes = [55, 58, 62, 58, 55, 62, 60, 58, 57, 55];
  navigator.mediaDevices.getUserMedia = async () => {
    const a = new AudioContext();
    const o = a.createOscillator(), g = a.createGain();
    g.gain.value = 0.3;
    const dest = a.createMediaStreamDestination();
    o.connect(g).connect(dest);
    let i = 0;
    const next = () => o.frequency.setValueAtTime(440 * 2 ** ((notes[i++ % notes.length] - 69) / 12), a.currentTime);
    next();
    setInterval(next, 300);
    o.start();
    return dest.stream;
  };
};

const capture = tab => tab.evaluate(() => {
  const live = document.querySelector('.fs-app');
  const copy = live.cloneNode(true);
  const shelf = live.querySelector('.fl-shelf'), row = copy.querySelector('.fl-shelf');
  if (shelf && row) { row.style.overflow = 'hidden'; row.querySelector('.fl-cover').style.marginLeft = `${-shelf.scrollLeft}px`; }
  copy.querySelectorAll('a[href]').forEach(a => a.removeAttribute('href'));
  copy.querySelectorAll('[data-travel]').forEach(e => e.removeAttribute('data-travel'));
  copy.querySelectorAll('[tabindex]').forEach(e => e.setAttribute('tabindex', '-1'));
  // a textarea's value is not in its markup: written in, so the picture shows what was typed
  live.querySelectorAll('textarea').forEach((t, i) => { const c = copy.querySelectorAll('textarea')[i]; if (c) { c.textContent = t.value; c.setAttribute('tabindex', '-1'); c.setAttribute('style', t.getAttribute('style') ?? ''); } });
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
      else tx.objectStore(s).put({ ...r, ...(s === 'takes' ? { audio: new ArrayBuffer(0) } : {}) });
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), { name, rows });

const shots = {};
/** SHOTS=<dir>: also a PNG of the live app at each screen, for reviewing the three lights (not part of the page). */
const pngs = process.env.SHOTS;
const png = async (tab, name) => { if (pngs) await tab.screenshot({ path: path.join(pngs, `${name}.png`) }); };
async function session(hour, run, world = 'eastwinds') {
  const ctx = await browser.newContext({ viewport: { width: 358, height: 722 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, isMobile: true });
  await ctx.route('**/.netlify/functions/bridge**', route => {
    const q = new URL(route.request().url()).searchParams;
    const op = q.get('op');
    if (op === 'worlds') return route.fulfill({ json: { worlds: WORLDS } });
    if (op === 'pocket') return route.fulfill({ json: { world: q.get('world'), stamp: 'example', pocket: q.get('world') === 'eastwinds' ? POCKET : SONGBOOK } });
    if (op === 'clip') return route.fulfill({ json: { take: q.get('take'), result: 'stored' } });
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { acks: body.envelopes.map(e => ({ table: e.table, id: e.id, rev: e.rev, result: 'stored' })) } });
  });
  const tab = await ctx.newPage();
  tab.setDefaultTimeout(20000);
  await tab.addInitScript(fakeMic);
  await tab.clock.setFixedTime(new Date(2026, 10, 25, hour, 30));
  await tab.goto(`${base}#/flow`);
  await tab.locator('.fl-cover').first().waitFor();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  await put(tab, 'flowstate', { settings: [{ patch: { bridge: { token: 'example' }, worlds: WORLDS, world } }] });
  await tab.reload();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  if (world === 'eastwinds') await tab.locator('.fs-hdr-year').waitFor();
  // East Winds holds the song and the hums; Songbook, the same song as it stands once moved there (no characters)
  const { characterIds: _c, ...moved } = SONG;
  await put(tab, `flowstate-w-${world}`, world === 'eastwinds' ? { songs: [SONG], takes: [...TAKES, ...LOOSE] } : { songs: [{ ...moved, tucked: [{ world: 'eastwinds', characterIds: ['dawn'] }] }], takes: TAKES });
  await tab.reload();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  await run(tab, ctx);
  await ctx.close();
}
const settle = tab => tab.waitForTimeout(600);

await session(23, async (tab, ctx) => {
  await tab.goto(`${base}#/flow`);
  await tab.locator('.fl-under a', { hasText: 'Songs' }).waitFor();
  await settle(tab);
  shots.row = await capture(tab);
  await png(tab, 'row');
  await tab.goto(`${base}#/flow/songs`);
  await tab.locator('.sg-list a[data-song]').first().waitFor();
  await settle(tab);
  shots.list = await capture(tab);
  await png(tab, 'list');
  await tab.goto(`${base}#/flow/songs/song-grey`);
  await tab.locator('.wd-take').first().waitFor();
  await settle(tab);
  shots.song = await capture(tab);
  await png(tab, 'song');
  if (pngs) {
    await tab.getByRole('button', { name: 'Still', exact: true }).click();
    await tab.waitForTimeout(1500);
    await png(tab, 'song-still');
    await tab.getByRole('button', { name: 'Leave Still' }).click();
    await tab.waitForTimeout(1500);
  }
  // the caret on the chorus' first line, a thumb on Hold to hum, the line drawn as it is sung
  await tab.getByRole('textbox', { name: 'Line 4' }).click();
  const cdp = await ctx.newCDPSession(tab);
  const b = await tab.locator('button.sg-hum').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
  await tab.waitForTimeout(3500);
  shots.hum = await capture(tab);
  await png(tab, 'hum');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await tab.locator('.sg-line[data-line="3"] + .wd-take').waitFor();
  await tab.evaluate(() => document.activeElement?.blur());
  await settle(tab);
  shots.taken = await capture(tab);
  await png(tab, 'taken');
  await tab.getByRole('group', { name: 'This song' }).getByRole('button', { name: 'Dawn Li' }).click();
  await tab.locator('[data-sheet="Whose song"]').waitFor();
  await settle(tab);
  shots.whose = await capture(tab);
  await png(tab, 'whose');
  await tab.locator('[data-sheet="Whose song"]').getByRole('button', { name: 'Done' }).click();
  await settle(tab);
  await tab.getByRole('button', { name: 'Move to…' }).click();
  await tab.locator('[data-sheet="Move to"]').waitFor();
  await settle(tab);
  shots.move = await capture(tab);
  await png(tab, 'move');
});
await session(7, async tab => {
  await tab.goto(`${base}#/flow/hum`);
  await tab.locator('.sg-hum-row').first().waitFor();
  await settle(tab);
  shots.hums = await capture(tab);
  await png(tab, 'hums');
});
await session(8, async tab => {
  await tab.goto(`${base}#/flow/songs`);
  await tab.locator('.sg-list a[data-song]').first().waitFor();
  await settle(tab);
  shots.songbook = await capture(tab);
  await png(tab, 'songbook');
}, 'songbook');
await browser.close();
server.close();

// ---- the page: the main walkthrough's shell, these steps ----
const STEPS = [
  { id: 'row', name: 'Songs live in a world', line: 'Under East Winds, beside Research.', light: 'night', time: '23:30', tab: 'Flow', html: shots.row },
  { id: 'list', name: 'Hum first, then the songs', line: 'A melody needs no song yet.', light: 'night', time: '23:30', tab: 'Flow', html: shots.list },
  { id: 'song', name: 'One line a rule', line: 'A blank rule starts a section.', light: 'night', time: '23:31', tab: 'Flow', html: shots.song },
  { id: 'hum', name: 'Hold to hum', line: 'The line is drawn as you sing.', light: 'night', time: '23:32', tab: 'Flow', html: shots.hum },
  { id: 'taken', name: 'It stays on its line', line: 'Its key, when the finder is sure.', light: 'night', time: '23:32', tab: 'Flow', html: shots.taken, built: [
    ['Take', '<code>model/pitch.ts</code>: YIN every 0.05 s into MIDI notes; the key from Music Companion\'s copied key finder.'],
    ['Up', 'The take row after its song; its audio as a clip once the row is acknowledged (<code>bridge/clips.ts</code>).'],
  ] },
  { id: 'whose', name: 'Whose song it is', line: 'In a novel, a character\'s theme.', light: 'night', time: '23:33', tab: 'Flow', html: shots.whose },
  { id: 'move', name: 'Move it to another world', line: 'Never into your own pages.', light: 'night', time: '23:34', tab: 'Flow', html: shots.move, built: [
    ['Order', 'Written whole into the new notebook, checked, then deleted from the old (<code>model/move.ts</code>).'],
  ] },
  { id: 'hums', name: 'Loose hums wait', line: 'Give one a title to make it a song.', light: 'day', time: '07:30', tab: 'Flow', html: shots.hums },
  { id: 'songbook', name: 'Songbook holds the rest', line: 'The Mac\'s songs are here to hum on.', light: 'day', time: '08:30', tab: 'Flow', html: shots.songbook, back: true },
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
const head = main.slice(0, at)
  .replace(/<title>[^<]*<\/title>/, '<title>FlowState: songs</title>')
  .replace(/<h1>[^<]*<\/h1>/, '<h1>FlowState: songs</h1>')
  .replace('<link rel="stylesheet" href="parts.css">', '<link rel="stylesheet" href="parts.css">\n<link rel="stylesheet" href="shelf.css">\n<link rel="stylesheet" href="world.css">\n<link rel="stylesheet" href="songs.css">');
const html = `${head}\n<!-- script/snap-songs.mjs: the real app's songs, PLAN-WORLDS.md W6 -->\n${STEPS.map(step).join('\n')}\n\n${main.slice(tail)}`;
await writeFile(out, html);
console.log(`design/songs.html: ${STEPS.length} steps, ${Math.round(html.length / 1024)} KB`);
