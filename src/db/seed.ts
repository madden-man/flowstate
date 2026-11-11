// The notebook's starting set (PLAN.md section 4, 2026-11-06): the pantheon, the two paradoxes and their
// items, and the small antonym list. Runs once, on an empty database. No pages (V5, 2026-11-08): the
// manifesto is the threshold's copy (MANIFESTO below), not a journal entry.
// Every line here is the notebook's own; nothing is generated.
import type { Fixation, Flow, Item, Message, Page, Paradox, Settings, Voice, VoiceColour } from './schema';
import type { Read } from './fields';
import { store, keyState } from './fields';
import { SEED_FLOWS, SEED_TIPS_LATER, seedFlow } from './seed-flows';
import { PICKS } from './seed/picks';
import { DOCTOR_LINE, DOCTOR_STEP, DOCTOR_TIP } from './seed/energize';
import { WALK_HELPERS, WALK_TRIM } from './seed/walk';

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
    // Along the diagonal, A to B, top to bottom: the notebook's order is volunteer, share, own sake,
    // breathing room. Each goal keeps its balance (pairId) as the walkthrough draws them, but the pairs sit
    // at different heights so the diagonal reads in the notebook's order (a pair shares a lean only by default).
    // Cadences (package 4): the notebook says "daily, weekly, monthly, yearly goals/tasks" but names none per
    // item, so these follow each item's own wording: volunteering is monthly, the metrics reminder weekly,
    // writing for its own sake daily, something nice for yourself weekly.
    item(p1.id, 'it-volunteer', 'a', 'find volunteer opportunities near Evergreen', -0.6, 0, { pairId: 'it-breathing-room', nextTo: 'it-share', cadence: 'monthly' }),
    item(p1.id, 'it-share', 'a', 'remind yourself, through metrics, that you matter by helping others; when something useful is created, share it with the world', -0.2, 1, { pairId: 'it-own-sake', cadence: 'weekly' }),
    item(p1.id, 'it-own-sake', 'b', 'write for its own sake, not worrying whether it is commercially viable or edifying', 0.2, 2, { pairId: 'it-share', cadence: 'daily' }),
    item(p1.id, 'it-breathing-room', 'b', 'find something nice for yourself which gives you life / breathing room', 0.6, 3, { pairId: 'it-volunteer', cadence: 'weekly' }),
    item(p2.id, 'it-journaling', 'a', 'journaling', -0.6, 0, { nextTo: 'it-asking-claude' }),
    item(p2.id, 'it-asking-claude', 'a', 'asking Claude', -0.2, 1, { nextTo: 'it-asking-friend' }),
    item(p2.id, 'it-asking-friend', 'b', 'asking a friend', 0.2, 2, { nextTo: 'it-feedback' }),
    item(p2.id, 'it-feedback', 'b', 'giving feedback', 0.6, 3),
  ];
  return { paradoxes: [p1, p2], items };
}

export function defaultSettings(now = Date.now()): Settings {
  return {
    id: 'app', light: 'sky', stillAfterMidnight: 'offer', sounds: true, haptics: true,
    lock: { enabled: false, relockAfterMin: 5 }, seededAt: now, cleaned: [SEED_PAGES_PASS, WALK_PASS], // a fresh journal is seeded in the walk's shape
    flowsSeeded: [...SEED_FLOWS.map(f => f.id), ...SEED_TIPS_LATER.map(tipMark), ...PICKS.map(p => picksMark(p.stepId))],
    sitSound: 'rain', sitMinutes: 0, sitThroughSilent: true,
  };
}

/** Seeds once. The settings row marks it done, so deleting every voice later never brings them back.
 *  No pages: the journal opens empty (Tommy, 2026-11-08, PLAN-V2.md section 2). */
export async function ensureSeeded(now = Date.now()): Promise<boolean> {
  if (await store.get('settings', 'app')) return false;
  const { paradoxes, items } = seedParadoxes();
  await store.many({ voices: seedVoices(), paradoxes, items, flows: SEED_FLOWS.map(f => seedFlow(f)), settings: [defaultSettings(now)] });
  return true;
}

// ---- the seed flows (F1, PLAN-FLOWS.md section 5) ----

let flowsPass: Promise<string[] | null> | null = null;

/**
 * Once per seed flow, for a journal seeded before it existed (schema version 3 and every later flow): writes each
 * seed flow not yet in settings.flowsSeeded, unless a flow with its id is already there (an import), and marks it.
 * A flow written once is never written again, so deleting it keeps it gone. Needs the journal open (the seed is
 * sealed like any flow), so it runs at boot when there is no lock and again once the PIN opens it; a locked journal
 * returns null and tries on the next open. Returns the ids written.
 */
export function seedFlowsOnce(): Promise<string[] | null> {
  flowsPass ??= (async () => {
    if (keyState() === 'locked') return null;
    const s = await store.get('settings', 'app');
    if (!s || s.locked) return null;
    const done = new Set(s.flowsSeeded ?? []);
    const todo = SEED_FLOWS.filter(f => !done.has(f.id));
    const tips = SEED_TIPS_LATER.filter(id => !done.has(tipMark(id)));
    if (!todo.length && !tips.length) return [];
    const stored = await store.all('flows');
    const have = new Set(stored.map(f => f.id));
    const write = todo.filter(f => !have.has(f.id)).map(f => seedFlow(f));
    // a tip added to a seed flow later: into each stored flow (not one just written, which has it), once
    const fresh = new Set(write.map(f => f.id));
    const grown = stored.filter(f => !fresh.has(f.id)).flatMap(f => withLaterTips(f, tips));
    await store.many({
      flows: [...write, ...grown],
      settings: [{ ...s, flowsSeeded: [...done, ...todo.map(f => f.id), ...tips.map(tipMark)] }],
    });
    return write.map(f => f.id);
  })().finally(() => { flowsPass = null; });
  return flowsPass;
}

/** How a later seed tip is marked in settings.flowsSeeded once it has been written (a flow id has no colon). */
const tipMark = (tipId: string) => `tip:${tipId}`;

/**
 * A stored flow with these later seed tips put in, each in its step after the seed tip before it (or at the end),
 * as a new revision; [] when none applies. A tip already there (by id) is left alone, a step he deleted gets
 * nothing, and a locked row is never written.
 */
function withLaterTips(flow: Read<Flow>, tipIds: string[]): Flow[] {
  const seed = SEED_FLOWS.find(f => f.id === flow.id);
  if (!seed || flow.locked) return [];
  let changed = false;
  const steps = flow.steps.map(st => {
    const from = seed.steps.find(x => x.id === st.id);
    if (!from) return st;
    let tips = st.tips;
    from.tips.forEach((t, k) => {
      if (!tipIds.includes(t.id) || tips.some(x => x.id === t.id)) return;
      const after = k > 0 ? tips.findIndex(x => x.id === from.tips[k - 1].id) : -1;
      const at = after >= 0 ? after + 1 : tips.length;
      tips = [...tips.slice(0, at), structuredClone(t), ...tips.slice(at)];
      changed = true;
    });
    return tips === st.tips ? st : { ...st, tips };
  });
  if (!changed) return [];
  const at = Date.now();
  return [{ ...flow, steps, updatedAt: at, revisions: [...flow.revisions, { at, name: flow.name, steps: structuredClone(steps) }] }];
}

// ---- the picks (PLAN-PICKS.md section 6, P0) ----

/** How a step's seed picks are marked in settings.flowsSeeded once they have been given (a flow id has no colon). */
const picksMark = (stepId: string) => `picks:${stepId}`;

let picksPass: Promise<string[] | null> | null = null;

/**
 * Once per step, for a journal that had the flows before the picks (P0): the step's On row gets its helper, and the step
 * its seed picks and printed line, as one new revision of its flow. Runs after seedFlowsOnce, which brings the four new
 * On rows (SEED_TIPS_LATER). Never brings anything back: a step he deleted gets nothing; an On row he struck or deleted
 * gets no helper and no picks; a row he gave another helper keeps it; picks or a printed line already on the step (his
 * own, from the step sheet) are left alone; a step marked once is never touched again. A locked journal returns null and
 * tries on the next open. Returns the step ids given picks.
 */
export function seedPicksOnce(): Promise<string[] | null> {
  picksPass ??= (async () => {
    if (keyState() === 'locked') return null;
    const s = await store.get('settings', 'app');
    if (!s || s.locked) return null;
    const done = new Set(s.flowsSeeded ?? []);
    const todo = PICKS.filter(p => !done.has(picksMark(p.stepId)));
    if (!todo.length) return [];
    const stored = await store.all('flows');
    if (stored.some(f => f.locked)) return null;
    const given: string[] = [];
    const at = Date.now();
    const grown: Flow[] = [];
    for (const flow of stored) {
      let changed = false;
      const steps = flow.steps.map(st => {
        const p = todo.find(x => x.stepId === st.id);
        const row = p && st.tips.find(t => t.id === p.tipId);
        if (!p || !row || row.struck) return st;
        const helper = row.helper === undefined || row.helper === 'music' ? 'on' : row.helper;
        const tips = helper === row.helper ? st.tips : st.tips.map(t => (t.id === row.id ? { ...t, helper } : t));
        const picks = st.picks ?? structuredClone(p.picks);
        const onLine = st.onLine ?? p.onLine;
        if (tips === st.tips && picks === st.picks && onLine === st.onLine) return st;
        changed = true;
        given.push(st.id);
        return { ...st, tips, picks, ...(onLine !== undefined ? { onLine } : {}) };
      });
      if (changed) grown.push({ ...flow, steps, updatedAt: at, revisions: [...flow.revisions, { at, name: flow.name, steps: structuredClone(steps) }] });
    }
    await store.many({ flows: grown, settings: [{ ...s, flowsSeeded: [...done, ...todo.map(p => picksMark(p.stepId))] }] });
    return given;
  })().finally(() => { picksPass = null; });
  return picksPass;
}

// ---- the fixations (PLAN-ENERGIZE.md section 5, X1) ----

/** The name the pass leaves in settings.cleaned once it has run. */
export const FIXATIONS_PASS = 'fixations';

/** A local-midnight date (section 5: the since dates are days, by the phone's own calendar). */
const localDay = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

/** Decided by Tommy, 2026-11-10: the three on, in slot order, with the day each went on; then the deck, never on, in
 *  the order he named them. Hues are the voices' wheel (HUES): FlowState blue, East Winds green, Japan Trip red. */
export const SEED_FIXATIONS_ON: { id: string; name: string; hue: number; since: number }[] = [
  { id: 'fx-flowstate', name: 'FlowState', hue: HUES.blue, since: localDay(2026, 11, 7) },
  { id: 'fx-east-winds', name: 'East Winds', hue: HUES.green, since: localDay(2026, 8, 20) },
  { id: 'fx-japan-trip', name: 'Japan Trip', hue: HUES.red, since: localDay(2026, 10, 28) },
];
export const SEED_FIXATIONS_DECK: { id: string; name: string; hue: number }[] = [
  { id: 'fx-jazz-piano', name: 'Jazz piano', hue: HUES.purple },
  { id: 'fx-conduit', name: 'Conduit', hue: HUES.orange },
  { id: 'fx-learning-chinese', name: 'Learning Chinese', hue: HUES.pink },
  { id: 'fx-studying-philosophy', name: 'Studying philosophy', hue: HUES.yellow },
];

/** The seed rows. An on one was made the day it went on; the deck was made now, a millisecond apart, so the deck's
 *  longest waiting first (model/fixations.ts deck) reads in the order he named them. */
export function seedFixations(now = Date.now()): Fixation[] {
  return [
    ...SEED_FIXATIONS_ON.map((f, slot) => ({ id: f.id, name: f.name, hue: f.hue, createdAt: f.since, stints: [{ from: f.since, slot }], updatedAt: f.since })),
    ...SEED_FIXATIONS_DECK.map((f, i) => ({ id: f.id, name: f.name, hue: f.hue, createdAt: now + i, stints: [], updatedAt: now + i })),
  ];
}

let fixationsPass: Promise<string[] | null> | null = null;

/**
 * Once per journal (PLAN-ENERGIZE.md section 5): writes the first three and the deck, and records 'fixations' in
 * settings.cleaned, so a fixation he finishes or a row that goes never comes back. A seed row whose id is already
 * there (an import) is left as it is. A name is sealed, so like seedFlowsOnce it runs where the journal is open: at
 * boot with no lock, and again once the PIN opens it; a locked journal returns null and tries on the next open.
 * The Energize flow row is not touched (X5 moves its doctor line). Returns the ids written.
 */
export function seedFixationsOnce(now = Date.now()): Promise<string[] | null> {
  fixationsPass ??= (async () => {
    if (keyState() === 'locked') return null;
    const s = await store.get('settings', 'app');
    if (!s || s.locked) return null;
    if (s.cleaned?.includes(FIXATIONS_PASS)) return [];
    const have = new Set((await store.all('fixations')).map(f => f.id));
    const write = seedFixations(now).filter(f => !have.has(f.id));
    await store.many({ fixations: write, settings: [{ ...s, cleaned: [...(s.cleaned ?? []), FIXATIONS_PASS] }] });
    return write.map(f => f.id);
  })().finally(() => { fixationsPass = null; });
  return fixationsPass;
}

// ---- the doctor line moves (PLAN-ENERGIZE.md section 5, X5) ----

/** The name the pass leaves in settings.cleaned once it has run. */
export const DOCTOR_PASS = 'energize-doctor';

let doctorPass: Promise<boolean | null> | null = null;

/**
 * Once per journal (X5): on the Energize flow row, the doctor line goes from restLine (the rest page is the three now)
 * to a print line under The tip's rows, in every light, as one new revision. Safe on a flow he has edited: the line
 * is added only if The tip has no tip with its id or its words; restLine is cleared only when it is still the seed's
 * words (a line he rewrote stays his, unseen); a step he deleted gets nothing and keeps restLine as it is; every
 * other edit stands. The flow gone: nothing is written but the mark. A fresh journal is seeded in this shape
 * (seed/energize.ts), so it is a no-op there. Runs where the journal is open, like seedFlowsOnce, after it; a locked
 * journal returns null and tries on the next open. Returns whether the flow was written.
 */
export function moveDoctorLineOnce(): Promise<boolean | null> {
  doctorPass ??= (async () => {
    if (keyState() === 'locked') return null;
    const s = await store.get('settings', 'app');
    if (!s || s.locked) return null;
    if (s.cleaned?.includes(DOCTOR_PASS)) return false;
    const done = { ...s, cleaned: [...(s.cleaned ?? []), DOCTOR_PASS] };
    const flow = await store.get('flows', 'energize');
    if (flow?.locked) return null;
    const step = flow?.steps.find(st => st.id === DOCTOR_STEP);
    if (!flow || !step) { await store.put('settings', done); return false; }
    const there = step.tips.some(t => t.id === DOCTOR_TIP || t.text.trim() === DOCTOR_LINE);
    const clear = flow.restLine?.trim() === DOCTOR_LINE;
    if (there && !clear) { await store.put('settings', done); return false; }
    const steps = there ? flow.steps : flow.steps.map(st => (st.id === DOCTOR_STEP
      ? { ...st, tips: [...st.tips, { id: DOCTOR_TIP, text: DOCTOR_LINE, print: true }] } : st));
    const { restLine: _was, ...rest } = flow;
    const at = Date.now();
    const row: Flow = { ...(clear ? rest : flow), steps, updatedAt: at, revisions: [...flow.revisions, { at, name: flow.name, steps: structuredClone(steps) }] };
    await store.many({ flows: [row], settings: [done] });
    return true;
  })().finally(() => { doctorPass = null; });
  return doctorPass;
}

// ---- the walk (2026-11-11): fewer things at each step ----

/** The name the pass leaves in settings.cleaned once it has run. */
export const WALK_PASS = 'walk';

let walkPass: Promise<string[] | null> | null = null;

/**
 * Once per journal: the audit of the things to do (seed/walk.ts). Each trimmed seed tip is struck (rule 10: struck,
 * never deleted, so it reads in the step sheet's Earlier), and four rows gain the helper that makes them a card that
 * does something. Safe on a flow he has edited: a tip whose words he changed stays (it is his now), one already
 * struck or deleted is left alone, a row he gave a helper keeps it. One new revision per flow touched. A fresh
 * journal is seeded in this shape, so it only leaves the mark there. Runs where the journal is open, after the other
 * flow passes; a locked journal returns null and tries on the next open. Returns the ids struck.
 */
export function walkOnce(): Promise<string[] | null> {
  walkPass ??= (async () => {
    if (keyState() === 'locked') return null;
    const s = await store.get('settings', 'app');
    if (!s || s.locked) return null;
    if (s.cleaned?.includes(WALK_PASS)) return [];
    const stored = await store.all('flows');
    if (stored.some(f => f.locked)) return null;
    const struck: string[] = [];
    const at = Date.now();
    const grown: Flow[] = [];
    for (const flow of stored) {
      let changed = false;
      const steps = flow.steps.map(st => {
        const tips = st.tips.map(t => {
          if (t.struck) return t;
          if (WALK_TRIM[t.id] !== undefined && t.text.trim() === WALK_TRIM[t.id]) { struck.push(t.id); changed = true; return { ...t, struck: true }; }
          const helper = WALK_HELPERS[t.id];
          if (helper && t.helper === undefined && !t.wise && !t.print) { changed = true; return { ...t, helper }; }
          return t;
        });
        return changed ? { ...st, tips } : st;
      });
      if (changed) grown.push({ ...flow, steps, updatedAt: at, revisions: [...flow.revisions, { at, name: flow.name, steps: structuredClone(steps) }] });
    }
    await store.many({ flows: grown, settings: [{ ...s, cleaned: [...(s.cleaned ?? []), WALK_PASS] }] });
    return struck;
  })().finally(() => { walkPass = null; });
  return walkPass;
}

// ---- the seed pages pass (V5, 2026-11-08) ----

/** The name the pass leaves in settings.cleaned once it has run. */
export const SEED_PAGES_PASS = 'seed-pages';

// The two pages packages 1 and 8 seeded, exactly as they were written, kept only to recognise them.
const OLD_11_4 = Date.UTC(2026, 10, 4, 12);
const OLD_MODELS_AT = NOTEBOOK_11_6 + 120_000;
const pageOf = (id: string, kind: Page['kind'], at: number, title?: string): Page => ({
  id, kind, ...(title ? { title } : {}), createdAt: at, updatedAt: at, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [],
});
export const OLD_SEED_PAGES: { page: Page; messages: Message[] }[] = [
  {
    page: pageOf('pg-manifesto', 'entry', OLD_11_4),
    messages: MANIFESTO.map((text, i) => ({ id: `m-manifesto-${i + 1}`, pageId: 'pg-manifesto', at: OLD_11_4 + i, text, kept: true })),
  },
  {
    page: pageOf('pg-models', 'question', OLD_MODELS_AT, 'Who are my models?'),
    messages: [{ id: 'm-models-1', pageId: 'pg-models', at: OLD_MODELS_AT + 1, text: 'Grumpa, Isaac, Alison, Myself', kept: false }],
  },
];

/** The same row, field for field, ignoring key order and fields left undefined. */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canon(x)]))
      : v;
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/**
 * Once, for a journal seeded before V5: takes away the manifesto entry and the models question only if
 * they were never written on (page and messages exactly as seeded). A page that differs in anything, a
 * line added, a kept flag, a tag, a link, its state, stays. Voices, paradoxes and every other row are
 * never touched. Runs where the journal is open (the gate in app.tsx), since a question's title is
 * sealed with the PIN; if a row reads locked it stops and tries again next open. Returns the ids removed,
 * or null when it did not run (done before, a fresh journal, or locked), so the caller reloads settings only once.
 */
export async function cleanSeedPages(): Promise<string[] | null> {
  const s = await store.get('settings', 'app');
  if (!s || s.locked || s.cleaned?.includes(SEED_PAGES_PASS)) return null;
  const removed: string[] = [];
  for (const seed of OLD_SEED_PAGES) {
    const id = seed.page.id;
    const page = await store.get('pages', id);
    const messages = await store.query('messages', t => t.where('pageId').equals(id));
    if (page?.locked || messages.some(m => m.locked)) return null;
    const byId = (a: Message, b: Message) => a.id.localeCompare(b.id);
    if (!same(messages.sort(byId), [...seed.messages].sort(byId))) continue;
    if (page && !same(page, seed.page)) continue;
    // the page first, so a stop halfway leaves no seed page with half its lines; seed lines left without
    // their page are swept on the next open (they still match the seed exactly)
    if (page) await store.delete('pages', id);
    for (const m of messages) await store.delete('messages', m.id);
    if (page) removed.push(id);
  }
  const { seedsAdded: _gone, ...rest } = s as Settings & { seedsAdded?: unknown };
  await store.put('settings', { ...rest, cleaned: [...(s.cleaned ?? []), SEED_PAGES_PASS] });
  return removed;
}
