// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { startLight, still, now } from '../../src/ui/light';
import { settings } from '../../src/ui/settings';
import { defaultSettings } from '../../src/db/seed';

afterEach(() => vi.useRealTimers());

describe('data-light on <html>', () => {
  it('is set at start, follows the pin and Still, and never overrides --t-light', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 10, 7, 12));
    settings.value = defaultSettings(0);
    now.value = Date.now();
    still.value = null;
    document.head.innerHTML = '<meta name="theme-color" id="theme-color" content="">';
    const root = document.documentElement;
    const stop = startLight(root);
    expect(root.dataset.light).toBe('day');
    settings.value = { ...settings.value, light: 'night' };
    expect(root.dataset.light).toBe('night');
    expect(root.style.getPropertyValue('--t-light')).toBe(''); // a chosen change uses the token
    still.value = { since: Date.now() };
    expect(root.dataset.light).toBe('still');
    still.value = null;
    settings.value = { ...settings.value, light: 'sky' };
    expect(root.dataset.light).toBe('day');
    // sunset (19:00 with no place): night in one --t-light breath, the token's own duration
    vi.setSystemTime(new Date(2026, 10, 7, 19, 0));
    now.value = Date.now();
    expect(root.dataset.light).toBe('night');
    expect(root.style.getPropertyValue('--t-light')).toBe('');
    stop();
  });

  it('flips at sunrise with no --t-light override on the root, and opening at dawn starts in the light of the moment (V5)', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 10, 8, 6, 42)); // the 2026-11-08 screenshot: 18 minutes before sunrise
    settings.value = defaultSettings(0);
    now.value = Date.now();
    still.value = null;
    const root = document.documentElement;
    root.removeAttribute('style');
    const stop = startLight(root);
    expect(root.dataset.light).toBe('night');
    expect(root.getAttribute('style') ?? '').not.toContain('--t-light');
    vi.setSystemTime(new Date(2026, 10, 8, 7, 0));
    now.value = Date.now();
    expect(root.dataset.light).toBe('day');
    expect(root.getAttribute('style') ?? '').not.toContain('--t-light');
    vi.advanceTimersByTime(45 * 60_000);
    expect(root.dataset.light).toBe('day');
    expect(root.getAttribute('style') ?? '').not.toContain('--t-light');
    stop();
  });
});
