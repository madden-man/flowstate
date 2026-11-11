// @vitest-environment jsdom
// The place is the page (PLAN-TASKS.md T1): the touch words on a sign's plate, the one dispatcher they go through, and
// the 988 line on Heart and Root. Each word is a button named by its words; the lead one lit at rest; a tap marks it
// active and runs the handler registered for it (most specific key first); through the door only door touches show.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { LocationProvider } from 'preact-iso';
import { Touches } from '../../src/ui/flow/chakra/Touches';
// the dispatcher's own tests: with no package's handlers loaded (T2 to T4 register theirs from ./handlers, tested apart)
vi.mock('../../src/ui/flow/chakra/handlers', () => ({}));
import { handlerFor, onTouch, onTouchDone, registerTouch, touchDone, type TouchAct } from '../../src/ui/flow/chakra/touch';
import { WORDS } from '../../src/ui/flow/chakra/words';
import { CHAKRA_IDS } from '../../src/model/mountain';
import { touchesOf, touchOf } from '../../src/model/acts';
import { LINE_988, safetyFoot } from '../../src/model/chakra-page';

let root: HTMLElement | undefined;
const undo: (() => void)[] = [];
afterEach(() => {
  if (root) { render(null, root); root.remove(); root = undefined; }
  while (undo.length) undo.pop()!();
});
const draw = (props: Parameters<typeof Touches>[0]) => {
  root = document.createElement('div');
  document.body.append(root);
  act(() => { render(h(LocationProvider, null, h(Touches, props)), root!); });
  return [...root.querySelectorAll<HTMLButtonElement>('button.ck-touch')];
};

describe('the touch words', () => {
  it('every sign prints each of its touches once, placed on its plate, the lead one lit and none pressed', () => {
    for (const c of CHAKRA_IDS) {
      const words = draw({ chakra: c });
      expect(words.map(b => b.dataset.touch), c).toEqual(touchesOf(c).map(t => t.id));
      for (const t of touchesOf(c)) expect(WORDS[c][t.id], `${c} ${t.id}`).toBeDefined();
      expect(words.filter(b => b.hasAttribute('data-lit')).map(b => b.dataset.touch), c).toEqual([touchesOf(c).find(t => t.lead)!.id]);
      expect(words.every(b => b.getAttribute('aria-pressed') === 'false' && b.type === 'button'), c).toBe(true);
      render(null, root!); root!.remove(); root = undefined;
    }
  });

  it('a word is named by its words, and where it lands after the dot', () => {
    const words = draw({ chakra: 'crown' });
    const core = words.find(b => b.dataset.touch === 'core')!;
    expect(core.textContent).toBe('Core · Be');
    expect(core.getAttribute('aria-label')).toBe('Core, Be');
    const letGo = words.find(b => b.dataset.touch === 'let-go')!;
    expect(letGo.textContent).toBe('Let go');
    expect(letGo.hasAttribute('aria-label')).toBe(false);
  });

  it('a tap marks the word active and lit, a second tap puts it back at rest', () => {
    const words = draw({ chakra: 'heart' });
    const reach = words.find(b => b.dataset.touch === 'reach')!;
    act(() => reach.click());
    expect(reach.getAttribute('aria-pressed')).toBe('true');
    expect(root!.querySelectorAll('[data-lit]').length).toBe(1);
    expect(reach.hasAttribute('data-lit')).toBe(true);
    act(() => reach.click());
    expect(reach.getAttribute('aria-pressed')).toBe('false');
    expect(root!.querySelector('[data-lit]')!.getAttribute('data-touch')).toBe('grieve');
  });

  it('through the door only the touches that write nothing show, and a sign with none shows no word', () => {
    expect(draw({ chakra: 'root', door: true }).map(b => b.dataset.touch)).toEqual(['five', 'breathe']);
    render(null, root!); root!.remove();
    expect(draw({ chakra: 'heart', door: true }).map(b => b.dataset.touch)).toEqual(['hold']);
    render(null, root!); root!.remove();
    expect(draw({ chakra: 'throat', door: true })).toEqual([]);
  });

  it('a handler registered for a word runs on its tap, draws its View while active, and its cleanup runs on the next tap', () => {
    const seen: string[] = [];
    undo.push(registerTouch({ id: 'grieve' }, {
      act: a => { seen.push(`act ${a.chakra} ${a.touch.id} door=${a.door}`); return () => seen.push('cleanup'); },
      View: (a: TouchAct) => h('i', { class: 'probe' }, a.touch.word),
    }));
    const words = draw({ chakra: 'heart' });
    act(() => words.find(b => b.dataset.touch === 'grieve')!.click());
    expect(seen).toEqual(['act heart grieve door=false']);
    expect(root!.querySelector('.ck-stage .probe')!.textContent).toBe('Grieve');
    act(() => words.find(b => b.dataset.touch === 'hold')!.click());
    expect(seen).toEqual(['act heart grieve door=false', 'cleanup']);
    expect(root!.querySelector('.ck-stage')).toBeNull();
  });
});

describe('the dispatcher', () => {
  const ctx = { door: false, still: false, route: () => {}, close: () => {} };
  it('picks the most specific handler: sign and id, then id, then lands, then kind', () => {
    const grieve = touchOf('heart', 'grieve')!;
    const kind = { act: () => {} }, lands = { act: () => {} }, id = { act: () => {} }, both = { act: () => {} };
    expect(handlerFor('heart', grieve)).toBeUndefined();
    undo.push(registerTouch({ kind: 'place' }, kind));
    expect(handlerFor('heart', grieve)).toBe(kind);
    undo.push(registerTouch({ lands: 'place' }, lands));
    expect(handlerFor('heart', grieve)).toBe(lands);
    undo.push(registerTouch({ id: 'grieve' }, id));
    expect(handlerFor('heart', grieve)).toBe(id);
    undo.push(registerTouch({ chakra: 'heart', id: 'grieve' }, both));
    expect(handlerFor('heart', grieve)).toBe(both);
    // another sign's hold is not heart's grieve
    expect(handlerFor('sacral', touchOf('sacral', 'hold')!)).toBe(lands);
  });

  it('done says which touch on which sign, for the surge; the door lets no other touch through', () => {
    const got: string[] = [];
    undo.push(onTouchDone(d => got.push(`${d.chakra}/${d.touch}`)));
    undo.push(registerTouch({ lands: 'messages' }, { act: a => a.done() }));
    onTouch('root', touchOf('root', 'reach')!, ctx);
    expect(got).toEqual(['root/reach']);
    expect(touchDone.value?.touch).toBe('reach');
    onTouch('root', touchOf('root', 'reach')!, { ...ctx, door: true });
    expect(got).toEqual(['root/reach']);
  });
});

describe('the 988 line', () => {
  const line988 = { id: 'x-988', text: "If you're thinking about suicide, call or text 988. Someone answers, any hour.", print: true };
  const doctor = { id: 'x-doc', text: 'If it goes on, talk to your doctor.', print: true };
  it('Heart and Root print it once with Call and Text; no other sign does', () => {
    expect(LINE_988).toMatch(/988/);
    expect(safetyFoot('heart', [line988, doctor], false)).toEqual({ line: LINE_988, links: true, lines: [doctor] });
    expect(safetyFoot('root', [doctor], false)).toEqual({ line: LINE_988, links: true, lines: [doctor] });
    expect(safetyFoot('crown', [doctor], false)).toEqual({ links: false, lines: [doctor] });
  });
  it('a step that prints its own 988 line keeps it, and the page adds only Call and Text', () => {
    expect(safetyFoot('heart', [line988], true)).toEqual({ links: true, lines: [line988] });
    expect(safetyFoot('heart', [doctor], true)).toEqual({ line: LINE_988, links: true, lines: [doctor] });
  });
});
