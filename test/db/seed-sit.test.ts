// Meditate S3 (PLAN-MEDITATE.md section 6): "Sit with the rain" with the Sit helper is seeded on Panic "Under the skin"
// (after "A warm shower"), What if on the climb before its peak, and Energize "Landing", never at a peak. A new journal
// has the three from the seed; a journal seeded before S3 gets them once, each in its seed place, as a revision, by the
// same once-only pass as F4's later tips (seed.ts seedFlowsOnce, SEED_TIPS_LATER). A tip he struck or reworded is
// never duplicated or restored, and a second pass adds nothing.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from './helpers';
import { ensureSeeded, seedFlowsOnce } from '../../src/db/seed';
import { SEED_FLOWS, SEED_TIPS_LATER } from '../../src/db/seed-flows';
import { flowById } from '../../src/model/flows';
import { store } from '../../src/db/fields';
import type { Flow, Tip } from '../../src/db/schema';
import { HELPERS } from '../../src/ui/flow/StepSheet';

const SIT_TIPS = ['panic-4-sit', 'whatif-2-sit', 'energize-5-sit'];
const where = (flows: Pick<Flow, 'id' | 'steps'>[]) => flows.flatMap(f => f.steps.flatMap(s => s.tips
  .filter(t => t.helper === 'sit').map(t => ({ flow: f.id, step: s.id, tip: t.id, text: t.text, peak: !!s.peak }))));
const tipsOf = (f: Pick<Flow, 'steps'>, stepId: string) => f.steps.find(s => s.id === stepId)!.tips;

describe('the seed', () => {
  it('three Sit rows, "Sit with the rain", on Under the skin, What if and Landing, never at a peak', () => {
    expect(where(SEED_FLOWS)).toEqual([
      { flow: 'panic', step: 'panic-4', tip: 'panic-4-sit', text: 'Sit with the rain', peak: false },
      { flow: 'energize', step: 'energize-5', tip: 'energize-5-sit', text: 'Sit with the rain', peak: false },
      { flow: 'whatif', step: 'whatif-2', tip: 'whatif-2-sit', text: 'Sit with the rain', peak: false },
    ]);
    const panic = SEED_FLOWS.find(f => f.id === 'panic')!;
    const ids = tipsOf(panic, 'panic-4').map(t => t.id);
    expect(ids[ids.indexOf('panic-4-album') + 1]).toBe('panic-4-sit');
  });
  it('the three are later seed tips, and Sit is offered in the step sheet', () => {
    for (const id of SIT_TIPS) expect(SEED_TIPS_LATER).toContain(id);
    expect(HELPERS).toContain('sit');
  });
});

describe('a new journal', () => {
  beforeEach(async () => { await freshDB(); });
  it('has the three from the seed, in its first revision, and the pass adds nothing', async () => {
    await ensureSeeded();
    const flows = await store.all('flows');
    expect(where(flows).map(x => x.tip).sort()).toEqual([...SIT_TIPS].sort());
    for (const f of flows) expect(f.revisions, f.id).toHaveLength(1);
    expect(await seedFlowsOnce()).toEqual([]);
    for (const f of await store.all('flows')) expect(f.revisions, f.id).toHaveLength(1);
  });
});

describe('a journal seeded before S3', () => {
  beforeEach(async () => { await freshDB(); });

  /** A journal as S2 left it: every flow seeded without the Sit rows, the three not yet marked. */
  async function asS2() {
    await ensureSeeded();
    const sit = new Set(SIT_TIPS);
    for (const row of await store.all('flows')) {
      const steps = row.steps.map(s => ({ ...s, tips: s.tips.filter((t: Tip) => !sit.has(t.id)) }));
      await store.put('flows', { ...row, steps, revisions: [{ ...row.revisions[0], steps }] });
    }
    const s = (await store.get('settings', 'app'))!;
    await store.put('settings', { ...s, flowsSeeded: s.flowsSeeded!.filter(m => !SIT_TIPS.map(id => `tip:${id}`).includes(m)) });
  }

  it('gets the three once, each in its seed place, as a revision; a second pass adds nothing', async () => {
    await asS2();
    expect(where(await store.all('flows'))).toEqual([]);
    expect(await seedFlowsOnce()).toEqual([]);
    for (const id of ['panic', 'whatif', 'energize']) {
      const f = (await flowById(id))!;
      const seed = SEED_FLOWS.find(x => x.id === id)!;
      const step = seed.steps.find(s => s.tips.some(t => t.helper === 'sit'))!;
      expect(tipsOf(f, step.id).map(t => t.id), id).toEqual(step.tips.map(t => t.id));
      expect(f.revisions, id).toHaveLength(2);
      expect(tipsOf(f.revisions[1], step.id).some(t => t.id === `${step.id}-sit`), id).toBe(true);
    }
    // the other flows are untouched
    expect((await flowById('fight'))!.revisions).toHaveLength(1);
    expect(await seedFlowsOnce()).toEqual([]);
    expect(where(await store.all('flows'))).toHaveLength(3);
    expect((await flowById('panic'))!.revisions).toHaveLength(2);
  });

  it('a Sit row he struck or reworded is never restored or doubled', async () => {
    await asS2();
    await seedFlowsOnce();
    const p = (await flowById('panic'))!;
    await store.put('flows', { ...p, steps: p.steps.map(s => ({ ...s, tips: s.tips.map(t => (t.id === 'panic-4-sit' ? { ...t, struck: true } : t)) })) });
    const e = (await flowById('energize'))!;
    await store.put('flows', { ...e, steps: e.steps.map(s => ({ ...s, tips: s.tips.map(t => (t.id === 'energize-5-sit' ? { ...t, text: 'Ten minutes of ocean' } : t)) })) });
    const w = (await flowById('whatif'))!;
    await store.put('flows', { ...w, steps: w.steps.map(s => ({ ...s, tips: s.tips.filter(t => t.id !== 'whatif-2-sit') })) });
    await seedFlowsOnce();
    // and even with the marks gone (an old backup's settings), a tip there by id is left as he left it
    const s = (await store.get('settings', 'app'))!;
    await store.put('settings', { ...s, flowsSeeded: s.flowsSeeded!.filter(m => m !== 'tip:panic-4-sit' && m !== 'tip:energize-5-sit') });
    await seedFlowsOnce();
    const panic = tipsOf((await flowById('panic'))!, 'panic-4').filter(t => t.id === 'panic-4-sit');
    expect(panic).toEqual([expect.objectContaining({ struck: true, text: 'Sit with the rain' })]);
    const energize = tipsOf((await flowById('energize'))!, 'energize-5').filter(t => t.id === 'energize-5-sit');
    expect(energize).toEqual([expect.objectContaining({ text: 'Ten minutes of ocean' })]);
    expect(tipsOf((await flowById('whatif'))!, 'whatif-2').some(t => t.id === 'whatif-2-sit')).toBe(false);
  });
});
