// Pages and their messages (PLAN.md section 4). Package 0 needs today's entry, a page by id, the
// questions list and the voices; package 1 grows this into the full Journal (below the line).
import type { EchoState, Message, Page, Voice } from '../db/schema';
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

/** Today's dated entry, its plain-ink message and its number in the sequence ("No."). No. counts entries
 *  only (v2): questions and councils are their own sections, so the numbers no longer jump. */
export async function today(now = new Date()): Promise<Today> {
  const list = (await pagesInOrder()).filter(p => p.kind === 'entry');
  const from = startOfDay(now), to = endOfDay(now);
  const page = [...list].reverse().find(p => p.createdAt >= from && p.createdAt <= to);
  if (!page) return { no: list.length + 1 };
  const message = (await messagesOf(page.id)).find(m => !m.voiceId);
  return { page, message, no: list.indexOf(page) + 1 };
}

/** How many entries there are: a fresh page today (V12, the header's +) is the next number. */
export async function entryCount(): Promise<number> {
  return (await pagesInOrder()).filter(p => p.kind === 'entry').length;
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

/** A page by id with its messages. no is its place among the entries; a question or council has none. */
export async function pageById(id: string): Promise<{ page: Read<Page>; messages: Read<Message>[]; no?: number } | null> {
  const pages = await pagesInOrder();
  const page = pages.find(p => p.id === id);
  if (!page) return null;
  const no = page.kind === 'entry' ? pages.filter(p => p.kind === 'entry').indexOf(page) + 1 : undefined;
  return { page, messages: await messagesOf(id), no };
}

/** Every question, open ones first, then the answered (an older 'revisited' row reads as answered),
 *  newest first within each. This order is the Questions list's and the walk's (Previous, Next). */
export async function questions(): Promise<Read<Page>[]> {
  const qs = await store.query('pages', t => t.where('kind').equals('question'));
  return qs.sort((a, b) => Number(a.state !== 'open') - Number(b.state !== 'open') || b.createdAt - a.createdAt);
}

export type Walk = { at: number; of: number; prev: string; next: string };
/** Where an open question sits among the open ones ("2 of 3 open"), and the ones either side. Next on the
 *  last wraps to the first, Previous on the first to the last. None for an answered question, or when it
 *  is the only open one (there is nowhere to walk). */
export async function walkOf(id: string): Promise<Walk | undefined> {
  const open = (await questions()).filter(q => q.state === 'open');
  const i = open.findIndex(q => q.id === id);
  if (i < 0 || open.length < 2) return undefined;
  const n = open.length;
  return { at: i + 1, of: n, prev: open[(i - 1 + n) % n].id, next: open[(i + 1) % n].id };
}

export async function voices(): Promise<Read<Voice>[]> {
  return (await store.all('voices')).filter(v => !v.archived).sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------------------------------
// Package 1: the Journal. A page is a column of messages; every op below goes through `store`.
// v2 (V1): the entry states and mood words left the UI; page.state is a question's (open, answered).
// ---------------------------------------------------------------------------------------------------

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

/** Today's page carrying a link to what it was written about: page.flow (a flow's Journal helper, F2) or page.sit
 *  (the page after a sit, PLAN-MEDITATE.md S2). A day with no page yet gets an empty one (nothing written: it stays off
 *  every list until a word is, like any fresh page). Not stored: the caller writes it with the row it links, both ways. */
export async function todayLinked(link: Pick<Page, 'flow'> | Pick<Page, 'sit'>, now = Date.now()): Promise<Read<Page>> {
  const t = await today(new Date(now));
  return t.page ? { ...t.page, ...link, updatedAt: now } : newPage('entry', now, link);
}

export type Draft = { text: string; voiceId?: string; replyTo?: string; wise?: boolean };
export type Line = { page: Read<Page>; message?: Read<Message>; messages: Read<Message>[] };

/** A line's text before an edit on a later day than it was written: kept once per day of editing, with
 *  the time it was replaced. The first edit of a later day keeps the text as it stood; edits the same
 *  day after that change only the line. */
export function revise(m: Pick<Message, 'at' | 'text' | 'revisions'>, text: string, now: number): Message['revisions'] {
  const revs = m.revisions;
  if (text === m.text || !m.text.trim() || dayKey(m.at) === dayKey(now)) return revs;
  if (revs?.some(r => dayKey(r.at) === dayKey(now))) return revs;
  return [...(revs ?? []), { at: now, text: m.text }];
}

/**
 * Writes one line. The first keystroke of a day makes the page (an entry unless `kind` says otherwise)
 * and the message (with `messageId` when the caller chose one); later keystrokes update that message.
 * A new line goes at the end of the page, or at `at` when the caller places it between two others
 * (Return in the middle of a page). An emptied line is removed, and the page's tags are read again from
 * every line. An edit on a later day keeps the old text (`revise`). A line's `wise` is carried as the
 * draft says, but writing never marks a question's state (V2): only "This answers it" does (`answerWith`).
 * Emptying a question's last wise line takes the answer back with it, as "Not the answer" would.
 */
export async function writeLine(
  page: Read<Page> | undefined, messageId: string | undefined, draft: Draft, now = Date.now(),
  opts: { kind?: Page['kind']; linkTo?: string; at?: number } = {},
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
    p = { ...p, ...(existing.wise ? reopened(p, rest) : {}), tags: tagsOf(rest), updatedAt: now };
    await store.delete('messages', existing.id);
    await store.put('pages', p);
    return { page: p, messages: rest };
  }
  const last = before[before.length - 1];
  const at = opts.at ?? Math.max(now, last ? last.at + 1 : now);
  const revisions = existing ? revise(existing, draft.text, now) : undefined;
  const message: Read<Message> = {
    ...(existing ?? { id: messageId ?? crypto.randomUUID(), pageId: p.id, at, kept: false }),
    text: draft.text, voiceId: draft.voiceId, replyTo: draft.replyTo, wise: draft.wise || undefined, updatedAt: now,
    ...(revisions ? { revisions } : {}),
  };
  const messages = existing
    ? before.map(m => (m.id === message.id ? message : m))
    : [...before, message].sort((a, b) => a.at - b.at);
  p = { ...p, tags: tagsOf(messages), updatedAt: now };
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
export const setTitle = (p: Read<Page>, title: string, now = Date.now()) => putPage(p, { title }, now);

/** "Ask this": a new question page titled by the line, open, linked both ways with the page the line is
 *  on. The line stays where it was written and the day stays whole; the page shows an "Asked" link. */
export async function askThis(p: Read<Page>, m: Pick<Message, 'text'>, now = Date.now()): Promise<{ question: Read<Page>; page: Read<Page> }> {
  const question = newPage('question', now, { title: firstSentence(m.text), linkedPageIds: [p.id], askedFrom: p.id });
  const page: Read<Page> = { ...p, linkedPageIds: withId(p.linkedPageIds, question.id), updatedAt: now };
  await store.many({ pages: [question, page] });
  return { question, page };
}

/** A question with no wise line left goes back to open; with one, it stays as it is. */
function reopened(p: Read<Page>, rest: Pick<Message, 'wise' | 'text'>[]): Partial<Page> {
  if (p.kind !== 'question' || rest.some(m => m.wise && m.text.trim())) return {};
  return { state: 'open', answeredAt: undefined };
}

/**
 * "This answers it" (V2): the held line turns wise (italic, the wiser second person) and the question
 * moves under Answered with today's date. "Not the answer" (`wise` false) clears the line's wise; once no
 * wise line is left the question is open again. Nothing else marks a question's state.
 */
export async function answerWith(
  q: Read<Page>, m: Read<Message>, wise = true, now = Date.now(),
): Promise<{ page: Read<Page>; message: Read<Message> }> {
  // the line as stored now: a write flushed just before the sheet's tap may have changed its text
  const message: Read<Message> = { ...((await store.get('messages', m.id)) ?? m), wise: wise || undefined, updatedAt: now };
  let page: Read<Page> = { ...q, updatedAt: now };
  if (wise && q.state === 'open') page = { ...page, state: 'answered', answeredAt: now };
  if (!wise) page = { ...page, ...reopened(q, (await messagesOf(q.id)).filter(x => x.id !== m.id)) };
  await store.many({ pages: [page], messages: [message] });
  return { page, message };
}

/** "New question" on the Questions list: one line, and it is the page's title. */
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

/** Asked: a question asked from this page (Ask this). Asked from: the page a question was asked from. */
export type LinkLabel = 'Asked from' | 'Smaller version of' | 'A smaller version' | 'Asked' | 'Related';
export type PageLink = { page: Read<Page>; label: LinkLabel; line: string };

/** The links at the bottom of a page, where a question was asked from first, then "Smaller version of…". */
export async function linksOf(p: Read<Page>): Promise<PageLink[]> {
  const out: PageLink[] = [];
  for (const id of p.linkedPageIds) {
    const other = await store.get('pages', id);
    if (!other) continue;
    const label: LinkLabel = p.askedFrom === id ? 'Asked from'
      : p.smallerOf?.includes(id) ? 'Smaller version of'
      : other.smallerOf?.includes(p.id) ? 'A smaller version'
      : other.askedFrom === p.id ? 'Asked'
      : 'Related';
    out.push({ page: other, label, line: firstLine(other, await messagesOf(id)) });
  }
  const rank = { 'Asked from': 0, 'Smaller version of': 1, 'A smaller version': 2, Asked: 3, Related: 4 } as const;
  return out.sort((x, y) => rank[x.label] - rank[y.label]);
}

/** "Take to the council": a council page linked both ways, the line as its About (V3: the title, shown
 *  above the seats screen "Who sits?" and the conversation). No message is copied: the council opens empty. */
export async function takeToCouncil(p: Read<Page>, m: Read<Message>, now = Date.now()): Promise<Read<Page>> {
  const council = newPage('council', now, { title: m.text.split('\n')[0].trim() || p.title, linkedPageIds: [p.id] });
  await store.many({ pages: [council, { ...p, linkedPageIds: withId(p.linkedPageIds, council.id), updatedAt: now }] });
  return council;
}

export type Listed = { page: Read<Page>; no: number; line: string; match?: string };
/** A row on the Pages screen: an entry or a council, with the voices that spoke on it (first speaking first). */
export type Paged = Listed & { spoke: string[] };

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

/** The Pages screen (v2): entries and councils, newest first, each with its first line and who spoke.
 *  Questions have their own section; a page with nothing written is not listed. */
export async function pagesList(): Promise<Paged[]> {
  const { pages, byPage } = await everything();
  return pages
    .map((page, i) => {
      const ms = byPage.get(page.id) ?? [];
      return { page, no: i + 1, line: firstLine(page, ms), spoke: [...new Set(ms.map(m => m.voiceId).filter((v): v is string => !!v))] };
    })
    .filter(x => (x.page.kind === 'entry' || x.page.kind === 'council') && x.line)
    .reverse();
}

/** The rail of earlier pages above a pulled page (V6): the newest few rows of the Pages screen, the open
 *  page left out. */
export async function earlierPages(exceptId?: string, limit = 6): Promise<Paged[]> {
  return (await pagesList()).filter(x => x.page.id !== exceptId).slice(0, limit);
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
    if (!inTitle && !hit) return;
    const line = firstLine(page, ms);
    // the matching line shows beneath only when it is not the first line already shown (package 8)
    out.push({ page, no: i + 1, line, match: !inTitle && hit && hit.text !== line ? hit.text : undefined });
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
