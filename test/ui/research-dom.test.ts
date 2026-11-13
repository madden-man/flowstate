// @vitest-environment jsdom
// Research's page (PLAN-RESEARCH.md section 2, Q4), on a recorded run (test/research/recorded.ts): no key, no network.
// The blank page and Ask; with no key, where the key goes and nothing sent; titles landing in found order, the check's
// neither lifted, a tick each and the soft bell at the end; the chips filtering by side; a paper's page word for word;
// both carries; Asked; ask again with the old lines struck; a lower source marked; a run cut by the connection picked
// up where it stopped; locked; offline; Still. No model text ever reaches the page.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { Router, Route } from 'preact-iso';

const feel = vi.hoisted(() => ({ ticks: [] as string[], bells: [] as string[] }));
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: (n: string) => { feel.ticks.push(n); } }));
vi.mock('../../src/ui/parts/Sound', async orig => ({
  ...(await orig<typeof import('../../src/ui/parts/Sound')>()),
  bell: (n: string) => { feel.bells.push(n); }, wakeBells: () => undefined,
}));

import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { loadSettings } from '../../src/ui/settings';
import { HashLocation } from '../../src/ui/route';
import { still } from '../../src/ui/light';
import { openSheet } from '../../src/ui/sheets';
import { choosePin, gate, relock } from '../../src/ui/lock/pin';
import { ResearchAsk, ResearchAsked, ResearchInquiry, ResearchPaper, PRINT } from '../../src/ui/flow/Research';
import { JournalToday } from '../../src/ui/journal/Journal';
import { Council } from '../../src/ui/council/Council';
import { getInquiry, listInquiries, saveResearchKey } from '../../src/research/store';
import { live, setRunDeps } from '../../src/research/run';
import { search } from '../../src/research/indexes';
import { messagesOf, today } from '../../src/model/pages';
import { councilPages } from '../../src/model/council';
import { indexFetch, loadRun, player, type Recorded } from '../research/recorded';
import type { MessagesPort } from '../../src/research/client';

let root: HTMLElement;
const wait = (ms = 0) => new Promise(r => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (!ok()) { if (Date.now() > end) throw new Error(`timed out at ${location.hash}`); await act(async () => { await wait(5); }); }
};
const settle = async () => { for (let i = 0; i < 20; i++) await act(async () => { await wait(2); }); };
const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];
const button = (text: string) => $$<HTMLButtonElement>('button').find(b => b.textContent === text);
const go = async (hash: string) => { location.hash = hash; await settle(); };

/** The real app's Research routes, and the journal and council they carry to. */
const R = Route as unknown as (p: { path?: string; default?: boolean; component: unknown }) => null;
const Hash = HashLocation as unknown as (p: object) => null;
const Routes = Router as unknown as (p: object) => null;
const routes = () => h(Hash, {}, h(Routes, {},
  h(R, { path: '/flow/research', component: ResearchAsk }),
  h(R, { path: '/flow/research/asked', component: ResearchAsked }),
  h(R, { path: '/flow/research/:id', component: ResearchInquiry }),
  h(R, { path: '/flow/research/:id/:paper', component: ResearchPaper }),
  h(R, { path: '/journal', component: JournalToday }),
  h(R, { path: '/council/:id', component: Council }),
  h(R, { default: true, component: () => null }),
));

/** The run's port and the indexes, from a recording; made counts how often a port was asked for (with a key). */
function useRecording(run: Recorded, opts: { failOn?: { key: 'for' | 'against' | 'check'; at: number } } = {}) {
  const p = player(run);
  const seen = { made: 0, calls: { for: 0, against: 0, check: 0 } as Record<string, number> };
  const port: MessagesPort = {
    async create(params) {
      await wait(1);
      const k = String(params.system).startsWith('You check') ? 'check' : String(params.system).includes('Your side is +') ? 'for' : 'against';
      seen.calls[k]++;
      if (opts.failOn && opts.failOn.key === k && seen.calls[k] === opts.failOn.at) {
        throw Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' });
      }
      return p.next(params) as never;
    },
  };
  setRunDeps({ makePort: () => { seen.made++; return port; }, search: (a, o) => search(a, { ...o, fetch: indexFetch(run) }) });
  return { seen, sent: p.sent };
}

const lineTitles = () => $$('.rs-line:not(.rs-lifting):not(.rs-hush) .rs-link').map(a => a.textContent);
const typeAsk = async (q: string) => {
  const area = $<HTMLTextAreaElement>('textarea.rs-q')!;
  await act(() => { area.value = q; area.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(() => { area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
};
const finished = () => { const st = $('[data-research="question"]')?.dataset.state; return !!st && st !== 'running'; };

beforeEach(async () => {
  // jsdom lays nothing out; the journal keeps its line in view this way
  Element.prototype.scrollIntoView ??= () => undefined;
  await freshDB();
  await ensureSeeded(7);
  await loadSettings();
  gate.value = null;
  live.value = {};
  feel.ticks = []; feel.bells = [];
  still.value = null;
  openSheet.value = null;
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  location.hash = '#/flow/research';
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(async () => { await act(() => { render(null, root); }); root.remove(); setRunDeps({}); still.value = null; });

const mount = async () => { await act(() => { render(routes(), root); }); await settle(); };

describe('Research: the blank page and Ask', () => {
  it('with no key, says where the key goes and sends nothing; Settings is the act under the thumb', async () => {
    const { seen } = useRecording(loadRun('writing'));
    await mount();
    expect($('textarea.rs-q')).not.toBeNull();
    expect($('[data-print="key"]')!.textContent).toBe(`${PRINT.key} Settings.`);
    expect(button('Ask')).toBeUndefined();
    await act(() => { $$<HTMLButtonElement>('.fs-new').find(b => b.textContent === 'Settings')!.click(); });
    expect(openSheet.value).toBe('settings');
    await typeAsk('Does expressive writing help mental health?');
    await settle();
    expect(await listInquiries()).toEqual([]);
    expect(seen.made).toBe(0);
    expect($('[data-print="leaves"]')).toBeNull();
  });

  it('with a key, prints that the question leaves the phone; offline, Ask sends nothing and says so', async () => {
    await saveResearchKey('sk-ant-test-0000');
    const { seen } = useRecording(loadRun('writing'));
    await mount();
    expect($('[data-print="leaves"]')!.textContent).toBe(PRINT.leaves);
    expect(button('Ask')!.disabled).toBe(true);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await typeAsk('Does expressive writing help mental health?');
    await settle();
    expect($('[data-print="offline"]')!.textContent).toBe(PRINT.offlineAsk);
    expect(await listInquiries()).toEqual([]);
    expect(seen.made).toBe(0);
  });
});

describe('Research: a run', () => {
  it('writes the titles in as they are filed, in found order; the check lifts neither; a tick each, the bell at the end', async () => {
    await saveResearchKey('sk-ant-test-0000');
    const run = loadRun('writing');
    const { sent } = useRecording(run);
    await mount();
    await typeAsk(run.question);
    await until(() => location.hash.startsWith('#/flow/research/') && !!$('p.rs-q'));
    expect($('.rs-q')!.textContent).toBe(run.question);
    await until(finished);
    await settle();
    const page = $('[data-research="question"]')!;
    expect(page.dataset.state).toBe('done');
    // + the meta-analysis, the review and the rumination study; − the offloading study; the drinking trial lifted
    const lines = $$('.rs-line:not(.rs-lifting)');
    expect(lines.map(l => [l.dataset.side, l.dataset.paperId])).toEqual(expect.arrayContaining([
      ['for', 'doi:10.1111/famp.70206'], ['for', 'doi:10.1177/13591053261499814'], ['for', 'doi:10.1037/1528-3542.8.2.302'],
      ['against', 'doi:10.1016/j.actpsy.2026.107843'],
    ]));
    expect(lines).toHaveLength(4);
    expect(root.querySelector('[data-paper-id="doi:10.1111/acer.70412"]')).toBeNull();
    // found order: the stored picks' seq, and the page draws them in it
    const q = (await listInquiries())[0];
    expect(q.state).toBe('done');
    expect(q.runs).toBeUndefined();
    const bySeq = [...q.picks].sort((a, b) => a.seq - b.seq).map(p => p.paperId);
    expect(lines.map(l => l.dataset.paperId)).toEqual(bySeq);
    // each title is a link out to the paper by DOI, underlined in its side's voice; the print is the paper's own
    const first = lines.find(l => l.dataset.paperId === 'doi:10.1111/famp.70206')!;
    expect(first.querySelector('a.rs-link')!.getAttribute('href')).toBe('https://doi.org/10.1111/famp.70206');
    expect(first.querySelector('a.rs-link')!.getAttribute('target')).toBe('_blank');
    expect(first.querySelector('.rs-sp')!.textContent).toBe('+ · Family process · 2026 · Meta-analysis');
    expect(first.style.getPropertyValue('--rs-side')).toBe('var(--v-blue)');
    const against = lines.find(l => l.dataset.side === 'against')!;
    expect(against.classList.contains('deep')).toBe(true);
    expect(against.style.getPropertyValue('--rs-side')).toBe('var(--d-blue)');
    expect(against.querySelector('.rs-abs')!.textContent).toBe('Abstract');
    // no model text, no count, no verdict
    expect(root.textContent).not.toMatch(/MODEL-|NEVER-SHOWN/);
    expect(root.querySelector('.fs-chat')!.textContent).not.toMatch(/\b\d+ (papers?|found|for|against)\b/i);
    // a tick as titles land (lines filed in one turn land together, one tick), the soft bell once at the end
    const ticks = feel.ticks.filter(t => t === 'check').length;
    expect(ticks).toBeGreaterThanOrEqual(1);
    expect(ticks).toBeLessThanOrEqual(5);
    expect(feel.ticks.every(t => t === 'check')).toBe(true);
    expect(feel.bells).toEqual(['found']);
    // the chips' dots are still once it ends, and nothing says Looking
    expect($$('.rs-side[data-looking]')).toHaveLength(0);
    expect($('[data-print="looking"]')).toBeNull();
    // the API heard only the question: no page, voice or flow of his
    expect(JSON.stringify(sent)).toContain(run.question);
  });

  it('while it runs: the dots breathe, Looking in the quiet italic, Stop ends it and keeps what was found', async () => {
    await saveResearchKey('sk-ant-test-0000');
    const run = loadRun('writing');
    useRecording(run);
    await mount();
    await typeAsk(run.question);
    await until(() => $$('.rs-side[data-looking]').length > 0);
    expect($('[data-print="looking"]')!.textContent).toBe('Looking');
    expect(button('Stop')).toBeDefined();
    await until(() => $$('.rs-line').length > 0);
    await act(() => { button('Stop')!.click(); });
    await until(finished);
    expect($('[data-research="question"]')!.dataset.state).toBe('stopped');
    expect($('[data-print="why"]')!.textContent).toBe(PRINT.why.ended);
    expect($$('.rs-line').length).toBeGreaterThan(0);
    expect((await listInquiries())[0].state).toBe('stopped');
    expect(feel.bells).toEqual([]);
  });

  it('after the run the chips filter by side; a second tap brings the other back', async () => {
    await saveResearchKey('sk-ant-test-0000');
    const run = loadRun('writing');
    useRecording(run);
    await mount();
    await typeAsk(run.question);
    await until(finished);
    await settle();
    expect(lineTitles()).toHaveLength(4);
    await act(() => { $('.rs-side[data-side="for"]')!.click(); });
    expect($('.rs-side[data-side="for"]')!.getAttribute('aria-pressed')).toBe('true');
    expect($$('.rs-line:not(.rs-hush)').map(l => l.dataset.side)).toEqual(['for', 'for', 'for']);
    await act(() => { $('.rs-side[data-side="against"]')!.click(); });
    expect($$('.rs-line:not(.rs-hush)').map(l => l.dataset.side)).toEqual(['against']);
    await act(() => { $('.rs-side[data-side="against"]')!.click(); });
    expect($$('.rs-line:not(.rs-hush)')).toHaveLength(4);
  });

  it('a side with nothing says so, and a lower source is marked by its kind', async () => {
    await saveResearchKey('sk-ant-test-0000');
    const run = loadRun('lower');
    useRecording(run);
    await mount();
    await typeAsk(run.question);
    await until(finished);
    await settle();
    expect($('[data-none="for"]')!.textContent).toBe('Nothing found for +.');
    const l = $('.rs-line')!;
    expect(l.dataset.side).toBe('against');
    expect(l.dataset.tier).toBe('2');
    expect(l.querySelector('.rs-sp')!.textContent).toBe('− · Research Square · 2026 · Preprint, not peer reviewed');
  });

  it('a run cut by the connection keeps what was found and goes on from its last finished turn', async () => {
    await saveResearchKey('sk-ant-test-0000');
    const run = loadRun('writing');
    const { seen } = useRecording(run, { failOn: { key: 'for', at: 3 } });
    await mount();
    await typeAsk(run.question);
    await until(() => !!$('[data-print="why"]'));
    expect($('[data-print="why"]')!.textContent).toBe(PRINT.why.offline);
    const stored = (await listInquiries())[0];
    expect(stored.state).toBe('running');
    expect(stored.why).toBe('offline');
    expect(stored.runs!.for.turns).toBe(2);
    const before = $$('.rs-line').length;
    expect(before).toBeGreaterThan(0);
    // Go on: the same recording, now answering; the for side picks up at its third turn
    // the same recording, answering from where each side stopped: the stored turns are skipped, nothing is sent again
    const p = player(run);
    for (let i = 0; i < stored.runs!.for.turns; i++) p.next({ system: 'Your side is +' });
    for (let i = 0; i < stored.runs!.against.turns; i++) p.next({ system: 'Your side is −' });
    const resumed: unknown[] = [];
    setRunDeps({
      makePort: () => ({ create: async params => { await wait(1); resumed.push(params); return p.next(params) as never; } }),
      search: (a, o) => search(a, { ...o, fetch: indexFetch(run) }),
    });
    await act(() => { button('Go on')!.click(); });
    await until(finished);
    await settle();
    expect($('[data-research="question"]')!.dataset.state).toBe('done');
    expect($$('.rs-line:not(.rs-lifting)').map(l => l.dataset.paperId).sort()).toEqual([
      'doi:10.1016/j.actpsy.2026.107843', 'doi:10.1037/1528-3542.8.2.302', 'doi:10.1111/famp.70206', 'doi:10.1177/13591053261499814',
    ]);
    expect(seen.made).toBe(1);
  });
});

describe('Research: a paper and the carries', () => {
  const asked = async () => {
    await saveResearchKey('sk-ant-test-0000');
    const run = loadRun('writing');
    useRecording(run);
    await mount();
    await typeAsk(run.question);
    await until(finished);
    await settle();
    return { run, id: (await listInquiries())[0].id };
  };

  it('Abstract opens the paper\'s page: the abstract word for word, its heads in print, the three words at its foot', async () => {
    const { id } = await asked();
    const line = $('.rs-line[data-paper-id="doi:10.1111/famp.70206"]')!;
    expect(line.querySelector<HTMLAnchorElement>('.rs-abs')!.getAttribute('href')).toBe(`#/flow/research/${id}/doi%3A10.1111%2Ffamp.70206`);
    await act(() => { line.querySelector<HTMLElement>('.rs-print.rs-abs')!.click(); });
    await until(() => !!$('[data-research="paper"]'));
    const paper = $('[data-research="paper"]')!;
    expect(paper.querySelector('.rs-q a')!.getAttribute('href')).toBe('https://doi.org/10.1111/famp.70206');
    expect(paper.querySelector('.rs-sp')!.textContent).toBe('+ · Family process · 2026 · Meta-analysis');
    const { getPapers } = await import('../../src/research/store');
    const [p] = await getPapers(['doi:10.1111/famp.70206']);
    expect($$('.rs-section p').map(e => e.textContent)).toEqual(p.abstract.map(s => s.text));
    expect($$('.rs-section .rs-print').map(e => e.textContent)).toEqual(p.abstract.filter(s => s.head).map(s => s.head));
    expect($$('.rs-words > *').map(e => e.textContent)).toEqual(['Open the paper', 'Write about it', 'To Council']);
    expect($<HTMLAnchorElement>('.rs-words a')!.href).toBe('https://doi.org/10.1111/famp.70206');
  });

  it('a tap on the line, not its title, opens the paper too', async () => {
    await asked();
    await act(() => { $('.rs-line[data-side="against"] .rs-sp')!.click(); });
    await until(() => !!$('[data-research="paper"]'));
    expect($('[data-research="paper"]')!.dataset.side).toBe('against');
  });

  it('Write about it: today\'s page, From and the question, the title in the side\'s voice', async () => {
    const { run, id } = await asked();
    await go(`#/flow/research/${id}/${encodeURIComponent('doi:10.1016/j.actpsy.2026.107843')}`);
    await until(() => !!button('Write about it'));
    await act(() => { button('Write about it')!.click(); });
    await until(() => location.hash === '#/journal');
    const t = await today();
    expect(t.page!.research).toEqual({ inquiryId: id });
    const ms = await messagesOf(t.page!.id);
    expect(ms.at(-1)!.paper).toEqual({ paperId: 'doi:10.1016/j.actpsy.2026.107843', side: 'against' });
    await until(() => !!$('.rs-carried') && !!$('.rs-from a'));
    expect($('.rs-from a')!.textContent).toBe(run.question);
    expect($('.rs-from a')!.getAttribute('href')).toBe(`#/flow/research/${id}`);
    const carried = $('.rs-carried')!;
    expect(carried.classList.contains('fs-v')).toBe(true);
    expect(carried.classList.contains('deep')).toBe(true);
    expect(carried.querySelector('a.rs-link')!.getAttribute('href')).toBe('https://doi.org/10.1016/j.actpsy.2026.107843');
  });

  it('To Council: a council about the question, the title its first line in the side\'s voice', async () => {
    const { run, id } = await asked();
    await go(`#/flow/research/${id}/${encodeURIComponent('doi:10.1111/famp.70206')}`);
    await until(() => !!button('To Council'));
    await act(() => { button('To Council')!.click(); });
    await until(() => location.hash.startsWith('#/council/'));
    const c = (await councilPages())[0];
    expect(c.page.title).toBe(run.question);
    expect(c.page.research).toEqual({ inquiryId: id });
    const ms = await messagesOf(c.page.id);
    expect(ms).toHaveLength(1);
    expect(ms[0].paper).toEqual({ paperId: 'doi:10.1111/famp.70206', side: 'for' });
    await until(() => !!$('.rs-carried'));
    expect($('.fs-from a')!.getAttribute('href')).toBe(`#/flow/research/${id}`);
  });
});

describe('Research: Asked, ask again, locked, Still', () => {
  it('Asked lists the questions, date over line, no count; ask again keeps the old lines struck until lifted', async () => {
    await saveResearchKey('sk-ant-test-0000');
    const run = loadRun('writing');
    useRecording(run);
    await mount();
    await typeAsk(run.question);
    await until(finished);
    const id = (await listInquiries())[0].id;
    await go('#/flow/research/asked');
    await until(() => !!$('.rs-asked .fs-list-row'));
    const row = $<HTMLAnchorElement>('.rs-asked .fs-list-row')!;
    expect(row.getAttribute('href')).toBe(`#/flow/research/${id}`);
    expect(row.querySelector('.fs-list-line')!.textContent).toBe(run.question);
    expect(row.querySelector('.fs-list-meta')!.textContent).toMatch(/^\d+ \/ \d+ \/ \d\d$/);
    await go(`#/flow/research/${id}`);
    await until(() => !!button('Ask again'));
    useRecording(loadRun('writing'));
    await act(() => { button('Ask again')!.click(); });
    await until(() => $$('.rs-earlier .fs-struck').length === 4);
    await until(finished);
    await settle();
    expect($$('.rs-line:not(.rs-lifting)').filter(l => !l.closest('.rs-earlier'))).toHaveLength(4);
    expect((await getInquiry(id))!.earlier).toHaveLength(1);
    await act(() => { button('Lift')!.click(); });
    await until(() => !$('.rs-earlier'));
    expect((await getInquiry(id))!.earlier).toBeUndefined();
  });

  it('Still: the question and the titles, no Ask again, no Stop, the dots still', async () => {
    await saveResearchKey('sk-ant-test-0000');
    const run = loadRun('writing');
    useRecording(run);
    await mount();
    await typeAsk(run.question);
    await until(finished);
    await settle();
    await act(() => { still.value = { since: Date.now() }; });
    await settle();
    expect($('.rs-q')!.textContent).toBe(run.question);
    expect(lineTitles()).toHaveLength(4);
    expect(button('Ask again')).toBeUndefined();
    expect(button('Stop')).toBeUndefined();
    expect($$('.rs-side[data-looking]')).toHaveLength(0);
  });

  it('locked: no question is read, nothing is sent', async () => {
    await saveResearchKey('sk-ant-test-0000');
    const run = loadRun('writing');
    const { seen } = useRecording(run);
    await mount();
    await typeAsk(run.question);
    await until(finished);
    const id = (await listInquiries())[0].id;
    await act(() => { render(null, root); });
    await choosePin('3569', 1000);
    relock();
    live.value = {};
    location.hash = '#/flow/research/asked';
    await mount();
    expect($$('.rs-asked .fs-list-row')).toHaveLength(0);
    expect(root.textContent).not.toContain(run.question);
    await go(`#/flow/research/${id}`);
    await settle();
    expect(root.textContent).not.toContain(run.question);
    expect(seen.made).toBe(1);
  });
});
