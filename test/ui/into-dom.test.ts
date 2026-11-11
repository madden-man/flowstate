// @vitest-environment jsdom
// Into the app (PLAN-TASKS.md T3): each touch's handler, registered by sign and id; what it carries and where it lands;
// the sign travelling with him (printed beside the date where he lands); done called when he comes back to the sign,
// not when he goes (section 5); and none of them reachable through the door.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { freshDB } from '../db/helpers';
import { handlerFor, onTouch, type TouchAct } from '../../src/ui/flow/chakra/touch';
import { INTO } from '../../src/ui/flow/chakra/handlers/into';
import { arrived, isUnder, leaveFor, pageCarry, signAt, travel } from '../../src/ui/flow/chakra/carry';
import { SignBack } from '../../src/ui/flow/chakra/SignBack';
import { touchOf } from '../../src/model/acts';
import type { ChakraId } from '../../src/model/mountain';
import { messagesOf, questions, today } from '../../src/model/pages';
import { councilPages } from '../../src/model/council';
import { sitFrom } from '../../src/ui/flow/Meditate';

let root: HTMLElement | undefined;
beforeEach(async () => { await freshDB(); travel.value = null; pageCarry.value = null; location.hash = ''; });
afterEach(() => { if (root) { render(null, root); root.remove(); root = undefined; } document.body.innerHTML = ''; });

const wait = (ms = 0) => new Promise(r => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!ok()) { if (Date.now() > end) throw new Error('timed out'); await act(async () => { await wait(10); }); }
};

/** A touch as Touches gives it, with route and done recorded. */
function touchAct(chakra: ChakraId, id: string, o: Partial<TouchAct> = {}) {
  const seen = { routes: [] as string[], done: 0, closed: 0 };
  const touch = touchOf(chakra, id)!;
  const a: TouchAct = {
    chakra, touch, door: false, still: false,
    route: to => { seen.routes.push(to); }, done: () => { seen.done++; }, close: () => { seen.closed++; }, ...o,
  };
  return { a, seen };
}

/** Draws a handler's View the way Touches does, inside .ck-stage. */
function drawView(a: TouchAct) {
  const View = handlerFor(a.chakra, a.touch)!.View!;
  root = document.createElement('div');
  document.body.append(root);
  act(() => { render(h('div', { class: 'ck-stage' }, h(View, a)), root!); });
  return root;
}

/** Types a line on the plate's rule and carries it with Return. */
async function carry(el: HTMLElement, text: string) {
  const input = el.querySelector<HTMLInputElement>('.ck-into-rule input')!;
  await act(() => { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
}

describe('the into touches', () => {
  it('each is registered on its sign, for its own id, and none of them shows through the door', () => {
    expect(INTO.map(x => `${x.chakra}/${x.id}`)).toEqual([
      'crown/core', 'crown/kept-line', 'crown/sit', 'third-eye/ask', 'third-eye/bring-it', 'third-eye/questions',
      'throat/a-voice', 'heart/letter', 'solar-plexus/stand-on', 'solar-plexus/spark-it', 'sacral/write-from-it',
    ]);
    for (const { chakra, id, handler } of INTO) {
      const t = touchOf(chakra, id)!;
      expect(t, `${chakra} ${id}`).toBeDefined();
      expect(t.door, `${chakra} ${id}`).toBe(false);
      expect(t.lands, `${chakra} ${id}`).not.toBe('place');
      expect(handlerFor(chakra, t)).toBe(handler);
    }
  });

  it('through the door a tap reaches none of them: nothing routes, nothing is carried', async () => {
    for (const { chakra, id } of INTO) {
      const { a, seen } = touchAct(chakra, id, { door: true });
      expect(onTouch(chakra, a.touch, a)).toBeUndefined();
      expect(seen.routes, `${chakra} ${id}`).toEqual([]);
    }
    await wait(20);
    expect(travel.value).toBeNull();
  });

  it('Core, Questions, Sit and Spark it go to Be, the ?, Meditate and Energize, carrying the sign and nothing else', () => {
    sitFrom.value = { episodeId: 'e1', tipId: 't1' };
    const cases: [ChakraId, string, string][] = [
      ['crown', 'core', '/be'], ['third-eye', 'questions', '/questions'], ['crown', 'sit', '/flow/meditate'],
      ['solar-plexus', 'spark-it', '/flow/energize'],
    ];
    for (const [c, id, to] of cases) {
      const { a, seen } = touchAct(c, id);
      onTouch(c, a.touch, a);
      expect(seen.routes, id).toEqual([to]);
      expect(seen.done, id).toBe(0);
      expect(travel.value).toMatchObject({ chakra: c, touch: id, under: to });
    }
    // Sit from a sign carries no episode
    expect(sitFrom.value).toBeNull();
  });

  it('Ask: his line on the rule, then today\'s page with it asked and the answer rule to open in italic', async () => {
    const { a, seen } = touchAct('third-eye', 'ask');
    const el = drawView(a);
    const input = el.querySelector<HTMLInputElement>('.ck-into-rule input')!;
    expect(document.activeElement).toBe(input);
    // nothing written: no arrow, and Return carries nothing
    expect(el.querySelector('.ck-into-go')).toBeNull();
    await act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await wait(20);
    expect(seen.routes).toEqual([]);
    await carry(el, 'What am I not seeing?');
    await until(() => seen.routes.length > 0);
    expect(seen.routes).toEqual(['/journal']);
    expect(pageCarry.value).toEqual({ wise: true });
    const t = await today();
    expect(t.page!.sign).toEqual({ chakra: 'third-eye' });
    expect((await messagesOf(t.page!.id)).map(m => m.text)).toEqual(['What am I not seeing?']);
    expect((await questions()).map(q => q.title)).toEqual(['What am I not seeing?']);
    expect(seen.done).toBe(0);
  });

  it('Bring it: his line becomes the first line of a new council, and it lands there', async () => {
    const { a, seen } = touchAct('third-eye', 'bring-it');
    const el = drawView(a);
    await carry(el, 'Should I take the job?');
    await until(() => seen.routes.length > 0);
    const [row] = await councilPages();
    expect(row.firstLine).toBe('Should I take the job?');
    expect(seen.routes).toEqual([`/council/${row.page.id}`]);
    expect(travel.value?.under).toBe('/council');
  });

  it('Write from it: his word on today\'s page, the next rule left as it is', async () => {
    pageCarry.value = { wise: true };
    const { a, seen } = touchAct('sacral', 'write-from-it');
    const el = drawView(a);
    await carry(el, 'restless');
    await until(() => seen.routes.length > 0);
    expect(seen.routes).toEqual(['/journal']);
    expect(pageCarry.value).toBeNull();
    const t = await today();
    expect((await messagesOf(t.page!.id)).map(m => m.text)).toEqual(['restless']);
  });

  it('Letter: today\'s page linked to Heart, opening on "Dear", nothing written', async () => {
    const { a, seen } = touchAct('heart', 'letter');
    onTouch('heart', a.touch, a);
    await until(() => seen.routes.length > 0);
    expect(seen.routes).toEqual(['/journal']);
    expect(pageCarry.value).toEqual({ tail: 'Dear ' });
    expect((await today()).page!.sign).toEqual({ chakra: 'heart' });
  });

  it('A voice: a council with nothing said, the chips ready', async () => {
    const { a, seen } = touchAct('throat', 'a-voice');
    onTouch('throat', a.touch, a);
    await until(() => seen.routes.length > 0);
    const [row] = await councilPages();
    expect(row.firstLine).toBe('');
    expect(seen.routes).toEqual([`/council/${row.page.id}`]);
  });

  it('Stand on: with values held, their words on the plate; a tap opens that one on Be. In Still, Be itself', async () => {
    const { createValue, held } = await import('../../src/model/values');
    const v1 = await createValue({ word: 'honest' });
    const v2 = await createValue({ word: 'brave' });
    const { a, seen } = touchAct('solar-plexus', 'stand-on');
    const el = drawView(a);
    await until(() => el.querySelectorAll('.ck-value').length === 2);
    // in his order, as Be lists them
    expect([...el.querySelectorAll('.ck-value')].map(b => b.textContent)).toEqual((await held()).map(v => v.word));
    act(() => (el.querySelector(`[data-value="${v2.id}"]`) as HTMLElement).click());
    expect(seen.routes).toEqual([`/be/${v2.id}`]);
    expect(travel.value?.under).toBe('/be');
    render(null, root!); root!.remove(); root = undefined;

    const still = touchAct('solar-plexus', 'stand-on', { still: true });
    drawView(still.a);
    await until(() => still.seen.routes.length > 0);
    expect(still.seen.routes).toEqual(['/be']);
    expect(v1.id).toBeDefined();
  });

  it('Kept line: no star with nothing kept; else the day\'s star with his kept line, and a tap opens its page', async () => {
    const { a, seen } = touchAct('crown', 'kept-line');
    let el = drawView(a);
    await wait(50);
    expect(el.querySelector('.ck-star')).toBeNull();
    render(null, root!); root!.remove(); root = undefined;

    const { writeLine, setKept } = await import('../../src/model/pages');
    const r = await writeLine(undefined, undefined, { text: 'The quiet voices know the way.' });
    await setKept(r!.message!, true);
    el = drawView(a);
    await until(() => !!el.querySelector('.ck-star'));
    expect(el.querySelector('.ck-star-line')!.textContent).toBe('The quiet voices know the way.');
    act(() => (el.querySelector('.ck-star') as HTMLElement).click());
    expect(seen.routes).toEqual([`/journal/${r!.page.id}`]);
    expect(travel.value?.under).toBe('/journal');
  });
});

describe('the sign travels with him', () => {
  it('is printed only under the place it landed', () => {
    expect(isUnder('/council/abc', '/council')).toBe(true);
    expect(isUnder('/councils', '/council')).toBe(false);
    const { a } = touchAct('third-eye', 'bring-it');
    leaveFor(a, '/council/abc', '/council');
    expect(signAt('/council/abc')).toBe('third-eye');
    expect(signAt('/council')).toBe('third-eye');
    expect(signAt('/journal')).toBeUndefined();
  });

  it('done is called once he is back on the sign, once its page is drawn, not as he goes', async () => {
    const { a, seen } = touchAct('third-eye', 'ask');
    leaveFor(a, '/journal');
    expect(seen.done).toBe(0);
    arrived('/journal');
    arrived('/journal/pages');
    expect(seen.done).toBe(0);
    arrived('/flow/c/third-eye');
    expect(travel.value).toBeNull();
    await wait(30);
    expect(seen.done).toBe(0);
    const page = document.createElement('div');
    page.className = 'ck-page';
    page.dataset.chakra = 'third-eye';
    page.innerHTML = '<div class="ck-touches"></div>';
    document.body.append(page);
    await until(() => seen.done === 1);
    arrived('/flow/c/third-eye');
    await wait(30);
    expect(seen.done).toBe(1);
  });

  it('arriving anywhere else on the Flow tab lets the touch go without done; another tab keeps it', async () => {
    const { a, seen } = touchAct('crown', 'core');
    leaveFor(a, '/be');
    arrived('/journal');
    expect(travel.value).not.toBeNull();
    arrived('/flow');
    expect(travel.value).toBeNull();
    arrived('/flow/c/crown');
    await wait(50);
    expect(seen.done).toBe(0);
  });

  it('the header prints the carried sign, or the page\'s own, and a tap goes back to the sign', () => {
    const { a } = touchAct('crown', 'core');
    location.hash = '#/be';
    leaveFor(a, '/be');
    root = document.createElement('div');
    document.body.append(root);
    act(() => { render(h(SignBack, { sign: undefined }), root!); });
    const b = root.querySelector<HTMLButtonElement>('[data-sign-back]')!;
    expect(b.dataset.signBack).toBe('crown');
    expect(b.getAttribute('aria-label')).toBe('Back to Crown');
    expect(b.querySelector('svg.ck-signmark path')).not.toBeNull();
    act(() => b.click());
    expect(location.hash).toBe('#/flow/c/crown');
    act(() => { travel.value = null; });
    expect(root.querySelector('[data-sign-back]')).toBeNull();
    act(() => { render(h(SignBack, { sign: 'heart' }), root!); });
    expect(root.querySelector<HTMLElement>('[data-sign-back]')!.dataset.signBack).toBe('heart');
    act(() => { render(h(SignBack, { sign: 'spleen' }), root!); });
    expect(root.querySelector('[data-sign-back]')).toBeNull();
  });
});
