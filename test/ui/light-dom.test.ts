// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { startLight, still, now } from '../../src/ui/light';
import { settings } from '../../src/ui/settings';
import { defaultSettings } from '../../src/db/seed';

afterEach(() => vi.useRealTimers());

describe('data-light on <html>', () => {
  it('is set at start, follows the pin and Still, and the dusk stretches --t-light', async () => {
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
    // ten minutes after sunset (19:00 with no place): night, crossing over the 30 minutes left
    vi.setSystemTime(new Date(2026, 10, 7, 19, 10));
    now.value = Date.now();
    expect(root.dataset.light).toBe('night');
    expect(root.style.getPropertyValue('--t-light')).toBe(`${30 * 60_000}ms`);
    stop();
  });
});
