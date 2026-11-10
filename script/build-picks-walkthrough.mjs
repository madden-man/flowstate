#!/usr/bin/env node
// Builds design/flows/picks.html, the picks walkthrough (PLAN-PICKS.md section 4), from the running app: the way the
// flows walkthroughs were captured (commit b3ee275), now as a script. A production build under vite preview, Playwright,
// a 358x722 iPhone viewport, a fixed November 2026 clock; the journal is given Spotify tokens that go nowhere (every
// request off the preview host is aborted), the Poems playlist and the covers in design/flows/covers/, so the On sheet
// draws its kept covers exactly as it does on the phone. Each step's real .fs-app markup goes into its data-mock phone:
// links stripped so a tap cannot leave the step, kept covers inlined as data URIs, a scrolled page or sheet marked with
// data-scroll (flows.css). The page shares tokens.css, parts.css, flows.css and flows.js with the flows walkthroughs.
// Then the artifact lint runs on the page.
//   node script/build-picks-walkthrough.mjs            build, preview on PORT (default 4233), capture, write
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'design/flows/picks.html');
const coversDir = path.join(root, 'design/flows/covers');
const port = Number(process.env.PORT ?? 4233);
const base = `http://127.0.0.1:${port}`;
const POEMS = '0T6Gzc2hN81u3vGC5IJZ9a';
const vite = path.join(root, 'node_modules/vite/bin/vite.js');

// ---- the picks, read from the seed's own source so the covers match its albums
const seed = fs.readFileSync(path.join(root, 'src/db/seed/picks.ts'), 'utf8');
const ALBUMS = [...seed.matchAll(/album\('[^']+', '([^']+)', '((?:[^'\\]|\\.)+)', '([A-Za-z0-9]{22})'\)/g)]
  .map(m => ({ by: m[1], title: m[2].replace(/\\'/g, "'"), id: m[3] }))
  .filter((a, i, all) => all.findIndex(b => b.id === a.id) === i);
const coverOf = id => fs.readdirSync(coversDir).find(f => f.startsWith(`${id}.`));
const dataUri = f => `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(path.join(coversDir, f)).toString('base64')}`;

// ---- the steps: [id, title, line, light, time, how this is built]
const HOW = {
  row: [['Row', 'A helper word, <code>on</code> (<code>TipHelper</code>, <code>flow/Tips.tsx</code>), on rows the flows already have: six of the seven ♪ rows and five plain rows, plus four new rows. Fifteen steps carry one; a step has one On row or none.'], ['Door', 'Behind the PIN, like ♪ (<code>BEHIND_PIN</code>): what he puts on is his.'], ['Plan', '<code>PLAN-PICKS.md</code>: the sources, every pick, the steps left empty and why, the design check, packages P0 to P2.']],
  sheet: [['Sheet', '<code>flow/On.tsx</code> on <code>parts/Sheet</code>. Covers are the ♪ grid\'s own <code>Tile</code> (M3\'s press, drop, hush, ring and flight to the ♪); lines are <code>parts/Check</code> rows with their kind word. At most three and three.'], ['Covers', 'From the cover cache the ♪ grid fills (<code>keptAlbums</code>), never fetched here. An album with no kept cover is a written line (My Head Is An Animal, here). A cover plays on its playlist at its first song, or as itself.'], ['Picks', 'A title and its kind, nothing more: <code>OnPick</code> in <code>db/schema.ts</code>, seeded from <code>db/seed/picks.ts</code>, every title guarded by <code>test/fixtures/picks-titles.json</code>.']],
  picked: [['Tick', 'A line ticked on a live episode writes <code>episodes.on</code> (its title sealed) and ticks the On row (<code>setOn</code>); a cover Spotify plays writes <code>episodes.music</code>. At rest a tick only draws.'], ['After', 'At rest, "what helped" names the pick, and next time at this step it comes first (<code>lastOn</code>). No number says so.']],
  quiet: [['Why', 'Less coming in: wordless, slow, already known. A screen is more coming in, so no lines.'], ['Source', 'All three are on the Poems playlist; All We Grow is on master (ii) too.']],
  bottom: [['Why', 'Music that keeps company, then lifts. Sad music deepens low mood in people who ruminate (Garrido and Schubert 2013, 2015), so the first cover is his most played and gentlest record, not his saddest. The row says music, so no lines.'], ['Printed', '<code>onLine</code> on the step, print like a step\'s said line; his to rewrite or blank in the step sheet.']],
  locked: [['Why', 'Lyrics cost reading and writing more than instrumental music does (Vasilev 2018, 65 studies). The Poems playlist is already his wordless shelf. Mr. Bean is his own exception, and it has no words either.'], ['Row', 'New seeded row: "One wordless record".']],
  flooded: [['Why', 'Twenty minutes is the least it takes, and rehearsing the argument keeps it up. An album is a clock that is not a timer. Nothing angry.'], ['Row', 'New seeded row at the peak, one row at a time: "One album: that\'s the twenty minutes".']],
  cooling: [['Why', 'About an hour, alone, and the replay is what keeps it up. One absurd half hour, or a game that needs both hands. Nothing about couples coming apart.'], ['Repair', 'The next step\'s lines are for two: KPop Demon Hunters, The Big Sick, Spiritfarer.']],
  before: [['Why', 'The peak of the curve, and the future is the unknown. A rewatch is the one evening with a known ending (Russell and Levy 2012).'], ['Row', 'New seeded row: "A film you know the ending of".']],
  fine: [['Why', 'Tommy, 2026-11-10: the saved film belongs on the far side of the thing. Two films he has not seen yet, kept for the evening it is over.'], ['Row', 'New seeded row: "The film you saved for after". No covers, no printed line.']],
  replay: [['Why', 'Eight minutes of something absorbing beat eight of replaying. Short and fast; "An album" under it stays a ♪ row.']],
  night: [['Why', 'Out of bed, dull and dim. Music may improve how sleep feels in insomnia (Cochrane 2022, 13 trials); a screen is light and a clock. Covers only, and only at this step.'], ['Still', 'The covers stay, dimmed by the ♪ grid\'s own Still rule; the printed line stays (words, no digits).']],
  thaw: [['Why', 'Rest is the task. Slow and beautiful, little plot to hold.']],
  still: [['Still', 'Rule 13: the lines leave (<code>fs-notstill</code>), the covers stay, and the printed line would too. Nothing about what was ticked shows but the row itself.']],
  yours: [['Sheet', '<code>flow/StepSheet.tsx</code> gains an On block: the line the sheet prints, reorder by long press, Strike (struck, never deleted: it goes to Earlier), "+ album" from the ♪ grid, "+ line" as a title and its kind. Every change is a revision.'], ['Seed', '<code>seedPicksOnce</code> gives a journal that already had the flows its picks once; a pick or row he struck or deleted is never brought back.']],
};
const STEPS = [
  ['row', 'A row that says On', 'After the wave, one row offers something to put on.', 'night', '22:41'],
  ['sheet', 'Three covers, three lines', 'Your albums by their covers, your shows by their names.', 'night', '22:41'],
  ['picked', 'Tick the one you put on', 'The row keeps what you chose.', 'night', '22:42'],
  ['quiet', 'Too much coming in', 'Only quiet records, and no screen.', 'night', '19:05'],
  ['bottom', 'The bottom', 'A record that keeps you company, then one that lifts.', 'night', '21:30'],
  ['locked', 'Locked in', 'Wordless records, and one show without words.', 'day', '10:15'],
  ['flooded', 'Flooded', 'An album is the twenty minutes.', 'night', '20:12'],
  ['cooling', 'Cooling', 'Something absurd, or a game for both hands.', 'night', '20:50'],
  ['before', 'Night before', 'A film whose ending you know.', 'night', '21:45'],
  ['fine', 'It was fine', 'The film you saved for after it.', 'day', '17:20'],
  ['replay', 'Heavier', 'Eight minutes: a level, an episode, six guesses.', 'day', '13:05'],
  ['night', '3 a.m., up', 'One quiet record; screens wait for seven.', 'still', '03:12'],
  ['thaw', 'Thawing', 'Slow records and slow shows, little plot to hold.', 'night', '18:40'],
  ['still', 'In Still', 'Under the skin again: only the covers stay.', 'still', '22:58'],
  ['yours', 'Make it yours', 'Strike a pick, add an album or a line.', 'day', '11:20'],
];

// ---- build and serve
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
run(process.execPath, [vite, 'build', '--logLevel', 'warn']);
const server = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on('exit', stop);
for (let k = 0; ; k++) {
  try { if ((await fetch(base)).ok) break; } catch { /* not yet */ }
  if (k > 100) { console.error('preview did not start'); process.exit(1); }
  await new Promise(r => setTimeout(r, 200));
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 358, height: 722 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
await context.route('**/*', r => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
const page = await context.newPage();
// November 2026, running: a frozen clock would stamp every mark at the same instant
await page.clock.install({ time: new Date(2026, 10, 10, 22, 41) });
await page.clock.resume();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

/** The first load: the threshold breathed through. */
async function enter(hash) {
  await page.goto(`${base}/${hash}`);
  await page.locator('.fs-app').waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await t.waitFor({ state: 'detached' });
}
/** Every later screen: the hash only, as a tap would, so the light (Still) and the open episode carry. */
async function go(hash) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(h => { location.hash = h; }, hash);
  await page.waitForTimeout(700);
}

// ---- the journal: seeded by the app, then given the Poems playlist, its kept covers and tokens that go nowhere
await enter('#/journal');
const covered = ALBUMS.filter(a => coverOf(a.id)).map(a => ({ ...a, b64: fs.readFileSync(path.join(coversDir, coverOf(a.id))).toString('base64') }));
await page.evaluate(async ({ albums, poems }) => {
  const db = await new Promise((res, rej) => { const o = indexedDB.open('flowstate'); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
  const at = Date.now();
  const tx = db.transaction(['settings', 'playlists', 'albums', 'shelves'], 'readwrite');
  const s = tx.objectStore('settings');
  const app = await new Promise(r => { const g = s.get('app'); g.onsuccess = () => r(g.result); });
  s.put({ ...app, spotify: { tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: at + 864e5 * 365, name: 'Tommy' }, connectedAt: at, ticked: [poems] } });
  tx.objectStore('playlists').put({ id: poems, name: 'For the Poems and the Prose; May They Dance Forever', uri: `spotify:playlist:${poems}`, order: 0, snapshotId: 's', total: albums.length, chosen: true, readAt: at });
  albums.forEach((a, i) => {
    const bin = Uint8Array.from(atob(a.b64), c => c.charCodeAt(0));
    tx.objectStore('albums').put({ albumUri: `spotify:album:${a.id}`, album: a.title, artist: a.by, cover: bin.buffer, coverType: 'image/jpeg', coverAt: at });
    tx.objectStore('shelves').put({ playlistId: poems, albumUri: `spotify:album:${a.id}`, order: i, firstTrackUri: `spotify:track:${a.id}` });
  });
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
}, { albums: covered, poems: POEMS });

// ---- capture
const shots = {};
const settle = () => page.waitForTimeout(900);
async function capture(id) {
  await settle();
  shots[id] = await page.evaluate(() => {
    const app = document.querySelector('.fs-app').cloneNode(true);
    const live = document.querySelector('.fs-app');
    // a scrolled page or sheet keeps its scroll as the mock's own (flows.css [data-scroll])
    const mark = (sel) => {
      const a = live.querySelectorAll(sel), b = app.querySelectorAll(sel);
      a.forEach((el, i) => { if (el.scrollTop > 0) { b[i].setAttribute('data-scroll', ''); b[i].style.setProperty('--scroll', `${Math.round(el.scrollTop)}px`); } });
    };
    mark('.fs-sheetof');
    mark('.fs-sheet-body');
    app.querySelectorAll('[href]').forEach(a => a.removeAttribute('href'));
    app.querySelectorAll('img[src^="blob:"]').forEach(img => {
      const uri = img.closest('[data-album]')?.getAttribute('data-album') ?? '';
      img.setAttribute('src', `cover:${uri.replace('spotify:album:', '')}`);
    });
    app.querySelectorAll('.fs-sheet').forEach(s => s.removeAttribute('tabindex'));
    return app.outerHTML;
  });
}
const sheetOpen = () => page.locator('.fs-sheet').last().waitFor();
const onRow = id => page.locator(`[data-tip="${id}"] .fs-check`);
async function rowInView(id) {
  await onRow(id).evaluate(el => el.scrollIntoView({ block: 'center' }));
}
async function openOn(id) {
  await rowInView(id);
  // on the text: at a peak the Next line sits up on the row's blank rule
  try { await onRow(id).click({ timeout: 3000, position: { x: 60, y: 14 } }); } catch {
    await page.screenshot({ path: path.join(os.tmpdir(), `picks-${id}.png`) });
    throw new Error(`the On row ${id} could not be tapped: ${path.join(os.tmpdir(), `picks-${id}.png`)}`);
  }
  await sheetOpen();
}
const done = () => page.locator('.fs-sheet').last().getByRole('button', { name: 'Done' }).click().then(() => page.waitForTimeout(600));
/** At a peak (The bottom, Flooded, Night before) the rows come one at a time: Next until the On row is the one. */
async function peakTo(id) {
  for (let k = 0; k < 8 && !(await onRow(id).count()); k++) await page.getByRole('button', { name: /^Next/ }).click();
}

// 15 first, before any episode: the step sheet's On block (Edit shows only at rest), never closed so nothing is kept
await page.reload();
await enter('#/flow/panic/4');
await page.getByRole('button', { name: 'Edit', exact: true }).click();
await sheetOpen();
await page.locator('.fs-sheet [data-pick="pk-panic-4-a-short-hike"]').getByRole('button', { name: /^Strike/ }).click();
// down to the end of the On block and Earlier, where the struck pick now is, struck through
await page.locator('.fs-sheet .fs-sheet-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
await capture('yours');

// 1 to 3: a live episode at Under the skin (the reload drops the step sheet's draft unkept)
await page.evaluate(() => { location.hash = '#/flow/panic'; });
await page.reload();
await enter('#/flow/panic');
const dot = page.getByRole('slider', { name: 'Where you are' });
for (const n of ['1', '2', '3', '4']) {
  await dot.press('ArrowRight');
  await page.locator(`[aria-valuenow="${n}"]`).waitFor();
  await page.locator('.fs-flowpage[data-saved="true"]').waitFor();
}
await rowInView('panic-4-album');
await capture('row');
await openOn('panic-4-album');
await capture('sheet');
await page.locator('.fs-sheet [data-pick="pk-panic-4-new-girl"] .fs-check').click();
await done();
await rowInView('panic-4-album');
await capture('picked');

// the other steps, read at rest
for (const [id, hash, tip] of [
  ['quiet', '#/flow/panic/1', 'panic-1-album'], ['bottom', '#/flow/depress/4', 'depress-4-music'], ['locked', '#/flow/energize/3', 'energize-3-on'],
  ['flooded', '#/flow/fight/3', 'fight-3-on'], ['cooling', '#/flow/fight/5', 'fight-5-distract'], ['before', '#/flow/whatif/3', 'whatif-3-on'],
  ['fine', '#/flow/whatif/5', 'whatif-5-on'], ['replay', '#/flow/replay/3', 'replay-3-absorb'], ['thaw', '#/flow/shutdown/4', 'shutdown-4-album'],
]) {
  await go(hash);
  await peakTo(tip);
  await openOn(tip);
  await capture(id);
}

// Still: 3 a.m. up, then Under the skin again
await go('#/flow/night/4');
await page.locator('.fs-moon').first().click();
await page.waitForTimeout(1600);
await openOn('night-4-dull');
await capture('night');
await done();
await go('#/flow/panic/4');
await openOn('panic-4-album');
await capture('still');

await browser.close();
stop();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

// ---- the page
const coverFor = Object.fromEntries(ALBUMS.filter(a => coverOf(a.id)).map(a => [a.id, dataUri(coverOf(a.id))]));
const inline = html => html.replace(/src="cover:([A-Za-z0-9]{22})"/g, (_, id) => `src="${coverFor[id]}"`);
const table = rows => rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
const sections = STEPS.map(([id, title, line, light, time], i) => `<!-- ${i + 1} -->
<section class="step" id="${id}" data-name="${title}">
  <h2>${title}</h2>
  <p class="line">${line}</p>
  <div class="phone" data-mock><div class="screen" data-light="${light}"><div class="island"></div>
    <div class="status"><span>${time}</span><span>Flow</span></div>
    ${inline(shots[id])}
  </div></div>
  <details><summary>How this is built</summary><table>
    ${table(HOW[id])}
  </table></details>
</section>
`).join('\n');

const page_ = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FlowState: something on</title>
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="parts.css">
<link rel="stylesheet" href="flows.css">
</head>
<body>
<div class="wrap">
<header class="top"><h1>FlowState: something on</h1><span class="counter" id="counter"></span>
  <div class="lights" role="group" aria-label="Relight every screen"><button data-light="design" aria-pressed="true">As designed</button><button data-light="day">Day</button><button data-light="night">Night</button><button data-light="still">Still</button></div>
</header>
<nav class="rail" aria-label="Steps"><ol id="rail"></ol></nav>
<main id="main">

${sections}
</main>
</div>
<script src="flows.js"></script>
</body>
</html>
`;
fs.writeFileSync(out, page_);
console.log(`wrote ${path.relative(root, out)}: ${STEPS.length} steps, ${(page_.length / 1024).toFixed(0)} KB`);
const lint = path.join(os.homedir(), '.claude/hooks/artifact-lint.mjs');
if (fs.existsSync(lint)) run(process.execPath, [lint, out]);
