// Into the app (PLAN-TASKS.md T3, sections 2 and 3): what a sign's touch carries into Journal and Council before the
// page it lands on opens. No UI. Every line here is his: the one he wrote on the plate's rule, carried as he wrote it
// (Ask, Bring it, Write from it); nothing is carried for Letter, A voice and the rest, and the app writes no words of its
// own. The journal page a touch lands on is today's (pages.ts todayLinked), linked to the sign by page.sign, so the page
// prints that sign beside its date and a tap on it goes back. Every read and write goes through store (sealed words).
import type { Message, Page } from '../db/schema';
import { store, type Read } from '../db/fields';
import { askThis, dayKey, keptLines, todayLinked, writeLine, type Kept } from './pages';
import { councilPages, newCouncil, speak } from './council';
import { starOfDay, type Star } from './stars';
import type { ChakraId } from './mountain';

/** One rule holds one line: what he wrote, its breaks and runs of space made one space, trimmed. Empty is nothing. */
export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

const needLine = (text: string): string => {
  const line = oneLine(text);
  if (!line) throw new Error('Nothing written');
  return line;
};

/** Ask (Third eye): his line written on today's page, linked to the sign, and asked (V2's Ask this, which took Turn to
 *  answer's place): a question titled by the line, linked both ways with today's page. The page opens with the answer
 *  rule under the line (the wiser second person, rule 17); that is the page's, not this. */
export async function askToday(chakra: ChakraId, text: string, now = Date.now()): Promise<{ page: Read<Page>; message: Read<Message>; question: Read<Page> }> {
  const line = needLine(text);
  const r = await writeLine(await todayLinked({ sign: { chakra } }, now), undefined, { text: line }, now);
  if (!r?.message) throw new Error('Nothing written');
  const { page, question } = await askThis(r.page, r.message, now);
  return { page, message: r.message, question };
}

/** Write from it (Sacral): his word as a line of today's page, the next after what is already there (the first line on
 *  a page not yet written on), the page linked to the sign. */
export async function writeFromIt(chakra: ChakraId, text: string, now = Date.now()): Promise<{ page: Read<Page>; message: Read<Message> }> {
  const line = needLine(text);
  const r = await writeLine(await todayLinked({ sign: { chakra } }, now), undefined, { text: line }, now);
  if (!r?.message) throw new Error('Nothing written');
  return { page: r.page, message: r.message };
}

/** Letter (Heart): today's page, linked to the sign, with nothing written on it here. The page opens on "Dear" on its
 *  next rule, unsaved until he writes, and is never sent anywhere. */
export async function letterToday(chakra: ChakraId, now = Date.now()): Promise<Read<Page>> {
  const page = await todayLinked({ sign: { chakra } }, now);
  await store.put('pages', page);
  return page;
}

/** Bring it (Third eye): a new council with his question as its first line, in ink, linked to the sign. */
export async function bringIt(chakra: ChakraId, text: string, now = Date.now()): Promise<{ page: Read<Page>; message: Read<Message> }> {
  const line = needLine(text);
  const c = await newCouncil({ now });
  const page: Read<Page> = { ...c, sign: { chakra } };
  await store.put('pages', page);
  const message = await speak(c.id, line, { now });
  return { page, message };
}

/** A voice (Throat): a council with nothing said, its voice chips ready ("Who sits?"). Today's own, if one was opened
 *  today and nothing has been said or asked on it yet; else a new one. Nothing is carried; the sign is linked. */
export async function voiceCouncil(chakra: ChakraId, now = Date.now()): Promise<Read<Page>> {
  const day = dayKey(now);
  const empty = (await councilPages()).find(r =>
    dayKey(r.page.createdAt) === day && !r.firstLine && !r.page.title && !r.page.valueIds?.length && !r.page.linkedPageIds.length);
  const page: Read<Page> = { ...(empty?.page ?? await newCouncil({ now })), sign: { chakra } };
  await store.put('pages', page);
  return page;
}

/** Kept line (Crown): the day's star (model/stars.ts) and the kept line it is, with the page it was kept on. None when
 *  nothing is kept yet. */
export async function keptStar(now = Date.now()): Promise<{ star: Star; kept: Kept } | undefined> {
  const kept = await keptLines();
  const star = starOfDay(kept.map(k => ({ id: k.message.id, at: k.message.at })), dayKey(now));
  const k = star && kept.find(x => x.message.id === star.id);
  return star && k ? { star, kept: k } : undefined;
}
