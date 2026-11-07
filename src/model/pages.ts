// Pages and their messages (PLAN.md section 4). Package 0 needs today's entry, a page by id, the
// questions list and the voices; package 1 grows this into the full Journal (below the line).
import type { EchoState, Message, Page, Paradox, Item, Voice } from '../db/schema';
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

// ---------------------------------------------------------------------------------------------------
// Package 1: the Journal. A page is a column of messages; every op below goes through `store`.
// Entry states keep PLAN.md's names in the UI and map onto page.state:
//   raw = 'open', revisited = 'revisited', integrated = 'answered'.
// ---------------------------------------------------------------------------------------------------

export type EntryState = 'raw' | 'revisited' | 'integrated';
export const ENTRY_STATES: [EntryState, Page['state']][] = [['raw', 'open'], ['revisited', 'revisited'], ['integrated', 'answered']];
export const entryState = (s: Page['state']): EntryState => ENTRY_STATES.find(([, v]) => v === s)![0];
export const pageStateOf = (s: EntryState): Page['state'] => ENTRY_STATES.find(([k]) => k === s)![1];

/** The notebook's own plain words for how a page feels; no emoji. */
export const MOODS = ['simple', 'serious', 'quiet', 'boiling', 'hard', 'incomplete', 'energy'] as const;

/** "YYYY-MM-DD" in the phone's own day. */
export const dayKey = (t: number | Date) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const uniq = <T>(xs: T[]) => [...new Set(xs)];
const withId = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id]);

/** Tags typed inline: "#evergreen", "#flow-state". Lowercased, in order of first appearance. */
export function parseTags(text: string): string[] {
  return uniq([...text.matchAll(/(?:^|[^\p{L}\p{N}_&#])#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu)].map(m => m[1].toLowerCase().replace(/[-_]+$/, '')));
}
export const tagsOf = (messages: { text: string }[]) => uniq(messages.flatMap(m => parseTags(m.text)));

/** A question from a message: the whole message if it is short, else its first sentence. */
export function firstSentence(text: string, short = 80): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= short) return t;
  const m = t.match(/^.+?[.?!](?=\s|$)/);
  return m ? m[0] : t;
}

/** The line a page is known by in a list: its title, else its first written line. */
export function firstLine(page: Pick<Page, 'title'>, messages: { text: string }[]): string {
  if (page.title?.trim()) return page.title.trim();
  const m = messages.find(x => x.text.trim());
  return m ? m.text.trim().split('\n')[0] : '';
}

export function newPage(kind: Page['kind'], now = Date.now(), extra: Partial<Page> = {}): Page {
  return { id: crypto.randomUUID(), kind, createdAt: now, updatedAt: now, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [], ...extra };
}

/** A question's state after one more answer: the first answers it, one on a later day marks it revisited. */
export function answerState(page: Pick<Page, 'state'>, earlier: Pick<Message, 'wise' | 'text' | 'at'>[], now = Date.now()): Page['state'] {
  const answers = earlier.filter(m => m.wise && m.text.trim());
  if (!answers.length) return page.state === 'revisited' ? 'revisited' : 'answered';
  if (answers.some(m => dayKey(m.at) !== dayKey(now))) return 'revisited';
  return page.state === 'open' ? 'answered' : page.state;
}

export type Draft = { text: string; voiceId?: string; replyTo?: string; wise?: boolean };
export type Line = { page: Read<Page>; message?: Read<Message>; messages: Read<Message>[] };

/**
 * Writes one line. The first keystroke of a day makes the page (an entry unless `kind` says otherwise)
 * and the message (with `messageId` when the caller chose one); later keystrokes update that message. An emptied line is removed, and the page's tags
 * are read again from every line. A new wise line answers a question (or revisits an entry).
 */
export async function writeLine(
  page: Read<Page> | undefined, messageId: string | undefined, draft: Draft, now = Date.now(),
  opts: { kind?: Page['kind']; linkTo?: string } = {},
): Promise<Line | null> {
  const before = page ? await messagesOf(page.id) : [];
  const existing = messageId ? before.find(m => m.id === messageId) : undefined;
  if (!draft.text && !existing) return page ? { page, messages: before } : null;
  let p: Read<Page> = page ?? newPage(opts.kind ?? 'entry', now);
  const others: Read<Page>[] = [];
  if (!page && opts.linkTo) {
    const other = await store.get('pages', opts.linkTo);
    if (other) {
      p = { ...p, linkedPageIds: [opts.linkTo] };
      others.push({ ...other, linkedPageIds: withId(other.linkedPageIds, p.id), updatedAt: now });
    }
  }
  if (existing && !draft.text) {
    const rest = before.filter(m => m.id !== existing.id);
    p = { ...p, tags: tagsOf(rest), updatedAt: now };
    await store.delete('messages', existing.id);
    await store.put('pages', p);
    return { page: p, messages: rest };
  }
  const last = before[before.length - 1];
  const message: Read<Message> = {
    ...(existing ?? { id: messageId ?? crypto.randomUUID(), pageId: p.id, at: Math.max(now, last ? last.at + 1 : now), kept: false }),
    text: draft.text, voiceId: draft.voiceId, replyTo: draft.replyTo, wise: draft.wise || undefined, updatedAt: now,
  };
  const messages = existing ? before.map(m => (m.id === message.id ? message : m)) : [...before, message];
  let state = p.state;
  if (!existing && draft.wise) {
    if (p.kind === 'question') state = answerState(p, before, now);
    else if (p.kind === 'entry' && p.state === 'open') state = 'revisited';
  }
  p = { ...p, state, tags: tagsOf(messages), updatedAt: now };
  await store.many({ pages: [p, ...others], messages: [message] });
  return { page: p, message, messages };
}

async function putMessage(m: Read<Message>, patch: Partial<Message>, now: number): Promise<Read<Message>> {
  const next = { ...m, ...patch, updatedAt: now };
  await store.put('messages', next);
  return next;
}

/** "Keep close": the line feeds the echo and Still. */
export const setKept = (m: Read<Message>, kept: boolean, now = Date.now()) => putMessage(m, { kept }, now);
/** "Speak as…": the line is reassigned to a voice (undefined = plain ink). */
export const speakAs = (m: Read<Message>, voiceId: string | undefined, now = Date.now()) => putMessage(m, { voiceId }, now);

async function putPage(p: Read<Page>, patch: Partial<Page>, now: number): Promise<Read<Page>> {
  const next = { ...p, ...patch, updatedAt: now };
  await store.put('pages', next);
  return next;
}
export const setMood = (p: Read<Page>, mood: string[], now = Date.now()) => putPage(p, { mood }, now);
export const setEntryState = (p: Read<Page>, s: EntryState, now = Date.now()) => putPage(p, { state: pageStateOf(s) }, now);
export const setTitle = (p: Read<Page>, title: string, now = Date.now()) => putPage(p, { title }, now);

/** "Turn to answer": the entry becomes a question titled by the line; its answer frame opens beneath. */
export async function turnToAnswer(p: Read<Page>, m: Pick<Message, 'text'>, now = Date.now()): Promise<Read<Page>> {
  const answered = (await messagesOf(p.id)).some(x => x.wise && x.text.trim());
  return putPage(p, { kind: 'question', title: firstSentence(m.text), state: answered ? 'answered' : 'open' }, now);
}

/** "Ask a question": one line, and it is the page's title. */
export async function askQuestion(title: string, now = Date.now()): Promise<Read<Page>> {
  const p = newPage('question', now, { title: title.trim() });
  await store.put('pages', p);
  return p;
}

export type LinkKind = 'related' | 'smaller';
/** Links two pages both ways; "smaller" marks a as a smaller version of b. */
export async function linkPages(a: Read<Page>, b: Read<Page>, kind: LinkKind = 'related', now = Date.now()): Promise<[Read<Page>, Read<Page>]> {
  if (a.id === b.id) return [a, b];
  const na: Read<Page> = { ...a, linkedPageIds: withId(a.linkedPageIds, b.id), updatedAt: now };
  if (kind === 'smaller') na.smallerOf = withId(a.smallerOf ?? [], b.id);
  const nb: Read<Page> = { ...b, linkedPageIds: withId(b.linkedPageIds, a.id), updatedAt: now };
  await store.many({ pages: [na, nb] });
  return [na, nb];
}

export type LinkLabel = 'Smaller version of' | 'A smaller version' | 'Related';
export type PageLink = { page: Read<Page>; label: LinkLabel; line: string };

/** The links at the bottom of a page, "Smaller version of…" first. */
export async function linksOf(p: Read<Page>): Promise<PageLink[]> {
  const out: PageLink[] = [];
  for (const id of p.linkedPageIds) {
    const other = await store.get('pages', id);
    if (!other) continue;
    const label: LinkLabel = p.smallerOf?.includes(id) ? 'Smaller version of' : other.smallerOf?.includes(p.id) ? 'A smaller version' : 'Related';
    out.push({ page: other, label, line: firstLine(other, await messagesOf(id)) });
  }
  const rank = { 'Smaller version of': 0, 'A smaller version': 1, Related: 2 } as const;
  return out.sort((x, y) => rank[x.label] - rank[y.label]);
}

/** "Take to the council": a council page linked both ways, its first message copied from the line. */
export async function takeToCouncil(p: Read<Page>, m: Read<Message>, now = Date.now()): Promise<Read<Page>> {
  const council = newPage('council', now, { title: p.kind === 'question' ? p.title : undefined, linkedPageIds: [p.id] });
  const first: Message = { id: crypto.randomUUID(), pageId: council.id, at: now, updatedAt: now, voiceId: m.voiceId, text: m.text, kept: false };
  await store.many({ pages: [council, { ...p, linkedPageIds: withId(p.linkedPageIds, council.id), updatedAt: now }], messages: [first] });
  return council;
}

export type Listed = { page: Read<Page>; no: number; line: string; match?: string };

async function everything(): Promise<{ pages: Read<Page>[]; byPage: Map<string, Read<Message>[]> }> {
  const [pages, messages] = await Promise.all([pagesInOrder(), store.all('messages')]);
  const byPage = new Map<string, Read<Message>[]>();
  for (const m of messages.sort((a, b) => a.at - b.at)) byPage.set(m.pageId, [...(byPage.get(m.pageId) ?? []), m]);
  return { pages, byPage };
}

/** The entries, newest first, each with its first line. A page with nothing written is not listed. */
export async function entries(): Promise<Listed[]> {
  const { pages, byPage } = await everything();
  return pages
    .map((page, i) => ({ page, no: i + 1, line: firstLine(page, byPage.get(page.id) ?? []) }))
    .filter(x => x.page.kind === 'entry' && x.line)
    .reverse();
}

/** Search, in memory over the opened rows: pages whose title or any line contains the text. */
export async function searchPages(q: string): Promise<Listed[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const { pages, byPage } = await everything();
  const out: Listed[] = [];
  pages.forEach((page, i) => {
    const ms = byPage.get(page.id) ?? [];
    const inTitle = !!page.title?.toLowerCase().includes(needle);
    const hit = ms.find(m => m.text.toLowerCase().includes(needle));
    if (inTitle || hit) out.push({ page, no: i + 1, line: firstLine(page, ms), match: !inTitle ? hit?.text : undefined });
  });
  return out.reverse();
}

export type Kept = { message: Read<Message>; page: Read<Page> };

/** Every kept line, oldest first, leaving out one page (today's). */
export async function keptLines(exceptPageId?: string): Promise<Kept[]> {
  const { pages, byPage } = await everything();
  return pages
    .filter(p => p.id !== exceptPageId)
    .flatMap(page => (byPage.get(page.id) ?? []).filter(m => m.kept && m.text.trim()).map(message => ({ message, page })))
    .sort((a, b) => a.message.at - b.message.at);
}

/**
 * The echo for a day: the same line all day once chosen; else the oldest kept line not yet shown,
 * starting over once every line has been shown. Returns the line's id (none when dismissed or nothing is
 * kept) and the state to store.
 */
export function pickEcho(kept: { id: string; at: number }[], state: EchoState | undefined, day: string): { id?: string; state: EchoState } {
  const ids = new Set(kept.map(k => k.id));
  const seen = (state?.seen ?? []).filter(id => ids.has(id));
  if (state && state.day === day && (state.id === undefined ? !kept.length : ids.has(state.id))) {
    return { id: state.dismissed ? undefined : state.id, state: { ...state, seen } };
  }
  const order = [...kept].sort((a, b) => a.at - b.at);
  const fresh = order.filter(k => !seen.includes(k.id));
  const pick = (fresh.length ? fresh : order)[0];
  if (!pick) return { state: { day, seen: [] } };
  return { id: pick.id, state: { day, id: pick.id, seen: [...(fresh.length ? seen : []), pick.id] } };
}

/** Pages to link to, by title or first line; the most recent first. An empty query gives the latest few. */
export async function findPages(q: string, exceptId?: string, limit = 12): Promise<Listed[]> {
  const needle = q.trim().toLowerCase();
  const { pages, byPage } = await everything();
  return pages
    .map((page, i) => ({ page, no: i + 1, line: firstLine(page, byPage.get(page.id) ?? []) }))
    .filter(x => x.page.id !== exceptId && x.line && (!needle || x.line.toLowerCase().includes(needle)))
    .reverse()
    .slice(0, limit);
}

/** Every voice by id, archived ones too, so an old line still reads in its own colour. */
export async function voicesById(): Promise<Map<string, Read<Voice>>> {
  return new Map((await store.all('voices')).map(v => [v.id, v]));
}

/** The chip row: starred voices first, then the rest, each in its order. */
export async function chipVoices(): Promise<Read<Voice>[]> {
  return (await voices()).sort((a, b) => Number(b.starred) - Number(a.starred) || a.order - b.order);
}
