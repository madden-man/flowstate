// The tasks become the water (PLAN-TASKS.md, T0): what each sign's page can do, and the three things it keeps. Data and
// model only; no UI, no counts (no tally of touches, no streak, nothing totalled: DESIGN.md rule 15).
//
// The API later packages build on:
//   TOUCHES, touchesOf(chakra), touchOf(chakra, id), leadOf(chakra)  the touches of section 2, at most four a sign
//   STARTERS, shelf(chakra), addPick(chakra, pick), movePick(chakra, id, to), removePick(chakra, id)   section 4
//   STARTER_ASKS, asksOf(chakra), setAsk(chakra, i, text)        the three questions under the shelf (2026-11-17)
//   STARTER_DECK, starterAskId(chakra, i), deckOf(chakra), resolveAsk(chakra, id, on), setDeck(chakra, texts)
//                                                                 the deck the three are drawn from (PLAN-BLOCKERS.md, K0)
//   lineOf(chakra), setLine(chakra, text)                          the sign's italic line (PLAN-SIGN-LINES.md, L1)
//   writeMark(chakra, touch, text, { struck, at }), marksOf(chakra, touch?), stones()                     section 7
//   BASICS, dayOf(t, place), basicsToday(now), setBasic(basic, lit, now)                                  section 7
// A touch says where it lands and what it carries (section 3); the page that acts on it is T2 to T4's. Everything he
// writes is sealed under the PIN (fields.ts); a locked journal reads as empty here, like the mountain's readings.
import type { BasicId, DeckAsk, Mark, Millis, OnPick, Place, SignShelf } from '../db/schema';
import { keyState, store } from '../db/fields';
import { PICKS, pickId } from '../db/seed/picks';
import { CHAKRA_IDS, chakraOf, isChakraId, type ChakraId } from './mountain';
import { dayKey } from './pages';
import { oneLine } from './into';
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

/** The starter albums of section 4, five a sign: the plan's three first, in its order, then two more (PLAN-TASKS.md
 *  section 4; Tommy, 2026-11-17: "five albums on each flow"). By title, found in the seed picks (db/seed/picks.ts) or,
 *  for one not seeded there, in the starter albums below. Two read longer there than in the plan: "v2.0 (Deluxe
 *  Edition)" and "Celeste (Original Soundtrack)". His to replace. */
export const STARTER_TITLES: Readonly<Record<ChakraId, readonly string[]>> = {
  crown: ['Ágætis byrjun', 'Raising Your Voice... Trying to Stop an Echo', 'Takk...', 'Nocturnes', 'Ma Fleur'],
  'third-eye': ['Dive', 'v2.0 (Deluxe Edition)', 'Awake', 'Knee-Deep In the North Sea', 'In a Safe Place'],
  throat: ['x Infinity', 'The Incredible True Story', 'Professional Rapper', 'Alfredo 2', 'Lahai'],
  heart: ['Atlas: I', 'Carrie & Lowell', 'Birthplace', 'Bon Iver, Bon Iver', 'Hundred Acres'],
  'solar-plexus': ['Gossamer', 'Celeste (Original Soundtrack)', 'Through the Deep, Dark Valley', 'Strange Trails', 'Funeral'],
  sacral: ['In Between Dreams', 'Bahamas Is Afie', 'The Head and the Heart', 'Lonesome Dreams', 'My Head Is An Animal (The Cabin Sessions)'],
  root: ['Romantic Piano', 'Solitudes', 'All We Grow', 'Mia Gargaret', 'Around the Well'],
};

/** Starters that are not seed picks: albums from his own Poems playlist ("For the Poems and the Prose; May They Dance
 *  Forever"), each with its artist and Spotify album id, read from the playlist on 2026-11-17 and checked against
 *  Spotify's own title for the id. test/fixtures/picks-titles.json lists them under "starters". */
export const STARTER_ALBUMS: readonly { by: string; title: string; albumId: string }[] = [
  { by: 'The Cinematic Orchestra', title: 'Ma Fleur', albumId: '5VrMypyjjBGzObGwnEHIJO' },
  { by: 'Portico Quartet', title: 'Knee-Deep In the North Sea', albumId: '2A8c5znvmslp2I77dTBV1K' },
  { by: 'The Album Leaf', title: 'In a Safe Place', albumId: '1sZjWlyc9yL13U5q1nTQ8a' },
  { by: 'Freddie Gibbs', title: 'Alfredo 2', albumId: '5WrpCQmbTUZuzNxGCPUFSV' },
  { by: 'Sampha', title: 'Lahai', albumId: '5GuWww4OaildzkmTTlfMN3' },
  { by: 'Arcade Fire', title: 'Funeral', albumId: '6ZB8qaR9JNuS0Q0bG1nbcH' },
  { by: 'Gia Margaret', title: 'Mia Gargaret', albumId: '0NZqwH80237QvwcJDlOia7' },
  { by: 'Iron & Wine', title: 'Around the Well', albumId: '5tOzXq44rU4yCCVY94f6m7' },
];

const starterAlbum = (title: string): OnPick => {
  const p = PICKS.flatMap(s => s.picks).find(x => x.kind === 'album' && x.title === title);
  if (p) return p;
  const a = STARTER_ALBUMS.find(x => x.title === title);
  if (!a) throw new Error(`No starter album ${title}`);
  return { id: '', kind: 'album', title: a.title, by: a.by, albumId: a.albumId };
};

/** A sign's starters as picks: the album (its artist and Spotify id), under an id of the sign's own. */
const startersOf = (chakra: ChakraId): OnPick[] =>
  STARTER_TITLES[chakra].map(title => ({ ...starterAlbum(title), id: pickId(chakra, title) }));

export const STARTERS: Readonly<Record<ChakraId, readonly OnPick[]>> =
  Object.fromEntries(CHAKRA_IDS.map(c => [c, startersOf(c)])) as Record<ChakraId, OnPick[]>;

const needSign = (chakra: ChakraId) => { if (!isChakraId(chakra)) throw new Error(`Not a sign: ${String(chakra)}`); };

/** The sign's shelf, in his order: its starters until he first changes it. A shelf he has changed (it has a row) is
 *  read as he left it, whatever the starters are now: a starter added later never tops it up. A locked journal has
 *  none to give. */
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
    // the row's questions go on as they were (they share the row, and its seal)
    await u.put('signShelves', { id: chakra, picks, updatedAt: now, ...kept(row) });
    return picks;
  });
}

/** The words a shelf row carries besides its picks (asks, deck, and the sign's line, L1), so a write to one part of the
 *  row keeps the rest as it was. */
const kept = (row: Pick<SignShelf, 'asks' | 'deck' | 'line'> | undefined): Pick<SignShelf, 'asks' | 'deck' | 'line'> =>
  ({ ...(row?.asks ? { asks: row.asks } : {}), ...(row?.deck ? { deck: row.deck } : {}), ...(row?.line ? { line: row.line } : {}) });

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

// ---- the asks: three questions under a sign's shelf (Tommy, 2026-11-17) ----
// "Ask three questions below to prompt journaling. When one is clicked, it opens the journal." The starters are
// Tommy's to rewrite, written as he asked for them; a tap carries one into today's page (into.ts askInJournal). They
// are kept on the sign's shelf row (SignShelf.asks), sealed with its picks: once rewritten they are his words.

/** The three questions a sign's page asks until he rewrites them. */
export const STARTER_ASKS: Readonly<Record<ChakraId, readonly [string, string, string]>> = {
  crown: ['What are you holding that is not yours to carry?', 'What would tonight be like if this were already settled?', 'What can wait until morning?'],
  'third-eye': ['What do you actually know, and what are you guessing?', 'What would you tell a friend who saw it this way?', 'What is the question under this one?'],
  throat: ['What did you not say?', 'Who needs to hear it, and in what words?', 'What do you want them to understand?'],
  heart: ['Who are you missing?', 'What is heavy today?', 'What was good, even a little?'],
  'solar-plexus': ['What did you do today that you would not take back?', 'Whose voice is saying you are not enough?', 'What is one thing you will do next?'],
  sacral: ['What are you feeling, in the body, right now?', 'What did you want today?', 'What have you been avoiding feeling?'],
  root: ['What is true right here, in this room?', 'What do you need in the next hour?', 'What has held before when it felt like this?'],
};

// ---- the question that always shows (PLAN-SIGN-LINES.md section 5, L2) ----
// One a sign, first in its questions: a small thing to do with the body or the room, then a question whose answer is in
// front of him. Fixed print, the same on every phone: not stored, not sealed (so the door can print it), never in the
// deck or its sheet, never resolved, never on the ? tab. The plan's drafts, verbatim; changing one is a code change.

/** The sign's grounding question. Frozen: nothing at run time rewrites it. */
export const GROUND_ASKS: Readonly<Record<ChakraId, string>> = Object.freeze({
  crown: 'Breathe out slower than you breathed in. What can you set down for that long?',
  'third-eye': 'Look at the farthest thing you can see. What is actually in front of you?',
  throat: 'Say it once, out loud, to the room. What is the sentence?',
  heart: 'Hand on your chest for three breaths. What is it holding?',
  'solar-plexus': 'Stand up and drop your shoulders. What can your hands finish in ten minutes?',
  sacral: 'Find where the feeling sits. Does it move when you breathe into it?',
  root: 'Feel your feet on the floor. What are five things you can see?',
});

/** The three as read: his own at each place he rewrote (row.asks[i] not empty), the starter at the rest. */
const asksFrom = (chakra: ChakraId, asks?: string[]): string[] => STARTER_ASKS[chakra].map((s, i) => asks?.[i] || s);

/** The sign's three questions, in order: the first three open questions of its deck (deckOf), so his own where he has
 *  rewritten them, else the starters. With every question resolved, fewer. A locked journal gives []. */
export async function asksOf(chakra: ChakraId): Promise<string[]> {
  return (await deckOf(chakra)).open.slice(0, 3).map(q => q.text);
}

/** Rewrites question i (0 to 2). Text is made one line and trimmed; an empty text puts the starter back. Refuses while locked. Returns the three.
 *  Stored as three places, an empty one meaning the starter, so a text that is the starter's is stored as empty and no
 *  row keeps asks once all three are the starters again. A sign with no row gets one holding its current starters as
 *  picks, as changeShelf gives it: from then on the shelf reads as it did, and is his. */
export async function setAsk(chakra: ChakraId, i: number, text: string, now: Millis = Date.now()): Promise<string[]> {
  needSign(chakra);
  if (!Number.isInteger(i) || i < 0 || i > 2) throw new Error(`No question ${String(i)}`);
  const line = oneLine(text);
  const out = await store.unit(async u => {
    const row = await u.get('signShelves', chakra);
    // a stored deck is the questions now (PLAN-BLOCKERS.md section 5): the open one at place i is rewritten there
    if (row?.deck) return { deck: row.deck };
    const asks = [0, 1, 2].map(k => row?.asks?.[k] ?? '');
    asks[i] = line === STARTER_ASKS[chakra][i] ? '' : line;
    const picks = row ? row.picks : STARTERS[chakra].map(p => ({ ...p }));
    await u.put('signShelves', { id: chakra, picks, updatedAt: now, ...(asks.some(Boolean) ? { asks } : {}), ...(row?.line ? { line: row.line } : {}) });
    return { asks: asksFrom(chakra, asks) };
  });
  if (out.asks) return out.asks;
  const texts = splitDeck(out.deck).open.map(q => q.text);
  if (i < texts.length) texts[i] = line;
  else if (line) texts.push(line);
  await setDeck(chakra, texts, now);
  return asksOf(chakra);
}

// ---- the sign's line: what it is for, in italic under its pair (PLAN-SIGN-LINES.md sections 2, 3 and 7, L1) ----
// The starter is CHAKRAS line (model/mountain.ts), fixed print in the code; his rewrite is kept on the sign's shelf
// row (SignShelf.line), sealed with its picks and questions, and carried by backup with the row. The pair (versus) is
// fixed print and is not kept here. Nothing is generated (DESIGN.md rule 16) and nothing counted.

/** The sign's line as read: his rewrite where he made one, else its starter. A locked journal gives '' (his words are
 *  behind the PIN, so the page holds the line's room and prints nothing). */
export async function lineOf(chakra: ChakraId): Promise<string> {
  needSign(chakra);
  if (keyState() === 'locked') return '';
  const row = await store.get('signShelves', chakra);
  if (row?.locked) return '';
  return row?.line || chakraOf(chakra).line;
}

/** Rewrites the sign's line. Text is made one line and trimmed; an empty text, or the starter's own words, puts the
 *  starter back (no line kept on the row). A sign with no row gets one holding its starters as picks, as setAsk gives
 *  it; putting the starter back on a sign with no row writes nothing. Refuses while locked (LockedError). Returns the
 *  line as read. */
export async function setLine(chakra: ChakraId, text: string, now: Millis = Date.now()): Promise<string> {
  needSign(chakra);
  const starter = chakraOf(chakra).line;
  const typed = oneLine(text);
  const line = typed === starter ? '' : typed;
  await store.unit(async u => {
    const row = await u.get('signShelves', chakra);
    if ((row?.line ?? '') === line) return;
    const { line: _was, ...rest } = kept(row);
    const picks = row ? row.picks : STARTERS[chakra].map(p => ({ ...p }));
    await u.put('signShelves', { id: chakra, picks, updatedAt: now, ...rest, ...(line ? { line } : {}) });
  });
  return line || starter;
}

// ---- the deck: the questions the three are drawn from (PLAN-BLOCKERS.md sections 5 and 6, K0) ----
// A sign holds a deck and shows its first three open questions. Absent, the deck is the starters with his rewritten
// asks laid over the first three; the first write (a resolve, an edit) stores it whole on the shelf row, sealed with the
// picks, and asks is then ignored and left as it was. Nothing here is counted (DESIGN.md rule 15).

/** Seven a sign: today's three (STARTER_ASKS) and the four of PLAN-BLOCKERS.md section 6, verbatim. His to strike or
 *  rewrite. */
export const STARTER_DECK: Readonly<Record<ChakraId, readonly string[]>> = {
  crown: [...STARTER_ASKS.crown, 'What are you trying to control that will not be controlled?', 'What would you do tomorrow if this never settled?', 'What is finished, even if it is not perfect?', 'What happens if you stop watching it?'],
  'third-eye': [...STARTER_ASKS['third-eye'], 'What would change your mind?', 'What are you not looking at?', 'What will this look like in a year?', 'Which story about this have you told the longest?'],
  throat: [...STARTER_ASKS.throat, 'What are you rehearsing instead of saying?', 'What is the kindest true version?', 'Where did you say yes and mean no?', 'What do you need to hear?'],
  heart: [...STARTER_ASKS.heart, 'Who has been kind to you lately?', 'What are you grieving that you have not named?', 'What would you forgive, if it cost nothing?', 'Where are you holding love back?'],
  'solar-plexus': [...STARTER_ASKS['solar-plexus'], 'What is putting it off protecting you from?', 'What would enough look like today?', 'What have you done that the critic never counts?', 'What would you try if no one were keeping score?'],
  sacral: [...STARTER_ASKS.sacral, 'What did you enjoy this week, in the body?', 'What do you reach for when you do not want to feel?', 'What feeling keeps coming back?', 'What would feel good that is also good for you?'],
  root: [...STARTER_ASKS.root, 'Where in the body is it quiet?', 'What is happening, apart from the fear?', 'Who or what is solid right now?', 'What does the alarm want you to do?'],
};

/** A starter's id in the deck, stable across reads and writes: "root-1" for Root's first. i counts from 0. */
export const starterAskId = (chakra: ChakraId, i: number): string => `${chakra}-${i + 1}`;

/** The deck as read when none is stored: the starters, his rewritten asks[i] over the first three. */
const startingDeck = (chakra: ChakraId, asks?: string[]): DeckAsk[] =>
  STARTER_DECK[chakra].map((text, i) => ({ id: starterAskId(chakra, i), text: (i < 3 && asks?.[i]) || text }));

const deckFrom = (chakra: ChakraId, row: Pick<SignShelf, 'asks' | 'deck'> | undefined): DeckAsk[] =>
  row?.deck ? row.deck.map(q => ({ ...q })) : startingDeck(chakra, row?.asks);

const splitDeck = (deck: DeckAsk[]): { open: DeckAsk[]; resolved: DeckAsk[] } =>
  ({ open: deck.filter(q => q.resolvedAt === undefined), resolved: deck.filter(q => q.resolvedAt !== undefined) });

/** The sign's deck: the open questions in their order (the first three are the ones that show), and the resolved ones
 *  in deck order, each with its resolvedAt. A locked journal gives both empty. */
export async function deckOf(chakra: ChakraId): Promise<{ open: DeckAsk[]; resolved: DeckAsk[] }> {
  needSign(chakra);
  if (keyState() === 'locked') return { open: [], resolved: [] };
  const row = await store.get('signShelves', chakra);
  if (row?.locked) return { open: [], resolved: [] };
  return splitDeck(deckFrom(chakra, row));
}

/** Reads, changes and writes one sign's deck as one unit, storing it whole (the first write stores the starters with
 *  his asks laid over them). A sign with no row gets one holding its current starters as picks, as setAsk gives it.
 *  Refuses while locked (LockedError). */
async function changeDeck(chakra: ChakraId, change: (deck: DeckAsk[]) => DeckAsk[] | null, now: Millis): Promise<{ open: DeckAsk[]; resolved: DeckAsk[] }> {
  needSign(chakra);
  return store.unit(async u => {
    const row = await u.get('signShelves', chakra);
    const before = deckFrom(chakra, row);
    const deck = change(before.map(q => ({ ...q })));
    if (!deck) return splitDeck(before);
    const picks = row ? row.picks : STARTERS[chakra].map(p => ({ ...p }));
    await u.put('signShelves', { id: chakra, picks, updatedAt: now, ...kept(row), deck });
    return splitDeck(deck);
  });
}

/** Resolves the question with this id (on) or takes it back (off), where it stands in the deck. Resolving needs no
 *  answer. An id not in the deck, or one already as asked, writes nothing. Returns the deck. */
export function resolveAsk(chakra: ChakraId, id: string, on: boolean, now: Millis = Date.now()): Promise<{ open: DeckAsk[]; resolved: DeckAsk[] }> {
  return changeDeck(chakra, deck => {
    const q = deck.find(x => x.id === id);
    if (!q || (q.resolvedAt !== undefined) === on) return null;
    if (on) q.resolvedAt = now; else delete q.resolvedAt;
    return deck;
  }, now);
}

/**
 * The deck sheet's rules, written back: texts are the open questions in his order. Each is made one line; a rule left
 * empty removes its question, and a text that is new (the blank last rule) adds one. A question keeps its id when its
 * words are unchanged, or when it was rewritten in its own place. An open deck left under three is filled back up from
 * the starters not in it (neither open nor resolved), in their order, which keeps rule 37's "a rule left empty puts its
 * starter back"; with every starter resolved it stays short. The resolved questions are kept where they stood among
 * the open ones (K2: one brought back is open in its old place).
 * Returns the deck.
 */
export function setDeck(chakra: ChakraId, texts: readonly string[], now: Millis = Date.now()): Promise<{ open: DeckAsk[]; resolved: DeckAsk[] }> {
  return changeDeck(chakra, deck => {
    const { open, resolved } = splitDeck(deck);
    const lines = texts.map(oneLine);
    const used = new Set<string>();
    const ids: (string | undefined)[] = lines.map(line => {
      const q = line ? open.find(x => !used.has(x.id) && x.text === line) : undefined;
      if (q) used.add(q.id);
      return q?.id;
    });
    const next: DeckAsk[] = [];
    lines.forEach((text, i) => {
      if (!text) return;
      let id = ids[i];
      // rewritten in its own place: the question keeps its id
      if (!id && open[i] && !used.has(open[i].id) && !ids.includes(open[i].id)) { id = open[i].id; used.add(id); }
      next.push({ id: id ?? crypto.randomUUID(), text });
    });
    const have = new Set([...next.map(q => q.id), ...resolved.map(q => q.id)]);
    const said = new Set(next.map(q => q.text));
    STARTER_DECK[chakra].forEach((text, i) => {
      const id = starterAskId(chakra, i);
      if (next.length >= 3 || have.has(id) || said.has(text)) return;
      next.push({ id, text });
    });
    // the resolved keep their places among the open (K2), so one brought back from the sheet is open where it stood
    const out: DeckAsk[] = [];
    deck.forEach(q => {
      if (q.resolvedAt !== undefined) out.push(q);
      else if (next.length) out.push(next.shift()!);
    });
    return [...out, ...next];
  }, now);
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
