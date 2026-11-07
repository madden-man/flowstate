// @vitest-environment jsdom
// The update check (package 8, 2026-11-08): the browser looks for a new service worker only at launch, so
// the app looks again whenever it comes to the front, when the connection returns, and on a timer.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { watchForUpdates, UPDATE_EVERY_MS } from '../../src/pwa/install';

afterEach(() => vi.useRealTimers());

const visible = (state: DocumentVisibilityState) => Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

describe('looking for a new version', () => {
  it('checks when the app comes to the front, when online returns, on pageshow, and every fifteen minutes', () => {
    vi.useFakeTimers();
    const check = vi.fn(() => Promise.resolve());
    visible('visible');
    const stop = watchForUpdates(check);
    expect(check).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(check).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('pageshow'));
    expect(check).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(UPDATE_EVERY_MS);
    expect(check).toHaveBeenCalledTimes(4);
    stop();
    vi.advanceTimersByTime(UPDATE_EVERY_MS);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(check).toHaveBeenCalledTimes(4);
  });

  it('does not check while hidden, and a failed check is just missed', async () => {
    vi.useFakeTimers();
    const check = vi.fn(() => Promise.reject(new TypeError('offline')));
    visible('hidden');
    const stop = watchForUpdates(check);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(UPDATE_EVERY_MS);
    expect(check).not.toHaveBeenCalled();
    visible('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(check).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    stop();
  });
});
