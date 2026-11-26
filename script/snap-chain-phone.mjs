#!/usr/bin/env node
// W8's chain, the phone's half (PLAN-WORLDS.md W8). The real app from its own build (dist, from npm run build) at
// 358 CSS px, on one set of example data, East Winds (Siyuan, Dawn Li, Sydney, 2071) and Songbook, end to end:
//
// - The bridge function is the real handler (netlify/lib/bridge.ts) on the tests' fake driver, seeded with what Novel
//   Companion and Music Companion published (test/fixtures/chain/down-*.json, from script/chain-desktops.mjs down).
// - The phone's pages, councils, songs and takes are put into East Winds' notebook as the app stores them with no PIN,
//   each with the outbox entry its one write path records for it (src/db/outbox.ts), and what the screens do (a hum
//   held on a line) goes through the app itself. On opening, the phone's own carry sends them.
// - What the function stored is saved as the recorded chain: test/fixtures/chain/up.json (bridge_up's documents) and
//   test/fixtures/chain/clips/ (bridge_clips' audio). script/chain-desktops.mjs screens writes exactly those into each
//   desktop app's test bridge database.
// - Each phone screen is captured as markup (links stripped, nothing focusable) into .chain/phone.json, for
//   script/build-world-walkthroughs.mjs.
// Usage: npm run build && node script/snap-chain-phone.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../netlify/lib/bridge.ts';
import { FakeMongo } from '../test/bridge/fake-mongo.ts';
import { BRIDGE_DB } from '../src/bridge/protocol.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const dir = path.join(root, 'dist');
const fix = path.join(root, 'test/fixtures/chain');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  try { res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(path.join(dir, file))); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

// ---- the function, seeded with what the desktops published ----
const TOKEN = 'example';
const fake = new FakeMongo();
const desk = ['nc', 'mc'].map(a => JSON.parse(readFileSync(path.join(fix, `down-${a}.json`), 'utf8')));
for (const d of desk) { fake.seed(BRIDGE_DB, 'bridge_worlds', d.worlds); fake.seed(BRIDGE_DB, 'bridge_down', d.down); }
const EW = 'east-winds';
const SB = 'songbook';
let fnNow = Date.UTC(2026, 10, 25);
const deps = { env: { BRIDGE_TOKEN: TOKEN, BRIDGE_MONGODB_URI: 'mongodb://fake' }, client: async () => fake, now: () => fnNow++ };
async function bridgeRoute(route) {
  const r = route.request();
  const body = r.postDataBuffer();
  const req = new Request(r.url(), { method: r.method(), headers: r.headers(), body: body && r.method() === 'POST' ? body : undefined });
  const res = await handle(req, deps);
  await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
}

// ---- example data: one story ----
const T = (d, h, m) => new Date(2026, 10, d, h, m).getTime();
const page = (id, kind, at, extra = {}) => ({ id, kind, createdAt: at, updatedAt: at, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [], ...extra });
const line = (id, pageId, at, text, extra = {}) => ({ id, pageId, at, updatedAt: at, text, kept: false, ...extra });
const ABOUT = 'Does Siyuan leave before the flood, or after?';
const PAGES = [
  page('pg-day', 'entry', T(25, 9, 30), { year: 2071, chips: { characterIds: ['siyuan', 'dawn'], placeIds: [] } }),
  page('q-leave', 'question', T(11, 10, 0), { title: ABOUT, state: 'answered', answeredAt: T(25, 21, 39), updatedAt: T(25, 21, 39), linkedPageIds: ['pg-about'] }),
  page('pg-about', 'council', T(25, 21, 10), { year: 2071, reading: 'about', title: ABOUT, seats: ['c:siyuan', 'c:sydney', 'c:dawn'], linkedPageIds: ['q-leave'] }),
  page('pg-in', 'council', T(25, 22, 20), { year: 2071, reading: 'in', seats: ['c:dawn', 'c:siyuan'] }),
];
const LINES = [
  line('m1', 'pg-day', T(25, 9, 31), 'Trying the leaving again. Maybe it is quieter than I had it.'),
  line('m2', 'pg-day', T(25, 9, 33), 'Siyuan leaves the temple in 2071, the spring after the flood.', { kept: true, chips: { characterIds: ['siyuan'], placeIds: ['gate'] } }),
  line('m3', 'pg-day', T(25, 9, 35), 'He tells nobody but Dawn. She is nine and keeps it for a year.', { kept: true, chips: { characterIds: ['siyuan', 'dawn'], placeIds: [] } }),
  line('m4', 'pg-day', T(25, 9, 37), 'Teenagers in Harbour Town begin to wear their grandparents\' coats starting around 2068.', { kept: true, chips: { characterIds: [], placeIds: ['harbour'] } }),
  line('m5', 'pg-day', T(25, 9, 38), 'Not sure about the coat yet.'),
  line('b1', 'pg-about', T(25, 21, 11), 'Before. The flood is the reason he has been waiting for.', { voiceId: 'c:sydney' }),
  line('b2', 'pg-about', T(25, 21, 12), 'After. I cannot leave them with the water still in the hall.', { voiceId: 'c:siyuan' }),
  line('b3', 'pg-about', T(25, 21, 13), 'He stays until the spring. I know, because he told me.', { voiceId: 'c:dawn' }),
  line('b4', 'pg-about', T(25, 21, 14), 'After, then. And it costs him a season.'),
  line('c1', 'pg-in', T(25, 22, 21), 'You packed the grey coat. You only wear that one to leave.', { voiceId: 'c:dawn' }),
  line('c2', 'pg-in', T(25, 22, 22), 'I am walking to the river and back.', { voiceId: 'c:siyuan' }),
  line('c3', 'pg-in', T(25, 22, 23), 'Then leave the coat.', { voiceId: 'c:dawn' }),
  line('c4', 'pg-in', T(25, 22, 24), 'Keep this for me. One year.', { voiceId: 'c:siyuan' }),
  line('a1', 'q-leave', T(25, 21, 38), 'Before is cleaner. After is truer to him.'),
  line('a2', 'q-leave', T(25, 21, 39), 'After. He stays one season too long, and that is the wound.', { wise: true }),
];
/** A sung line: notes (MIDI) held for a few frames each, with a little drift, and a breath between phrases. */
const sung = (notes, each = 6) => notes.flatMap((m, i) => (m === 0 ? Array(4).fill(0) : Array.from({ length: each }, (_, k) => Math.round((m + Math.sin((i * each + k) / 2) * 0.15) * 100) / 100)));
/** The hum as sound: an 8 kHz, 8-bit WAV of a soft sine following the pitch line, one value every 0.05 s. */
function wav(pitch, seconds) {
  const rate = 8000, n = Math.round(seconds * rate), buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36); buf.writeUInt32LE(n, 40);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const m = pitch[Math.min(pitch.length - 1, Math.floor((i / n) * pitch.length))] ?? 0;
    if (m) ph += (2 * Math.PI * 440 * 2 ** ((m - 69) / 12)) / rate;
    buf[44 + i] = 128 + Math.round((m ? 0.25 : 0) * 127 * Math.sin(ph));
  }
  return [...buf];
}
const SONG = {
  id: 'song-grey', createdAt: T(25, 22, 50), updatedAt: T(25, 23, 4), title: 'The grey coat',
  lyric: 'You only wear that one to leave\nso leave it on the nail\n\nKeep this for me, one year\nand I will keep the spring',
  sections: [{ line: 0, name: 'Verse' }, { line: 3, name: 'Chorus' }], bpm: 72, characterIds: ['dawn'],
};
const take = (id, at, seconds, pitch, extra = {}) => ({ id, at, seconds, pitch, audio: wav(pitch, seconds), audioType: 'audio/wav', ...extra });
const TAKES = [
  take('take-nail', T(25, 23, 5), 14, sung([55, 58, 62, 62, 60, 58, 0, 57, 58, 55, 55, 0, 58, 62, 67, 65, 62, 58, 57, 55], 33), { songId: 'song-grey', key: 'G minor', bpm: 72, lineId: '1', lineText: 'so leave it on the nail' }),
];
const LOOSE = [
  take('hum-train', T(19, 7, 40), 22, sung([62, 66, 69, 69, 71, 69, 66, 0, 64, 66, 62, 62, 0, 69, 74, 73, 71, 69, 66, 64, 62], 50), { key: 'D major' }),
  take('hum-porch', T(24, 21, 12), 9, sung([60, 60, 62, 64, 0, 64, 62, 60], 22)),
];
const WORLDS_ON_PHONE = fake.rows(BRIDGE_DB, 'bridge_worlds');
const WORLDS = [...WORLDS_ON_PHONE.values()].map(w => ({ id: w._id, name: w.name, kind: w.kind }));

const fakeMic = () => {
  // ids the app makes are counted, so the recorded chain is the same from run to run
  let n = 0;
  crypto.randomUUID = () => `7a1e0000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
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

/** Rows put as the app stores them with no PIN; with `outbox`, each traveling row also gets the entry the write path
 *  records (src/db/outbox.ts: councils and questions with their lines, kept journal lines, songs, takes). */
const put = (tab, name, rows, outbox) => tab.evaluate(({ name, rows, outbox }) => new Promise((resolve, reject) => {
  const open = indexedDB.open(name);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const stores = [...new Set([...Object.keys(rows), ...(outbox ? ['outbox'] : [])])];
    const tx = db.transaction(stores, 'readwrite');
    const pagesById = new Map((rows.pages ?? []).map(p => [p.id, p]));
    let rev = 1790000000000;
    for (const [s, rs] of Object.entries(rows)) for (const r of rs) {
      if (r.patch) { const st = tx.objectStore(s); const g = st.get('app'); g.onsuccess = () => st.put({ ...g.result, ...r.patch }); continue; }
      const row = s === 'takes' ? { ...r, audio: new Uint8Array(r.audio).buffer } : r;
      tx.objectStore(s).put(row);
      if (!outbox) continue;
      const travels = s === 'songs' || s === 'takes' || (s === 'pages' && r.kind !== 'entry')
        || (s === 'messages' && (r.kept || pagesById.get(r.pageId)?.kind !== 'entry'));
      if (travels) tx.objectStore('outbox').add({ table: s, id: r.id, rev: rev++, at: r.updatedAt ?? r.at ?? r.createdAt });
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), { name, rows, outbox });

/** Waits until this world's outbox is empty and every take with audio has its clip mark: the carry has gone. */
const drained = (tab, name) => tab.waitForFunction(name => new Promise(resolve => {
  const open = indexedDB.open(name);
  open.onerror = () => resolve(false);
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction(['outbox', 'takes'], 'readonly');
    const o = tx.objectStore('outbox').count();
    const t = tx.objectStore('takes').getAll();
    tx.oncomplete = () => { db.close(); resolve(o.result === 0 && t.result.every(x => x.clip || !x.audio?.byteLength)); };
  };
}), name, { timeout: 20000, polling: 500 });

const shots = {};
async function session(hour, run, { world = EW, rows = 'all', minute = 30, day = 25 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 358, height: 722 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, isMobile: true });
  await ctx.route('**/.netlify/functions/bridge**', bridgeRoute);
  const tab = await ctx.newPage();
  tab.setDefaultTimeout(20000);
  await tab.addInitScript(fakeMic);
  const now = new Date(2026, 10, day, hour, minute);
  await tab.clock.setFixedTime(now);
  fnNow = now.getTime();
  await tab.goto(`${base}#/flow`);
  await tab.locator('.fl-cover').first().waitFor();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  await put(tab, 'flowstate', { settings: [{ patch: { bridge: { token: TOKEN }, worlds: WORLDS, world } }] });
  await tab.reload();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  if (world === EW) await tab.locator('.fs-hdr-year').waitFor();
  // the world's notebook exists once worn; the story's rows go in, then the app opens on them and carries
  const db = `flowstate-w-${world}`;
  if (world === EW) {
    const all = { pages: PAGES, messages: LINES, songs: [SONG], takes: [...TAKES, ...LOOSE] };
    if (rows === 'seats') await put(tab, db, { pages: [{ ...PAGES[2], id: 'pg-seat', title: undefined, linkedPageIds: [] }] }, false);
    else await put(tab, db, all, true);
  }
  await tab.reload();
  await tab.locator('[data-threshold]').waitFor({ state: 'detached' });
  if (world === EW) await tab.locator('.fs-hdr-year').waitFor();
  await run(tab, ctx);
  await drained(tab, db);
  await ctx.close();
}
const settle = tab => tab.waitForTimeout(600);
const snap = async (tab, name) => { await settle(tab); shots[name] = await capture(tab); };

// ---- Wear a world ----
await session(21, async tab => {
  await tab.locator('.fl-cover[data-book="east-winds"] [role="slider"]').waitFor();
  await tab.locator('.wd-waiting').waitFor();
  await snap(tab, 'dial');
  await tab.locator('.fs-hdr-year').click();
  await tab.locator('[data-sheet="The year"]').waitFor();
  await snap(tab, 'year');
  await tab.locator('[data-sheet="The year"]').getByRole('button', { name: 'Done' }).click();
  await tab.goto(`${base}#/questions/q-leave`);
  await tab.locator('.fs-msg.fs-wise').first().waitFor();
  await snap(tab, 'answer');
  await tab.goto(`${base}#/council/pg-about`);
  await tab.locator('.fs-msg.fs-v').first().waitFor();
  await snap(tab, 'about');
  await tab.goto(`${base}#/council/pg-in`);
  await tab.locator('.wd-reading').waitFor();
  await snap(tab, 'in');
});
await session(21, async tab => {
  await tab.goto(`${base}#/council/pg-seat`);
  await tab.getByRole('group', { name: 'Who sits' }).waitFor();
  await snap(tab, 'seats');
}, { rows: 'seats', minute: 5 });
await session(9, async tab => {
  await tab.goto(`${base}#/journal`);
  await tab.getByRole('group', { name: 'What this page is about' }).waitFor();
  await tab.locator('body').click({ position: { x: 200, y: 140 } }).catch(() => undefined);
  await snap(tab, 'journal');
  const box = await tab.locator('.fs-msg', { hasText: 'He tells nobody' }).boundingBox();
  await tab.mouse.move(box.x + 30, box.y + 12);
  await tab.mouse.down(); await tab.waitForTimeout(650); await tab.mouse.up();
  await tab.locator('[data-sheet="This line"]').waitFor();
  await snap(tab, 'kept');
}, { minute: 40 });

// ---- Songs ----
await session(23, async (tab, ctx) => {
  await tab.goto(`${base}#/flow`);
  await tab.locator('.fl-under a', { hasText: 'Songs' }).waitFor();
  await snap(tab, 'row');
  await tab.goto(`${base}#/flow/songs`);
  await tab.locator('.sg-list a[data-song]').first().waitFor();
  await snap(tab, 'list');
  await tab.goto(`${base}#/flow/songs/song-grey`);
  await tab.locator('.wd-take').first().waitFor();
  await snap(tab, 'song');
  // the caret on the chorus' first line, a thumb on Hold to hum, the line drawn as it is sung
  await tab.getByRole('textbox', { name: 'Line 4' }).click();
  const cdp = await ctx.newCDPSession(tab);
  const b = await tab.locator('button.sg-hum').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
  await tab.waitForTimeout(3500);
  shots.hum = await capture(tab);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await tab.locator('.sg-line[data-line="3"] + .wd-take').waitFor();
  await tab.evaluate(() => document.activeElement?.blur());
  await snap(tab, 'taken');
  await tab.getByRole('group', { name: 'This song' }).getByRole('button', { name: 'Dawn Li' }).click();
  await tab.locator('[data-sheet="Whose song"]').waitFor();
  await snap(tab, 'whose');
  await tab.locator('[data-sheet="Whose song"]').getByRole('button', { name: 'Done' }).click();
  await settle(tab);
  await tab.getByRole('button', { name: 'Move to…' }).click();
  await tab.locator('[data-sheet="Move to"]').waitFor();
  await snap(tab, 'move');
}, { minute: 0 });
await session(7, async tab => {
  await tab.goto(`${base}#/flow/hum`);
  await tab.locator('.sg-hum-row').first().waitFor();
  await snap(tab, 'hums');
}, { day: 26 });
await session(8, async tab => {
  await tab.goto(`${base}#/flow/songs`);
  await tab.locator('.sg-list a[data-song]').first().waitFor();
  await snap(tab, 'songbook');
}, { world: SB, day: 26 });
await browser.close();
server.close();

// ---- the recorded chain: what the function stored ----
const up = [...fake.rows(BRIDGE_DB, 'bridge_up').values()].sort((a, b) => String(a._id).localeCompare(String(b._id)));
const clipDir = path.join(fix, 'clips');
rmSync(clipDir, { recursive: true, force: true });
mkdirSync(clipDir, { recursive: true });
const ext = t => ({ 'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' }[t] ?? 'bin');
const clips = [...fake.rows(BRIDGE_DB, 'bridge_clips').values()].sort((a, b) => String(a._id).localeCompare(String(b._id))).map(({ audio, ...c }) => {
  const file = `clips/${c.world}-${c.take}.${ext(c.type)}`;
  writeFileSync(path.join(fix, file), audio);
  return { ...c, file };
});
writeFileSync(path.join(fix, 'up.json'), `${JSON.stringify({ up, clips }, null, 1)}\n`);
mkdirSync(path.join(root, '.chain'), { recursive: true });
writeFileSync(path.join(root, '.chain/phone.json'), JSON.stringify(shots));
console.log(`chain: ${up.length} envelopes, ${clips.length} clips; ${Object.keys(shots).length} phone screens`);
