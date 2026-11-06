// The notebook's starting set (PLAN.md section 4, 2026-11-06): the pantheon, the two paradoxes and their
// items, the manifesto as the first page, and the small antonym list. Runs once, on an empty database.
// Every line here is the notebook's own; nothing is generated.
import type { Item, Message, Page, Paradox, Settings, Voice, VoiceColour } from './schema';
import { store } from './fields';

/** Hue angles from tokens.css (--h-*). test/db/seed.test.ts checks they still match. */
export const HUES = { blue: 250, green: 150, red: 25, purple: 305, brown: 60, orange: 55, pink: 350, yellow: 95 } as const;
export const BROWN_CHROMA = 0.5; // tokens.css --v-brown: calc(var(--voice-c) * .5)

export const MANIFESTO = ['I determine my core.', 'I choose how to flow.'] as const;

/** Offered on the paradox form, never filled in (PLAN.md section 6). Both directions are looked up. */
export const ANTONYMS: [string, string][] = [
  ['selfless', 'selfish'],
  ['thoughtful', 'reactive'],
  ['patient', 'urgent'],
  ['open', 'guarded'],
  ['giving', 'keeping'],
  ['serious', 'playful'],
  ['planned', 'spontaneous'],
  ['humble', 'proud'],
  ['steady', 'restless'],
  ['alone', 'together'],
  ['careful', 'bold'],
  ['soft', 'hard'],
  ['still', 'moving'],
  ['trusting', 'skeptical'],
  ['disciplined', 'free'],
];

export function antonymsOf(word: string): string[] {
  const w = word.trim().toLowerCase();
  return ANTONYMS.flatMap(([a, b]) => (a === w ? [b] : b === w ? [a] : []));
}

// A fixed date for the seed: the notebook's 11/6 section.
const NOTEBOOK_11_6 = Date.UTC(2026, 10, 6, 12);
const NOTEBOOK_11_4 = Date.UTC(2026, 10, 4, 12);

type V = { id: string; name: string; aka?: string[]; colour: VoiceColour; starred?: boolean; twin?: { id: string; name: string; aka?: string[] } };
const hue = (h: number, chroma?: number): VoiceColour => (chroma === undefined ? { hue: h } : { hue: h, chroma });

// Order: the starred four first, as the walkthrough's chip row shows them, then the rest of the table.
const PANTHEON: V[] = [
  { id: 'v-skeptic', name: 'Skeptic', aka: ['Thinker', 'Philosopher'], colour: { hue: null }, starred: true },
  { id: 'v-mystic', name: 'Mystic', aka: ['Healer', 'Feeler'], colour: hue(HUES.blue), starred: true, twin: { id: 'v-phantom', name: 'Phantom', aka: ['Ghost'] } },
  { id: 'v-warrior', name: 'Warrior', aka: ['Poet'], colour: hue(HUES.red), starred: true },
  { id: 'v-architect', name: 'Architect', aka: ['King'], colour: hue(HUES.green), starred: true, twin: { id: 'v-workaholic', name: 'Workaholic', aka: ['Hoarder'] } },
  { id: 'v-meaning-maker', name: 'Meaning Maker', aka: ['Romantic'], colour: hue(HUES.purple), twin: { id: 'v-victim', name: 'Victim' } },
  { id: 'v-engineer', name: 'Engineer', colour: hue(HUES.brown, BROWN_CHROMA) },
  { id: 'v-explorer', name: 'Explorer', aka: ['Adventurer'], colour: hue(HUES.orange), twin: { id: 'v-sojourner', name: 'Sojourner', aka: ['Ranger'] } },
  { id: 'v-sensualist', name: 'Sensualist', colour: hue(HUES.pink), twin: { id: 'v-addict', name: 'Addict' } },
  { id: 'v-joker', name: 'Joker', colour: hue(HUES.yellow) },
];

export function seedVoices(): Voice[] {
  const lights: Voice[] = PANTHEON.map((v, i) => ({
    id: v.id, name: v.name, aka: v.aka ?? [], colour: v.colour, shade: 'light', twinId: v.twin?.id,
    starred: !!v.starred, order: i, archived: false, revisions: [],
  }));
  const deeps: Voice[] = PANTHEON.filter(v => v.twin).map((v, i) => ({
    id: v.twin!.id, name: v.twin!.name, aka: v.twin!.aka ?? [], colour: v.colour, shade: 'deep', twinId: v.id,
    starred: false, order: PANTHEON.length + i, archived: false, revisions: [],
  }));
  return [...lights, ...deeps];
}

export function seedParadoxes(): { paradoxes: Paradox[]; items: Item[] } {
  const p1: Paradox = {
    id: 'px-selfless-selfish', createdAt: NOTEBOOK_11_6, updatedAt: NOTEBOOK_11_6, status: 'active',
    // The aspects are the notebook's "fill both" lines for each side.
    poleA: { value: 'selfless', aspect: 'vegetable chopping in Evergreen' },
    poleB: { value: 'selfish', aspect: 'something that gives breathing room' },
    // Both middles were struck through in the notebook ("closer... but still too vague"), so both are revisions.
    revisions: [
      { at: NOTEBOOK_11_6, poleA: { value: 'selfless', aspect: 'vegetable chopping in Evergreen' }, poleB: { value: 'selfish', aspect: 'something that gives breathing room' }, middle: { word: 'compassionate self-awareness' } },
      { at: NOTEBOOK_11_6 + 60_000, poleA: { value: 'selfless', aspect: 'vegetable chopping in Evergreen' }, poleB: { value: 'selfish', aspect: 'something that gives breathing room' }, middle: { word: 'balance self with others, fill all needs' } },
    ],
  };
  const p2: Paradox = {
    id: 'px-thoughtful-reactive', createdAt: NOTEBOOK_11_6, updatedAt: NOTEBOOK_11_6, status: 'active',
    // The notebook gives this spread no aspects yet; they stay empty until Tommy writes them.
    poleA: { value: 'thoughtful', aspect: '', shadow: 'obsessive' },
    poleB: { value: 'reactive', aspect: '' },
    revisions: [],
  };
  const item = (paradoxId: string, id: string, pole: 'a' | 'b', text: string, lean: number, order: number, extra: Partial<Item> = {}): Item =>
    ({ id, paradoxId, pole, text, lean, order, doneLog: [], ...extra });
  const items: Item[] = [
    // Along the diagonal, A to B. Pairs as the walkthrough's spread draws them.
    item(p1.id, 'it-volunteer', 'a', 'find volunteer opportunities near Evergreen', -0.3, 0, { pairId: 'it-breathing-room', nextTo: 'it-share' }),
    item(p1.id, 'it-share', 'a', 'remind yourself, through metrics, that you matter by helping others; when something useful is created, share it with the world', 0.25, 1, { pairId: 'it-own-sake' }),
    item(p1.id, 'it-own-sake', 'b', 'write for its own sake, not worrying whether it is commercially viable or edifying', 0.25, 2, { pairId: 'it-share' }),
    item(p1.id, 'it-breathing-room', 'b', 'find something nice for yourself which gives you life / breathing room', -0.3, 3, { pairId: 'it-volunteer' }),
    item(p2.id, 'it-journaling', 'a', 'journaling', -0.6, 0, { nextTo: 'it-asking-claude' }),
    item(p2.id, 'it-asking-claude', 'a', 'asking Claude', -0.2, 1, { nextTo: 'it-asking-friend' }),
    item(p2.id, 'it-asking-friend', 'b', 'asking a friend', 0.2, 2, { nextTo: 'it-feedback' }),
    item(p2.id, 'it-feedback', 'b', 'giving feedback', 0.6, 3),
  ];
  return { paradoxes: [p1, p2], items };
}

export function seedManifesto(): { page: Page; messages: Message[] } {
  const page: Page = {
    id: 'pg-manifesto', kind: 'entry', createdAt: NOTEBOOK_11_4, updatedAt: NOTEBOOK_11_4, state: 'open',
    tags: [], paradoxIds: [], linkedPageIds: [],
  };
  const messages: Message[] = MANIFESTO.map((text, i) => ({ id: `m-manifesto-${i + 1}`, pageId: page.id, at: NOTEBOOK_11_4 + i, text, kept: true }));
  return { page, messages };
}

export function defaultSettings(now = Date.now()): Settings {
  return {
    id: 'app', light: 'sky', stillAfterMidnight: 'offer', sounds: true, haptics: true,
    lock: { enabled: false, relockAfterMin: 5 }, seededAt: now,
  };
}

/** Seeds once. The settings row marks it done, so deleting every voice later never brings them back. */
export async function ensureSeeded(now = Date.now()): Promise<boolean> {
  if (await store.get('settings', 'app')) return false;
  const { paradoxes, items } = seedParadoxes();
  const { page, messages } = seedManifesto();
  await store.many({
    voices: seedVoices(), paradoxes, items, pages: [page], messages,
    settings: [defaultSettings(now)],
  });
  return true;
}
