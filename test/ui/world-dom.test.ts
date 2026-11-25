// @vitest-environment jsdom
// The sections in a world (PLAN-WORLDS.md W4), as drawn: the council's reading offers In the story only once a year is
// known (an in-story council always has a year; review finding 5); the dial with a one-year span draws no NaN (finding
// 6); and a drag that loses the finger (pointercancel, lostpointercapture) ends cleanly, writing nothing.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { Reading } from '../../src/ui/council/Council';
import { Dial } from '../../src/ui/world/Dial';
import { spanOf } from '../../src/model/story';
import { settings } from '../../src/ui/settings';
import { wornWorld } from '../../src/ui/notebook';
import type { NovelPocket } from '../../src/bridge/protocol';
import type { Page } from '../../src/db/schema';
import { freshDB } from '../db/helpers';

let root: HTMLElement;
beforeEach(async () => { await freshDB(); root = document.createElement('div'); document.body.append(root); });
afterEach(() => { act(() => { render(null, root); }); root.remove(); wornWorld.value = null; });

const council = (o: Partial<Page> = {}): Page => ({ id: 'c1', kind: 'council', createdAt: 1, updatedAt: 1, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [], ...o });
const chips = (group: string) => [...root.querySelectorAll(`[aria-label="${group}"] button`)].map(b => b.textContent);

describe('the council\'s reading', () => {
  it('offers In the story only once a year is known; About and the whole book always', () => {
    settings.value = { ...settings.value, worlds: [{ id: 'eastwinds', name: 'East Winds', kind: 'novel' }], year: undefined };
    wornWorld.value = 'eastwinds';
    act(() => { render(h(Reading, { page: council(), onChange: () => undefined }), root); });
    expect(chips('This council is')).toEqual(['About the story']);
    expect(chips('Set in')).toEqual(['The whole book']);
    settings.value = { ...settings.value, year: 2071 };
    act(() => { render(h(Reading, { page: council(), onChange: () => undefined }), root); });
    expect(chips('This council is')).toEqual(['About the story', 'In the story']);
    expect(chips('Set in')).toEqual(['2071', 'The whole book']);
  });
});

const POCKET: NovelPocket = {
  kind: 'novel', places: [], chapters: [], events: [], questions: [],
  characters: [{ id: 'a', fullName: 'A', firstName: 'A', born: 2071, died: 2071 }],
  span: { from: 2071, to: 2071 },
};

describe('the dial', () => {
  it('a span of one year is widened, and no lifeline stands at NaN', () => {
    expect(spanOf(POCKET)).toEqual({ from: 2070, to: 2072 });
    act(() => { render(h(Dial, { pocket: POCKET, year: 2071, onYear: () => undefined }), root); });
    const styles = [...root.querySelectorAll<HTMLElement>('.wd-lives i, .wd-now')].map(e => e.getAttribute('style') ?? '');
    expect(styles.length).toBe(2);
    for (const s of styles) expect(s).not.toMatch(/NaN|Infinity/);
  });

  const fire = (el: Element, type: string, o: { x?: number; id?: number } = {}) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { pointerId: number; clientX: number };
    Object.assign(e, { pointerId: o.id ?? 1, clientX: o.x ?? 0 });
    el.dispatchEvent(e);
  };
  const pocket: NovelPocket = { ...POCKET, characters: [], span: { from: 2040, to: 2080 } };

  for (const end of ['pointercancel', 'lostpointercapture']) {
    it(`a drag ended by ${end} writes nothing and puts the year back`, () => {
      const onYear = vi.fn(), onMove = vi.fn();
      act(() => { render(h(Dial, { pocket, year: 2071, onYear, onMove }), root); });
      const track = root.querySelector<HTMLElement>('.wd-track')!;
      track.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 10, right: 400, bottom: 10, x: 0, y: 0, toJSON: () => ({}) });
      act(() => { fire(track, 'pointerdown', { x: 310 }); });
      act(() => { fire(track, 'pointermove', { x: 250 }); });
      expect(track.getAttribute('aria-valuenow')).toBe('2065');
      act(() => { fire(track, end); });
      expect(onYear).not.toHaveBeenCalled();
      expect(track.getAttribute('aria-valuenow')).toBe('2071');
      expect(onMove).toHaveBeenLastCalledWith(2071);
      // a move after the drag ended does nothing
      act(() => { fire(track, 'pointermove', { x: 100 }); });
      expect(track.getAttribute('aria-valuenow')).toBe('2071');
    });
  }

  it('a drag let go on another year writes it once', () => {
    const onYear = vi.fn();
    act(() => { render(h(Dial, { pocket, year: 2071, onYear }), root); });
    const track = root.querySelector<HTMLElement>('.wd-track')!;
    track.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 10, right: 400, bottom: 10, x: 0, y: 0, toJSON: () => ({}) });
    act(() => { fire(track, 'pointerdown', { x: 310 }); fire(track, 'pointermove', { x: 250 }); fire(track, 'pointerup'); fire(track, 'lostpointercapture'); });
    expect(onYear).toHaveBeenCalledTimes(1);
    expect(onYear).toHaveBeenCalledWith(2065);
  });
});
