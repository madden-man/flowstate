#!/usr/bin/env node
// Plan-stage capture (PLAN-BLOCKERS.md): the walkthrough's screens, photographed from the real app on a dev server with
// the proposed pieces drawn in by hand (proposed.css, and the DOM put in below). Run: a dev server on PORT (default
// 4262), then `node design/blockers/capture.mjs`. The build replaces this with a walkthrough that runs the real app.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = `http://127.0.0.1:${process.env.PORT ?? 4262}`;
const css = fs.readFileSync(path.join(here, 'proposed.css'), 'utf8');
const only = process.argv.slice(2);
const want = name => !only.length || only.includes(name);

// ---- what the plan proposes (PLAN-BLOCKERS.md sections 4 and 6) ----
const NEW = {
  gripping: { name: 'Gripping', diagram: 'ring', steps: ['Planning', 'Re-planning', 'Checking', 'Tighter'] },
  choose: { name: "Can't choose", diagram: 'fork', steps: ['Two doors', 'More research', 'Asking everyone', 'Neither'] },
  swallowed: { name: 'Swallowed it', diagram: 'stairs', steps: ['Almost said', 'Let it pass', 'Rehearsing', 'Resenting'] },
  missing: { name: 'Missing someone', diagram: 'curve', steps: ['A reminder', 'The wave', 'Aching', 'Easing'] },
  start: { name: "Can't start", diagram: 'valley', steps: ['Should', 'Putting off', 'Dread', 'One small piece'] },
  numbing: { name: 'Numbing', diagram: 'coil', steps: ['Restless', 'Reaching', 'Scrolling', 'Hollow'] },
};
const SIGNS = [
  ['Crown', 'letting go', ['night', 'replay+', 'gripping*']],
  ['Third eye', 'seeing clearly', ['replay', 'whatif+', 'choose*']],
  ['Throat', 'speech', ['fight', 'swallowed*']],
  ['Heart', 'love and grief', ['depress', 'missing*']],
  ['Solar plexus', 'will and worth', ['shame', 'start*']],
  ['Sacral', 'feeling', ['shutdown', 'numbing*']],
  ['Root', 'feeling safe', ['panic', 'whatif', 'night+']],
];
const ROOT_DECK = [
  'What is true right here, in this room?', 'What do you need in the next hour?', 'What has held before when it felt like this?',
  'Where in the body does it feel least safe, and where most?', 'What is the worst that is actually likely?',
  'Who or what is solid right now?', 'What does the alarm want you to do, and what do you want to do?',
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });

async function open(hash, time = '2026-11-17T10:12:00') {
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('page error:', String(e)));
  await page.clock.install({ time: new Date(time) });
  await page.goto(`${base}/${hash}`);
  await page.locator('.fs-page').first().waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await page.clock.runFor(3000);
  await page.addStyleTag({ content: css });
  await page.evaluate(async ({ NEW, ROOT_DECK }) => {
    const cap = await import('/design/blockers/cap.tsx');
    const S = { ...Object.fromEntries(cap.seeds().map(s => [s.id, s])), ...NEW };
    const ring = on => `<button type="button" class="pd-ring${on ? ' on' : ''}" aria-label="${on ? 'Resolved' : 'Resolve'}"><svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="6.4"/>${on ? '<circle class="in" cx="10" cy="10" r="3.4"/>' : ''}</svg></button>`;
    const row = (key, o = {}) => {
      const also = key.endsWith('+'), fresh = key.endsWith('*'), s = S[key.replace(/[+*]$/, '')];
      const tag = also ? 'also here' : fresh ? 'new' : '';
      return `<a class="fs-row fs-list-row fl-flow"${o.struck ? ' data-struck' : ''}${o.at ? ' data-live="true"' : ''}><span class="fs-list-line">${s.name}</span><small class="fs-list-meta">${tag ? `${tag} · ` : ''}${s.steps.join(' · ')}</small><span class="fl-mini" aria-hidden="true">${cap.mini(s.diagram, s.steps, o.at ?? 0)}</span></a>`;
    };
    const blockers = (keys, o = {}) => `<p class="fs-month bk-label">Blockers</p>${keys.map(k => row(k, k === o.live ? { at: 2 } : {})).join('')}`;
    const q = (text, o = {}) => `<div class="pd-q${o.done ? ' done' : ''}"><button type="button" class="ck-ask fs-wise">${text}</button>${o.date ? `<span class="pd-date">${o.date}</span>` : ''}${ring(o.done)}</div>`;
    window.mk = {
      cap, S, ring, row, blockers, q, ROOT_DECK,
      /** Blockers under the gate of the sign's page that is up. */
      putBlockers(keys, o) {
        const sec = document.createElement('section');
        sec.className = 'bk fs-notstill';
        sec.innerHTML = blockers(keys, o);
        document.querySelector('.fs-gate').after(sec);
      },
      /** The sign's questions with their rings: open ones, then the foot (Resolved, Edit), then the fold if open. */
      putAsks(open, o = {}) {
        const el = document.querySelector('.ck-asks');
        el.style.position = 'static';
        el.innerHTML = open.map(x => (typeof x === 'string' ? q(x) : q(x.text, x))).join('')
          + `<p class="pd-foot"><button type="button" class="fs-word"${o.fold ? ' aria-expanded="true"' : ''}>Resolved</button><button type="button" class="fs-word">Edit</button></p>`
          + (o.fold ?? []).map(x => q(x.text, { done: true, date: x.date })).join('');
      },
      show(sel, block = 'center') { document.querySelector(sel)?.scrollIntoView({ block }); },
    };
  }, { NEW, ROOT_DECK });
  return page;
}
const shot = async (page, name) => {
  await page.clock.runFor(600);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(here, `${name}.jpg`), type: 'jpeg', quality: 82 });
  console.log('shot', name);
  await page.close();
};
const ROOT = ['panic', 'whatif', 'night+'];

// 1. each sign names what blocks it
if (want('blockers')) {
  const p = await open('#/flow/c/root');
  await p.evaluate(ROOT => { mk.putBlockers(ROOT); mk.show('.bk', 'end'); }, ROOT);
  await shot(p, 'blockers');
}
// 2 and 3. a tap opens its drawing; a step word reads the step
for (const [name, step] of [['drawing', undefined], ['step', '2']]) {
  if (!want(name)) continue;
  const p = await open('#/flow/c/root');
  await p.evaluate(step => {
    for (const c of document.querySelector('.fs-main').children) c.style.setProperty('display', 'none', 'important');
    mk.cap.showFlow('panic', step);
  }, step);
  await p.clock.runFor(2500);
  await p.evaluate(() => {
    const words = [...document.querySelectorAll('.fs-main > div:last-child .fs-hdr-l .fs-word')];
    words[0].textContent = 'Root';
    words.find(w => w.textContent === 'Settings')?.remove();
    scrollTo(0, 0);
  });
  await shot(p, name);
}
// 4. one that is running shows where I am
if (want('live')) {
  const p = await open('#/flow/c/root');
  await p.evaluate(ROOT => { mk.putBlockers(ROOT, { live: 'panic' }); mk.show('.bk', 'end'); }, ROOT);
  await shot(p, 'live');
}
// 5. I decide what stays: the sheet
if (want('stays')) {
  const p = await open('#/flow/c/root');
  await p.evaluate(ROOT => { mk.putBlockers(ROOT); }, ROOT);
  await p.locator('.ck-asks-edit .fs-word').click();
  await p.clock.runFor(1500);
  await p.evaluate(() => {
    const sheet = document.querySelector('.fs-sheet');
    sheet.querySelector('h2').textContent = 'Root blockers';
    sheet.querySelector('.fs-sheet-body').innerHTML = `<div class="bk">${mk.row('panic')}${mk.row('whatif')}${mk.row('night+', { struck: true })}<p class="bk-edit"><button type="button" class="fs-word">+ blocker</button></p></div>`;
  });
  await shot(p, 'stays');
}
// 7 to 9. the questions, one resolved, the fold
for (const name of ['ponder', 'resolved', 'fold']) {
  if (!want(name)) continue;
  const p = await open('#/flow/c/root');
  await p.evaluate(({ ROOT, name }) => {
    const D = mk.ROOT_DECK;
    mk.putBlockers(ROOT);
    if (name === 'ponder') mk.putAsks(D.slice(0, 3));
    if (name === 'resolved') mk.putAsks([{ text: D[0], done: true }, D[1], D[2], D[3]]);
    if (name === 'fold') mk.putAsks(D.slice(1, 4), { fold: [{ text: D[0], date: '11 / 17 / 26' }, { text: 'What can you put down for tonight?', date: '11 / 9 / 26' }] });
    mk.show('.ck-asks', name === 'fold' ? 'end' : 'center');
  }, { ROOT, name });
  await shot(p, name);
}
// 10. Edit holds the whole deck
if (want('deck')) {
  const p = await open('#/flow/c/root');
  await p.locator('.ck-asks-edit .fs-word').click();
  await p.clock.runFor(1500);
  await p.evaluate(() => {
    const box = document.querySelector('.ck-asks-sheet'), first = box.querySelector('input');
    box.innerHTML = '';
    for (const text of [...mk.ROOT_DECK.slice(1), '']) {
      const i = first.cloneNode();
      i.value = text; i.placeholder = text ? '' : 'Another question'; i.setAttribute('aria-label', text || 'Another question');
      box.appendChild(i);
    }
  });
  await shot(p, 'deck');
}
// 11. or resolve it where I answered it: today's page
if (want('journal')) {
  const p = await open('#/flow/c/root');
  await p.locator('.ck-ask').nth(1).click();
  await p.clock.runFor(2500);
  await p.waitForTimeout(1500);
  await p.keyboard.type('Water, something to eat, and the window open. Nothing else is owed tonight.');
  await p.clock.runFor(800);
  const html = await p.evaluate(() => {
    const line = [...document.querySelectorAll('.fs-page *')].find(e => e.children.length === 0 && e.textContent.trim() === 'What do you need in the next hour?');
    const host = line?.closest('[class*="fs-"]');
    if (host) { host.style.display = 'flex'; host.style.alignItems = 'flex-start'; const s = document.createElement('span'); s.style.flex = '1'; while (host.firstChild) s.appendChild(host.firstChild); host.appendChild(s); host.insertAdjacentHTML('beforeend', mk.ring(false)); }
    document.activeElement?.blur();
    return host?.outerHTML.slice(0, 400);
  });
  console.log('journal line:', html);
  await shot(p, 'journal');
}
// 12 and 13. the same ring on the ? list and on a question's own page
if (want('qtab') || want('qpage')) {
  const seed = await open('#/questions');
  for (const text of ['Is the rental the right size, or just the available one?', 'What do I want the mornings to be?', 'Do I call Dad back this week?']) {
    if (await seed.locator('.fs-qrow', { hasText: text }).count()) continue;
    if (await seed.locator('.fs-ask .fs-word').count()) await seed.locator('.fs-ask .fs-word').click();
    await seed.locator('.fs-ask input').fill(text);
    await seed.locator('.fs-ask input').press('Enter');
    await seed.locator('.fs-qrow', { hasText: text }).waitFor();
  }
  await seed.close();
  if (want('qtab')) {
    const p = await open('#/questions');
    await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.fs-qlist > .fs-qrow')];
      const wrap = (a, done, date) => {
        const d = document.createElement('div');
        d.className = `pd-q${done ? ' done' : ''}`;
        a.replaceWith(d); d.appendChild(a);
        if (done) { a.classList.add('done'); a.querySelector('.fs-list-meta').textContent += ` · ${date}`; }
        d.insertAdjacentHTML('beforeend', mk.ring(done));
        return d;
      };
      const [a, b, c] = rows;
      wrap(a); wrap(b);
      const done = wrap(c, true, '11 / 17 / 26');
      const group = document.createElement('div');
      group.className = 'fs-notstill';
      group.innerHTML = '<p class="fs-month fs-answered">Resolved</p>';
      document.querySelector('.fs-qlist').appendChild(group);
      group.appendChild(done);
    });
    await shot(p, 'qtab');
  }
  if (want('qpage')) {
    const p = await open('#/questions');
    await p.locator('.fs-qrow').nth(1).click();
    await p.clock.runFor(2500);
    await p.waitForTimeout(1500);
    await p.keyboard.type('Slow. Coffee on the porch before the phone.');
    await p.clock.runFor(800);
    const html = await p.evaluate(() => {
      const t = [...document.querySelectorAll('.fs-page *')].filter(e => (e.value ?? e.textContent).trim() === 'What do I want the mornings to be?').pop();
      if (t) { const d = document.createElement('div'); d.className = 'pd-title'; t.replaceWith(d); d.appendChild(t); d.insertAdjacentHTML('beforeend', mk.ring(false)); }
      document.activeElement?.blur();
      return t?.outerHTML.slice(0, 300);
    });
    console.log('question title:', html);
    await shot(p, 'qpage');
  }
}
// 14. in Still, none of it
if (want('still')) {
  const p = await open('#/flow/c/root', '2026-11-17T23:05:00');
  await p.evaluate(ROOT => { mk.putBlockers(ROOT); mk.putAsks(mk.ROOT_DECK.slice(0, 3)); }, ROOT);
  await p.locator('.fs-moon').first().click();
  await p.clock.runFor(4000);
  await shot(p, 'still');
}
await ctx.close();

// 6. the candidates, sign by sign: one wide sheet of the same rows
if (want('candidates')) {
  const wide = await browser.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await wide.newPage();
  await page.clock.install({ time: new Date('2026-11-17T10:12:00') });
  await page.goto(`${base}/#/flow`);
  await page.locator('.fs-page').first().waitFor();
  await page.addStyleTag({ content: css });
  await page.evaluate(async ({ NEW, SIGNS }) => {
    const cap = await import('/design/blockers/cap.tsx');
    const S = { ...Object.fromEntries(cap.seeds().map(s => [s.id, s])), ...NEW };
    const row = key => {
      const also = key.endsWith('+'), fresh = key.endsWith('*'), s = S[key.replace(/[+*]$/, '')];
      const tag = also ? 'also here' : fresh ? 'new' : 'has its steps';
      return `<a class="fs-row fs-list-row fl-flow"><span class="fs-list-line">${s.name}</span><small class="fs-list-meta">${tag} · ${s.steps.join(' · ')}</small><span class="fl-mini" aria-hidden="true">${cap.mini(s.diagram, s.steps)}</span></a>`;
    };
    document.body.innerHTML = `<div class="cand">${SIGNS.map(([name, gloss, keys]) => `<section class="fs-rules bk"><p class="fs-month">${name} · ${gloss}</p>${keys.map(row).join('')}</section>`).join('')}</div>`;
  }, { NEW, SIGNS });
  await page.addStyleTag({ content: `body{margin:0;background:var(--page);color:var(--ink);font-family:var(--serif);font-size:var(--fs-ink);line-height:var(--lh-ink)}
    .cand{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--lh-ink) calc(var(--gutter) * 2);padding:var(--lh-ink) var(--gutter)}
    .cand section{min-width:0}` });
  await page.screenshot({ path: path.join(here, 'candidates.jpg'), type: 'jpeg', quality: 84, fullPage: true });
  console.log('shot candidates');
  await wide.close();
}
await browser.close();
