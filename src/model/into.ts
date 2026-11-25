// Into the app (PLAN-RESEARCH.md section 2, Q4): what a paper carries into Journal and Council before the page it lands
// on opens. No UI. The signs' touches that once carried his lines here (PLAN-TASKS.md T3) left with the mountain
// (PLAN-WORLDS.md section 4.1). Every read and write goes through store (sealed words).
import type { Message, Page } from '../db/schema';
import { store, type Read } from '../db/fields';
import { todayLinked, writeLine } from './pages';
import { newCouncil, speak } from './council';
import type { Paper, Side } from '../research/types';

/** One rule holds one line: what he wrote, its breaks and runs of space made one space, trimmed. Empty is nothing. */
export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

const needLine = (text: string): string => {
  const line = oneLine(text);
  if (!line) throw new Error('Nothing written');
  return line;
};

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
