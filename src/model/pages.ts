// Pages and their messages (PLAN.md section 4). Package 0 needs today's entry, a page by id, the
// questions list and the voices; package 1 grows this into the full Journal.
import type { Message, Page, Paradox, Item, Voice } from '../db/schema';
import { store, type Read } from '../db/fields';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - 1;

export async function pagesInOrder(): Promise<Read<Page>[]> {
  return store.query('pages', t => t.orderBy('createdAt'));
}

export async function messagesOf(pageId: string): Promise<Read<Message>[]> {
  return store.query('messages', t => t.where('[pageId+at]').between([pageId, -Infinity], [pageId, Infinity], true, true));
}

export type Today = { page?: Read<Page>; message?: Read<Message>; no: number };

/** Today's dated entry, its plain-ink message and its number in the sequence ("No."). */
export async function today(now = new Date()): Promise<Today> {
  const pages = await pagesInOrder();
  const from = startOfDay(now), to = endOfDay(now);
  const page = [...pages].reverse().find(p => p.kind === 'entry' && p.createdAt >= from && p.createdAt <= to);
  if (!page) return { no: pages.length + 1 };
  const message = (await messagesOf(page.id)).find(m => !m.voiceId);
  return { page, message, no: pages.indexOf(page) + 1 };
}

/** Writes today's text: the first keystroke makes the page and its message, later ones update them. */
export async function writeToday(current: Today, text: string, now = Date.now()): Promise<Today> {
  if (!current.page || !current.message) {
    const page: Page = current.page ?? {
      id: crypto.randomUUID(), kind: 'entry', createdAt: now, updatedAt: now, state: 'open',
      tags: [], paradoxIds: [], linkedPageIds: [],
    };
    const message: Message = { id: crypto.randomUUID(), pageId: page.id, at: now, updatedAt: now, text, kept: false };
    await store.many({ pages: [{ ...page, updatedAt: now }], messages: [message] });
    return { ...current, page: { ...page, updatedAt: now }, message };
  }
  const page = { ...current.page, updatedAt: now };
  const message = { ...current.message, text, updatedAt: now };
  await store.many({ pages: [page], messages: [message] });
  return { ...current, page, message };
}

export async function pageById(id: string): Promise<{ page: Read<Page>; messages: Read<Message>[]; no: number } | null> {
  const pages = await pagesInOrder();
  const i = pages.findIndex(p => p.id === id);
  if (i < 0) return null;
  return { page: pages[i], messages: await messagesOf(id), no: i + 1 };
}

export async function questions(): Promise<Read<Page>[]> {
  const qs = await store.query('pages', t => t.where('kind').equals('question'));
  // open ones first ("space to answer left"), then the rest, newest first within each
  return qs.sort((a, b) => Number(a.state !== 'open') - Number(b.state !== 'open') || b.createdAt - a.createdAt);
}

export async function voices(): Promise<Read<Voice>[]> {
  return (await store.all('voices')).filter(v => !v.archived).sort((a, b) => a.order - b.order);
}

export async function paradoxes(): Promise<{ paradox: Read<Paradox>; items: Read<Item>[] }[]> {
  const all = (await store.all('paradoxes')).filter(p => p.status === 'active').sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return Promise.all(all.map(async paradox => ({
    paradox,
    items: (await store.query('items', t => t.where('paradoxId').equals(paradox.id))).sort((a, b) => a.order - b.order),
  })));
}
