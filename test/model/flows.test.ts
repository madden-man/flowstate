import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB, Flow } from '../../src/db/schema';
import { ensureSeeded, seedFlowsOnce } from '../../src/db/seed';
import { PANIC, SEED_FLOWS, SEED_FLOWS_AT, SEED_TIPS_LATER, seedFlow } from '../../src/db/seed-flows';
import { store, setKey, lock } from '../../src/db/fields';
import { PICKS } from '../../src/db/seed/picks';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { exportData, importData, parseBackup, stamp } from '../../src/db/backup';
import {
  flows, flowById, stepAt, placeOf, liveEpisode, lastEnded, moveDot, onOpen, lastTimeOf, spanWords, flowStates, currentStepId,
} from '../../src/model/flows';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 8, 21, 36);
const ids = PANIC.steps.map(s => s.id);

describe('the seed flows', () => {
  it('a fresh journal is seeded with Panic, its seed text as the first revision', async () => {
    await ensureSeeded();
    const [panic] = await flows();
    expect(panic.name).toBe('Panic');
    expect(panic.diagram).toBe('ring');
    expect(panic.steps.map(s => s.name)).toEqual(['Overstimulated', 'The wave', 'Settling', 'Under the skin']);
    expect(panic.revisions).toEqual([{ at: SEED_FLOWS_AT, name: 'Panic', steps: panic.steps }]);
    expect((await store.get('settings', 'app'))!.flowsSeeded).toEqual([
      ...SEED_FLOWS.map(f => f.id), ...SEED_TIPS_LATER.map(id => `tip:${id}`), ...PICKS.map(p => `picks:${p.stepId}`),
    ]);
    expect(await seedFlowsOnce()).toEqual([]);
  });

  it('every step has a line, a said line, a usual, a words-only usual, a span and tips; the peak is marked once', () => {
    for (const s of PANIC.steps) {
      expect(s.line && s.said && s.usual && s.usualShort && s.spanMin).toBeTruthy();
      expect(s.tips.length).toBeGreaterThan(0);
      expect(s.usualShort).not.toMatch(/\d/);
    }
    expect(PANIC.steps.filter(s => s.peak).map(s => s.id)).toEqual(['panic-2']);
  });

  it('the language audit holds: no "It isn\'t", no clinic words, no em dashes', () => {
    const text = JSON.stringify(PANIC);
    expect(text).not.toMatch(/It isn't|relapse|\bGP\b|\bround the block|\u2014/);
    expect(text).toMatch(/false alarm/);
  });

  it('a journal seeded before flows gets Panic once; deleted, it stays gone', async () => {
    await ensureSeeded();
    await db.flows.clear();
    const s = (await store.get('settings', 'app'))!;
    await store.put('settings', { ...s, flowsSeeded: undefined });
    expect(await seedFlowsOnce()).toEqual(SEED_FLOWS.map(f => f.id));
    expect((await flowById('panic'))!.name).toBe('Panic');
    await store.delete('flows', 'panic');
    expect(await seedFlowsOnce()).toEqual([]);
    expect(await flowById('panic')).toBeUndefined();
  });

  it('a flow already there (an import) is not written over, only marked', async () => {
    await ensureSeeded();
    const s = (await store.get('settings', 'app'))!;
    await store.put('settings', { ...s, flowsSeeded: [] });
    await store.put('flows', { ...seedFlow(PANIC), name: 'Mine' });
    expect(await seedFlowsOnce()).toEqual([]);
    expect((await flowById('panic'))!.name).toBe('Mine');
  });

  it('with a PIN every word of a flow is sealed, and opens again with the key', async () => {
    await ensureSeeded();
    const salt = randomSalt();
    await setKey(await deriveKey('3569', salt, 1000), { salt, iterations: 1000 });
    const raw = JSON.stringify(await db.flows.get('panic'));
    for (const word of ['Panic', 'Overstimulated', 'Too much coming in', 'false alarm', 'Cold water', 'Wait out']) expect(raw).not.toContain(word);
    // the shape stays clear, so the list can draw it locked
    expect(raw).toContain('"diagram":"ring"');
    expect((await flowById('panic'))!.steps[0].line).toBe('Too much coming in at once.');
    lock();
    const locked = (await flowById('panic'))!;
    expect(locked.locked).toBe(true);
    expect(locked.steps.map(s => s.id)).toEqual(ids);
  });
});

describe('episodes', () => {
  beforeEach(async () => { await ensureSeeded(); });

  it('a drag off rest starts an episode with its marks; each detent marks; back on rest ends it', async () => {
    expect(await moveDot('panic', [], 'rest', T0)).toBeUndefined();
    const e = (await moveDot('panic', [], ids[0], T0))!;
    expect(e.startedAt).toBe(T0);
    expect(e.marks).toEqual([{ stepId: ids[0], at: T0 }]);
    await moveDot('panic', [ids[1]], ids[2], T0 + 6 * MIN);
    const live = (await liveEpisode('panic'))!;
    expect(live.marks.map(m => m.stepId)).toEqual(ids.slice(0, 3));
    expect(currentStepId(live)).toBe(ids[2]);
    // the same step again is not a new mark
    await moveDot('panic', [], ids[2], T0 + 7 * MIN);
    expect((await liveEpisode('panic'))!.marks).toHaveLength(3);
    await moveDot('panic', [ids[3]], 'rest', T0 + 54 * MIN);
    expect(await liveEpisode('panic')).toBeUndefined();
    const last = (await lastEnded('panic'))!;
    expect(last.endedAt).toBe(T0 + 54 * MIN);
    expect(lastTimeOf(PANIC, last)).toEqual({ at: T0, minutes: 48, from: 'peak' });
  });

  it('the list knows the live flow and its step', async () => {
    await moveDot('panic', [], ids[1], T0);
    const [st] = await flowStates();
    expect(st.live && placeOf(st.flow, currentStepId(st.live))).toBe(2);
    expect(st.last).toBeUndefined();
  });

  it('the app opens on a live episode inside its step\'s usual span, and not after', async () => {
    await moveDot('panic', [], ids[0], T0);
    expect(await onOpen(T0 + 10 * MIN)).toEqual({ flowId: 'panic', step: 1 });
    // past Overstimulated's 30 minutes: the journal, but the episode stays open
    expect(await onOpen(T0 + 45 * MIN)).toBeNull();
    expect(await liveEpisode('panic')).toBeTruthy();
  });

  it('untouched past the last step\'s usual span, the episode ends at its last touch on the next open', async () => {
    await moveDot('panic', [ids[0], ids[1], ids[2]], ids[3], T0);
    expect(await onOpen(T0 + 7 * 60 * MIN)).toBeNull();
    const last = (await lastEnded('panic'))!;
    expect(last.endedAt).toBe(T0);
    expect(await liveEpisode('panic')).toBeUndefined();
  });

  it('an episode stamps its last touch for a merge import', async () => {
    const e = (await moveDot('panic', [], ids[0], T0))!;
    await moveDot('panic', [], ids[1], T0 + 5 * MIN);
    expect(stamp((await db.episodes.get(e.id)) as never)).toBe(T0 + 5 * MIN);
  });
});

describe('last time', () => {
  const flow = { steps: PANIC.steps } as Pick<Flow, 'steps'>;
  it('counts from the peak to the end, and says nothing it does not know', () => {
    expect(lastTimeOf(flow, { startedAt: 0, endedAt: 50 * MIN, marks: [{ stepId: 'panic-2', at: 2 * MIN }] })!.minutes).toBe(48);
    expect(lastTimeOf(flow, { startedAt: 0, endedAt: 50 * MIN, marks: [{ stepId: 'panic-1', at: 0 }] })!.minutes).toBeUndefined();
    expect(lastTimeOf(flow, { startedAt: 0, endedAt: 2 * MIN, marks: [{ stepId: 'panic-2', at: 2 * MIN }] })!.minutes).toBeUndefined();
    expect(lastTimeOf(flow, { startedAt: 0, marks: [] })).toBeNull();
  });
  it('in words a person says', () => {
    expect(spanWords(1)).toBe('1 minute');
    expect(spanWords(48)).toBe('48 minutes');
    expect(spanWords(190)).toBe('about 3 hours');
  });
  it('steps by their place', () => {
    expect(stepAt(PANIC, 2)!.id).toBe('panic-2');
    expect(stepAt(PANIC, 5)).toBeUndefined();
    expect(placeOf(PANIC, 'panic-4')).toBe(4);
  });
});

describe('backup', () => {
  it('flows and episodes round-trip', async () => {
    await ensureSeeded();
    await moveDot('panic', [], ids[1], T0);
    const file = parseBackup(JSON.stringify(await exportData(db, 1000)));
    expect(file.tables.flows).toHaveLength(SEED_FLOWS.length);
    expect(file.tables.episodes).toHaveLength(1);
    const other = await freshDB();
    await importData(file, 'replace', other);
    expect((await flows())[0].steps[1].name).toBe('The wave');
    expect((await liveEpisode('panic'))!.marks[0].stepId).toBe(ids[1]);
  });

  it('a version 2 file comes in with no flows, and the next open seeds Panic', async () => {
    await ensureSeeded();
    const f = await exportData(db, 1000);
    const v2 = { ...f, schemaVersion: 2, tables: { ...f.tables } } as Record<string, unknown> & typeof f;
    delete (v2.tables as Record<string, unknown>).flows;
    delete (v2.tables as Record<string, unknown>).episodes;
    const s = (v2.tables.settings as Record<string, unknown>[])[0];
    delete s.flowsSeeded;
    const other = await freshDB();
    await importData(parseBackup(JSON.stringify(v2)), 'replace', other);
    expect(await other.flows.count()).toBe(0);
    expect(await seedFlowsOnce()).toEqual(SEED_FLOWS.map(f => f.id));
  });
});
