// @vitest-environment jsdom
// Out of the app (PLAN-TASKS.md T4): the links Send, Call, Reach and I will build (the exact URLs, the body encoded),
// the one person chosen once (the person sheet rises when there is none), done only on coming back to the sign (a faked
// visibilitychange), once, and Move playing the shelf's first album. None reaches through the door.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { LocationProvider } from 'preact-iso';

const music = vi.hoisted(() => ({ played: [] as unknown[], result: 'playing' as 'playing' | 'woke' }));
vi.mock('../../src/ui/music/state', async () => {
  const { signal } = await import('@preact/signals');
  const playing = signal<{ albumUri: string } | null>(null);
  const playNote = signal<string | null>(null);
  return {
    playing, playNote,
    play: async (playlist: unknown, row: { albumUri: string }) => {
      music.played.push({ playlist, row });
      if (music.result === 'playing') playing.value = { albumUri: row.albumUri };
      else playNote.value = 'Opening Spotify: come back and it plays';
    },
  };
});

import { playing } from '../../src/ui/music/state';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store } from '../../src/db/fields';
import { Touches } from '../../src/ui/flow/chakra/Touches';
import { onTouch, onTouchDone, handlerFor } from '../../src/ui/flow/chakra/touch';
import { touchOf, TOUCHES, STARTERS } from '../../src/model/acts';
import { CHAKRA_IDS } from '../../src/model/mountain';
import { albumUriOf } from '../../src/db/seed/picks';
import {
  calshowHref, CALENDAR_HREF, telHref, smsHref, nextAt, reachHref, chosenPerson, choosePerson, doneOnReturn,
} from '../../src/ui/flow/chakra/handlers/out-links';

const flush = async (n = 8) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };

/** The page going and coming back, as Messages in front then FlowState again. */
let vis: DocumentVisibilityState = 'visible';
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vis });
const away = () => { vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); };
const back = () => { vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); };

describe('the links', () => {
  it('Messages: sms:<digits>?&body=<encoded>, spaces, &, ? and line breaks encoded', () => {
    expect(smsHref('555 010-4471', 'I miss you & the lake?\nSoon'))
      .toBe('sms:5550104471?&body=I%20miss%20you%20%26%20the%20lake%3F%0ASoon');
    expect(smsHref(undefined, 'hi')).toBe('sms:?&body=hi');
  });
  it('the phone: tel:<digits and +>, none with no number', () => {
    expect(telHref('+1 (555) 010-4471')).toBe('tel:+15550104471');
    expect(telHref('')).toBeUndefined();
    expect(telHref(undefined)).toBeUndefined();
  });
  it('Calendar: calshow: on today, or calshow:<seconds since 2001-01-01 UTC> on a time', () => {
    expect(CALENDAR_HREF).toBe('calshow:');
    expect(calshowHref()).toBe('calshow:');
    expect(calshowHref(Date.UTC(2001, 0, 1))).toBe('calshow:0');
    expect(calshowHref(Date.UTC(2026, 10, 11, 18, 30))).toBe(`calshow:${(Date.UTC(2026, 10, 11, 18, 30) - Date.UTC(2001, 0, 1)) / 1000}`);
  });
  it('a time is the next time the clock reads it: today, or tomorrow once gone', () => {
    const now = new Date(2026, 10, 11, 12, 0).getTime();
    expect(nextAt('18:30', now)).toBe(new Date(2026, 10, 11, 18, 30).getTime());
    expect(nextAt('09:05', now)).toBe(new Date(2026, 10, 12, 9, 5).getTime());
    expect(nextAt('', now)).toBeUndefined();
    expect(nextAt('25:00', now)).toBeUndefined();
  });
});

describe('done on coming back', () => {
  beforeEach(() => { vis = 'visible'; location.hash = '#/flow/c/throat'; });
  it('waits for the page to go, then runs once when it comes back on the sign', () => {
    const done = vi.fn();
    const off = doneOnReturn('throat', done);
    back();
    expect(done).not.toHaveBeenCalled(); // never left
    away();
    expect(done).not.toHaveBeenCalled(); // going is not done
    back();
    expect(done).toHaveBeenCalledTimes(1);
    away(); back();
    expect(done).toHaveBeenCalledTimes(1);
    off();
  });
  it('coming back on another screen is not done, and undone it never runs', () => {
    const done = vi.fn();
    doneOnReturn('throat', done);
    away(); location.hash = '#/journal'; back();
    expect(done).not.toHaveBeenCalled();
    location.hash = '#/flow/c/throat';
    const undo = doneOnReturn('throat', done);
    away(); undo(); back();
    expect(done).not.toHaveBeenCalled();
  });
});

describe('the one person', () => {
  beforeEach(async () => { await freshDB(); await ensureSeeded(); });
  it('none until chosen; chosen once, it is kept on the flows\' own person tip', async () => {
    expect(await chosenPerson()).toBeUndefined();
    expect(await choosePerson({ name: '  ', text: '' })).toBeUndefined();
    await choosePerson({ name: ' Ali ', tel: '555 010 4471', text: 'Hard hour. Ten minutes?' });
    expect(await chosenPerson()).toEqual({ name: 'Ali', tel: '555 010 4471', text: 'Hard hour. Ten minutes?' });
    const panic = await store.get('flows', 'panic');
    expect(JSON.stringify(panic)).toContain('Ali');
    // chosen again, the same slot changes, not a second one
    await choosePerson({ name: 'Sam', text: 'Call me?' });
    expect((await chosenPerson())!.name).toBe('Sam');
    expect(reachHref((await chosenPerson())!)).toBe('sms:?&body=Call%20me%3F');
  });
});

describe('the touches on the plate', () => {
  let root: HTMLElement | undefined;
  const got: string[] = [];
  let offDone: () => void = () => {};
  beforeEach(async () => {
    await freshDB(); await ensureSeeded();
    vis = 'visible'; got.length = 0; music.played.length = 0; music.result = 'playing'; playing.value = null;
    offDone = onTouchDone(d => got.push(`${d.chakra}/${d.touch}`));
    // a tap on a link is not followed here (jsdom navigates nowhere)
    document.addEventListener('click', stop, true);
  });
  const stop = (e: Event) => { if ((e.target as Element).closest?.('a')) e.preventDefault(); };
  afterEach(() => {
    offDone(); document.removeEventListener('click', stop, true);
    if (root) { render(null, root); root.remove(); root = undefined; }
  });
  const draw = async (chakra: Parameters<typeof Touches>[0]['chakra']) => {
    location.hash = `#/flow/c/${chakra}`;
    root = document.createElement('div');
    root.className = 'fs-page';
    document.body.append(root);
    act(() => { render(h(LocationProvider, null, h(Touches, { chakra })), root!); });
    await flush();
  };
  const word = (id: string) => root!.querySelector<HTMLButtonElement>(`.ck-touch[data-touch="${id}"]`)!;
  const type = (el: HTMLInputElement, v: string) => act(() => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); });

  it('Send with no person: the person sheet rises; then his sentence is the body, and done comes on the way back', async () => {
    await draw('throat');
    act(() => word('send').click());
    await flush();
    const sheet = root!.querySelector('[data-sheet="One person"]')!;
    expect(sheet).not.toBeNull();
    expect(document.querySelector('dialog, [role="dialog"]')).toBeNull();
    type(sheet.querySelector<HTMLInputElement>('input[aria-label="Who"]')!, 'Ali');
    type(sheet.querySelector<HTMLInputElement>('input[aria-label="Their number"]')!, '555 010 4471');
    act(() => [...sheet.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Done')!.click());
    await flush();
    const stage = root!.querySelector('.ck-stage [data-out="send"]')!;
    expect(stage.querySelector('a')).toBeNull(); // nothing to send until he writes
    type(stage.querySelector<HTMLInputElement>('input.out-rule')!, 'I miss you & the lake?');
    const go = stage.querySelector<HTMLAnchorElement>('a.out-go')!;
    expect(go.textContent).toBe('Ali');
    expect(go.getAttribute('href')).toBe('sms:5550104471?&body=I%20miss%20you%20%26%20the%20lake%3F');
    act(() => go.click());
    expect(got).toEqual([]);
    away();
    expect(got).toEqual([]);
    act(() => back());
    expect(got).toEqual(['throat/send']);
    expect(word('send').getAttribute('aria-pressed')).toBe('false'); // back at rest
    away(); back();
    expect(got).toEqual(['throat/send']);
  });

  it('Call goes to the number; Reach on the Heart and the Root to the person, his calm words in the body', async () => {
    await choosePerson({ name: 'Ali', tel: '555 010 4471', text: 'Hard hour.' });
    await draw('throat');
    act(() => word('call').click());
    await flush();
    expect(root!.querySelector('[data-sheet]')).toBeNull();
    expect(root!.querySelector('[data-out="call"] a')!.getAttribute('href')).toBe('tel:5550104471');
    render(null, root!); root!.remove();
    for (const c of ['heart', 'root'] as const) {
      await draw(c);
      act(() => word('reach').click());
      await flush();
      const go = root!.querySelector<HTMLAnchorElement>('[data-out="reach"] a')!;
      expect(go.getAttribute('href'), c).toBe('sms:5550104471?&body=Hard%20hour.');
      act(() => go.click()); away(); act(() => back());
      render(null, root!); root!.remove();
    }
    expect(got).toEqual(['heart/reach', 'root/reach']);
    root = undefined;
  });

  it('Call with a person but no number: the sheet rises on them', async () => {
    await choosePerson({ name: 'Ali', text: 'Hard hour.' });
    await draw('throat');
    act(() => word('call').click());
    await flush();
    expect(root!.querySelector<HTMLInputElement>('[data-sheet="One person"] input[aria-label="Who"]')!.value).toBe('Ali');
    expect(root!.querySelector('[data-out="call"] a')).toBeNull();
  });

  it('I will: one thing and a time, then Calendar on that time; leaving the page before going is not done', async () => {
    await draw('solar-plexus');
    act(() => word('i-will').click());
    await flush();
    const stage = root!.querySelector('[data-out="i-will"]')!;
    type(stage.querySelector<HTMLInputElement>('input.out-rule')!, 'Walk to the lake');
    expect(stage.querySelector('a')).toBeNull();
    type(stage.querySelector<HTMLInputElement>('input.out-time')!, '18:30');
    const go = stage.querySelector<HTMLAnchorElement>('a.out-go')!;
    expect(go.textContent).toBe('Calendar');
    expect(go.getAttribute('href')).toBe(calshowHref(nextAt('18:30')));
    away(); back();
    expect(got).toEqual([]);
    act(() => go.click()); away(); act(() => back());
    expect(got).toEqual(['solar-plexus/i-will']);
  });

  it('Move plays the shelf\'s first album as itself, done when it plays from here', async () => {
    await draw('sacral');
    act(() => word('move').click());
    await flush();
    const first = STARTERS.sacral[0];
    expect(music.played).toEqual([{ playlist: { id: '', uri: albumUriOf(first) }, row: expect.objectContaining({ albumUri: albumUriOf(first), album: first.title }) }]);
    expect(got).toEqual(['sacral/move']);
  });

  it('Move that had to open Spotify is done on coming back', async () => {
    music.result = 'woke';
    await draw('sacral');
    act(() => word('move').click());
    await flush();
    expect(got).toEqual([]);
    expect(root!.querySelector('[data-out="move"] .out-note')!.textContent).toMatch(/Opening Spotify/);
    away(); back();
    expect(got).toEqual(['sacral/move']);
  });

  it('through the door none of them is printed or reached', async () => {
    const outs = CHAKRA_IDS.flatMap(c => TOUCHES[c].filter(t => t.kind === 'out').map(t => [c, t] as const));
    expect(outs.map(([c, t]) => `${c}/${t.id}`)).toEqual(['throat/send', 'throat/call', 'heart/reach', 'solar-plexus/i-will', 'sacral/move', 'root/reach']);
    for (const [c, t] of outs) {
      expect(t.door, `${c}/${t.id}`).toBe(false);
      expect(handlerFor(c, t), `${c}/${t.id}`).toBeDefined();
      expect(onTouch(c, t, { door: true, still: false, route: () => {}, close: () => {} })).toBeUndefined();
    }
    await flush();
    expect(music.played).toEqual([]);
    expect(touchOf('sacral', 'move')!.door).toBe(false);
  });
});
