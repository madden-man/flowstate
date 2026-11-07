// Council pages and the voices who speak on them (PLAN.md section 4 "Voices are mutable, always",
// section 5 item 2). Every read and write goes through store, so sealing works; the UI never touches
// a table. Nothing here writes a word for anyone: names in MORE_VOICES are labels to pick from.
import type { Message, Page, Voice, VoiceColour } from '../db/schema';
import { store, type Read } from '../db/fields';
import { messagesOf } from './pages';

const startOfDay = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);
const uid = () => crypto.randomUUID();

// ---------------------------------------------------------------- council pages

export type CouncilRow = { page: Read<Page>; spoke: string[]; firstLine: string };

/** Council pages newest first, each with the voices that spoke on it in order of first speaking. */
export async function councilPages(): Promise<CouncilRow[]> {
  const pages = await store.query('pages', t => t.where('kind').equals('council'));
  pages.sort((a, b) => b.createdAt - a.createdAt);
  return Promise.all(pages.map(async page => {
    const ms = await messagesOf(page.id);
    return { page, spoke: spokeOn(ms), firstLine: firstLine(ms[0]?.text ?? '') };
  }));
}

export const spokeOn = (ms: Pick<Message, 'voiceId'>[]): string[] => [...new Set(ms.map(m => m.voiceId).filter((v): v is string => !!v))];
export const firstLine = (text: string): string => text.split('\n')[0].trim();

/** Today's council page, if one was opened today. */
export async function councilToday(now = Date.now()): Promise<Read<Page> | undefined> {
  return (await councilPages()).find(r => sameDay(r.page.createdAt, now))?.page;
}

/** A new council page. linkedPageIds points at the question it was opened from, if any (both ways). */
export async function newCouncil(opts: { now?: number; linkedPageIds?: string[] } = {}): Promise<Page> {
  const now = opts.now ?? Date.now();
  const page: Page = {
    id: uid(), kind: 'council', createdAt: now, updatedAt: now, state: 'open',
    tags: [], paradoxIds: [], linkedPageIds: [...(opts.linkedPageIds ?? [])],
  };
  const others = (await Promise.all(page.linkedPageIds.map(id => store.get('pages', id)))).filter((p): p is Read<Page> => !!p && !p.locked);
  await store.many({ pages: [page, ...others.map(o => withLink(o, page.id, now))] });
  return page;
}

const withLink = (p: Page, other: string, now: number): Page =>
  p.linkedPageIds.includes(other) ? p : { ...p, linkedPageIds: [...p.linkedPageIds, other], updatedAt: now };

/** Links two pages both ways (a council and a question, say). Linking twice changes nothing. */
export async function linkPages(aId: string, bId: string, now = Date.now()): Promise<void> {
  if (aId === bId) return;
  const [a, b] = await Promise.all([store.get('pages', aId), store.get('pages', bId)]);
  if (!a || !b) throw new Error('No such page');
  await store.many({ pages: [withLink(a, bId, now), withLink(b, aId, now)] });
}

export type Linked = { id: string; kind: Page['kind']; label: string };

/** What a page is called in a link: its title (a question), or its first line. */
async function labelOf(p: Read<Page>): Promise<string> {
  if (p.title) return p.title;
  const ms = await messagesOf(p.id);
  return firstLine(ms.find(m => m.text.trim())?.text ?? '');
}

export async function linkedPages(page: Page): Promise<Linked[]> {
  const ps = await Promise.all(page.linkedPageIds.map(id => store.get('pages', id)));
  return Promise.all(ps.filter((p): p is Read<Page> => !!p).map(async p => ({ id: p.id, kind: p.kind, label: await labelOf(p) })));
}

/** Pages to link from a council's long-press sheet: search by title or first line, questions first. */
export async function linkCandidates(query: string, fromId: string): Promise<Linked[]> {
  const q = query.trim().toLowerCase();
  const from = await store.get('pages', fromId);
  const pages = (await store.all('pages')).filter(p => p.id !== fromId && p.kind !== 'council' && !from?.linkedPageIds.includes(p.id));
  const rows = await Promise.all(pages.map(async p => ({ id: p.id, kind: p.kind, label: await labelOf(p), at: p.createdAt })));
  return rows
    .filter(r => r.label && (!q || r.label.toLowerCase().includes(q)))
    .sort((a, b) => Number(a.kind !== 'question') - Number(b.kind !== 'question') || b.at - a.at)
    .map(({ id, kind, label }) => ({ id, kind, label }));
}

export type CouncilPage = { page: Read<Page>; messages: Read<Message>[]; linked: Linked[] };

export async function councilById(id: string): Promise<CouncilPage | null> {
  const page = await store.get('pages', id);
  if (!page || page.kind !== 'council') return null;
  return { page, messages: await messagesOf(id), linked: await linkedPages(page) };
}

// ---------------------------------------------------------------- messages

/** A line spoken on a page: by a voice, or plain ink when voiceId is undefined. */
export async function speak(pageId: string, text: string, opts: { voiceId?: string; replyTo?: string; now?: number } = {}): Promise<Message> {
  const now = opts.now ?? Date.now();
  const page = await store.get('pages', pageId);
  if (!page) throw new Error('No such page');
  const last = (await messagesOf(pageId)).at(-1);
  // at orders the page; two lines in the same millisecond still keep their order
  const at = last && last.at >= now ? last.at + 1 : now;
  const message: Message = { id: uid(), pageId, at, updatedAt: now, text, kept: false };
  if (opts.voiceId) message.voiceId = opts.voiceId;
  if (opts.replyTo) message.replyTo = opts.replyTo;
  await store.many({ pages: [{ ...page, updatedAt: now }], messages: [message] });
  return message;
}

export const reply = (pageId: string, to: string, text: string, opts: { voiceId?: string; now?: number } = {}) =>
  speak(pageId, text, { ...opts, replyTo: to });

/** Moves a message to index `to` on its page. The page's moments are kept and handed out in the new order. */
export async function reorderMessage(pageId: string, messageId: string, to: number, now = Date.now()): Promise<Read<Message>[]> {
  const ms = await messagesOf(pageId);
  const from = ms.findIndex(m => m.id === messageId);
  if (from < 0) throw new Error('No such message');
  const ats = ms.map(m => m.at);
  const next = [...ms];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
  const changed = next.map((m, i) => ({ ...m, at: ats[i] })).filter((m, i) => m.id !== ms[i].id).map(m => ({ ...m, updatedAt: now }));
  if (changed.length) await store.bulkPut('messages', changed);
  return messagesOf(pageId);
}

export async function keepClose(messageId: string, kept = true, now = Date.now()): Promise<void> {
  const m = await store.get('messages', messageId);
  if (!m) throw new Error('No such message');
  await store.put('messages', { ...m, kept, updatedAt: now });
}

/** True when message i is the first of a run by one speaker, so its voice name is printed above it. */
export const startsRun = (ms: Pick<Message, 'voiceId'>[], i: number): boolean => i === 0 || ms[i - 1].voiceId !== ms[i].voiceId;

// ---------------------------------------------------------------- speaker selection

/** The chip row: starred voices first, then the rest, in their order; archived voices leave it,
 *  and in Still so do the deep twins. Plain ink (the first chip, "Ink") and "+ voice" are the UI's. */
export function chipVoices<V extends Voice>(vs: V[], still = false): V[] {
  return vs
    .filter(v => !v.archived && !(still && v.shade === 'deep'))
    .sort((a, b) => Number(b.starred) - Number(a.starred) || a.order - b.order);
}

/** Who speaks next: the chip that was tapped, while it is still in the row; otherwise plain ink. */
export function nextSpeaker(selected: string | undefined, vs: Voice[], still = false): string | undefined {
  return selected && chipVoices(vs, still).some(v => v.id === selected) ? selected : undefined;
}

/** The lamp takes the colour of the last voice that spoke (plain ink lights nothing). */
export function lastSpeaker<V extends Voice>(ms: Pick<Message, 'voiceId'>[], vs: V[]): V | undefined {
  for (let i = ms.length - 1; i >= 0; i--) {
    const v = ms[i].voiceId && vs.find(x => x.id === ms[i].voiceId);
    if (v) return v;
  }
  return undefined;
}

// ---------------------------------------------------------------- voices

export async function allVoices(): Promise<Read<Voice>[]> {
  return (await store.all('voices')).sort((a, b) => a.order - b.order);
}

export type VoiceDraft = { name: string; aka?: string[]; colour: VoiceColour; shade: 'light' | 'deep'; twinId?: string; starred?: boolean };

/** "a, b , c" to ['a', 'b', 'c']. */
export const akaWords = (s: string): string[] => s.split(',').map(w => w.trim()).filter(Boolean);

export async function addVoice(d: VoiceDraft): Promise<Voice> {
  const name = d.name.trim();
  if (!name) throw new Error('A voice needs a name');
  const vs = await allVoices();
  const voice: Voice = {
    id: uid(), name, aka: d.aka ?? [], colour: d.colour, shade: d.shade, starred: !!d.starred,
    order: vs.reduce((m, v) => Math.max(m, v.order), -1) + 1, archived: false, revisions: [],
  };
  await store.put('voices', voice);
  if (d.twinId) await setTwin(voice.id, d.twinId);
  return (await store.get('voices', voice.id))!;
}

const sameColour = (a: VoiceColour, b: VoiceColour) => a.hue === b.hue && (a.chroma ?? 1) === (b.chroma ?? 1);
const sameAka = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => w === b[i]);

/** Renames or recolours. The old name, aka and colour go onto revisions first, so old pages still read
 *  and the struck-through names stay visible. An edit that changes nothing pushes nothing. */
export async function editVoice(id: string, patch: { name?: string; aka?: string[]; colour?: VoiceColour; shade?: 'light' | 'deep' }, now = Date.now()): Promise<Voice> {
  const v = await store.get('voices', id);
  if (!v) throw new Error('No such voice');
  const name = patch.name?.trim() || v.name;
  const aka = patch.aka ?? v.aka;
  const colour = patch.colour ?? v.colour;
  const shade = patch.shade ?? v.shade;
  const changed = name !== v.name || !sameAka(aka, v.aka) || !sameColour(colour, v.colour);
  const next: Voice = {
    ...v, name, aka, colour, shade,
    revisions: changed ? [...v.revisions, { at: now, name: v.name, aka: v.aka, colour: v.colour }] : v.revisions,
  };
  await store.put('voices', next);
  // a twin of the same shade is no twin: changing shade lets go of it
  if (shade !== v.shade && v.twinId) await setTwin(id, null);
  return (await store.get('voices', id))!;
}

/** Pairs a light voice with a deep one (both ways), letting go of any earlier partners. null unpairs. */
export async function setTwin(id: string, twinId: string | null): Promise<void> {
  const vs = await allVoices();
  const v = vs.find(x => x.id === id);
  if (!v) throw new Error('No such voice');
  const t = twinId ? vs.find(x => x.id === twinId) : undefined;
  if (twinId && !t) throw new Error('No such voice');
  if (t && t.shade === v.shade) throw new Error('A twin is the other shade');
  const loosen = (x: Voice): Voice => { const { twinId: _, ...rest } = x; return rest; };
  const touched = new Map<string, Voice>();
  const put = (x: Voice) => touched.set(x.id, x);
  for (const x of [v, t]) {
    if (!x?.twinId) continue;
    const old = vs.find(o => o.id === x.twinId);
    if (old && old.twinId === x.id) put(loosen(old));
  }
  if (t) {
    put({ ...v, twinId: t.id });
    put({ ...(touched.get(t.id) ?? t), twinId: v.id });
  } else put(loosen(v));
  await store.bulkPut('voices', [...touched.values()]);
}

export async function starVoice(id: string, starred: boolean): Promise<void> {
  const v = await store.get('voices', id);
  if (!v) throw new Error('No such voice');
  await store.put('voices', { ...v, starred });
}

/** Archived voices keep their messages and colour; they only leave the chip row. */
export async function archiveVoice(id: string, archived = true): Promise<void> {
  const v = await store.get('voices', id);
  if (!v) throw new Error('No such voice');
  await store.put('voices', { ...v, archived });
}
export const restoreVoice = (id: string) => archiveVoice(id, false);

/** Puts the ids in this order and numbers every voice again; voices not named keep their place after them. */
export async function orderVoices(ids: string[]): Promise<void> {
  const vs = await allVoices();
  const named = ids.map(id => vs.find(v => v.id === id)).filter((v): v is Read<Voice> => !!v);
  const rest = vs.filter(v => !ids.includes(v.id));
  await store.bulkPut('voices', [...named, ...rest].map((v, i) => ({ ...v, order: i })));
}

/** Groups for the Voices screen: each light voice with its deep twin beside it, a lone deep voice on its own. */
export type VoiceGroup<V extends Voice = Voice> = { light?: V; deep?: V };
export function voiceGroups<V extends Voice>(vs: V[]): VoiceGroup<V>[] {
  const sorted = [...vs].sort((a, b) => a.order - b.order);
  const seen = new Set<string>();
  const groups: VoiceGroup<V>[] = [];
  for (const v of sorted) {
    if (seen.has(v.id)) continue;
    const t = v.twinId ? sorted.find(x => x.id === v.twinId && x.twinId === v.id && x.archived === v.archived) : undefined;
    seen.add(v.id);
    if (t) seen.add(t.id);
    groups.push(v.shade === 'light' ? { light: v, deep: t } : { light: t, deep: v });
  }
  return groups;
}

/** Moves the group holding `id` to group index `to`, and writes the order that follows. */
export async function moveGroup(id: string, to: number): Promise<void> {
  const groups = voiceGroups((await allVoices()).filter(v => !v.archived));
  const from = groups.findIndex(g => g.light?.id === id || g.deep?.id === id);
  if (from < 0) return;
  const [g] = groups.splice(from, 1);
  groups.splice(Math.max(0, Math.min(groups.length, to)), 0, g);
  await orderVoices(groups.flatMap(x => [x.light, x.deep].filter((v): v is Voice => !!v).map(v => v.id)));
}

// ---------------------------------------------------------------- hues

/** Degrees between two hues around the wheel, 0 to 180. */
export const hueDistance = (a: number, b: number): number => { const d = Math.abs((((a - b) % 360) + 360) % 360); return d > 180 ? 360 - d : d; };
export const CLOSE_DEG = 20;

const HUE_WORDS: [number, string][] = [[25, 'red'], [55, 'orange'], [95, 'yellow'], [150, 'green'], [200, 'teal'], [250, 'blue'], [280, 'indigo'], [305, 'purple'], [350, 'pink']];

/** The colour's everyday word: "blue", "brown" (the Engineer's muted orange), "black". */
export function hueWord(c: VoiceColour): string {
  if (c.hue === null) return 'black';
  if ((c.chroma ?? 1) < 0.8 && hueDistance(c.hue, 60) < 30) return 'brown';
  return HUE_WORDS.reduce((best, w) => (hueDistance(c.hue!, w[0]) < hueDistance(c.hue!, best[0]) ? w : best))[1];
}

/** The nearest active voice whose hue sits within CLOSE_DEG of this one, so bubbles stay tellable apart.
 *  The voice itself and its chosen twin are never a clash; light voices are named before deep ones. */
export function closeVoice<V extends Voice>(hue: number, vs: V[], except: (string | undefined)[] = []): V | undefined {
  let best: V | undefined;
  for (const v of vs) {
    if (v.archived || v.colour.hue === null || except.includes(v.id)) continue;
    const d = hueDistance(hue, v.colour.hue);
    if (d >= CLOSE_DEG) continue;
    if (!best || d < hueDistance(hue, best.colour.hue!) || (d === hueDistance(hue, best.colour.hue!) && v.shade === 'light' && best.shade === 'deep')) best = v;
  }
  return best;
}

/** "close to the Mystic's blue", or null when the hue is clear of every active voice. */
export function closeWarning(hue: number, vs: Voice[], except: (string | undefined)[] = []): string | null {
  const v = closeVoice(hue, vs, except);
  return v ? `Close to the ${v.name}'s ${hueWord(v.colour)}` : null;
}

/** A hue for a new voice: the one asked for when it is clear, else the nearest clear hue to it, else
 *  (no preference, or nothing clear) the middle of the widest gap between the active voices. */
export function suggestHue(vs: Voice[], preferred?: number): number {
  if (preferred !== undefined) {
    for (let d = 0; d <= 180; d++) {
      for (const h of [preferred + d, preferred - d]) {
        const n = ((h % 360) + 360) % 360;
        if (!closeVoice(n, vs)) return n;
      }
    }
  }
  const hues = [...new Set(vs.filter(v => !v.archived && v.colour.hue !== null).map(v => v.colour.hue!))].sort((a, b) => a - b);
  if (!hues.length) return preferred ?? 250;
  let gap = -1, at = 0;
  hues.forEach((h, i) => {
    const next = i + 1 < hues.length ? hues[i + 1] : hues[0] + 360;
    if (next - h > gap) { gap = next - h; at = h + (next - h) / 2; }
  });
  return Math.round(at) % 360;
}

// ---------------------------------------------------------------- more voices

/** Jung's named figures and the familiar twelve, offered as one-tap additions in the Voices screen.
 *  None is active until added; each carries a suggested hue. */
export const MORE_VOICES: { name: string; aka: string[]; hue: number; from: 'jung' | 'twelve' }[] = [
  { name: 'Self', aka: [], hue: 85, from: 'jung' },
  { name: 'Shadow', aka: [], hue: 280, from: 'jung' },
  { name: 'Persona', aka: ['Mask'], hue: 330, from: 'jung' },
  { name: 'Anima/Animus', aka: [], hue: 340, from: 'jung' },
  { name: 'Wise Old One', aka: [], hue: 200, from: 'jung' },
  { name: 'Child', aka: [], hue: 110, from: 'jung' },
  { name: 'Trickster', aka: [], hue: 75, from: 'jung' },
  { name: 'Innocent', aka: [], hue: 105, from: 'twelve' },
  { name: 'Everyman', aka: ['Orphan'], hue: 70, from: 'twelve' },
  { name: 'Hero', aka: [], hue: 15, from: 'twelve' },
  { name: 'Caregiver', aka: [], hue: 165, from: 'twelve' },
  { name: 'Explorer', aka: [], hue: 55, from: 'twelve' },
  { name: 'Rebel', aka: ['Outlaw'], hue: 5, from: 'twelve' },
  { name: 'Lover', aka: [], hue: 0, from: 'twelve' },
  { name: 'Creator', aka: [], hue: 180, from: 'twelve' },
  { name: 'Jester', aka: [], hue: 90, from: 'twelve' },
  { name: 'Sage', aka: [], hue: 215, from: 'twelve' },
  { name: 'Magician', aka: [], hue: 290, from: 'twelve' },
  { name: 'Ruler', aka: [], hue: 130, from: 'twelve' },
];

/** The figures not yet in the pantheon (by name, archived voices included). */
export function moreVoices(vs: Voice[]): typeof MORE_VOICES {
  const have = new Set(vs.flatMap(v => [v.name, ...v.aka]).map(n => n.toLowerCase()));
  return MORE_VOICES.filter(m => !have.has(m.name.toLowerCase()));
}

/** One tap: the figure joins as a light voice, on its suggested hue or the nearest clear one. */
export async function addFigure(name: string): Promise<Voice> {
  const m = MORE_VOICES.find(x => x.name === name);
  if (!m) throw new Error('No such figure');
  const vs = await allVoices();
  return addVoice({ name: m.name, aka: m.aka, colour: { hue: suggestHue(vs, m.hue) }, shade: 'light' });
}
