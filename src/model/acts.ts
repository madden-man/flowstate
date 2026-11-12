// The tasks become the water (PLAN-TASKS.md, T0): what each sign's page can do, and the three things it keeps. Data and
// model only; no UI, no counts (no tally of touches, no streak, nothing totalled: DESIGN.md rule 15).
//
// The API later packages build on:
//   TOUCHES, touchesOf(chakra), touchOf(chakra, id), leadOf(chakra)  the touches of section 2, at most four a sign
//   STARTERS, shelf(chakra), addPick(chakra, pick), movePick(chakra, id, to), removePick(chakra, id)   section 4
//   writeMark(chakra, touch, text, { struck, at }), marksOf(chakra, touch?), stones()                     section 7
//   BASICS, dayOf(t, place), basicsToday(now), setBasic(basic, lit, now)                                  section 7
// A touch says where it lands and what it carries (section 3); the page that acts on it is T2 to T4's. Everything he
// writes is sealed under the PIN (fields.ts); a locked journal reads as empty here, like the mountain's readings.
import type { BasicId, Mark, Millis, OnPick, Place } from '../db/schema';
import { keyState, store } from '../db/fields';
import { PICKS, pickId } from '../db/seed/picks';
import { CHAKRA_IDS, isChakraId, type ChakraId } from './mountain';
import { dayKey } from './pages';
import { sunTimes } from './sun';

// ---- the touches (PLAN-TASKS.md section 2) ----

/** Where a touch happens: in the place, into one of the app's sections, the sea's circles, or out of the app. */
export type TouchKind = 'place' | 'journal' | 'council' | 'be' | 'questions' | 'sea' | 'out';

/** Where a touch lands (section 3). place is the sign's own page; today is today's journal page; kept-page a kept
 *  line's own page; meditate and energize the sea's circles; the rest leave the app. */
export type Lands =
  | 'place' | 'today' | 'kept-page' | 'council' | 'be' | 'questions' | 'meditate' | 'energize'
  | 'messages' | 'phone' | 'calendar' | 'spotify';

/** What a touch carries with it (sections 2 and 3):
 *  lifts: one rule whose words lift off and are not kept (Let go); mark: his line, kept as a mark (Say it here,
 *  Grieve, Feel, Reword); breath: a held thumb (Look far, Hold, Breathe); five: five things he can see; basics: the
 *  day's four; question: his line as a question (Ask, Bring it); first-line: his word as a page's first line (Write
 *  from it); dear: a page that opens on "Dear" (Letter); kept-line: a kept line's page (Kept line); core: Be on "I
 *  determine my core." (Core); value: a held value and who champions it (Stand on); voices: Council with the voice
 *  chips ready (A voice); sentence: his sentence into Messages (Send); person: one person he chose (Call, Reach); time:
 *  one thing with a time (I will); shelf: this sign's shelf (Move); nothing: as the place opens now (Sit, Spark it,
 *  Questions). */
export type Carries =
  | 'lifts' | 'mark' | 'breath' | 'five' | 'basics' | 'question' | 'first-line' | 'dear' | 'kept-line'
  | 'core' | 'value' | 'voices' | 'sentence' | 'person' | 'time' | 'shelf' | 'nothing';

/** One touch on a sign's page. id is unique within its sign; word is the print word beside the stream; lead is the one
 *  drawn in use at rest (one a sign); marks says it writes a mark; door says it shows through the door without the PIN
 *  (section 7: in the place and writing nothing). */
export interface Touch {
  id: string; word: string; kind: TouchKind; lands: Lands; carries: Carries;
  lead: boolean; marks: boolean; door: boolean;
}

const t = (id: string, word: string, kind: TouchKind, lands: Lands, carries: Carries, flags: Partial<Pick<Touch, 'lead' | 'marks' | 'door'>> = {}): Touch =>
  ({ id, word, kind, lands, carries, lead: !!flags.lead, marks: !!flags.marks, door: !!flags.door });

/** Seeded as data, in the order of section 2's columns (in the place, into the app, out of the app). Read through
 *  touchesOf, so a later package can make them editable without changing a caller. */
export const TOUCHES: Readonly<Record<ChakraId, readonly Touch[]>> = {
  crown: [
    t('let-go', 'Let go', 'place', 'place', 'lifts', { lead: true }),
    t('core', 'Core', 'be', 'be', 'core'),
    t('kept-line', 'Kept line', 'journal', 'kept-page', 'kept-line'),
    t('sit', 'Sit', 'sea', 'meditate', 'nothing'),
  ],
  'third-eye': [
    t('look-far', 'Look far', 'place', 'place', 'breath', { lead: true, door: true }),
    t('ask', 'Ask', 'journal', 'today', 'question'),
    t('bring-it', 'Bring it', 'council', 'council', 'question'),
    t('questions', 'Questions', 'questions', 'questions', 'nothing'),
  ],
  throat: [
    t('say-it-here', 'Say it here', 'place', 'place', 'mark', { lead: true, marks: true }),
    t('a-voice', 'A voice', 'council', 'council', 'voices'),
    t('send', 'Send', 'out', 'messages', 'sentence'),
    t('call', 'Call', 'out', 'phone', 'person'),
  ],
  heart: [
    t('grieve', 'Grieve', 'place', 'place', 'mark', { lead: true, marks: true }),
    t('hold', 'Hold', 'place', 'place', 'breath', { door: true }),
    t('letter', 'Letter', 'journal', 'today', 'dear'),
    t('reach', 'Reach', 'out', 'messages', 'person'),
  ],
  'solar-plexus': [
    t('reword', 'Reword', 'place', 'place', 'mark', { lead: true, marks: true }),
    t('stand-on', 'Stand on', 'be', 'be', 'value'),
    t('spark-it', 'Spark it', 'sea', 'energize', 'nothing'),
    t('i-will', 'I will', 'out', 'calendar', 'time'),
  ],
  sacral: [
    t('feel', 'Feel', 'place', 'place', 'mark', { lead: true, marks: true }),
    t('hold', 'Hold', 'place', 'place', 'breath', { door: true }),
    t('write-from-it', 'Write from it', 'journal', 'today', 'first-line'),
    t('move', 'Move', 'out', 'spotify', 'shelf'),
  ],
  root: [
    t('five', 'Five', 'place', 'place', 'five', { lead: true, door: true }),
    t('breathe', 'Breathe', 'place', 'place', 'breath', { door: true }),
    t('basics', 'Basics', 'place', 'place', 'basics'),
    t('reach', 'Reach', 'out', 'messages', 'person'),
  ],
};

/** The sign's touches, in their order. */
export const touchesOf = (chakra: ChakraId): readonly Touch[] => TOUCHES[chakra];

/** The touch with this id on this sign, or undefined. */
export const touchOf = (chakra: ChakraId, id: string): Touch | undefined => TOUCHES[chakra]?.find(x => x.id === id);

/** The sign's lead touch, the one drawn in use at rest. */
export const leadOf = (chakra: ChakraId): Touch => TOUCHES[chakra].find(x => x.lead)!;

// ---- the shelves (PLAN-TASKS.md section 4) ----

/** The starter albums of section 4, three a sign, by their titles in the seed picks (db/seed/picks.ts). Two read longer
 *  there than in the plan: "v2.0 (Deluxe Edition)" and "Celeste (Original Soundtrack)". His to replace. */
export const STARTER_TITLES: Readonly<Record<ChakraId, readonly string[]>> = {
  crown: ['Ágætis byrjun', 'Raising Your Voice... Trying to Stop an Echo', 'Takk...'],
  'third-eye': ['Dive', 'v2.0 (Deluxe Edition)', 'Awake'],
  throat: ['x Infinity', 'The Incredible True Story', 'Professional Rapper'],
  heart: ['Atlas: I', 'Carrie & Lowell', 'Birthplace'],
  'solar-plexus': ['Gossamer', 'Celeste (Original Soundtrack)', 'Through the Deep, Dark Valley'],
  sacral: ['In Between Dreams', 'Bahamas Is Afie', 'The Head and the Heart'],
  root: ['Romantic Piano', 'Solitudes', 'All We Grow'],
};

const seededAlbum = (title: string): OnPick => {
  const p = PICKS.flatMap(s => s.picks).find(x => x.kind === 'album' && x.title === title);
  if (!p) throw new Error(`No seeded album ${title}`);
  return p;
};

/** A sign's starters as picks: the seeded album (its artist and Spotify id), under an id of the sign's own. */
const startersOf = (chakra: ChakraId): OnPick[] =>
  STARTER_TITLES[chakra].map(title => ({ ...seededAlbum(title), id: pickId(chakra, title) }));

export const STARTERS: Readonly<Record<ChakraId, readonly OnPick[]>> =
  Object.fromEntries(CHAKRA_IDS.map(c => [c, startersOf(c)])) as Record<ChakraId, OnPick[]>;

const needSign = (chakra: ChakraId) => { if (!isChakraId(chakra)) throw new Error(`Not a sign: ${String(chakra)}`); };

/** The sign's shelf, in his order: its starters until he first changes it. A locked journal has none to give. */
export async function shelf(chakra: ChakraId): Promise<OnPick[]> {
  needSign(chakra);
  if (keyState() === 'locked') return [];
  const row = await store.get('signShelves', chakra);
  if (!row) return STARTERS[chakra].map(p => ({ ...p }));
  return row.locked ? [] : row.picks;
}

/** Reads, changes and writes one shelf as one unit in the write queue. Refuses while locked (LockedError). */
async function changeShelf(chakra: ChakraId, change: (picks: OnPick[]) => OnPick[], now: Millis): Promise<OnPick[]> {
  needSign(chakra);
  return store.unit(async u => {
    const row = await u.get('signShelves', chakra);
    const picks = change(row ? [...row.picks] : STARTERS[chakra].map(p => ({ ...p })));
    await u.put('signShelves', { id: chakra, picks, updatedAt: now });
    return picks;
  });
}

/** Puts a pick at the end of the shelf. An album already on it (by albumId) or a pick with the same id is not added
 *  twice. A pick with no id gets one. Returns the shelf. */
export async function addPick(chakra: ChakraId, pick: Omit<OnPick, 'id'> & { id?: string }, now: Millis = Date.now()): Promise<OnPick[]> {
  const title = pick.title.trim();
  if (!title) throw new Error('A pick needs a title');
  const next: OnPick = { ...pick, title, id: pick.id ?? crypto.randomUUID() };
  return changeShelf(chakra, picks =>
    picks.some(p => p.id === next.id || (next.albumId && p.albumId === next.albumId)) ? picks : [...picks, next], now);
}

/** Moves a pick to index `to` (clamped), as a drag sets it down. Returns the shelf. */
export function movePick(chakra: ChakraId, id: string, to: number, now: Millis = Date.now()): Promise<OnPick[]> {
  return changeShelf(chakra, picks => {
    const from = picks.findIndex(p => p.id === id);
    if (from < 0) return picks;
    const [p] = picks.splice(from, 1);
    picks.splice(Math.max(0, Math.min(picks.length, Math.trunc(Number.isFinite(to) ? to : picks.length))), 0, p);
    return picks;
  }, now);
}

/** Takes a pick off the shelf (dragged off it). A shelf emptied stays empty. Returns the shelf. */
export function removePick(chakra: ChakraId, id: string, now: Millis = Date.now()): Promise<OnPick[]> {
  return changeShelf(chakra, picks => picks.filter(p => p.id !== id), now);
}

// ---- the marks (PLAN-TASKS.md section 7) ----

/** Writes one line on the water at a touch that keeps one (marks: true); never edited. struck is the line a touch
 *  strikes (Reword's verdict, the deed in text). Throws on a touch that keeps nothing (Crown's Let go among them), on
 *  an empty line, and with LockedError on a locked journal. */
export async function writeMark(chakra: ChakraId, touch: string, text: string, opts: { struck?: string; at?: Millis } = {}): Promise<Mark> {
  needSign(chakra);
  const tc = touchOf(chakra, touch);
  if (!tc) throw new Error(`No touch ${touch} on ${chakra}`);
  if (!tc.marks) throw new Error(`${tc.word} keeps nothing`);
  const line = text.trim();
  if (!line) throw new Error('A mark needs words');
  const mark: Mark = { id: crypto.randomUUID(), chakra, touch, text: line, at: opts.at ?? Date.now() };
  const struck = opts.struck?.trim();
  if (struck) mark.struck = struck;
  await store.put('marks', mark);
  return mark;
}

/** The sign's marks, oldest first, at one touch or all of them. A locked journal has none to give. */
export async function marksOf(chakra: ChakraId, touch?: string): Promise<Mark[]> {
  needSign(chakra);
  if (keyState() === 'locked') return [];
  const rows = await store.query('marks', tb => tb.where('[chakra+at]').between([chakra, -Infinity], [chakra, Infinity]));
  return rows.filter(r => !r.locked && (touch === undefined || r.touch === touch));
}

/** Heart's stones: each name he grieved on the tarn, oldest first. They sink and stay. */
export const stones = (): Promise<Mark[]> => marksOf('heart', 'grieve');

// ---- Root's basics (PLAN-TASKS.md section 2 and 7) ----

/** The four lanterns in the firs, in their order, with their print words. */
export const BASICS: readonly { id: BasicId; word: string }[] = [
  { id: 'ate', word: 'ate' }, { id: 'slept', word: 'slept' }, { id: 'water', word: 'water' }, { id: 'outside', word: 'outside' },
];
const isBasic = (x: unknown): x is BasicId => BASICS.some(b => b.id === x);

/** The day a time falls in, running sunrise to sunrise at his place (07:00 with none, as the sky does): "YYYY-MM-DD"
 *  of the sunrise it began at. Before today's sunrise it is still yesterday. */
export function dayOf(t: Millis, place?: Place | null): string {
  const { rise } = sunTimes(new Date(t), place);
  if (t >= rise) return dayKey(t);
  const d = new Date(t);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

const placeNow = async () => (await store.get('settings', 'app'))?.place ?? null;

/** Today's lit basics, in BASICS order; none once the sun has risen on a new day. A locked journal has none to give. */
export async function basicsToday(now: Millis = Date.now()): Promise<BasicId[]> {
  if (keyState() === 'locked') return [];
  const row = await store.get('days', dayOf(now, await placeNow()));
  return row && !row.locked ? BASICS.map(b => b.id).filter(id => row.basics.includes(id)) : [];
}

/** Lights or puts out one of today's basics, and takes away earlier days' rows (gone at sunrise). Returns today's lit
 *  basics. Refuses while locked (LockedError). */
export async function setBasic(basic: BasicId, lit: boolean, now: Millis = Date.now()): Promise<BasicId[]> {
  if (!isBasic(basic)) throw new Error(`Not a basic: ${String(basic)}`);
  const id = dayOf(now, await placeNow());
  const out = await store.unit(async u => {
    const row = await u.get('days', id);
    const have = new Set(row && !row.locked ? row.basics : []);
    if (lit) have.add(basic); else have.delete(basic);
    const basics = BASICS.map(b => b.id).filter(b => have.has(b));
    await u.put('days', { id, basics, updatedAt: now });
    return basics;
  });
  const earlier = (await store.all('days')).map(d => d.id).filter(d => d !== id);
  if (earlier.length) await store.bulkDelete('days', earlier);
  return out;
}
