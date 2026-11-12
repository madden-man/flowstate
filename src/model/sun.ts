// Sunrise and sunset, offline, with no library (PLAN.md section 8): the sunrise equation, Meeus-style approximations,
// good to a minute or two. Pure. Moved here from ui/light.ts in T0 (PLAN-TASKS.md section 7) so a model can turn its
// day at sunrise (model/acts.ts, Root's basics); ui/light.ts re-exports it unchanged.
import type { Place } from '../db/schema';

const DAY_MS = 86_400_000;
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
