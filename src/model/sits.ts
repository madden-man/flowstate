// The sits (PLAN-MEDITATE.md section 5, S2): one row per sit of a minute or more on the Meditate page, written when it
// ends; "last sat", the newest of them; and the page after a sit, today's journal page linked to it both ways. Every
// read and write goes through store. No UI. Nothing here adds sits up, counts them or runs them into days (DESIGN.md
// rule 15): a sit keeps its date and its sound, and the one number said about it is its own length.
// S3: a sit reached from a flow's Sit tip carries that episode; when it is kept, the tip is ticked on the episode.
import type { Millis, Page, Sit, SitMinutes, SitSound } from '../db/schema';
import { store, type Read } from '../db/fields';
import { todayLinked } from './pages';
import { setDone } from './tips';

const MIN = 60_000;
/** A sit ended inside its first minute writes nothing and the page goes back to rest. */
export const SIT_KEPT_MS = MIN;
/** The lengths the Minutes chips offer: open, then 5, 10 and 20. */
export const SIT_LENGTHS: readonly SitMinutes[] = [0, 5, 10, 20];

/** Where a sit was sent from (S3): the live episode and the Sit tip whose row opened Meditate. */
export type SitFrom = { episodeId: string; tipId: string };

/** The row a sit leaves, or null for one ended inside its first minute. minutes 0 is open (no minutes on the row).
 *  One sent from a flow's tip carries the episode. */
export function sitOf(startedAt: Millis, endedAt: Millis, sound: SitSound, minutes: SitMinutes = 0, from?: SitFrom): Sit | null {
  if (endedAt - startedAt < SIT_KEPT_MS) return null;
  return { id: crypto.randomUUID(), startedAt, endedAt, sound, ...(minutes ? { minutes } : {}), ...(from ? { episodeId: from.episodeId } : {}) };
}

/** Writes a sit's row; one sent from a flow's tip then ticks that tip on its episode, at the sit's end (the same
 *  write a tap on the row makes, model/tips.ts setDone: nothing when the episode has ended or is locked). */
export async function keepSit(sit: Sit, from?: SitFrom): Promise<void> {
  await store.put('sits', sit);
  if (from && sit.episodeId === from.episodeId) await setDone(from.episodeId, from.tipId, true, sit.endedAt);
}

/** The newest sit, for "last sat"; undefined before the first. */
export async function lastSit(): Promise<Read<Sit> | undefined> {
  const [newest] = await store.query('sits', t => t.orderBy('startedAt').reverse().limit(1));
  return newest;
}

/** How long a sit was, in whole minutes, never under one: "Sat · 12 minutes · rain". */
export const satMinutes = (s: Pick<Sit, 'startedAt' | 'endedAt'>) => Math.max(1, Math.round((s.endedAt - s.startedAt) / MIN));
/** "12 minutes", "1 minute". */
export const minutesWords = (n: number) => `${n} minute${n === 1 ? '' : 's'}`;

/** Today's page, linked to the sit both ways: page.sit on the page, pageId on the sit. Undefined when the sit is gone. */
export async function linkSitToday(sitId: string, now = Date.now()): Promise<Read<Page> | undefined> {
  const sit = await store.get('sits', sitId);
  if (!sit) return undefined;
  const page = await todayLinked({ sit: { sitId } }, now);
  await store.many({ pages: [page], sits: [{ ...sit, pageId: page.id }] });
  return page;
}

/** What a journal page written after a sit shows (ui/flow/JournalLink.tsx): when it began and ended, and its sound. */
export type SitLinkRow = { href: string; startedAt: Millis; endedAt: Millis; sound: SitSound };

export async function sitLinkOf(page: Pick<Page, 'sit'>): Promise<SitLinkRow | undefined> {
  if (!page.sit) return undefined;
  const sit = await store.get('sits', page.sit.sitId);
  if (!sit) return undefined;
  return { href: '#/flow/meditate', startedAt: sit.startedAt, endedAt: sit.endedAt, sound: sit.sound };
}
