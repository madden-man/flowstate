#!/usr/bin/env node
// W8's two walkthroughs (PLAN-WORLDS.md W8), each the real apps on the recorded chain (docs/WORLDS-HANDOFF.md,
// "Walkthroughs"): design/wear-a-world.html (don, write, council, answer, see it in the bible) and design/songs.html
// (hum, lyric, find it on the Mac). The last step of the first links to the first of the second.
//
// Phone screens: .chain/phone.json (script/snap-chain-phone.mjs). Desktop screens: .chain/nc-*.json and mc-*.json
// (script/chain-desktops.mjs screens), each the app's body as rendered, shown in a frame of its own with the app's
// stylesheet (design/desk/nc.css and mc.css, written here from the capture), so the app's CSS never meets the page's.
// The relight control turns a desktop frame light by day and dark at night or Still, as the app's own theme does.
// The page's shell (its rail, keys, hash and lights) is the main walkthrough's own.
//
// Env: SONGS_URL, the published Songs walkthrough, for the link at the foot of Wear a world (default songs.html, the
// file beside it).
// Usage: node script/build-world-walkthroughs.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chain = path.join(root, '.chain');
const phone = JSON.parse(readFileSync(path.join(chain, 'phone.json'), 'utf8'));
const desk = name => JSON.parse(readFileSync(path.join(chain, `${name}.json`), 'utf8'));
const songsUrl = process.env.SONGS_URL ?? 'songs.html';

// ---- the apps' own stylesheets, one line each (the design lint reads design/) ----
mkdirSync(path.join(root, 'design/desk'), { recursive: true });
for (const [app, first, who] of [['nc', 'nc-kept', 'Novel Companion'], ['mc', 'mc-song', 'Music Companion']]) {
  const css = desk(first).css.replace(/\s*\n\s*/g, ' ');
  writeFileSync(path.join(root, `design/desk/${app}.css`), `${css} /* design-lint: allow: ${who}'s own stylesheet as its window held it (script/chain-desktops.mjs); its tokens are its own, not FlowState's */\n`);
}

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
const attrs = list => list.filter(([k]) => k !== 'data-theme').map(([k, v]) => ` ${k}="${v.replace(/"/g, '&quot;')}"`).join('');
const RESTORE = "addEventListener('load',function(){document.querySelectorAll('[data-st]').forEach(function(e){var p=e.getAttribute('data-st').split(',');e.scrollTop=+p[0];e.scrollLeft=+p[1];});});";

const APPS = { nc: 'Novel Companion', mc: 'Music Companion' };
function macMock(s) {
  const shot = desk(s.shot);
  const doc = `<!doctype html><html${attrs(shot.htmlAttrs)} data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="desk/${s.app}.css"><style>html,body{overflow:hidden!important}*{caret-color:transparent!important}</style><script>${RESTORE}</script></head><body${attrs(shot.bodyAttrs)}>${shot.body}</body></html>`;
  return `<div class="mac" data-mock><div class="mac-bar"><i></i><i></i><i></i><span>${APPS[s.app]} · East Winds (example data)</span></div><div class="win" data-w="${shot.w}" style="aspect-ratio:${shot.w}/${shot.h}"><iframe title="${APPS[s.app]}" tabindex="-1" data-theme="light" width="${shot.w}" height="${shot.h}" srcdoc="${esc(doc)}"></iframe></div></div> <!-- design-lint: allow: another app's screen as it rendered, its own inline styles -->`;
}
const phoneMock = s => `<div class="phone" data-mock><div class="screen" data-light="${s.light}" data-step="${s.id}"><div class="island"></div>
    <div class="status"><span>${s.time}</span><span>Example data</span></div>
    ${phone[s.id]}
  </div></div>`;
const built = rows => `  <details><summary>How this is built</summary><table>
${rows.map(([a, b]) => `    <tr><td>${a}</td><td>${b}</td></tr>`).join('\n')}
  </table></details>\n`;
const step = s => `<section class="step" id="${s.id}" data-name="${s.name.replace(/"/g, '&quot;')}">
  <h2>${s.name}</h2>
  <p class="line">${s.line}</p>
  ${s.app === 'phone' ? phoneMock(s) : macMock(s)}
${s.next ? `  <p class="line"><a href="${s.next[0]}">${s.next[1]}</a></p>\n` : ''}${s.built ? built(s.built) : ''}</section>`;

const P = (id, name, line, light, time, extra = {}) => ({ id, name, line, light, time, app: 'phone', ...extra });
const M = (id, app, shot, name, line, extra = {}) => ({ id, app, shot, name, line, ...extra });

const WEAR = [
  P('dial', 'Slide to East Winds and wear it', 'Everyone alive in its year is on the line.', 'night', '21:30', { built: [
    ['Down', 'Novel Companion publishes the bible\'s pocket (characters, places, chapters, open questions, its year) to one shared database, <code>flowstate_bridge</code>.'],
    ['Year', 'Started once from the pocket\'s story year, then the phone\'s own (<code>model/story.ts</code>).'],
  ] }),
  P('year', 'Tap the year', 'Its chapters and events are marked.', 'night', '21:31'),
  P('journal', 'Write about the book', 'Only the lines you keep go to the bible.', 'day', '09:40'),
  P('kept', 'Keep a line', 'It carries its own chips.', 'day', '09:41', { built: [
    ['Up', 'A kept line travels alone, with its page\'s date, the year and its chips; never the page (<code>bridge/up.ts</code>).'],
  ] }),
  P('seats', 'Seat the characters', 'Each at their age that year.', 'night', '21:05'),
  P('about', 'Let them argue the plot', 'Ink is you.', 'night', '21:30'),
  P('in', 'Or set it in the story', 'Dialogue is never offered as fact.', 'night', '21:30'),
  P('answer', 'Answer the bible\'s question', 'Hold a line: This answers it.', 'night', '21:30', { built: [
    ['Up', 'The question page answered, and its newest wise line as the decision.'],
    ['One write path', 'Every write in a world records what travels in its outbox, in the same transaction; the carry sends it on opening, on a pause and as the app hides.'],
  ] }),
  M('nc-kept', 'nc', 'nc-kept', 'Next morning, it is on Siyuan', 'The kept line and both councils, on his page.', { built: [
    ['Pull', 'Novel Companion reads its own world\'s rows from <code>bridge_up</code> when the bible opens, when the window comes to the front, and every ten minutes.'],
    ['Never edited', 'A notebook page follows the phone; nothing in the list is a field.'],
  ] }),
  M('nc-council', 'nc', 'nc-council', 'A council opens across the screen', 'Every line, with who said it.'),
  M('nc-voice', 'nc', 'nc-voice', 'Dawn\'s lines in the story', 'Under Voice on her page, by year.'),
  M('nc-tray', 'nc', 'nc-tray', 'Each fact waits for you', 'One the bible can file alone comes ticked.', { built: [
    ['Offered', 'Kept lines and councils about the story, read by the capture box\'s router; a council in the story offers nothing.'],
    ['Dismiss', 'Stays dismissed; a line edited on the phone is offered again.'],
  ] }),
  M('nc-filed', 'nc', 'nc-filed', 'File it', 'A plain new entry, one undo step.', { built: [
    ['File it', 'The capture box\'s own filing into the section the router picks; no status, no source note.'],
  ] }),
  M('nc-changes', 'nc', 'nc-changes', 'The question is decided', 'Undo puts it back open.', { next: [`${songsUrl}#row`, 'Then the songs'], built: [
    ['Newer wins', 'The phone\'s answer against the question\'s last change in the bible; each change from the phone is an undo step.'],
  ] }),
];

const SONGS = [
  P('row', 'Songs live in a world', 'Under East Winds, beside Research.', 'night', '23:00'),
  P('list', 'Hum first, then the songs', 'A melody needs no song yet.', 'night', '23:00'),
  P('song', 'One line a rule', 'A blank rule starts a section.', 'night', '23:01'),
  P('hum', 'Hold to hum', 'The line is drawn as you sing.', 'night', '23:02'),
  P('taken', 'It stays on its line', 'Its key, when the finder is sure.', 'night', '23:02', { built: [
    ['Take', '<code>model/pitch.ts</code>: a pitch every 0.05 s as MIDI notes; the key from Music Companion\'s own key finder, copied.'],
    ['Up', 'The take row after its song, with its line\'s text; its audio as a clip once the row is acknowledged.'],
  ] }),
  P('whose', 'Whose song it is', 'In a novel, a character\'s theme.', 'night', '23:03'),
  P('move', 'Move it to another world', 'Never into your own pages.', 'night', '23:04', { built: [
    ['Order', 'Written whole into the new notebook and checked, then deleted from the old; same ids for life (<code>model/move.ts</code>).'],
  ] }),
  P('songbook', 'Songbook holds the Mac\'s songs', 'Hum on one from the phone.', 'day', '08:30'),
  P('hums', 'Loose hums wait', 'Give one a title to make it a song.', 'day', '07:30'),
  M('mc-song', 'mc', 'mc-song', 'On the Mac, under the song', 'Each hum on its line, ready to play.', { built: [
    ['Clips', 'Music Companion pulls each clip to disk beside its recordings and removes it from <code>bridge_clips</code>.'],
  ] }),
  M('mc-hums', 'mc', 'mc-hums', 'Loose hums, from every world', 'Captioned with where they were hummed.'),
  M('nc-song', 'nc', 'nc-song', 'The song is on Dawn\'s page', 'Its title, pointing to Music Companion.', { built: [
    ['Stub', 'Novel Companion keeps a song\'s title and the characters it names, nothing more; a song moved away goes to the trash there.'],
  ] }),
];

const main = readFileSync(path.join(root, 'design/walkthrough.html'), 'utf8');
const at = main.indexOf('<main id="main">') + '<main id="main">'.length;
const tail = main.indexOf('<div class="ctl">');
const MAC_CSS = `<style>
/* a desktop app's window: its own document in a frame, scaled to the column (script/build-world-walkthroughs.mjs) */
.mac{width:min(100%,780px);border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--rail);box-shadow:var(--shadow-sheet)}
.mac-bar{display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--line);color:var(--muted);font:12px var(--sans)}
.mac-bar i{width:10px;height:10px;border-radius:50%;background:var(--line)}
.mac-bar span{margin-left:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mac .win{position:relative;overflow:hidden}
.mac iframe{position:absolute;top:0;left:0;border:0;transform-origin:0 0;pointer-events:none}
</style>`;
const MAC_JS = `<script>
/* the desktop frames: scaled to the column, and lit as the relight control says (day light; night and Still dark) */
(function(){
  var mode='design';
  function theme(f){var d=f.contentDocument;if(!d||!d.documentElement)return;d.documentElement.setAttribute('data-theme',mode==='design'?f.dataset.theme:mode==='day'?'light':'dark');}
  function fit(){document.querySelectorAll('.step.on .mac .win').forEach(function(w){var f=w.querySelector('iframe');if(f&&w.clientWidth)f.style.transform='scale('+(w.clientWidth/+w.dataset.w)+')';});}
  document.querySelectorAll('.lights [data-light]').forEach(function(b){b.addEventListener('click',function(){mode=b.dataset.light;document.querySelectorAll('.mac iframe').forEach(theme);});});
  document.addEventListener('load',function(e){if(e.target.tagName==='IFRAME'){theme(e.target);fit();}},true);
  new MutationObserver(fit).observe(document.getElementById('main'),{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',fit);fit();
})();
</script>`;

function page(file, title, steps, comment) {
  const head = main.slice(0, at)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<h1>[^<]*<\/h1>/, `<h1>${title}</h1>`)
    .replace('<link rel="stylesheet" href="parts.css">', '<link rel="stylesheet" href="parts.css">\n<link rel="stylesheet" href="shelf.css">\n<link rel="stylesheet" href="world.css">\n<link rel="stylesheet" href="songs.css">')
    .replace('</head>', `${MAC_CSS}\n</head>`);
  const html = `${head}\n<!-- ${comment} -->\n${steps.map(step).join('\n')}\n\n${main.slice(tail).replace('</body>', `${MAC_JS}\n</body>`)}`;
  writeFileSync(path.join(root, 'design', file), html);
  console.log(`design/${file}: ${steps.length} steps, ${Math.round(html.length / 1024)} KB`);
}
page('wear-a-world.html', 'Wear a world', WEAR, 'script/build-world-walkthroughs.mjs: the phone and Novel Companion on one recorded chain, PLAN-WORLDS.md W8');
page('songs.html', 'Songs', SONGS, 'script/build-world-walkthroughs.mjs: the phone, Music Companion and Novel Companion on one recorded chain, PLAN-WORLDS.md W8');
