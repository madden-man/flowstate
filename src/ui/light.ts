// The sky (PLAN.md section 8, DESIGN.md rules 12 to 14). Sunrise and sunset are computed here from the
// stored place, offline, with no library; with no place the day runs 07:00 to 19:00. Sunrise and sunset
// change the light in one --t-light breath, the token's own duration, so the page, chips, rules and
// sheets turn together (V5, 2026-11-08: the 40-minute stretch left them in two lights at once). Still is
// a light the user chooses, by the moon (package 5; the pull shows earlier pages since V6); this file holds the state.
// The moon's way in and the ring's way out open and close the dark as a circle (still.ts, M4); every other change of
// light, the sky's and the Settings pin's, stays the one breath.
import { signal, computed, effect } from '@preact/signals';
import type { LightPin, Place } from '../db/schema';
import { settings } from './settings';

export type Light = 'day' | 'night' | 'still';
const DAY_MS = 86_400_000;

// ---- solar maths (the sunrise equation; Meeus-style approximations, good to a minute or two) ----

const rad = Math.PI / 180;
const toJulian = (ms: number) => ms / DAY_MS + 2440587.5;
const fromJulian = (j: number) => (j - 2440587.5) * DAY_MS;

export type SunTimes = { rise: number; set: number; fromPlace: boolean };

/** Sunrise and sunset (epoch ms) for the calendar day of `day` (device local) at a place. */
export function sunTimes(day: Date, place?: Place | null): SunTimes {
  const fallback = (): SunTimes => {
    const d = new Date(day);
    return { rise: d.setHours(7, 0, 0, 0), set: d.setHours(19, 0, 0, 0), fromPlace: false };
  };
  if (!place) return fallback();
  const midnightUtc = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate());
  const n = Math.ceil(toJulian(midnightUtc) - 2451545.0 + 0.0008);
  const jStar = n - place.lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDec = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(place.lat * rad) * sinDec) / (Math.cos(place.lat * rad) * cosDec);
  if (cosW < -1 || cosW > 1) return fallback(); // polar day or night: keep the plain clock
  const w = Math.acos(cosW) / rad;
  return { rise: fromJulian(transit - w / 360), set: fromJulian(transit + w / 360), fromPlace: true };
}

export type Sky = { light: 'day' | 'night' };

/** Day from sunrise to sunset, night otherwise. */
export function skyAt(t: number, place?: Place | null): Sky {
  const { rise, set } = sunTimes(new Date(t), place);
  return { light: t >= rise && t < set ? 'day' : 'night' };
}

// ---- places ----

/** A few towns, offline. Anything else is typed as "lat, lon". */
export const TOWNS: Place[] = [
  { name: 'Evergreen, Colorado', lat: 39.6336, lon: -105.3172 },
  { name: 'Denver, Colorado', lat: 39.7392, lon: -104.9903 },
  { name: 'Boulder, Colorado', lat: 40.015, lon: -105.2705 },
  { name: 'Orange, California', lat: 33.7879, lon: -117.8531 },
  { name: 'Los Angeles, California', lat: 34.0522, lon: -118.2437 },
  { name: 'Seattle, Washington', lat: 47.6062, lon: -122.3321 },
  { name: 'New York, New York', lat: 40.7128, lon: -74.006 },
  { name: 'London, England', lat: 51.5072, lon: -0.1276 },
  { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503 },
  { name: 'Kyoto, Japan', lat: 35.0116, lon: 135.7681 },
  { name: 'Osaka, Japan', lat: 34.6937, lon: 135.5023 },
];

export function parsePlace(input: string): Place | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (m) {
    const lat = Number(m[1]), lon = Number(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon, name: `${lat.toFixed(2)}, ${lon.toFixed(2)}` };
  }
  const q = s.toLowerCase().replace(/\s+/g, ' ');
  return TOWNS.find(t => t.name.toLowerCase() === q) ?? TOWNS.find(t => t.name.toLowerCase().startsWith(q)) ?? null;
}

// ---- state ----

export const now = signal(Date.now());
export const still = signal<{ since: number } | null>(null);
const pin = computed<LightPin>(() => settings.value.light);
const place = computed(() => settings.value.place ?? null);
export const sky = computed(() => skyAt(now.value, place.value));
export const light = computed<Light>(() => (still.value ? 'still' : pin.value === 'sky' ? sky.value.light : pin.value));
/** The moon glows after sunset, whatever the pin; it never switches Still on by itself. */
export const moonGlows = computed(() => sky.value.light === 'night');

export function enterStill(): void {
  if (!still.value) still.value = { since: Date.now() };
}
export function leaveStill(): void {
  still.value = null;
}

/** Still lifts itself at the next sunrise (DESIGN.md rule 13). Leaving changes no data. */
export function liftAtSunrise(t: number): void {
  const s = still.value;
  if (!s) return;
  const { rise } = sunTimes(new Date(t), place.value);
  if (s.since < rise && rise <= t) leaveStill();
}

// ---- applying it to <html> ----

let prev: Light | null = null;

function setThemeColour(root: HTMLElement) {
  const meta = document.getElementById('theme-color');
  const page = getComputedStyle(root).getPropertyValue('--page').trim();
  if (meta && page) meta.setAttribute('content', page);
}

function apply(root: HTMLElement, next: Light) {
  root.dataset.light = next;
  setThemeColour(root);
}

/** Starts the sky: sets data-light now, then follows the clock. Returns a stop function. */
export function startLight(root: HTMLElement = document.documentElement): () => void {
  prev = light.peek();
  apply(root, prev);
  const stop = effect(() => {
    const next = light.value;
    if (next === prev) return;
    prev = next;
    apply(root, next);
  });
  const tick = () => {
    now.value = Date.now();
    liftAtSunrise(now.value);
  };
  const iv = setInterval(tick, 30_000);
  const onVis = () => document.visibilityState === 'visible' && tick();
  document.addEventListener('visibilitychange', onVis);
  return () => {
    stop();
    clearInterval(iv);
    document.removeEventListener('visibilitychange', onVis);
  };
}

/** "06:41" in the phone's own clock. */
export const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
