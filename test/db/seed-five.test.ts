// The missed five (F4, PLAN-FLOWS.md 3.5 and 3.7) as seeded: the words audit holds on every said line and tip,
// Still's words have no digits, the peaks and spans are where the plan puts them, Still comes first on Shutdown and
// 3 a.m., the Avoidance step is a tip on Panic and Depress, and every hand-off is a printed line naming a real step.
// A journal seeded before F4 gets the five flows and the later tips once, as a revision, and never again.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from './helpers';
import { ensureSeeded, seedFlowsOnce } from '../../src/db/seed';
import { SEED_FLOWS, SEED_TIPS_LATER, PANIC } from '../../src/db/seed-flows';
import { WHATIF } from '../../src/db/seed/whatif';
import { REPLAY } from '../../src/db/seed/replay';
import { NIGHT } from '../../src/db/seed/night';
import { SHUTDOWN } from '../../src/db/seed/shutdown';
import { SHAME } from '../../src/db/seed/shame';
import { DEPRESS } from '../../src/db/seed/depress';
import { ENERGIZE } from '../../src/db/seed/energize';
import { FIGHT } from '../../src/db/seed/fight';
import { flowById } from '../../src/model/flows';
import { store } from '../../src/db/fields';
import type { FlowDB, Tip } from '../../src/db/schema';
import { shownTips } from '../../src/model/tips';

const FIVE = [WHATIF, REPLAY, NIGHT, SHUTDOWN, SHAME];
const AUDIT = /\u2014|calm down|It isn't|it isn't|relapse|\bGP\b|round the block|pinned|hypomania|dorsal|vagal|fight-or-flight/i;

describe.each(FIVE.map(f => [f.name, f] as const))('%s', (_, flow) => {
  it('every said line passes the audit', () => {
    for (const s of flow.steps) {
      expect(s.said, s.id).toBeTruthy();
      expect(s.said).not.toMatch(AUDIT);
    }
  });
  it('every tip has a text and passes the audit; usualShort has no digit; every step has a span', () => {
    for (const s of flow.steps) {
      expect(s.tips.length, s.id).toBeGreaterThan(0);
      for (const t of s.tips) {
        expect(t.text.trim(), t.id).toBeTruthy();
        expect(t.text).not.toMatch(AUDIT);
        if (t.short) expect(t.short).not.toMatch(/\u2014/);
      }
      expect(s.usualShort, s.id).toBeTruthy();
      expect(s.usualShort).not.toMatch(/\d/);
      expect(s.spanMin, s.id).toBeGreaterThan(0);
    }
  });
  it('one peak, ids unique, no line put in Tommy\'s mouth (the plan gives none), no em dash', () => {
    expect(flow.steps.filter(s => s.peak)).toHaveLength(1);
    const ids = [...flow.steps.map(s => s.id), ...flow.steps.flatMap(s => s.tips.map(t => t.id))];
    expect(new Set(ids).size).toBe(ids.length);
    expect(flow.steps.every(s => s.line === undefined)).toBe(true);
    expect(flow.line).toBeUndefined();
    expect(JSON.stringify(flow)).not.toMatch(/\u2014/);
  });
});

describe('the five as the plan has them', () => {
  it('the list order follows the walkthrough: What if, Replay, 3 a.m., Shutdown, Shame, after Fight', () => {
    expect(SEED_FLOWS.slice(4).map(f => f.id)).toEqual(['whatif', 'replay', 'night', 'shutdown', 'shame']);
    expect(FIVE.map(f => f.diagram)).toEqual(['curve', 'coil', 'clock', 'stairs', 'fork']);
  });
  it('the step names are the plan\'s', () => {
    expect(FIVE.map(f => f.steps.map(s => s.name))).toEqual([
      ["Something's coming", 'What if', 'Night before', 'The thing', 'It was fine'],
      ['That stung', 'Why did I', 'Heavier', 'How, not why'],
      ['Awake again', 'What time is it', 'Lying there', 'Up', 'Same alarm'],
      ['Too much', 'Stuck', 'Far away', 'Thawing'],
      ['Seen', "I'm worthless", 'Hide or hit back', 'I did a thing'],
    ]);
  });
  it('the peaks: the night before, heavier, lying there, far away, the verdict', () => {
    expect(FIVE.map(f => f.steps.find(s => s.peak)!.name)).toEqual(['Night before', 'Heavier', 'Lying there', 'Far away', "I'm worthless"]);
  });
  it('the spans: What if in days, Replay in hours, 3 a.m. in tens of minutes, Shutdown up to an hour, Shame to hours', () => {
    const spans = (f: typeof WHATIF) => f.steps.map(s => s.spanMin!);
    expect(spans(WHATIF)[0]).toBeGreaterThanOrEqual(24 * 60);
    expect(Math.max(...spans(REPLAY))).toBeGreaterThanOrEqual(120);
    expect(spans(NIGHT).every(m => m >= 10 && m <= 60)).toBe(true);
    expect(spans(SHUTDOWN).every(m => m <= 60)).toBe(true);
    expect(Math.min(...spans(SHAME))).toBeLessThan(60);
    expect(Math.max(...spans(SHAME))).toBeGreaterThanOrEqual(120);
  });
  it('Still first on Shutdown and 3 a.m.: the Still row is the first row of every step in Day and Night, gone in Still', () => {
    for (const f of [NIGHT, SHUTDOWN]) for (const s of f.steps) {
      expect(s.tips[0].helper, s.id).toBe('still');
      expect(shownTips(s, false)[0].helper, s.id).toBe('still');
      expect(shownTips(s, true).some(t => t.helper === 'still'), s.id).toBe(false);
    }
  });
  it('"nine in ten" is a natural frequency, in words', () => {
    expect(WHATIF.steps[1].said).toMatch(/^Nine in ten/);
    expect(JSON.stringify(WHATIF)).not.toMatch(/9 in 10|91|%/);
  });
  it('3 a.m. carries the sleep caution as its line at rest, gently, never a step', () => {
    expect(NIGHT.restLine).toMatch(/talk to your doctor/);
    expect(JSON.stringify(NIGHT.steps)).not.toMatch(/doctor/);
    expect(NIGHT.restLine).not.toMatch(/mania/i);
  });
});

const all = SEED_FLOWS.flatMap(f => f.steps.flatMap(s => s.tips.map(t => ({ flow: f.id, step: s.id, tip: t }))));

describe('Avoidance and the hand-offs', () => {
  it('Avoidance is a tip, "the small version", on Panic (after the peak) and Depress (pulling in), not a flow', () => {
    const small = all.filter(x => /small version/.test(x.tip.text));
    expect(small.map(x => [x.flow, x.step])).toEqual([['panic', 'panic-3'], ['depress', 'depress-2']]);
    expect(SEED_FLOWS.map(f => f.name)).not.toContain('Avoidance');
    // F2 shows at most six rows: the tip is among them
    for (const x of small) expect(SEED_FLOWS.find(f => f.id === x.flow)!.steps.find(s => s.id === x.step)!.tips.filter(t => !t.print).length).toBeLessThanOrEqual(6);
  });
  it('the five seeded hand-offs, each a printed line naming a real step of another flow', () => {
    const hand = all.filter(x => x.tip.handoff);
    expect(hand.map(x => `${x.step} > ${x.tip.handoff!.flowId}/${x.tip.handoff!.stepId}`)).toEqual([
      'panic-4 > depress/depress-1',
      'energize-5 > depress/depress-1',
      'fight-1 > depress/depress-1',
      'whatif-3 > panic/panic-1',
      'shame-3 > fight/fight-1',
    ]);
    for (const { flow, tip } of hand) {
      expect(tip.print, tip.id).toBe(true);
      expect(tip.wise).toBeFalsy();
      const to = SEED_FLOWS.find(f => f.id === tip.handoff!.flowId)!;
      expect(to.id).not.toBe(flow);
      expect(to.steps.map(s => s.id)).toContain(tip.handoff!.stepId);
      expect(tip.text).toContain(`the ${to.name} flow.`);
    }
    expect(SHAME.steps[2].tips.find(t => t.handoff)!.text).toBe("If it's hot: the Fight flow.");
  });
  it('every later tip names a tip in its seed flow', () => {
    const tipIds = new Set(all.map(x => x.tip.id));
    for (const id of SEED_TIPS_LATER) expect(tipIds.has(id), id).toBe(true);
  });
});

describe('a journal seeded before F4', () => {
  let db: FlowDB;
  beforeEach(async () => { db = await freshDB(); });

  /** A journal as F3 left it: the four flows as F3 seeded them (no later tips), marked seeded, nothing else. */
  async function asF3() {
    await ensureSeeded();
    const later = new Set(SEED_TIPS_LATER);
    for (const id of ['whatif', 'replay', 'night', 'shutdown', 'shame']) await db.flows.delete(id);
    for (const f of [PANIC, DEPRESS, ENERGIZE, FIGHT]) {
      const row = (await store.get('flows', f.id))!;
      const steps = row.steps.map(s => ({ ...s, tips: s.tips.filter((t: Tip) => !later.has(t.id)) }));
      await store.put('flows', { ...row, steps, revisions: [{ ...row.revisions[0], steps }] });
    }
    const s = (await store.get('settings', 'app'))!;
    await store.put('settings', { ...s, flowsSeeded: ['panic', 'depress', 'energize', 'fight'] });
  }

  it('gets the five flows and the later tips once, each in its seed place, as a revision', async () => {
    await asF3();
    expect(await seedFlowsOnce()).toEqual(['whatif', 'replay', 'night', 'shutdown', 'shame']);
    const panic = (await flowById('panic'))!;
    expect(panic.steps[2].tips.map(t => t.id)).toEqual(PANIC.steps[2].tips.map(t => t.id));
    expect(panic.steps[3].tips.at(-1)!.handoff).toEqual({ flowId: 'depress', stepId: 'depress-1' });
    expect(panic.revisions).toHaveLength(2);
    const depress = (await flowById('depress'))!;
    expect(depress.steps[1].tips.map(t => t.id)).toEqual(DEPRESS.steps[1].tips.map(t => t.id));
    expect((await flowById('fight'))!.steps[0].tips.some(t => t.id === 'fight-1-depress')).toBe(true);
    expect((await flowById('energize'))!.steps[4].tips.some(t => t.id === 'energize-5-depress')).toBe(true);
    // once: a second pass writes nothing, and a tip he then deletes stays gone
    expect(await seedFlowsOnce()).toEqual([]);
    const p2 = (await flowById('panic'))!;
    await store.put('flows', { ...p2, steps: p2.steps.map(s => ({ ...s, tips: s.tips.filter(t => t.id !== 'panic-3-avoid') })) });
    await seedFlowsOnce();
    expect((await flowById('panic'))!.steps[2].tips.some(t => t.id === 'panic-3-avoid')).toBe(false);
    expect((await flowById('panic'))!.revisions).toHaveLength(2);
  });

  it('a flow he deleted gets no later tip and stays gone', async () => {
    await asF3();
    await store.delete('flows', 'energize');
    await seedFlowsOnce();
    expect(await flowById('energize')).toBeUndefined();
  });
});
