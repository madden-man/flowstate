// @vitest-environment jsdom
// Resolve (PLAN-BLOCKERS.md K1): the part on its own, then on the ? tab and on a question's own page. The word at rest,
// the drawn check once tapped, the check's tick only on the way in, role and label, all three lights (gone in Still).
// The ? tab: the label reads Resolved, a row stays where it stood until the list is read again, one date when asked and
// resolved fall on the same day. The question page: Resolve beside the title, the open counter going with it.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import { act } from 'preact/test-utils';
import { Router, Route } from 'preact-iso';

const feel = vi.hoisted(() => ({ ticks: [] as string[] }));
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: (n: string) => { feel.ticks.push(n); } }));

import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { loadSettings } from '../../src/ui/settings';
import { HashLocation } from '../../src/ui/route';
import { still } from '../../src/ui/light';
import { gate } from '../../src/ui/lock/pin';
import { Resolve } from '../../src/ui/parts/Resolve';
import { Questions, QuestionPage, askedAndResolved } from '../../src/ui/questions/Questions';
import { askQuestion, pageById, resolveQuestion } from '../../src/model/pages';
import { notebookDate } from '../../src/ui/date';

let root: HTMLElement;
const wait = (ms = 0) => new Promise(r => setTimeout(r, ms));
const settle = async () => { for (let i = 0; i < 20; i++) await act(async () => { await wait(2); }); };
const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];
const got = async (id: string) => (await pageById(id))!.page;
const LIGHTS = ['day', 'night', 'still'] as const;

// the app's own stylesheet, so "gone in Still" is the CSS saying so and not a class name alone
const css = document.createElement('style');
css.textContent = readFileSync('src/ui/parts/parts.css', 'utf8');
document.head.append(css);

beforeEach(async () => {
  Element.prototype.scrollIntoView ??= () => undefined;
  await freshDB();
  await ensureSeeded(7);
  await loadSettings();
  gate.value = null;
  still.value = null;
  feel.ticks = [];
  document.documentElement.dataset.light = 'day';
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(async () => { await act(() => { render(null, root); }); root.remove(); still.value = null; document.documentElement.dataset.light = 'day'; });

/** A Resolve with its state held by the caller, as every screen holds it. */
function Held({ start = false, seen }: { start?: boolean; seen: boolean[] }) {
  const [on, setOn] = useState(start);
  return h(Resolve, { on, onChange: v => { seen.push(v); setOn(v); } });
}

describe('parts/Resolve', () => {
  it('is a checkbox labelled Resolved: the print word at rest, the drawn check once tapped, the word again when taken back', async () => {
    const seen: boolean[] = [];
    await act(() => { render(h(Held, { seen }), root); });
    const b = $<HTMLButtonElement>('button')!;
    expect(b.getAttribute('role')).toBe('checkbox');
    expect(b.getAttribute('aria-label')).toBe('Resolved');
    expect(b.getAttribute('aria-checked')).toBe('false');
    expect(b.textContent).toBe('Resolve');
    expect(b.querySelector('svg .fs-check-ink')).not.toBeNull();
    expect(b.classList.contains('done')).toBe(false);

    await act(() => { b.click(); });
    expect(seen).toEqual([true]);
    expect(b.getAttribute('aria-checked')).toBe('true');
    // drawn by a thumb: the pen's weight (rule 27), and the check's tick (rule 19)
    expect(b.className).toMatch(/\bdone\b.*\binked\b/);
    expect(feel.ticks).toEqual(['check']);

    await act(() => { b.click(); });
    expect(seen).toEqual([true, false]);
    expect(b.getAttribute('aria-checked')).toBe('false');
    expect(b.classList.contains('done')).toBe(false);
    // taking it back is lifted, not felt
    expect(feel.ticks).toEqual(['check']);
  });

  it('a check already there when the screen came up carries no pen weight', async () => {
    await act(() => { render(h(Held, { start: true, seen: [] }), root); });
    const b = $<HTMLButtonElement>('button')!;
    expect(b.getAttribute('aria-checked')).toBe('true');
    expect(b.classList.contains('done')).toBe(true);
    expect(b.classList.contains('inked')).toBe(false);
  });

  it('takes its own label and class, and asks nothing of what it resolves', async () => {
    const seen: boolean[] = [];
    await act(() => { render(h(Resolve, { on: false, onChange: v => seen.push(v), label: 'Resolved line', class: 'x-here' }), root); });
    const b = $<HTMLButtonElement>('button')!;
    expect(b.getAttribute('aria-label')).toBe('Resolved line');
    expect(b.classList.contains('x-here')).toBe(true);
    await act(() => { b.click(); });
    expect(seen).toEqual([true]);
  });

  it('a tap on it inside a link answers the word, not the link', async () => {
    const seen: boolean[] = [];
    location.hash = '#/start';
    await act(() => { render(h('a', { href: '#/elsewhere' }, h(Resolve, { on: false, onChange: v => seen.push(v) })), root); });
    await act(() => { $<HTMLButtonElement>('button')!.click(); });
    expect(seen).toEqual([true]);
    expect(location.hash).toBe('#/start');
  });

  for (const l of LIGHTS) {
    it(`in ${l}: ${l === 'still' ? 'gone, as states are' : 'shown, open and resolved alike'}`, async () => {
      document.documentElement.dataset.light = l;
      await act(() => { render(h('div', {}, h(Resolve, { on: false, onChange: () => undefined }), h(Resolve, { on: true, onChange: () => undefined })), root); });
      for (const b of $$('button')) {
        expect(b.classList.contains('fs-notstill')).toBe(true);
        expect(getComputedStyle(b).display).toBe(l === 'still' ? 'none' : 'inline-grid');
      }
    });
  }
});

describe('askedAndResolved: the ? tab meta line', () => {
  const d = (s: string) => new Date(s).getTime();
  it('prints the day asked, then the day resolved, and one date when both are the same day', () => {
    const asked = d('2026-11-15T09:00');
    expect(askedAndResolved({ createdAt: asked, state: 'open' })).toBe(notebookDate(new Date(asked)));
    expect(askedAndResolved({ createdAt: asked, state: 'answered', answeredAt: d('2026-11-17T08:00') }))
      .toBe(`${notebookDate(new Date(asked))} · ${notebookDate(new Date(d('2026-11-17T08:00')))}`);
    expect(askedAndResolved({ createdAt: asked, state: 'answered', answeredAt: d('2026-11-15T22:00') })).toBe(notebookDate(new Date(asked)));
  });
});

/** The real app's two question routes. */
const R = Route as unknown as (p: { path?: string; default?: boolean; component: unknown }) => null;
const Hash = HashLocation as unknown as (p: object) => null;
const Routes = Router as unknown as (p: object) => null;
const routes = () => h(Hash, {}, h(Routes, {},
  h(R, { path: '/questions', component: Questions }),
  h(R, { path: '/questions/:id', component: QuestionPage }),
  h(R, { default: true, component: () => null }),
));
const mount = async (hash: string) => { location.hash = hash; await act(() => { render(routes(), root); }); await settle(); };
const rowOf = (title: string) => $$('.fs-qitem').find(r => r.querySelector('.fs-list-line')?.textContent === title)!;
const resolveOf = (title: string) => rowOf(title).querySelector<HTMLButtonElement>('[role="checkbox"]')!;

describe('the ? tab', () => {
  it('Resolve on every open row, the check on every resolved one; the label reads Resolved; nothing counted', async () => {
    const a = await askQuestion('Do I call Dad back this week?');
    await askQuestion('What do I want the mornings to be?');
    const c = await askQuestion('Is the rental the right size?');
    await resolveQuestion(c.id, true);
    await mount('#/questions');

    expect($$('.fs-qitem').length).toBe(3);
    expect(resolveOf('Do I call Dad back this week?').getAttribute('aria-checked')).toBe('false');
    expect(resolveOf('What do I want the mornings to be?').textContent).toBe('Resolve');
    expect(resolveOf('Is the rental the right size?').getAttribute('aria-checked')).toBe('true');
    expect($('.fs-answered')!.textContent).toBe('Resolved');
    expect($('[role="group"]')!.getAttribute('aria-label')).toBe('Resolved');
    expect(root.textContent).not.toMatch(/Answered/);
    // one date: asked and resolved the same day
    expect(rowOf('Is the rental the right size?').querySelector('.fs-list-meta')!.textContent).toBe(notebookDate(new Date(c.createdAt)));
    // nothing counted anywhere on the list
    expect(root.textContent).not.toMatch(/\d+ of \d+|\bopen\b/i);

    // a tap resolves it where it stands: the check drawn, the row in print grey, no move under the heading yet
    await act(() => { resolveOf('Do I call Dad back this week?').click(); });
    await settle();
    expect((await got(a.id)).state).toBe('answered');
    expect(resolveOf('Do I call Dad back this week?').getAttribute('aria-checked')).toBe('true');
    expect(rowOf('Do I call Dad back this week?').querySelector('.fs-qrow')!.classList.contains('done')).toBe(true);
    expect(rowOf('Do I call Dad back this week?').closest('[role="group"]')).toBeNull();
    expect(feel.ticks).toEqual(['check']);

    // a tap on the check takes it back
    await act(() => { resolveOf('Do I call Dad back this week?').click(); });
    await settle();
    expect((await got(a.id)).state).toBe('open');
    expect(resolveOf('Do I call Dad back this week?').getAttribute('aria-checked')).toBe('false');

    // taken back from under Resolved: open again, and under Resolved until the list is read again
    await act(() => { resolveOf('Is the rental the right size?').click(); });
    await settle();
    expect((await got(c.id)).state).toBe('open');
    expect(rowOf('Is the rental the right size?').closest('[role="group"]')).not.toBeNull();

    // read again, everything stands where its state says
    await act(() => { render(null, root); });
    await mount('#/questions');
    expect($('[role="group"]')).toBeNull();
    expect($$('.fs-qitem [aria-checked="true"]').length).toBe(0);
  });

  for (const l of LIGHTS) {
    it(`in ${l}: ${l === 'still' ? 'the open questions only, with no Resolve' : 'Resolve shown, and the resolved under their label'}`, async () => {
      document.documentElement.dataset.light = l;
      await askQuestion('Who are my models?');
      const done = await askQuestion('What is the smallest version of this?');
      await resolveQuestion(done.id, true);
      await mount('#/questions');
      const shown = (el: Element) => getComputedStyle(el).display !== 'none' && (!el.closest('.fs-notstill') || l !== 'still');
      expect(shown(resolveOf('Who are my models?'))).toBe(l !== 'still');
      expect(shown(rowOf('Who are my models?'))).toBe(true);
      expect(shown(rowOf('What is the smallest version of this?'))).toBe(l !== 'still');
    });
  }
});

describe('a question page', () => {
  it('Resolve stands beside the title; a tap resolves it with nothing written, the counter goes, a tap takes it back', async () => {
    await askQuestion('Who are my models?');
    const q = await askQuestion('What do I want the mornings to be?');
    await mount(`#/questions/${q.id}`);
    const title = $<HTMLTextAreaElement>('textarea[aria-label="Question"]')!;
    expect(title.value).toBe('What do I want the mornings to be?');
    const r = $<HTMLButtonElement>('.fs-qtitle [role="checkbox"]')!;
    expect(r.parentElement).toBe(title.parentElement);
    expect(r.getAttribute('aria-label')).toBe('Resolved');
    expect(r.getAttribute('aria-checked')).toBe('false');
    expect($('.fs-hdr-r')!.textContent).toMatch(/\d of 2 open/);

    await act(() => { r.click(); });
    await settle();
    const stored = (await got(q.id));
    expect(stored.state).toBe('answered');
    expect(stored.resolvedByTap).toBe(true);
    expect($('.fs-qtitle [role="checkbox"]')!.getAttribute('aria-checked')).toBe('true');
    expect($('.fs-hdr-r')!.textContent).not.toMatch(/open/);
    expect(feel.ticks).toEqual(['check']);

    await act(() => { $<HTMLButtonElement>('.fs-qtitle [role="checkbox"]')!.click(); });
    await settle();
    expect((await got(q.id)).state).toBe('open');
    expect($('.fs-qtitle [role="checkbox"]')!.getAttribute('aria-checked')).toBe('false');
  });

  it('a title still being typed is kept when Resolve is tapped straight after', async () => {
    const q = await askQuestion('What do I want');
    await mount(`#/questions/${q.id}`);
    const title = $<HTMLTextAreaElement>('textarea[aria-label="Question"]')!;
    await act(() => { title.value = 'What do I want the mornings to be?'; title.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(() => { $<HTMLButtonElement>('.fs-qtitle [role="checkbox"]')!.click(); });
    await settle();
    const stored = (await got(q.id));
    expect(stored.title).toBe('What do I want the mornings to be?');
    expect(stored.state).toBe('answered');
    expect($<HTMLTextAreaElement>('textarea[aria-label="Question"]')!.value).toBe('What do I want the mornings to be?');
  });

  for (const l of LIGHTS) {
    it(`in ${l}: Resolve beside the title ${l === 'still' ? 'is gone' : 'shows'}`, async () => {
      document.documentElement.dataset.light = l;
      const q = await askQuestion('Who are my models?');
      await mount(`#/questions/${q.id}`);
      expect(getComputedStyle($('.fs-qtitle [role="checkbox"]')!).display === 'none').toBe(l === 'still');
    });
  }
});
