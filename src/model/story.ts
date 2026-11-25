// The story a world is worn in (PLAN-WORLDS.md section 4 and section 5, W4): the year worn, who is alive that year and
// how old, the one open question waiting under a novel's cover, and the chips a page or a kept line is about, all read
// from the pocket the bible sent (src/bridge/protocol.ts NovelPocket, kept on home's row as settings.bridge.pocket) and
// from the world's own notebook. His own pages wear no year and no chips: nothing here acts unless a novel world is
// the one asked about. Nothing here writes a word for him: every name is the bible's, every line his.
import { peek, store, wearYear, worn, type Read } from '../db/fields';
import type { Message, Page, Settings } from '../db/schema';
import type { NovelPocket, PocketCharacter } from '../bridge/protocol';

// ---------------------------------------------------------------- the year worn, stamped on new pages

let held: { world: string; year: number } | undefined;
/** The year a new page or council is stamped with (section 4: "A new page or council takes the year worn"): the year
 *  worn while a novel world is worn, else none. ui/settings.ts notes it whenever the settings row is read or written;
 *  it is kept with the world it was read in, so a world taken off (or another put on) before the row is read again
 *  stamps nothing of the last one's. */
export const yearStamp = (): number | undefined => (held && held.world === worn() ? held.year : undefined);
/** Called with the joined settings row (its year is the notebook worn's own, schema.ts BOOK_KEYS). */
export function noteYearWorn(s: Pick<Settings, 'year'> | undefined): void {
  const w = worn();
  held = w && typeof s?.year === 'number' ? { world: w, year: s.year } : undefined;
}
/** A new page's year fields: { year } in a novel world, nothing anywhere else. */
export const stamped = (): Pick<Page, 'year'> => { const y = yearStamp(); return y === undefined ? {} : { year: y }; };

// ---------------------------------------------------------------- the pocket

/** The pocket kept for a world (home's row keeps the last one fetched, with the world it is for); none for his own
 *  pages, Songbook, another world's pocket, or while locked. */
export function pocketFor(s: Pick<Settings, 'bridge'> | undefined, world: string | null): NovelPocket | undefined {
  const p = s?.bridge?.pocket;
  return world && p?.world === world && p.pocket.kind === 'novel' ? p.pocket : undefined;
}

/** The pocket of the world worn, read from the stored row. */
export async function pocketWorn(): Promise<NovelPocket | undefined> {
  const s = await store.get('settings', 'app');
  return s && !s.locked ? pocketFor(s, worn()) : undefined;
}

/** The bible's timeline from its first year to its last: the pocket's span, else the lives, chapters and events it
 *  holds, else a year either side of the story year. Undefined when the pocket gives no year at all. */
export function spanOf(p: NovelPocket): { from: number; to: number } | undefined {
  if (p.span && p.span.to >= p.span.from) return p.span;
  const ys = [
    ...p.characters.flatMap(c => [c.born, c.died]), ...p.chapters.map(c => c.year), ...p.events.map(e => e.year), p.storyYear,
  ].filter((y): y is number => typeof y === 'number' && Number.isFinite(y));
  if (!ys.length) return undefined;
  const from = Math.min(...ys), to = Math.max(...ys);
  return from === to ? { from: from - 1, to: to + 1 } : { from, to };
}

/** Where the phone's year starts, once (section 4): the bible's story year, else the first year of its span. */
export function startOf(p: NovelPocket): number | undefined {
  return typeof p.storyYear === 'number' ? p.storyYear : spanOf(p)?.from;
}

/** Sets a world's year from its pocket the first time the pocket comes (decision 15: after that the year is the phone's
 *  own, separate from the bible's story year). Returns the year now worn, or undefined. */
export async function startYearOnce(world: string, p: NovelPocket): Promise<number | undefined> {
  const had = await peek(world, r => r.get('settings', 'app'));
  if (!had || had.locked) return undefined;
  if (typeof had.year === 'number') return had.year;
  const y = startOf(p);
  if (y === undefined) return undefined;
  await wearYear(world, y);
  return y;
}

// ---------------------------------------------------------------- lives

export type Life = 'alive' | 'unborn' | 'dead' | 'unknown';

/** Where a character stands in a year: alive (born that year or before, not dead before it), not yet born, already
 *  dead, or unknown when the bible gives no birth year. */
export function lifeOf(c: Pick<PocketCharacter, 'born' | 'died'>, year: number): Life {
  if (typeof c.born !== 'number') return 'unknown';
  if (year < c.born) return 'unborn';
  if (typeof c.died === 'number' && year > c.died) return 'dead';
  return 'alive';
}

/** A character's age in a year, when known and alive. */
export function ageOf(c: Pick<PocketCharacter, 'born' | 'died'>, year: number): number | undefined {
  return lifeOf(c, year) === 'alive' ? year - c.born! : undefined;
}

/** Who is alive in a year and how old, in the pocket's order: "Abbot Ren 55" (the ages under a cover). */
export function aliveIn(p: NovelPocket, year: number): { id: string; name: string; age: number }[] {
  return p.characters.flatMap(c => {
    const age = ageOf(c, year);
    return age === undefined ? [] : [{ id: c.id, name: c.fullName, age }];
  });
}

/** A seat's label at a council in a year (section 4, "Ages at the council"): "Dawn Li, 9"; one already dead "Abbot Ren,
 *  d. 2069"; one not yet born "Mei, b. 2075"; with no birth year, the name alone. A council set in the whole book has
 *  no year, so the names stand alone. */
export function seatLabel(name: string, c: Pick<PocketCharacter, 'born' | 'died'> | undefined, year: number | null | undefined): string {
  if (!c || typeof year !== 'number') return name;
  const life = lifeOf(c, year);
  if (life === 'alive') return `${name}, ${year - c.born!}`;
  if (life === 'dead') return `${name}, d. ${c.died}`;
  if (life === 'unborn') return `${name}, b. ${c.born}`;
  return name;
}

/** The character behind a voice (c:<characterId>, src/bridge/down.ts). */
export const characterOf = (p: NovelPocket | undefined, voiceId: string): PocketCharacter | undefined =>
  voiceId.startsWith('c:') ? p?.characters.find(c => `c:${c.id}` === voiceId) : undefined;

// ---------------------------------------------------------------- names in the text

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whether a name stands in a text as a whole word, as written (case kept: "Dawn" is Dawn Li, "dawn" is the morning). */
function names(text: string, name: string | undefined): boolean {
  const n = name?.trim();
  if (!n) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escape(n)}(?=$|[^\\p{L}\\p{N}])`, 'u').test(text);
}

/** The characters and places a text names, found on the phone from the bible's lists: a character by full name,
 *  first name or Chinese name, a place by its name. In the pocket's order. */
export function namedIn(text: string, p: NovelPocket): { characterIds: string[]; placeIds: string[] } {
  return {
    characterIds: p.characters.filter(c => names(text, c.fullName) || names(text, c.firstName) || names(text, c.chineseName)).map(c => c.id),
    placeIds: p.places.filter(pl => names(text, pl.name)).map(pl => pl.id),
  };
}

export type Chips = { characterIds: string[]; placeIds: string[] };
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

/** A kept line's own chips, filled at the moment of keeping (section 4, "A kept line stands alone"): the page's chips,
 *  plus any character or place the page names in its lines, so "She keeps it for a year" arrives saying Dawn Li. */
export function chipsAtKeeping(page: Pick<Page, 'chips'> | undefined, lines: Pick<Message, 'text'>[], p: NovelPocket): Chips {
  const found = namedIn(lines.map(l => l.text).join('\n'), p);
  return {
    characterIds: union(page?.chips?.characterIds ?? [], found.characterIds),
    placeIds: union(page?.chips?.placeIds ?? [], found.placeIds),
  };
}

/** One chip on or off in a set of chips. */
export function toggleChip(chips: Chips | undefined, kind: 'character' | 'place', id: string): Chips {
  const c = chips ?? { characterIds: [], placeIds: [] };
  const key = kind === 'character' ? 'characterIds' : 'placeIds';
  const has = c[key].includes(id);
  return { ...c, characterIds: [...c.characterIds], placeIds: [...c.placeIds], [key]: has ? c[key].filter(x => x !== id) : [...c[key], id] };
}

// ---------------------------------------------------------------- the waiting question

/** The one open question from the bible waiting under a novel's cover (section 4): the one the bible changed last that
 *  the phone has not answered or resolved, read from that world's notebook whether it is worn or not. */
export async function waitingIn(world: string, p: NovelPocket): Promise<{ id: string; question: string } | undefined> {
  const open = p.questions.filter(q => q.state === 'open').sort((a, b) => b.changedAt - a.changedAt);
  if (!open.length) return undefined;
  const pages = await peek(world, r => Promise.all(open.map(q => r.get('pages', q.id)))) ?? [];
  for (let i = 0; i < open.length; i++) {
    const pg = pages[i] as Read<Page> | undefined;
    if (pg && (pg.kind !== 'question' || pg.state !== 'open')) continue;
    return { id: open[i].id, question: pg && !pg.locked && pg.title ? pg.title : open[i].question };
  }
  return undefined;
}

// ---------------------------------------------------------------- writes: a page's chips and year, a line's chips,
// a council's reading. Each reads the row as stored now and writes it back in the write queue (store.unit).

async function patchPage(pageId: string, change: (p: Page) => Page | undefined, now: number): Promise<Read<Page> | undefined> {
  return store.unit(async u => {
    const p = await u.get('pages', pageId);
    if (!p || p.locked) return p;
    const { locked: _, ...row } = p;
    const next = change(row as Page);
    if (!next) return p;
    const out = { ...next, updatedAt: now };
    await u.put('pages', out);
    return out;
  });
}

/** The Character and Place chips under a journal page (section 4): what the page is about. Optional. */
export const setPageChips = (pageId: string, chips: Chips, now = Date.now()) =>
  patchPage(pageId, p => ({ ...p, chips: { characterIds: [...chips.characterIds], placeIds: [...chips.placeIds] } }), now);

/** The Year chip: this page alone takes another year (null is the whole book, for a council about the story only).
 *  An in-story council always has a year, so null is refused there. */
export const setPageYear = (pageId: string, year: number | null, now = Date.now()) =>
  patchPage(pageId, p => {
    if (year === null && p.kind === 'council' && p.reading === 'in') return undefined;
    return { ...p, year };
  }, now);

/** "About the story" or "In the story" (section 4, "Council"): changeable later, and the bible follows. A council
 *  turned in the story takes the year worn when it was set in the whole book (an in-story council always has a year). */
export const setReading = (pageId: string, reading: 'in' | 'about', now = Date.now()) =>
  patchPage(pageId, p => {
    if (p.kind !== 'council') return undefined;
    const next: Page = { ...p, reading };
    if (reading === 'in' && typeof p.year !== 'number') {
      const y = yearStamp();
      if (y === undefined) return undefined;
      next.year = y;
    }
    return next;
  }, now);

/** The reading a council is in: absent is about (section 9). */
export const readingOf = (p: Pick<Page, 'reading'>): 'in' | 'about' => (p.reading === 'in' ? 'in' : 'about');

/** "Keep close" in a novel world (decision 18): kept, the line takes its own chips at that moment, the page's and any
 *  name the page uses (chipsAtKeeping); a line already carrying chips keeps them (he may have changed them). Elsewhere,
 *  and unkept, only kept changes. */
export async function keepLine(messageId: string, kept: boolean, now = Date.now()): Promise<Read<Message> | undefined> {
  const pocket = kept ? await pocketWorn() : undefined;
  return store.unit(async u => {
    const m = await u.get('messages', messageId);
    if (!m || m.locked) return m;
    const { locked: _, ...row } = m;
    const next: Message = { ...(row as Message), kept, updatedAt: now };
    if (kept && pocket && !m.chips) {
      const page = await u.get('pages', m.pageId);
      if (page && !page.locked && page.kind === 'entry') {
        const lines = await u.query('messages', t => t.where('[pageId+at]').between([m.pageId, -Infinity], [m.pageId, Infinity], true, true));
        next.chips = chipsAtKeeping(page, lines.filter(l => !l.locked), pocket);
      }
    }
    await u.put('messages', next);
    return next;
  });
}

/** A kept line's chips changed on its sheet. */
export async function setLineChips(messageId: string, chips: Chips, now = Date.now()): Promise<Read<Message> | undefined> {
  return store.unit(async u => {
    const m = await u.get('messages', messageId);
    if (!m || m.locked) return m;
    const { locked: _, ...row } = m;
    const next: Message = { ...(row as Message), chips: { characterIds: [...chips.characterIds], placeIds: [...chips.placeIds] }, updatedAt: now };
    await u.put('messages', next);
    return next;
  });
}

/** "Research this" (section 4, "Research"): the question page keeps the inquiry it was researched in (page.asked), as
 *  the inquiry keeps the page (Inquiry.pageId, research/run.ts ask). */
export const linkAsked = (pageId: string, inquiryId: string, now = Date.now()) =>
  patchPage(pageId, p => (p.kind === 'question' ? { ...p, asked: { inquiryId } } : undefined), now);

/** The title of a question page, for Research to carry ("Research this"); undefined for anything else, or locked. */
export async function questionTitle(pageId: string): Promise<string | undefined> {
  const p = await store.get('pages', pageId);
  return p && !p.locked && p.kind === 'question' && p.title?.trim() ? p.title.trim() : undefined;
}

/** The year a world is worn with, moved on its cover's dial or the year sheet (db/fields.ts wearYear). */
export const setWorldYear = (world: string, year: number) => wearYear(world, year);
