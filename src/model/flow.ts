// Flow (PLAN.md section 5 item 4): what is due today by cadence, the done log, the lean between the
// poles, and the look back. Every read and write goes through store, so sealing works. Every date is the
// phone's own local calendar: a day starts at local midnight, a week on Monday (ISO), a month on the 1st.
// Nothing here counts a run of days; there are no totals.
import type { Cadence, Item, Lean, Paradox, Voice } from '../db/schema';
import { store, type Read } from '../db/fields';
import { questions } from './pages';
import { goalsOf, openSlots, slotLine, clampLean } from './paradox';

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- calendar

const at = (d: Date | number) => (typeof d === 'number' ? new Date(d) : d);
export const startOfDay = (d: Date | number): number => { const x = at(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
/** Monday of the ISO week holding d, at local midnight. */
export const startOfWeek = (d: Date | number): number => {
  const x = at(d);
  const back = (x.getDay() + 6) % 7; // Monday 0 ... Sunday 6
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() - back).getTime();
};
export const startOfMonth = (d: Date | number): number => { const x = at(d); return new Date(x.getFullYear(), x.getMonth(), 1).getTime(); };
export const startOfYear = (d: Date | number): number => new Date(at(d).getFullYear(), 0, 1).getTime();

type Recurring = Exclude<Cadence, 'once'>;
const PERIOD: Record<Recurring, { start: (d: Date | number) => number; next: (start: number) => number }> = {
  daily: { start: startOfDay, next: s => { const x = new Date(s); return new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1).getTime(); } },
  weekly: { start: startOfWeek, next: s => { const x = new Date(s); return new Date(x.getFullYear(), x.getMonth(), x.getDate() + 7).getTime(); } },
  monthly: { start: startOfMonth, next: s => { const x = new Date(s); return new Date(x.getFullYear(), x.getMonth() + 1, 1).getTime(); } },
  yearly: { start: startOfYear, next: s => new Date(new Date(s).getFullYear() + 1, 0, 1).getTime() },
};

/** The period of a cadence that holds d: [from, to). "once" has one period, all of time. */
export function periodOf(cadence: Cadence, d: Date | number): { from: number; to: number } {
  if (cadence === 'once') return { from: -Infinity, to: Infinity };
  const p = PERIOD[cadence];
  const from = p.start(d);
  return { from, to: p.next(from) };
}

type Logged = Pick<Item, 'cadence' | 'doneLog' | 'archived'>;
const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);

/** Done at some time on the day of d. */
export const doneOn = (item: Pick<Item, 'doneLog'>, d: Date | number): boolean => item.doneLog.some(e => sameDay(e.at, at(d).getTime()));

/** Due: daily every day, weekly once per ISO week, monthly once per calendar month, yearly once per
 *  year, once until its first done. An item with no cadence, or archived, is never due. */
export function isDue(item: Logged, d: Date | number = Date.now()): boolean {
  if (!item.cadence || item.archived) return false;
  const { from, to } = periodOf(item.cadence, d);
  return !item.doneLog.some(e => e.at >= from && e.at < to);
}

/** On today's page: due, or done today (so a check drawn today stays to be un-drawn). */
export function onToday(item: Logged, d: Date | number = Date.now()): boolean {
  if (!item.cadence || item.archived) return false;
  return isDue(item, d) || doneOn(item, d);
}

/** When it is next due: today (its start) if it is due now, else the start of the next period; null for
 *  a "once" that is done or an item with no cadence. */
export function nextDue(item: Logged, d: Date | number = Date.now()): number | null {
  if (!item.cadence || item.archived) return null;
  if (isDue(item, d)) return startOfDay(d);
  if (item.cadence === 'once') return null;
  return periodOf(item.cadence, d).to;
}

// ---------------------------------------------------------------- the done log

/** The log with one more done at now. Checking an item already done today changes nothing. */
export function withCheck(log: Item['doneLog'], now: number): Item['doneLog'] {
  return log.some(e => sameDay(e.at, now)) ? log : [...log, { at: now }];
}
/** The log with today's dones taken out (the check un-drawn); earlier days stay. */
export const withoutToday = (log: Item['doneLog'], now: number): Item['doneLog'] => log.filter(e => !sameDay(e.at, now));

/** Draws or un-draws today's check on an item. Returns the item as written. */
export async function setDone(id: string, done: boolean, now = Date.now()): Promise<Read<Item>> {
  const item = await store.get('items', id);
  if (!item) throw new Error('No such item');
  const doneLog = done ? withCheck(item.doneLog, now) : withoutToday(item.doneLog, now);
  const next = { ...item, doneLog };
  await store.put('items', next);
  return next;
}

// ---------------------------------------------------------------- today

export type TodayGroup = { paradox: Read<Paradox>; items: Read<Item>[]; lean?: Read<Lean> };

const activeParadoxes = async () =>
  (await store.all('paradoxes')).filter(p => p.status === 'active').sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

/** Today's page: each active paradox with its items on today (in spread order) and its latest lean. */
export async function today(now = Date.now()): Promise<TodayGroup[]> {
  const ps = await activeParadoxes();
  return Promise.all(ps.map(async paradox => ({
    paradox,
    items: (await goalsOf(paradox.id)).filter(i => onToday(i, now)),
    lean: await latestLean(paradox.id),
  })));
}

// ---------------------------------------------------------------- leans

export const leansOf = (paradoxId: string): Promise<Read<Lean>[]> =>
  store.query('leans', t => t.where('[paradoxId+at]').between([paradoxId, -Infinity], [paradoxId, Infinity], true, true));

export async function latestLean(paradoxId: string): Promise<Read<Lean> | undefined> {
  const ls = await leansOf(paradoxId);
  return ls[ls.length - 1];
}

/** A lean, written on release: -1 is pole A, +1 pole B. */
export async function addLean(paradoxId: string, lean: number, opts: { note?: string; now?: number } = {}): Promise<Lean> {
  const row: Lean = { id: crypto.randomUUID(), paradoxId, at: opts.now ?? Date.now(), lean: clampLean(lean), note: opts.note?.trim() ?? '' };
  await store.put('leans', row);
  return row;
}

/** The note under a lean: one line, written on the lean it belongs to. */
export async function setLeanNote(id: string, note: string): Promise<Read<Lean>> {
  const row = await store.get('leans', id);
  if (!row) throw new Error('No such lean');
  const next = { ...row, note: note.replace(/\s*\n\s*/g, ' ').trim() };
  await store.put('leans', next);
  return next;
}

// The slider's detents: -1, 0, +1. A mark within SNAP of one sits on it.
export const DETENTS = [-1, 0, 1] as const;
export const SNAP = 0.08;
/** The detent a lean sits on, if any. */
export const detentOf = (lean: number): number | undefined => DETENTS.find(d => Math.abs(lean - d) <= SNAP);
/** A raw lean from the finger, clicked onto a detent when it is close to one. */
export const snapLean = (raw: number): number => { const l = clampLean(raw); return detentOf(l) ?? l; };

// ---------------------------------------------------------------- look back

export type OpenQuestion = { id: string; title: string };
export async function openQuestions(limit = 5): Promise<OpenQuestion[]> {
  return (await questions())
    .filter(q => q.state === 'open' && q.title?.trim())
    .slice(0, limit)
    .map(q => ({ id: q.id, title: q.title!.trim() }));
}

export type QuietParadox = { id: string; label: string };
/** Active paradoxes with no lean in the calendar month of now. */
export async function quietParadoxes(now = Date.now()): Promise<QuietParadox[]> {
  const from = startOfMonth(now);
  const ps = await activeParadoxes();
  const quiet = await Promise.all(ps.map(async p => ((await leansOf(p.id)).some(l => l.at >= from) ? null : p)));
  return quiet.filter((p): p is Read<Paradox> => !!p).map(p => ({ id: p.id, label: `${p.poleA.value} · ${p.poleB.value}` }));
}

export const QUIET_DAYS = 30;
/** Light voices (not archived) that have not spoken in thirty days, or ever, in pantheon order. Deep twins
 *  are left out so the list stays short; each sits beside its light voice on the Voices screen. */
export async function quietVoices(now = Date.now(), days = QUIET_DAYS): Promise<Read<Voice>[]> {
  const since = now - days * DAY_MS;
  const [vs, ms] = await Promise.all([store.all('voices'), store.all('messages')]);
  const last = new Map<string, number>();
  for (const m of ms) if (m.voiceId) last.set(m.voiceId, Math.max(last.get(m.voiceId) ?? -Infinity, m.at));
  return vs.filter(v => !v.archived && v.shade === 'light' && (last.get(v.id) ?? -Infinity) < since).sort((a, b) => a.order - b.order);
}

export type OpenBalance = { paradoxId: string; forId: string; goal: string; line: string };
/** The spread's open balance slots: a goal whose balance on the other pole is still missing. */
export async function openBalances(): Promise<OpenBalance[]> {
  const ps = await activeParadoxes();
  const rows = await Promise.all(ps.map(async p => {
    const items = await goalsOf(p.id);
    return openSlots(items).map(s => ({
      paradoxId: p.id,
      forId: s.forId,
      goal: items.find(i => i.id === s.forId)?.text ?? '',
      line: slotLine(s.pole === 'a' ? p.poleA.value : p.poleB.value),
    }));
  }));
  return rows.flat();
}

export type LeanLineData = { paradox: Read<Paradox>; points: { at: number; lean: number }[] };
/** Each active paradox that has been leaned, with its leans oldest first. */
export async function leanLines(): Promise<LeanLineData[]> {
  const ps = await activeParadoxes();
  const rows = await Promise.all(ps.map(async paradox => ({ paradox, points: (await leansOf(paradox.id)).map(l => ({ at: l.at, lean: l.lean })) })));
  return rows.filter(r => r.points.length > 0);
}

/** The look back. Entries have no state since V1, so nothing lists them as still raw (V2 took that list out). */
export type LookBack = {
  open: OpenQuestion[];
  quiet: QuietParadox[];
  voices: Read<Voice>[];
  balances: OpenBalance[];
  lines: LeanLineData[];
};
export async function lookBack(now = Date.now()): Promise<LookBack> {
  const [open, quiet, voices, balances, lines] = await Promise.all([
    openQuestions(), quietParadoxes(now), quietVoices(now), openBalances(), leanLines(),
  ]);
  return { open, quiet, voices, balances, lines };
}

// ---------------------------------------------------------------- the lean line's path

/** An SVG path for a lean line in a w by h box: time left to right (first lean to now), lean top (-1) to
 *  bottom (+1). It holds its last height out to now, since that is where you still are. */
export function leanPath(points: { at: number; lean: number }[], now: number, w: number, h: number, pad = 2): string {
  if (!points.length) return '';
  const t0 = points[0].at;
  const t1 = Math.max(now, points[points.length - 1].at, t0 + 1);
  const x = (t: number) => pad + ((t - t0) / (t1 - t0)) * (w - pad * 2);
  const y = (l: number) => pad + ((clampLean(l) + 1) / 2) * (h - pad * 2);
  const r = (n: number) => Math.round(n * 10) / 10;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${r(x(p.at))} ${r(y(p.lean))}`);
  const last = points[points.length - 1];
  d.push(`L${r(x(t1))} ${r(y(last.lean))}`);
  return d.join(' ');
}
