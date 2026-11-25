#!/usr/bin/env node
// The Worlds walkthrough (PLAN-WORLDS.md), a plan-stage page: nothing here is built yet. The phone screens are the
// app's own page parts and CSS (design/parts.css, tokens.css, gate.css, copied beside the page), set with what the
// plan would show; the shelf of notebooks (wd-*) is new and drawn here in tokens only. The three desktop screens are drawn by hand in Novel Companion's own theme tokens.
// Usage: node script/build-worlds-walkthrough.mjs   (writes design/worlds/index.html)
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'design/worlds');
const main = await readFile(path.join(root, 'design/walkthrough.html'), 'utf8');

// ---- the shell's CSS, from the main walkthrough ----
const firstStep = main.indexOf('<section class="step"');
const chromeCss = [...main.slice(0, firstStep).matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
// ---- the app's own parts, as the walkthrough's other steps write them ----
const W = 'East Winds';
const hdrL = '<div class="fs-hdr-l"><button type="button" class="fs-moon" aria-label="Still"><i></i><span class="fs-ring-mark"></span></button><button type="button" class="fs-word">Settings</button><button type="button" class="fs-word fs-musicword" aria-label="Music">♪</button></div>';
const hdr = (date, label = W) => `<header class="fs-hdr">${hdrL}<div class="fs-hdr-r"><span class="fs-hdr-label">${label}</span><span>Date: <b>${date}</b></span></div></header>`;
const tabs = cur => `<nav class="fs-tabs" aria-label="Sections">${[['Journal'], ['Council'], ['?', 'Questions'], ['Be'], ['Flow']].map(([w, l]) => `<a class="fs-tab${l ? ' fs-tab-q' : ''}"${(l ?? w) === cur ? ' aria-current="page"' : ''}${l ? ` aria-label="${l}"` : ''}>${w}</a>`).join('')}</nav>`;
const phone = (light, time, tab, body, after = '') => `<div class="phone" data-mock><div class="screen" data-light="${light}"><div class="island"></div>
    <div class="status"><span>${time}</span><span>Example lines</span></div>
    <div class="fs-app"><main class="fs-main"><section class="fs-page">${body}</section></main>${tabs(tab)}</div>${after}
  </div></div>`;
const line = t => `<div class="fs-block"><div class="fs-msg" data-j-line><p>${t}</p></div></div>`;
const caret = '<div class="fs-block"><div class="fs-msg cur" data-j-line><button type="button" class="fs-dot" aria-label="Who speaks this line" aria-expanded="false"></button><textarea class="fs-edit" rows="1" spellcheck="false" aria-label="This page"></textarea></div></div>';
const V = { Siyuan: 'var(--v-blue)', Sydney: 'var(--v-red)', 'Dawn Li': 'var(--v-green)' };
const says = (who, t) => `<div class="fs-msg fs-v" style="--vc:${V[who]}" data-who="${who}"><span class="fs-sp">${who}</span><p>${t}</p></div>`;
const ink = t => `<div class="fs-msg"><p>${t}</p></div>`;
const chip = (name, on, vc) => `<button type="button" class="fs-chip" aria-pressed="${on}"${vc ? ` style="--vc:${vc}"><i></i>` : '>'}${name}</button>`;
const seg = '<nav class="fs-seg" aria-label="Council"><a>Councils</a><a>Voices</a></nav>';
const row = (lineText, meta, cls = '') => `<a class="fs-row fs-list-row fl-flow ${cls}"><span class="fs-list-line">${lineText}</span><small class="fs-list-meta">${meta}</small></a>`;
const pitch = (d, cls = '') => `<svg class="wd-pitch ${cls}" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"></path></svg>`;
const HUM = 'M4 40 C20 40 24 26 40 26 S58 34 72 34 S92 14 108 14 S128 22 142 22 S160 38 176 38 S196 28 210 28 S232 10 248 10 S276 30 296 30';
const HUM2 = 'M4 30 C22 30 30 18 46 18 S70 36 88 36 S112 24 130 24 S156 44 176 44 S204 20 224 20 S262 34 296 34';
// ---- the shelf of notebooks (PLAN-WORLDS.md section 4): covers slide sideways, the one in front shows its rows ----
const circ = (name, inner) => `<a class="wd-circ"><svg viewBox="0 0 48 48" aria-hidden="true">${inner}</svg><small>${name}</small></a>`;
const CIRCLES = `<nav class="wd-circles" aria-label="Sits and questions">${circ('Meditate', '<circle cx="24" cy="24" r="17"></circle>')}${circ('Energize', '<path d="M6 36 C16 36 16 12 24 12 S32 36 42 36"></path>')}${circ('Research', '<circle cx="24" cy="24" r="17"></circle><path d="M24 7 V41"></path>')}</nav>`;
const plainRow = (lineText, meta) => `<a class="fs-row fs-list-row fl-flow"><span class="fs-list-line">${lineText}</span><small class="fs-list-meta">${meta}</small></a>`;
const BOOKS = [
  { id: 'own', name: 'My own pages', sub: 'Who to Be, How to Flow', wc: 'var(--ink)', dots: [], last: ['11 / 24 / 26', 'Then the answer is not a list of people. It is the pace.'], rows: CIRCLES + plainRow('Right now', 'Your lines; tap the one that fits') },
  { id: 'eastwinds', name: 'East Winds', sub: 'A novel', wc: 'var(--v-blue)', dots: ['var(--v-blue)', 'var(--v-red)', 'var(--v-green)', 'var(--v-brown)', 'var(--v-purple)'], last: ['11 / 25 / 26', 'What does it cost her to keep it?'], rows: plainRow('Songs', 'Lyrics and hums') + plainRow('Research', 'A question, and the papers on both sides') },
  { id: 'songbook', name: 'Songbook', sub: 'Songs of no book', wc: 'var(--v-orange)', dots: [], last: ['11 / 19 / 26', 'slow train, low sun, nobody waving'], rows: plainRow('Songs', 'Lyrics and hums') },
];
const shelf = (worn, front) => `<div class="wd-shelf" data-front="${BOOKS.findIndex(b => b.id === front)}" role="group" aria-label="Notebooks">${BOOKS.map(b => `<button type="button" class="wd-cover" data-book="${b.id}" style="--wc:${b.wc}"><span class="wd-cover-name">${b.name}</span><span class="wd-cover-foot"><span class="wd-dots">${b.dots.map(d => `<i style="--vc:${d}"></i>`).join('')}</span><small>${b.id === worn ? 'Open' : b.sub}</small></span></button>`).join('')}</div>${BOOKS.map(b => `<div class="fs-sheetof fs-rules fs-flows wd-under" data-for="${b.id}"${b.id === front ? '' : ' hidden'}><p class="fs-quiet wd-last"><small>${b.last[0]}</small> ${b.last[1]}</p>${b.rows}</div>`).join('')}`;

const built = rows => `<details><summary>How this is built</summary><table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table></details>`;

// ---- the desktop windows (Novel Companion, Music Companion), hand drawn in the bible's own tokens ----
const mac = (app, rail, cur, body) => `<div class="mac" data-mock><div class="mac-bar"><i></i><i></i><i></i><span>${app}</span></div><div class="mac-body"><nav class="mac-rail">${rail.map(r => `<a${r === cur ? ' aria-current="page"' : ''}>${r}</a>`).join('')}</nav><div class="mac-main">${body}</div></div></div>`;
const NC_RAIL = ['Characters', 'Family tree', 'Outline', 'Timeline', 'Entries'];

const steps = [
  { id: 'shelf', name: 'Flow is a shelf of notebooks', line: 'Yours is in front.',
    mock: phone('day', '09:31', 'Flow', hdr('11 / 25 / 26', 'Flow') + shelf('own', 'own')),
    built: [['Gone', 'The mountain, the signs, their questions and albums, and their animations. Nothing is deleted from the notebook.'], ['Kept', 'Meditate, Energize and Research, unchanged, as three circles under your own cover. Right now stays one row.']] },

  { id: 'worlds', name: 'Slide to East Winds', line: 'Tap the cover to put it on.',
    mock: phone('day', '09:32', 'Flow', hdr('11 / 25 / 26', 'Flow') + shelf('own', 'eastwinds')),
    built: [['The cover', 'The world\'s name, one hue on the spine, a dot for each character\'s colour. Under it, the last line you wrote there.'], ['Donning', '<code>don(worldId)</code> points the storage layer at <code>flowstate-w-eastwinds</code>, a second notebook with the same schema and PIN. PLAN-WORLDS.md section 3.']] },

  { id: 'journal', name: 'Write about the book', line: 'The header says whose pages these are.',
    mock: phone('day', '09:40', 'Journal', `${hdr('11 / 25 / 26')}<div class="fs-sheetof fs-rules fs-col">${line('Siyuan leaves the temple in 2071, the spring after the flood.')}${line('He tells nobody but Dawn. She is nine and keeps it for a year.')}${line('What does it cost her to keep it?')}${caret}</div><div class="fs-composer-wrap"><div class="fs-chips" role="group" aria-label="What this page is about">${chip('Siyuan', true)}${chip('Dawn Li', true)}${chip('2071', true)}<button type="button" class="fs-chip add">+ place</button></div></div>`),
    built: [['Chips', 'Character, Place and Year, filled from the bible. Optional: names in the text are found anyway.'], ['Leaves the phone', 'The whole page, once a bridge token is pasted. The personal notebook has no path to the bridge.']] },

  { id: 'seats', name: 'Seat the characters', line: 'About the story, unless you say otherwise.',
    mock: phone('night', '22:10', 'Council', `${hdr('11 / 25 / 26')}${seg}<div class="fs-council"><div class="fs-sheetof fs-rules"><p class="fs-quiet">Who sits?</p><div class="fs-seats" role="group" aria-label="Who sits">${chip('Siyuan', true, V.Siyuan)}${chip('Sydney', true, V.Sydney)}${chip('Dawn Li', true, V['Dawn Li'])}${chip('Abbot Ren', false, 'var(--v-brown)')}${chip('Mrs. Li', false, 'var(--v-purple)')}</div><p class="fs-quiet">This council is</p><div class="fs-seats" role="group" aria-label="This council is">${chip('About the story', true)}${chip('In the story', false)}</div><p class="fs-from"><small>About</small> <a>Does Siyuan leave before the flood, or after?</a></p></div><div class="fs-composer-wrap"><button type="button" class="fs-new">Begin</button></div></div>`),
    built: [['Voices', 'One voice a character, from the bible: full name, first name, the family colour.'], ['Reading', '<code>page.reading</code>, <code>about</code> when absent. It can be changed later and the bible follows.']] },

  { id: 'about', name: 'They argue the plot', line: 'Ink is you.',
    mock: phone('night', '22:14', 'Council', `${hdr('11 / 25 / 26')}${seg}<div class="fs-council"><div class="fs-chat fs-rules"><p class="fs-from"><small>About</small> <a>Does Siyuan leave before the flood, or after?</a></p>${says('Sydney', 'After. If he goes before, nobody has a reason to resent him.')}${says('Siyuan', 'Before. I would not walk out on people standing in water.')}${ink('Then he leaves after, and carries that he stayed too long.')}${says('Dawn Li', 'Which makes chapter 12 his, not mine.')}</div><div class="fs-composer-wrap"><div class="fs-chips" role="group" aria-label="Who speaks next"><button type="button" class="fs-chip" aria-pressed="true" aria-label="Plain ink">Ink</button>${chip('Siyuan', false, V.Siyuan)}${chip('Sydney', false, V.Sydney)}${chip('Dawn Li', false, V['Dawn Li'])}<button type="button" class="fs-chip add">+ seat</button></div><div class="fs-composer"><textarea rows="1" aria-label="Message" placeholder="Ink…"></textarea></div></div></div>`),
    built: [['Ink', 'The Ink chip as built: a plain line, no voice, no turn. The bible reads an ink line as yours.'], ['In the bible', 'Attached to the question and the chapter it names. Nothing is recorded as a character\'s voice.']] },

  { id: 'in', name: 'Or they speak as themselves', line: 'Dialogue is never offered as fact.',
    mock: phone('night', '22:31', 'Council', `${hdr('11 / 25 / 26')}${seg}<div class="fs-council"><div class="fs-chat fs-rules"><p class="fs-from"><small>In the story</small> <a>2071, the temple gate</a></p>${says('Dawn Li', 'You packed the grey coat. You only wear that one to leave.')}${says('Siyuan', 'I am walking to the river and back.')}${says('Dawn Li', 'Then leave the coat.')}${says('Siyuan', 'Keep this for me. One year.')}</div><div class="fs-composer-wrap"><div class="fs-chips" role="group" aria-label="Who speaks next"><button type="button" class="fs-chip" aria-pressed="false" aria-label="Plain ink">Ink</button>${chip('Siyuan', false, V.Siyuan)}${chip('Dawn Li', true, V['Dawn Li'])}<button type="button" class="fs-chip add">+ seat</button></div><div class="fs-composer"><textarea rows="1" aria-label="Message" placeholder="Dawn Li speaks…" style="--vc:${V['Dawn Li']}"></textarea></div></div></div>`),
    built: [['In the bible', 'Each character\'s lines are listed on that character under Voice, by the page\'s story year.']] },

  { id: 'questions', name: 'The bible\'s open questions', line: 'They arrive on their own.',
    mock: phone('day', '09:54', 'Questions', `${hdr('11 / 25 / 26')}<div class="fs-sheetof fs-rules"><div class="fs-qlist"><a class="fs-list-row fs-qrow"><span class="fs-list-meta">11 / 25 / 26</span><span class="fs-list-line">What does it cost Dawn to keep it?</span></a><a class="fs-list-row fs-qrow"><span class="fs-list-meta">10 / 11 / 26</span><span class="fs-list-line">Does Siyuan leave before the flood, or after?</span></a><a class="fs-list-row fs-qrow"><span class="fs-list-meta">10 / 11 / 26</span><span class="fs-list-line">Who raises Dawn after 2065?</span></a><a class="fs-list-row fs-qrow"><span class="fs-list-meta">10 / 11 / 26</span><span class="fs-list-line">What does Sydney know about the temple?</span></a><div class="fs-notstill" role="group" aria-label="Answered"><p class="fs-month fs-answered">Answered</p><a class="fs-list-row fs-qrow done"><span class="fs-list-meta">10 / 11 / 26 · 10 / 12 / 26</span><span class="fs-list-line">Which year is the Introduction?</span></a></div></div></div><div class="fs-ask"><button type="button" class="fs-word">New question</button></div>`),
    built: [['Down', 'One question page for each open question in the bible, the page\'s id the question\'s id.'], ['Up', 'A question asked here is a new open question there.']] },

  { id: 'answer', name: 'Answer one, and it is decided', line: 'Hold: This answers it.',
    mock: phone('night', '21:40', 'Questions', `<header class="fs-hdr"><div class="fs-hdr-l"><button type="button" class="fs-moon" aria-label="Still"><i></i><span class="fs-ring-mark"></span></button><a class="fs-word">Questions</a><button type="button" class="fs-word fs-musicword" aria-label="Music">♪</button></div><div class="fs-hdr-r"><span class="fs-hdr-label">${W}</span><span>Date: <b>10 / 11 / 26</b></span></div></header><div class="fs-sheetof fs-rules fs-col fs-swipe"><textarea class="fs-edit fs-q" rows="2" spellcheck="false" aria-label="Question">Does Siyuan leave before the flood, or after?</textarea>${line('Before is cleaner. After is truer to him.')}<div class="fs-block"><div class="fs-msg fs-wise" data-j-line><p>After. He stays one season too long, and that is the wound.</p></div></div>${caret}</div><nav class="fs-ask fs-walk" aria-label="The open questions"><button type="button" class="fs-word">Research this</button><button type="button" class="fs-word">Next ›</button></nav>`),
    built: [['In the bible', 'The wise line fills Decision and sets Decided, written directly as one undo step. Taking it back reopens the question.'], ['Research this', 'Carries the question to the Research page and keeps the link.']] },

  { id: 'be', name: 'Themes, and who fights for them', line: 'Be stays on the phone.',
    mock: phone('day', '11:20', 'Be', `${hdr('11 / 25 / 26')}<div class="fs-be-top fs-notstill"><nav class="fs-seg" aria-label="Be"><a aria-current="page">Values</a><a>Champions</a></nav><button type="button" class="fs-word">New value</button></div><div class="fs-sheetof fs-rules fs-be fs-values"><p class="fs-be-tier fs-be-head" data-heading="1" data-place="1"><button type="button" aria-expanded="true"><span class="w">First</span><i class="stroke" aria-hidden="true"></i></button></p><section class="fs-be-row" data-place="1"><button type="button" class="fs-dichotomy fs-value fs-value-t1" aria-expanded="false"><span class="a">leaving</span><span class="fs-spoke" aria-label="Siyuan, Dawn Li"><i style="--vc:${V.Siyuan}"></i><i style="--vc:${V['Dawn Li']}"></i></span></button></section><p class="fs-be-tier fs-be-head" data-heading="2" data-place="2"><button type="button" aria-expanded="true"><span class="w">Second</span><i class="stroke" aria-hidden="true"></i></button></p><section class="fs-be-row" data-place="2"><button type="button" class="fs-dichotomy fs-value fs-value-t2" aria-expanded="false"><span class="a">what is owed</span><span class="fs-spoke" aria-label="Sydney, Siyuan"><i style="--vc:${V.Sydney}"></i><i style="--vc:${V.Siyuan}"></i></span></button></section><section class="fs-be-row" data-place="2"><button type="button" class="fs-dichotomy fs-value fs-value-t2" aria-expanded="false"><span class="a">kept secrets</span><span class="fs-spoke" aria-label="Dawn Li"><i style="--vc:${V['Dawn Li']}"></i></span></button></section><p class="fs-be-tier fs-be-head" data-heading="3" data-place="3"><button type="button" aria-expanded="true"><span class="w">Third</span><i class="stroke" aria-hidden="true"></i></button></p><section class="fs-be-row" data-place="3"><button type="button" class="fs-dichotomy fs-value fs-value-t3" aria-expanded="false"><span class="a">water</span><span class="fs-spoke-none" aria-label="Nobody yet"></span></button></section></div>`),
    built: [['Screen', 'Be as built: values, tiers, shadows. Champions are the characters.'], ['Copy', 'Nothing here maps to Novel Companion. The notebook\'s backup file is its only copy.']] },

  { id: 'make', name: 'Worn, it offers Songs and Research', line: 'Slide back to take it off.',
    mock: phone('day', '14:02', 'Flow', hdr('11 / 25 / 26') + shelf('eastwinds', 'eastwinds')),
    built: [['Route', '<code>#/flow</code> is the shelf, opening on the cover of the notebook worn.'], ['The door', 'The ring under the lock\'s keypad always opens your own Right now.']] },

  { id: 'song', name: 'Hold to hum', line: 'The line is drawn as you sing.',
    mock: phone('night', '23:05', 'Flow', `<header class="fs-hdr"><div class="fs-hdr-l"><button type="button" class="fs-moon" aria-label="Still"><i></i><span class="fs-ring-mark"></span></button><a class="fs-word">Songs</a><button type="button" class="fs-word fs-musicword" aria-label="Music">♪</button></div><div class="fs-hdr-r"><span class="fs-hdr-label">${W}</span><span>Date: <b>11 / 25 / 26</b></span></div></header><div class="fs-sheetof fs-rules fs-col"><textarea class="fs-edit fs-q" rows="1" spellcheck="false" aria-label="Title">The grey coat</textarea><p class="wd-sec">Verse</p>${line('You only wear that one to leave')}${line('so leave it on the nail')}<div class="wd-take">${pitch(HUM)}<small>G minor · 0:14</small></div><p class="wd-sec">Chorus</p>${line('Keep this for me, one year')}${caret}</div><div class="fs-composer-wrap"><div class="fs-chips" role="group" aria-label="Whose song">${chip('Dawn Li', true)}<button type="button" class="fs-chip add">Tap tempo</button></div><button type="button" class="fs-new">Hold to hum</button></div>`),
    built: [['Take', 'The audio, the pitch line, a key guess from Music Companion\'s key finder, a tapped tempo. Pinned to a lyric line or left loose.'], ['Not verified', 'Recording in the installed Home Screen app is the first thing package W0 tries on the iPhone.']] },

  { id: 'lock', name: 'It opens where you left it', line: 'The keypad says which notebook.',
    mock: phone('night', '07:12', 'Journal', `${hdr('11 / 26 / 26')}<div class="fs-sheetof fs-rules fs-col"></div>`, `<div class="fs-threshold locked" data-threshold data-lock><div class="fs-threshold-words"><h1 class="fs-threshold-title">Who to Be, How to Flow</h1><p class="fs-manifesto">I determine my core.<br>I choose how to flow.</p><p class="wd-worn">${W}</p></div><div class="fs-threshold-keypad"><div class="fs-keypad" role="group" aria-label="PIN"><div class="fs-dots"><i></i><i></i><i></i><i></i></div><p class="fs-keypad-note" role="status"></p><div class="fs-keys">${[['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']].map(([n, l]) => `<button type="button" class="fs-key" aria-label="${n}"><b>${n}</b><small aria-hidden="true">${l}</small></button>`).join('')}<span></span><button type="button" class="fs-key" aria-label="0"><b>0</b><small aria-hidden="true"></small></button><button type="button" class="fs-word fs-key-word">delete</button></div></div></div></div>`) },

  { id: 'bible', name: 'The page is waiting on Siyuan', line: 'Nothing to approve: it is your writing.', badge: 'Novel Companion',
    mock: mac('Novel Companion · East Winds (example data)', NC_RAIL, 'Characters', `<h3>Siyuan</h3><p class="mac-sub">b. 2041 · Guangzhou</p><h4>Voice</h4><ul class="mac-list"><li><time>2071</time><span>“I am walking to the river and back.”</span><em>In the story · 25 Nov</em></li><li><time>2071</time><span>“Keep this for me. One year.”</span><em>In the story · 25 Nov</em></li></ul><h4>Notebook</h4><ul class="mac-list"><li><time>25 Nov</time><span>Siyuan leaves the temple in 2071, the spring after the flood.</span><em>Journal</em></li><li><time>25 Nov</time><span>Does Siyuan leave before the flood, or after?</span><em>Council, about the story</em></li><li><time>25 Nov</time><span>The grey coat</span><em>Song · in Music Companion</em></li></ul>`),
    built: [['Collection', '<code>notebookPages</code>, written through the one write path, read-only on the desktop because it follows the phone.'], ['Links', 'The Capture Router\'s free stages (parse, resolve names, score) plus the page\'s chips.'], ['Follows the phone', 'An edit replaces the page; a delete sends it to the trash.']] },

  { id: 'facts', name: 'Each clear fact waits for a yes', line: 'File it writes one undo step.', badge: 'Novel Companion',
    mock: mac('Novel Companion · East Winds (example data)', NC_RAIL, 'Entries', `<h3>From the notebook</h3><p class="mac-sub">Journal · 25 Nov 2026</p><div class="mac-card"><label><input type="checkbox" checked id="f1"> “Siyuan leaves the temple in 2071, the spring after the flood.”</label><div class="mac-chips"><span>Moment</span><span>Siyuan</span><span>2071</span><span class="idea">idea</span></div><p class="mac-diff">+ Moment · Siyuan · 2071 · Leaves the temple</p></div><div class="mac-card"><label><input type="checkbox" checked id="f2"> “He tells nobody but Dawn. She is nine and keeps it for a year.”</label><div class="mac-chips"><span>Moment</span><span>Dawn Li</span><span>2071 to 2072</span><span class="idea">idea</span></div><p class="mac-diff">+ Moment · Dawn Li · 2071 to 2072 · Keeps Siyuan's leaving to herself</p></div><div class="mac-card wait"><label>“What does it cost her to keep it?”</label><div class="mac-chips"><span>Open question</span><span>Dawn Li</span></div><p class="mac-diff">+ Open question, filed already</p></div><div class="mac-acts"><button type="button" class="pri">File it</button><button type="button">Dismiss</button></div>`),
    built: [['Free', 'Lines the router is sure of are drafted with no model. A line that needs judgment waits behind Send to Claude; nothing is spent until you press it.'], ['Filed as', 'Status idea, source note "From the notebook page of 25 Nov 2026."'], ['Dismissed', 'Stays dismissed unless the line itself changes on the phone.']] },

  { id: 'sketch', name: 'The hum is under the song', line: 'Ready when you sit down at the Mac.', badge: 'Music Companion',
    mock: mac('Music Companion (example data)', ['Circle', 'Songs', 'Frequencies', 'Settings'], 'Songs', `<h3>2026-11-25 The grey coat</h3><p class="mac-sub">G minor · from East Winds · Dawn Li</p><h4>Lyrics</h4><p class="mac-lyric">You only wear that one to leave<br>so leave it on the nail</p><h4>Sketches</h4><ul class="mac-list"><li><time>23:05</time>${pitch(HUM, 'sm')}<em>G minor · 0:14 · “so leave it on the nail”</em></li><li><time>23:09</time>${pitch(HUM2, 'sm')}<em>G minor · 0:22 · loose</em></li></ul>`),
    built: [['Audio', 'Pulled to <code>audio/sketches/</code> on this Mac and removed from Atlas, so no audio stays there.'], ['Song', 'Keeps its one recording; sketches are a list under it.']] },
];

const stepHtml = s => `<section class="step" id="${s.id}" data-name="${s.name.replace(/"/g, '&quot;')}">
  <h2>${s.name}${s.badge ? `<span class="badge">${s.badge}</span>` : ''}</h2>
  <p class="line">${s.line}</p>
  ${s.mock}
  ${s.built ? built(s.built) : ''}
</section>`;

const page = `<title>FlowState Worlds</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="tokens.css">
<style>
${chromeCss}
:root[data-theme="dark"]{--bg:#121318;--fg:#D8D2C3;--muted:#8C8F99;--rail:#1B1D26;--line:#2C2F3A;color-scheme:dark} /* design-lint: allow */
</style>
<link rel="stylesheet" href="parts.css">
<link rel="stylesheet" href="gate.css">
<style>
/* Worlds: what this plan adds to the page parts, in tokens only */
.badge{display:inline-block;vertical-align:middle;margin-left:10px;padding:2px 9px;border:1px solid var(--line);border-radius:999px;font:500 11px var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.wd-shelf{display:flex;align-items:center;gap:var(--s2);overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:var(--s2) 21% var(--s1);flex:none}
.wd-shelf::-webkit-scrollbar{display:none}
.wd-cover{flex:none;width:100%;aspect-ratio:4/5;scroll-snap-align:center;display:flex;flex-direction:column;justify-content:space-between;text-align:left;padding:var(--s2) var(--s2) var(--s2) calc(var(--s2) + 8px);border:1px solid var(--seam);border-radius:3px 12px 12px 3px;color:var(--ink);font-family:var(--serif);cursor:pointer;
  background:linear-gradient(to right,color-mix(in oklch,var(--wc) 60%,var(--page)) 0 8px,transparent 8px),color-mix(in oklch,var(--wc) 14%,var(--page));
  transform:scale(.86);opacity:.5;transition:transform var(--t-ui) var(--ease),opacity var(--t-ui) var(--ease)}
.wd-cover.front{transform:none;opacity:1}
.wd-cover-name{font-size:var(--fs-title);line-height:1.15;text-wrap:balance}
.wd-cover-foot{display:flex;flex-direction:column;gap:var(--s1)}
.wd-cover small{font-family:var(--sans);font-size:var(--fs-print);letter-spacing:var(--track-print);text-transform:uppercase;color:var(--print)}
.wd-dots{display:flex;gap:5px;min-height:8px}
.wd-dots i{width:8px;height:8px;border-radius:50%;background:var(--vc)}
[data-light="still"] .wd-cover{background:var(--page)}
[data-light="still"] .wd-dots{visibility:hidden}
.wd-under{flex:1;min-height:0}
.wd-last small{font-family:var(--sans);font-style:normal;font-size:var(--fs-print);letter-spacing:var(--track-print);text-transform:uppercase;margin-right:var(--s1)}
.wd-last{margin:0;min-height:calc(var(--lh-ink)*2);overflow:hidden}
.wd-circles{display:flex;justify-content:space-between;height:calc(var(--lh-ink)*4);align-items:center}
.wd-circ{display:grid;justify-items:center;gap:2px;flex:1;cursor:pointer}
.wd-circ svg{width:calc(var(--lh-ink)*2);height:calc(var(--lh-ink)*2)}
.wd-circ svg *{fill:none;stroke:var(--ink);stroke-width:1.4;stroke-linecap:round}
.wd-circ small{font-family:var(--sans);font-size:var(--fs-print);letter-spacing:var(--track-print);text-transform:uppercase;color:var(--print);line-height:var(--lh-ink)}
@media (prefers-reduced-motion:reduce){.wd-cover{transition:none}}
.wd-sec{margin:0;font-family:var(--sans);font-size:var(--fs-print);letter-spacing:var(--track-print);text-transform:uppercase;color:var(--print);line-height:var(--lh-ink)}
.wd-take{display:flex;align-items:center;gap:var(--s1);height:calc(var(--lh-ink)*2)}
.wd-take small{font-family:var(--sans);font-size:var(--fs-print);letter-spacing:var(--track-print);text-transform:uppercase;color:var(--print);white-space:nowrap}
.wd-pitch{flex:1;min-width:0;height:calc(var(--lh-ink)*1.6)}
.wd-pitch path{fill:none;stroke:var(--ink);stroke-width:1.6;stroke-linecap:round;vector-effect:non-scaling-stroke}
.wd-worn{margin:var(--s2) 0 0;font-family:var(--sans);font-size:var(--fs-print);letter-spacing:var(--track-print);text-transform:uppercase;color:var(--print)}
.screen .fs-composer-wrap>.fs-new{margin:0 var(--gutter) var(--s1)}
/* The desktop windows keep Novel Companion's own light theme whatever the page's theme, as the phones keep their lights. */
.mac{--m-bg:#f3f5f7;--m-surface:#ffffff;--m-sunken:#e9edf1;--m-border:#cfd6dd;--m-fg:#16202b;--m-fg2:#3f4d5b;--m-fg3:#5f6e7d;--m-accent:#1b705f;--m-accent-soft:#d7efe8;--m-idea:#7a611b;--m-serif:Georgia,'Times New Roman',serif;--m-sans:system-ui,-apple-system,sans-serif;--m-mono:ui-monospace,Menlo,monospace; /* design-lint: allow: Novel Companion theme.css */
  width:min(100%,720px);border:1px solid var(--m-border);border-radius:12px;overflow:hidden;background:var(--m-bg);color:var(--m-fg);font-family:var(--m-sans);font-size:14px;line-height:1.45;box-shadow:0 20px 50px #00000030} /* design-lint: allow */
.mac-bar{display:flex;align-items:center;gap:6px;padding:9px 12px;background:var(--m-sunken);border-bottom:1px solid var(--m-border);color:var(--m-fg2);font-size:12px}
.mac-bar i{width:11px;height:11px;border-radius:50%;background:var(--m-border)}
.mac-bar span{margin-left:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mac-body{display:grid;grid-template-columns:132px minmax(0,1fr)}
.mac-rail{display:grid;align-content:start;gap:2px;padding:10px 8px;border-right:1px solid var(--m-border)}
.mac-rail a{padding:6px 8px;border-radius:6px;color:var(--m-fg2)}
.mac-rail a[aria-current]{background:var(--m-accent-soft);color:var(--m-accent);font-weight:600}
.mac-main{padding:16px 18px 20px;background:var(--m-surface);min-width:0}
.mac h3{margin:0;font:500 24px/1.2 var(--m-serif)}
.mac h4{margin:16px 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--m-fg3)}
.mac-sub{margin:2px 0 0;color:var(--m-fg3);font-size:13px}
.mac-list{list-style:none;margin:0;padding:0}
.mac-list li{display:grid;grid-template-columns:56px minmax(0,1fr);gap:0 10px;padding:7px 0;border-top:1px solid var(--m-sunken);align-items:center}
.mac-list time{color:var(--m-fg3);font-variant-numeric:tabular-nums;font-size:13px}
.mac-list em{grid-column:2;font-style:normal;font-size:12px;color:var(--m-fg3)}
.mac-lyric{margin:0;font:400 16px/1.5 var(--m-serif)}
.mac .wd-pitch{height:34px;width:100%}
.mac .wd-pitch path{stroke:var(--m-accent)}
.mac-card{border:1px solid var(--m-border);border-radius:8px;padding:10px 12px;margin-top:10px}
.mac-card.wait{background:var(--m-bg)}
.mac-card label{display:block;font:400 16px/1.4 var(--m-serif)}
.mac-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 6px}
.mac-chips span{padding:2px 8px;border:1px solid var(--m-border);border-radius:999px;font-size:12px;color:var(--m-fg2)}
.mac-chips .idea{border-color:var(--m-idea);color:var(--m-idea)}
.mac-diff{margin:0;padding:4px 8px;border-radius:4px;background:var(--m-accent-soft);color:var(--m-fg);font:13px/1.4 var(--m-mono);overflow-wrap:anywhere}
.mac-acts{display:flex;gap:8px;margin-top:14px}
.mac-acts button{font:600 13px var(--m-sans);padding:7px 14px;border-radius:6px;border:1px solid var(--m-border);background:var(--m-surface);color:var(--m-fg)}
.mac-acts .pri{background:var(--m-accent);border-color:var(--m-accent);color:var(--m-surface)}
@media (max-width:520px){.mac-body{grid-template-columns:1fr}.mac-rail{display:flex;overflow-x:auto;border-right:0;border-bottom:1px solid var(--m-border)}}
</style>
<div class="wrap">
<header class="top"><h1>FlowState Worlds</h1><span class="badge">Plan</span><span class="counter" id="counter"></span>
  <div class="lights" role="group" aria-label="Relight every phone"><button data-light="design" aria-pressed="true">As designed</button><button data-light="day">Day</button><button data-light="night">Night</button><button data-light="still">Still</button></div>
</header>
<nav class="rail" aria-label="Steps"><ol id="rail"></ol></nav>
<main id="main">
${steps.map(stepHtml).join('\n\n')}

<div class="ctl"><button id="prev">Previous</button><button id="next">Next</button></div>
</main>
</div>
<script>
(function(){
  var steps=[].slice.call(document.querySelectorAll('.step'));
  var rail=document.getElementById('rail'),counter=document.getElementById('counter');
  var designed=[].slice.call(document.querySelectorAll('.screen')).map(function(s){return [s,s.dataset.light];});
  var i=0;
  steps.forEach(function(s,k){var li=document.createElement('li'),a=document.createElement('a');a.href='#'+s.id;a.innerHTML='<span class="n">'+(k+1)+'</span><span class="t"></span>';a.lastChild.textContent=s.dataset.name;a.addEventListener('click',function(e){e.preventDefault();go(k,true);});li.appendChild(a);rail.appendChild(li);});
  function go(k,push){i=(k+steps.length)%steps.length;steps.forEach(function(s,j){s.classList.toggle('on',j===i);});
    [].slice.call(rail.querySelectorAll('a')).forEach(function(a,j){if(j===i)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});
    counter.textContent='Step '+(i+1)+' of '+steps.length;
    var sh=steps[i].querySelector('.wd-shelf');if(sh)requestAnimationFrame(function(){var c=sh.children[+sh.dataset.front];sh.scrollLeft=c.offsetLeft-(sh.clientWidth-c.offsetWidth)/2;settle(sh);});
    if(push){try{history.replaceState(null,'','#'+steps[i].id);}catch(e){location.hash=steps[i].id;}}}
  document.getElementById('prev').addEventListener('click',function(){go(i-1,true);});
  document.getElementById('next').addEventListener('click',function(){go(i+1,true);});
  document.addEventListener('keydown',function(e){if(e.target.closest&&e.target.closest('textarea,input'))return;if(e.key==='ArrowRight')go(i+1,true);if(e.key==='ArrowLeft')go(i-1,true);});
  document.querySelectorAll('.lights [data-light]').forEach(function(b){b.addEventListener('click',function(){var m=b.dataset.light;designed.forEach(function(d){d[0].dataset.light=m==='design'?d[1]:m;});document.querySelectorAll('.lights [data-light]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});});});
  function settle(sh){var mid=sh.scrollLeft+sh.clientWidth/2,best=null,d=1e9;[].forEach.call(sh.children,function(c){var x=Math.abs(c.offsetLeft+c.offsetWidth/2-mid);if(x<d){d=x;best=c;}});
    [].forEach.call(sh.children,function(c){c.classList.toggle('front',c===best);});
    sh.parentNode.querySelectorAll('.wd-under').forEach(function(u){u.hidden=u.dataset.for!==best.dataset.book;});}
  document.querySelectorAll('.wd-shelf').forEach(function(sh){sh.addEventListener('scroll',function(){settle(sh);},{passive:true});
    sh.addEventListener('click',function(e){var c=e.target.closest('.wd-cover');if(c)sh.scrollTo({left:c.offsetLeft-(sh.clientWidth-c.offsetWidth)/2,behavior:'smooth'});});});
  function fromHash(){var h=(location.hash||'').replace('#','');var k=steps.findIndex(function(s){return s.id===h;});go(k>=0?k:0,false);}
  window.addEventListener('hashchange',fromHash);fromHash();
})();
</script>
`;

await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'index.html'), page);
for (const f of ['tokens.css', 'parts.css', 'gate.css']) await copyFile(path.join(root, 'design', f), path.join(out, f));
console.log(`design/worlds/index.html: ${steps.length} steps, ${(page.length / 1024).toFixed(0)} KB`);
