// Into the app (PLAN-RESEARCH.md section 2, Q4): what a paper carries into Journal and Council before the page it lands
// on opens, and the Sunday question's landing (PLAN-PUSH.md N1). No UI. The signs' touches that once carried his lines here (PLAN-TASKS.md T3) left with the mountain
// (PLAN-WORLDS.md section 4.1). Every read and write goes through store (sealed words).
import type { Message, Page } from '../db/schema';
import { store, worn, type Read } from '../db/fields';
import { askThis, messagesOf, todayLinked, writeLine } from './pages';
import { newCouncil, speak } from './council';
import type { Paper, Side } from '../research/types';

/** One rule holds one line: what he wrote, its breaks and runs of space made one space, trimmed. Empty is nothing. */
export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

const needLine = (text: string): string => {
  const line = oneLine(text);
  if (!line) throw new Error('Nothing written');
  return line;
};

/** The Sunday question (PLAN-PUSH.md section 4, N1): his question written on today's page and asked (a question
 *  titled by the line, linked both ways with today's page, as Ask this does), the page linked to the week it asked
 *  (page.checkin). Landed twice the same day (the line, then the notification), the question already on a page of that
 *  week is not written or asked again: the page just opens.
 *  The question is the personal notebook's whatever world is worn (DESIGN.md rule 22, PLAN-WORLDS.md section 3): a
 *  world's question page would travel to the bible. So it refuses with a world worn; the landing
 *  (ui/journal/checkin.tsx) takes the world off first, as the door does. */
export async function askCheckin(week: string, text: string, now = Date.now()): Promise<{ page: Read<Page>; message?: Read<Message>; question?: Read<Page> }> {
  if (worn() !== null) throw new Error('The Sunday question is written in his own pages only');
  const line = needLine(text);
  const page = await todayLinked({ checkin: { week } }, now);
  const there = (await messagesOf(page.id)).find(m => oneLine(m.text) === line);
  if (there) { await store.put('pages', page); return { page, message: there }; }
  const r = await writeLine(await todayLinked({ checkin: { week } }, now), undefined, { text: line }, now);
  if (!r?.message) throw new Error('Nothing written');
  const { page: asked, question } = await askThis(r.page, r.message, now);
  return { page: asked, message: r.message, question };
}

// ---- Research (PLAN-RESEARCH.md section 2, Q4): a paper carried from a question's page ----
// The only places a paper's words sit beside his own, and they are marked as the paper's: the line carries
// message.paper, so it is drawn in its side's voice with the voice rule, its title a link to the paper. The app writes
// nothing of its own: the title is the index's, the question his.

/** Write about it: today's page, linked to the question (page.research, so it prints "From" and the question and a
 *  tap goes back), with the paper's title as its next line in the side's voice; the caret waits on the rule under it. */
export async function writeAboutPaper(inquiryId: string, paper: Pick<Paper, 'id' | 'title'>, side: Side, now = Date.now()): Promise<{ page: Read<Page>; message: Read<Message> }> {
  const title = needLine(paper.title);
  const r = await writeLine(await todayLinked({ research: { inquiryId } }, now), undefined, { text: title, paper: { paperId: paper.id, side } }, now);
  if (!r?.message) throw new Error('Nothing written');
  return { page: r.page, message: r.message };
}

/** To Council: a new council about the question (its title), linked to it, whose first line is the paper's title in
 *  the side's voice. */
export async function paperToCouncil(inquiryId: string, question: string, paper: Pick<Paper, 'id' | 'title'>, side: Side, now = Date.now()): Promise<{ page: Read<Page>; message: Read<Message> }> {
  const title = needLine(paper.title);
  const c = await newCouncil({ now });
  const page: Read<Page> = { ...c, title: oneLine(question) || undefined, research: { inquiryId } };
  await store.put('pages', page);
  const message = await speak(c.id, title, { now, paper: { paperId: paper.id, side } });
  return { page, message };
}
