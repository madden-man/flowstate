// The stars are kept lines (PLAN-WEATHER.md, the stars row; PLAN-TASKS.md T3, Crown's Kept line). Pure: no UI, no
// database. Each kept line (messages.kept) is one star, the newest forty, each placed by a seed from its own id so it
// stays where it is from one opening to the next. Crown's Kept line shows one of them: the day's star, the same one all
// day, so a second tap shows the line he saw before. W2 draws the whole sky from starsOf; Crown draws starOfDay.
// Nothing here counts (rule 15): forty is a cap on the drawing, never printed.

/** The most stars drawn: past this the oldest are not drawn, so the sky never fills. Never printed. */
export const STARS_MAX = 40;

/** A star: the kept line's id and where it sits, as fractions of the sky it is drawn in (0 to 1 across, 0 to 1 down). */
export type Star = { id: string; x: number; y: number };

/** A small string hash (FNV-1a), the seed a star's place is read from. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Two numbers from 0 to 1 out of one id, the same every time. */
function placeOf(id: string): [number, number] {
  const a = hash(id), b = hash(`${id}·y`);
  return [(a % 10007) / 10007, (b % 10009) / 10009];
}

/** One star per kept line, the newest STARS_MAX, newest first, each where its id puts it. */
export function starsOf(kept: readonly { id: string; at: number }[]): Star[] {
  return [...kept].sort((p, q) => q.at - p.at || p.id.localeCompare(q.id)).slice(0, STARS_MAX)
    .map(k => { const [x, y] = placeOf(k.id); return { id: k.id, x, y }; });
}

/** The day's star among the drawn ones: the same all day (day is "YYYY-MM-DD"), another the next. None with none kept. */
export function starOfDay(kept: readonly { id: string; at: number }[], day: string): Star | undefined {
  const sky = starsOf(kept);
  return sky.length ? sky[hash(day) % sky.length] : undefined;
}
