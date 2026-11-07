// @vitest-environment jsdom
// Still (package 5): the twelve-minute rule, the kept-line rotation, and the lift at sunrise on the real timer.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ENOUGH_MS, TYPING_GAP_MS, freshSession, keystroke, pickKept, settle, rise, noteKeystroke, asking, current,
  answerEnough, resetStillSession, keptLine, loadKeptLine,
} from '../../src/ui/still';
import { still, light, now, startLight } from '../../src/ui/light';
import { settings } from '../../src/ui/settings';
import { defaultSettings } from '../../src/db/seed';

const SEC = 1000, MIN = 60 * SEC;

/** Types steadily: one key every `every` ms for `ms`, starting at t. Returns the time after the last key. */
function type(s: ReturnType<typeof freshSession>, t: number, ms: number, every = 400) {
  let x = s;
  for (let k = 0; k <= ms; k += every) x = keystroke(x, t + k);
  return { s: x, t: t + ms };
}

describe('Enough for now? after twelve minutes of typing', () => {
  it('asks once twelve minutes of keystrokes have gone by, not before', () => {
    let { s, t } = type(freshSession(0), 0, 11 * MIN);
    expect(s.asked).toBe(false);
    ({ s, t } = type(s, t + 400, 59 * SEC));
    expect(s.asked).toBe(false);
    ({ s } = type(s, t + 400, 2 * SEC));
    expect(s.typedMs).toBeGreaterThanOrEqual(ENOUGH_MS);
    expect(s.asked).toBe(true);
  });

  it('does not count idle time: an hour away adds only the short gap', () => {
    let { s, t } = type(freshSession(0), 0, 6 * MIN);
    const before = s.typedMs;
    s = keystroke(s, t + 60 * MIN);
    expect(s.typedMs - before).toBe(TYPING_GAP_MS);
    expect(s.asked).toBe(false);
    ({ s } = type(s, t + 60 * MIN, 5 * MIN));
    expect(s.asked).toBe(false);
  });

  it('asks once a session: answered, it never asks again; a new Still starts over', () => {
    settings.value = defaultSettings(0);
    still.value = null;
    resetStillSession();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 7, 23, 0));
    settle();
    expect(light.value).toBe('still');
    const t0 = Date.now();
    for (let k = 0; k <= 12 * MIN + 2 * SEC; k += 500) noteKeystroke(t0 + k);
    expect(asking.value).toBe(true);
    answerEnough();
    expect(asking.value).toBe(false);
    for (let k = 0; k <= 30 * MIN; k += 500) noteKeystroke(t0 + 13 * MIN + k);
    expect(asking.value).toBe(false);
    rise();
    expect(current.value).toBeNull();
    noteKeystroke();
    expect(current.value).toBeNull();
    vi.setSystemTime(new Date(2026, 10, 8, 23, 0));
    settle();
    expect(current.value?.asked).toBe(false);
    rise();
    vi.useRealTimers();
  });
});

describe('the kept line in Still', () => {
  const kept = [{ id: 'b', at: 20 }, { id: 'a', at: 10 }, { id: 'c', at: 30 }];
  it('is the oldest not yet shown, and rotates one per session', () => {
    let seen: string[] = [];
    const shown: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      const p = pickKept(kept, seen);
      shown.push(p.id);
      seen = p.seen;
    }
    expect(shown).toEqual(['a', 'b', 'c', 'a']);
  });
  it('forgets lines no longer kept, and shows nothing when nothing is kept', () => {
    expect(pickKept(kept, ['gone', 'a'])).toEqual({ id: 'b', seen: ['a', 'b'] });
    expect(pickKept([], ['a'])).toEqual({ seen: [] });
  });
  it('the oldest kept line first, and choosing it writes nothing to the data', async () => {
    const { init, store } = await import('../../src/db/fields');
    const { ensureSeeded, OLD_SEED_PAGES } = await import('../../src/db/seed');
    const { exportData } = await import('../../src/db/backup');
    await init();
    await ensureSeeded();
    // two kept lines: the old seed's manifesto page, now that the seed writes no pages (V5)
    await store.many({ pages: [OLD_SEED_PAGES[0].page], messages: OLD_SEED_PAGES[0].messages });
    localStorage.clear();
    resetStillSession();
    still.value = null;
    const before = JSON.stringify((await exportData(undefined, 0)).tables);
    settle();
    await loadKeptLine();
    expect(keptLine.value?.text).toBe('I determine my core.');
    rise();
    settle();
    await loadKeptLine();
    expect(keptLine.value?.text).toBe('I choose how to flow.');
    rise();
    expect(JSON.stringify((await exportData(undefined, 0)).tables)).toBe(before);
  });
});

describe('Still lifts at the next sunrise', () => {
  beforeEach(() => { settings.value = defaultSettings(0); still.value = null; });
  afterEach(() => vi.useRealTimers());
  it('on the sky timer, with nothing touched', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 10, 7, 23, 30));
    now.value = Date.now();
    document.head.innerHTML = '<meta name="theme-color" id="theme-color" content="">';
    const root = document.documentElement;
    const stop = startLight(root);
    settle();
    expect(root.dataset.light).toBe('still');
    vi.advanceTimersByTime(7 * 60 * MIN); // 06:30: still Still
    expect(root.dataset.light).toBe('still');
    vi.advanceTimersByTime(31 * MIN); // past 07:00, the fallback sunrise
    expect(still.value).toBeNull();
    expect(root.dataset.light).toBe('day');
    stop();
  });
});
