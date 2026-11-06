import { describe, it, expect, beforeEach } from 'vitest';
import { sunTimes, skyAt, parsePlace, TOWNS, light, sky, still, enterStill, leaveStill, liftAtSunrise, now, moonGlows, DUSK_MIN } from '../../src/ui/light';
import { settings } from '../../src/ui/settings';
import { defaultSettings } from '../../src/db/seed';

const MIN = 60_000;
const near = (ms: number, utc: number, tolMin = 4) => expect(Math.abs(ms - utc) / MIN).toBeLessThan(tolMin);
const london = { name: 'London', lat: 51.5072, lon: -0.1276 };
const tokyo = { name: 'Tokyo', lat: 35.6762, lon: 139.6503 };
const denver = { name: 'Denver', lat: 39.7392, lon: -104.9903 };

describe('sunrise and sunset, computed offline', () => {
  it('London at midsummer and midwinter', () => {
    const jun = sunTimes(new Date(2026, 5, 21, 12), london);
    near(jun.rise, Date.UTC(2026, 5, 21, 3, 43));
    near(jun.set, Date.UTC(2026, 5, 21, 20, 21));
    const dec = sunTimes(new Date(2026, 11, 21, 12), london);
    near(dec.rise, Date.UTC(2026, 11, 21, 8, 4));
    near(dec.set, Date.UTC(2026, 11, 21, 15, 53));
    expect(jun.fromPlace).toBe(true);
  });

  it('Tokyo at midsummer (east of Greenwich: sunrise falls on the previous UTC day)', () => {
    const t = sunTimes(new Date(2026, 5, 21, 12), tokyo);
    near(t.rise, Date.UTC(2026, 5, 20, 19, 25));
    near(t.set, Date.UTC(2026, 5, 21, 10, 0));
  });

  it('Denver, the week this was written', () => {
    const t = sunTimes(new Date(2026, 10, 7, 12), denver);
    near(t.rise, Date.UTC(2026, 10, 7, 13, 38));
    near(t.set, Date.UTC(2026, 10, 7, 23, 51));
  });

  it('falls back to 07:00 to 19:00 with no place, or in polar day and night', () => {
    const none = sunTimes(new Date(2026, 10, 7, 12));
    expect(new Date(none.rise).getHours()).toBe(7);
    expect(new Date(none.set).getHours()).toBe(19);
    expect(none.fromPlace).toBe(false);
    const polar = sunTimes(new Date(2026, 11, 21, 12), { name: 'Svalbard', lat: 78.2, lon: 15.6 });
    expect(polar.fromPlace).toBe(false);
  });
});

describe('the sky', () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m).getTime();
  it('is day from sunrise to sunset and night otherwise', () => {
    expect(skyAt(at(12)).light).toBe('day');
    expect(skyAt(at(3)).light).toBe('night');
    expect(skyAt(at(21)).light).toBe('night');
  });
  it('crosses over a 40-minute dusk after sunset and a 40-minute dawn before sunrise', () => {
    expect(DUSK_MIN).toBe(40);
    expect(skyAt(at(19, 10))).toEqual({ light: 'night', from: 'day', fadeEndsAt: at(19, 40) });
    expect(skyAt(at(19, 40))).toEqual({ light: 'night' });
    expect(skyAt(at(6, 30))).toEqual({ light: 'day', from: 'night', fadeEndsAt: at(7) });
    expect(skyAt(at(6, 19))).toEqual({ light: 'night' });
  });
});

describe('the light', () => {
  beforeEach(() => {
    settings.value = defaultSettings(0);
    still.value = null;
  });
  it('follows the sky unless pinned, and Still sits over both', () => {
    now.value = new Date(2026, 10, 7, 12).getTime();
    expect(light.value).toBe('day');
    settings.value = { ...settings.value, light: 'night' };
    expect(light.value).toBe('night');
    enterStill();
    expect(light.value).toBe('still');
    leaveStill();
    expect(light.value).toBe('night');
    settings.value = { ...settings.value, light: 'sky' };
    now.value = new Date(2026, 10, 7, 22).getTime();
    expect(sky.value.light).toBe('night');
    expect(light.value).toBe('night');
  });
  it('the moon glows after sunset, even when Day is pinned', () => {
    settings.value = { ...settings.value, light: 'day' };
    now.value = new Date(2026, 10, 7, 22).getTime();
    expect(light.value).toBe('day');
    expect(moonGlows.value).toBe(true);
  });
  it('Still lifts at the next sunrise, and not before', () => {
    still.value = { since: new Date(2026, 10, 7, 23).getTime() };
    liftAtSunrise(new Date(2026, 10, 8, 3).getTime());
    expect(still.value).not.toBeNull();
    liftAtSunrise(new Date(2026, 10, 8, 7, 5).getTime());
    expect(still.value).toBeNull();
  });
});

describe('places', () => {
  it('knows Evergreen, Colorado offline', () => {
    expect(parsePlace('Evergreen')).toEqual(TOWNS[0]);
    expect(parsePlace('evergreen, colorado')?.name).toBe('Evergreen, Colorado');
  });
  it('accepts a typed "lat, lon"', () => {
    expect(parsePlace('39.63, -105.32')).toEqual({ lat: 39.63, lon: -105.32, name: '39.63, -105.32' });
    expect(parsePlace('35.68 139.65')).toMatchObject({ lat: 35.68, lon: 139.65 });
  });
  it('refuses what it cannot place', () => {
    expect(parsePlace('Atlantis')).toBeNull();
    expect(parsePlace('91, 10')).toBeNull();
    expect(parsePlace('')).toBeNull();
  });
});
