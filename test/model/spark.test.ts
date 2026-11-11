// Spark it (PLAN-ENERGIZE.md sections 2 and 5, X5): the word on a fixation's sheet starts the Energize episode with the
// dot on Spark and fixationId set, or only names one already live (the dot left where it is); ending the episode
// changes nothing in the fixation; Next is his own line. And the one-time pass that moves the doctor line from the
// rest page to The tip: once, a no-op on a rerun and on a fresh journal, nothing when the flow is gone, his edits kept.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB, Fixation } from '../../src/db/schema';
import { store, setKey, lock, unlock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded, moveDoctorLineOnce, DOCTOR_PASS } from '../../src/db/seed';
import { DOCTOR_LINE } from '../../src/db/seed/energize';
import { flowById, liveEpisode, moveDot, endEpisode, currentStepId } from '../../src/model/flows';
import { FIXATION_FLOW, spark, setNext, finish, fixationById } from '../../src/model/fixations';
import { shownTips } from '../../src/model/tips';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

const NOW = new Date(2026, 10, 10, 9, 30).getTime();
const fx = (id: string, extra: Partial<Fixation> = {}): Fixation =>
  ({ id, name: id, hue: 150, createdAt: NOW - 1e9, stints: [{ from: NOW - 1e9, slot: 1 }], ...extra });

describe('Spark it', () => {
  beforeEach(async () => {
    await ensureSeeded();
    await store.bulkPut('fixations', [fx('east'), fx('jazz', { stints: [] })]);
  });

  it('starts the Energize episode with the dot on Spark, named', async () => {
    const s = (await spark('east', NOW))!;
    expect(s.step).toBe(1);
    expect(s.episode).toMatchObject({ flowId: FIXATION_FLOW, startedAt: NOW, fixationId: 'east', marks: [{ stepId: 'energize-1', at: NOW }] });
    const live = (await liveEpisode(FIXATION_FLOW))!;
    expect(live.id).toBe(s.episode.id);
    expect(live.fixationId).toBe('east');
  });

  it('on a live episode only names it, the dot left where it is', async () => {
    const dragged = (await moveDot(FIXATION_FLOW, ['energize-1', 'energize-2'], 'energize-3', NOW))!;
    expect(dragged.fixationId).toBeUndefined();
    const s = (await spark('east', NOW + 60_000))!;
    expect(s.step).toBe(3);
    expect(s.episode.id).toBe(dragged.id);
    const live = (await liveEpisode(FIXATION_FLOW))!;
    expect(currentStepId(live)).toBe('energize-3');
    expect(live.marks).toEqual(dragged.marks);
    expect(live.fixationId).toBe('east');
    expect(await db.episodes.count()).toBe(1);
    // sparked again from another card, it names that one instead
    await spark('jazz', NOW + 120_000);
    expect((await liveEpisode(FIXATION_FLOW))!.fixationId).toBe('jazz');
  });

  it('ending the episode clears nothing in the fixation', async () => {
    await setNext('east', 'Chapter nine, the harbor at dawn', NOW);
    const before = await fixationById('east');
    const s = (await spark('east', NOW))!;
    await moveDot(FIXATION_FLOW, ['energize-2'], 'rest', NOW + 60_000);
    expect(await liveEpisode(FIXATION_FLOW)).toBeUndefined();
    expect((await store.get('episodes', s.episode.id))!).toMatchObject({ fixationId: 'east', endedAt: NOW + 60_000 });
    expect(await fixationById('east')).toEqual(before);
    await endEpisode(s.episode.id);
    expect((await fixationById('east'))!.next).toBe('Chapter nine, the harbor at dawn');
  });

  it('writes nothing for a finished or unknown fixation, a gone flow, or a locked journal', async () => {
    await finish('jazz', NOW);
    expect(await spark('jazz', NOW)).toBeUndefined();
    expect(await spark('nobody', NOW)).toBeUndefined();
    expect(await db.episodes.count()).toBe(0);
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    lock();
    expect(await spark('east', NOW)).toBeUndefined();
    await unlock(key);
    await store.delete('flows', FIXATION_FLOW);
    expect(await spark('east', NOW)).toBeUndefined();
    expect(await db.episodes.count()).toBe(0);
  });

  it('the fixationId stays clear, so the door could read it without the key; the episode is otherwise as dragged', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('2580', salt, 1000), { salt, iterations: 1000 });
    const s = (await spark('east', NOW))!;
    expect((await db.episodes.get(s.episode.id))!.fixationId).toBe('east');
  });
});

describe('Next', () => {
  it('is his line, trimmed; an empty one takes it away; sealed with the PIN', async () => {
    await store.put('fixations', fx('east'));
    await setNext('east', '  Chapter nine  ', NOW);
    expect((await fixationById('east'))!.next).toBe('Chapter nine');
    const salt = randomSalt();
    await setKey(await deriveKey('2580', salt, 1000), { salt, iterations: 1000 });
    await setNext('east', 'The harbor at dawn', NOW);
    expect(JSON.stringify(await db.fixations.get('east'))).not.toContain('harbor');
    await setNext('east', '   ', NOW);
    expect((await fixationById('east'))!.next).toBeUndefined();
  });
});

describe('the doctor line moves (one-time pass)', () => {
  /** The Energize row as an older journal has it: the doctor line on restLine, none on The tip. */
  async function older() {
    await ensureSeeded();
    const f = (await flowById('energize'))!;
    await store.put('flows', {
      ...f, restLine: DOCTOR_LINE,
      steps: f.steps.map(s => ({ ...s, tips: s.tips.filter(t => t.id !== 'energize-4-doctor') })),
    });
    const s = (await store.get('settings', 'app'))!;
    expect(s.cleaned).not.toContain(DOCTOR_PASS);
  }
  const tipStep = async () => (await flowById('energize'))!.steps.find(s => s.id === 'energize-4')!;

  it('adds the print line to The tip once and clears restLine; a rerun does nothing', async () => {
    await older();
    const revs = (await flowById('energize'))!.revisions.length;
    expect(await moveDoctorLineOnce()).toBe(true);
    const f = (await flowById('energize'))!;
    expect(f.restLine).toBeUndefined();
    expect('restLine' in f && f.restLine !== undefined).toBe(false);
    const step = await tipStep();
    expect(step.tips.filter(t => t.print)).toEqual([{ id: 'energize-4-doctor', text: DOCTOR_LINE, print: true }]);
    expect(f.revisions).toHaveLength(revs + 1);
    // a print line is not a row: the step's rows and their cap are as they were
    expect(shownTips(step, false).map(t => t.id)).not.toContain('energize-4-doctor');
    expect(shownTips(step, false)).toHaveLength(4);
    expect((await store.get('settings', 'app'))!.cleaned).toContain(DOCTOR_PASS);
    const after = await flowById('energize');
    expect(await moveDoctorLineOnce()).toBe(false);
    expect(await flowById('energize')).toEqual(after);
  });

  it('is a no-op on a fresh journal, which is seeded in the final shape', async () => {
    await ensureSeeded();
    const f = await flowById('energize');
    expect(f!.restLine).toBeUndefined();
    expect(await moveDoctorLineOnce()).toBe(false);
    expect(await flowById('energize')).toEqual(f);
    expect((await store.get('settings', 'app'))!.cleaned).toContain(DOCTOR_PASS);
  });

  it('does nothing to a deleted flow, and never brings it back', async () => {
    await older();
    await store.delete('flows', 'energize');
    expect(await moveDoctorLineOnce()).toBe(false);
    expect(await flowById('energize')).toBeUndefined();
    expect(await db.flows.count()).toBe(8);
  });

  it('keeps his edits: his step names, his own tips, a restLine he rewrote, a step he deleted', async () => {
    await older();
    const f = (await flowById('energize'))!;
    await store.put('flows', {
      ...f, name: 'Wind up', restLine: 'My own boundary line',
      steps: f.steps.map(s => (s.id === 'energize-4'
        ? { ...s, name: 'Over the top', tips: [...s.tips, { id: 'mine', text: 'Call Ali' }] }
        : s)),
    });
    expect(await moveDoctorLineOnce()).toBe(true);
    const g = (await flowById('energize'))!;
    expect(g.name).toBe('Wind up');
    expect(g.restLine).toBe('My own boundary line');
    const step = await tipStep();
    expect(step.name).toBe('Over the top');
    expect(step.tips.map(t => t.id).slice(-2)).toEqual(['mine', 'energize-4-doctor']);

    // a step he deleted gets nothing, and restLine stays where it is
    await db.delete();
    db = await freshDB();
    await older();
    const h = (await flowById('energize'))!;
    await store.put('flows', { ...h, steps: h.steps.filter(s => s.id !== 'energize-4') });
    expect(await moveDoctorLineOnce()).toBe(false);
    expect((await flowById('energize'))!.restLine).toBe(DOCTOR_LINE);
  });

  it('a line he already wrote on The tip is not added twice; the seed restLine still goes', async () => {
    await older();
    const f = (await flowById('energize'))!;
    await store.put('flows', { ...f, steps: f.steps.map(s => (s.id === 'energize-4' ? { ...s, tips: [...s.tips, { id: 'his', text: DOCTOR_LINE, print: true }] } : s)) });
    expect(await moveDoctorLineOnce()).toBe(true);
    const step = await tipStep();
    expect(step.tips.filter(t => t.text === DOCTOR_LINE)).toHaveLength(1);
    expect((await flowById('energize'))!.restLine).toBeUndefined();
  });

  it('waits for the PIN on a locked journal', async () => {
    await older();
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    lock();
    expect(await moveDoctorLineOnce()).toBeNull();
    await unlock(key);
    expect(await moveDoctorLineOnce()).toBe(true);
    expect(JSON.stringify(await db.flows.get('energize'))).not.toContain('talk to your doctor');
  });
});
