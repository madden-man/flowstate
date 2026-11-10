// Depress, Energize and Fight (F3, PLAN-FLOWS.md 3.2 to 3.4) as seeded: the words audit holds on every said line and
// tip, Still's words have no digits, the peaks are where the plan puts them, and the safety and boundary lines are
// printed lines, never rows to tick.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from './helpers';
import { ensureSeeded } from '../../src/db/seed';
import { SEED_FLOWS } from '../../src/db/seed-flows';
import { DEPRESS } from '../../src/db/seed/depress';
import { ENERGIZE } from '../../src/db/seed/energize';
import { FIGHT } from '../../src/db/seed/fight';
import { flows } from '../../src/model/flows';
import { store, setKey } from '../../src/db/fields';
import type { FlowDB } from '../../src/db/schema';
import { deriveKey, randomSalt } from '../../src/db/crypto';

const THREE = [DEPRESS, ENERGIZE, FIGHT];

describe.each(THREE.map(f => [f.name, f] as const))('%s', (_, flow) => {
  it('every said line passes the audit', () => {
    for (const s of flow.steps) {
      expect(s.said, s.id).toBeTruthy();
      expect(s.said).not.toMatch(/\u2014|calm down|It isn't|it isn't|relapse|\bGP\b|round the block/i);
    }
  });
  it('every tip has a text and passes the audit; usualShort has no digit', () => {
    for (const s of flow.steps) {
      expect(s.tips.length, s.id).toBeGreaterThan(0);
      for (const t of s.tips) {
        expect(t.text.trim(), t.id).toBeTruthy();
        expect(t.text).not.toMatch(/\u2014|calm down|It isn't|\bGP\b/i);
        if (t.short) expect(t.short).not.toMatch(/\u2014/);
      }
      expect(s.usualShort, s.id).toBeTruthy();
      expect(s.usualShort).not.toMatch(/\d/);
      expect(s.spanMin, s.id).toBeGreaterThan(0);
    }
  });
  it('one peak, ids unique, no line put in Tommy\'s mouth beyond the plan', () => {
    expect(flow.steps.filter(s => s.peak)).toHaveLength(1);
    const ids = [...flow.steps.map(s => s.id), ...flow.steps.flatMap(s => s.tips.map(t => t.id))];
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(flow)).not.toMatch(/\u2014/);
  });
});

describe('the three as the plan has them', () => {
  it('the list order is Panic, Depress, Energize, Fight, then F4\'s five', () => {
    expect(SEED_FLOWS.map(f => f.name)).toEqual(['Panic', 'Depress', 'Energize', 'Fight', 'What if', 'Replay', '3 a.m.', 'Shutdown', 'Shame']);
    expect(SEED_FLOWS.map(f => f.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(THREE.map(f => f.diagram)).toEqual(['valley', 'arc', 'mountain']);
  });
  it('the peaks: Depress at the bottom, Energize at the tip, Fight flooded', () => {
    expect(THREE.map(f => f.steps.find(s => s.peak)!.name)).toEqual(['The bottom', 'The tip', 'Flooded']);
  });
  it('the bottom ends on the safety line, printed, 988 only', () => {
    const bottom = DEPRESS.steps[3];
    const last = bottom.tips.at(-1)!;
    expect(last.print).toBe(true);
    expect(last.text).toContain('988');
    expect(last.text).not.toMatch(/111|NHS/);
    expect(bottom.tips.filter(t => t.print)).toEqual([last]);
  });
  it('the hypomania line is a print line under The tip\'s rows (X5), not a row and not a step', () => {
    expect(ENERGIZE.restLine).toBeUndefined();
    const tip = ENERGIZE.steps.find(s => s.id === 'energize-4')!;
    expect(tip.tips.filter(t => t.print)).toEqual([{ id: 'energize-4-doctor', text: 'Highs most days for a week without needing sleep: talk to your doctor.', print: true }]);
    expect(JSON.stringify(ENERGIZE.steps.filter(s => s.id !== 'energize-4'))).not.toMatch(/doctor/i);
    expect(JSON.stringify(ENERGIZE)).not.toMatch(/\bmania/i);
  });
  it('Fight: the flooded step carries the return time, cooling asks "slower now?", nobody counts a pulse there', () => {
    const flooded = FIGHT.steps.find(s => s.name === 'Flooded')!;
    expect(flooded.tips[0]).toMatchObject({ helper: 'timer', text: `Say "I'm going, back at 7:40"` });
    const cooling = FIGHT.steps.find(s => s.name === 'Cooling')!;
    expect(cooling.line).toBe('Slower now?');
    expect(cooling.spanMin).toBe(60);
    expect(JSON.stringify(cooling)).not.toMatch(/pulse|hundred/);
  });
});

describe('seeded and sealed', () => {
  let db: FlowDB;
  beforeEach(async () => { db = await freshDB(); });
  it('a fresh journal has all nine; with a PIN the new lines are sealed too', async () => {
    await ensureSeeded();
    expect((await flows()).map(f => f.id)).toEqual(['panic', 'depress', 'energize', 'fight', 'whatif', 'replay', 'night', 'shutdown', 'shame']);
    const salt = randomSalt();
    await setKey(await deriveKey('3569', salt, 1000), { salt, iterations: 1000 });
    const raw = JSON.stringify(await db.flows.get('energize')) + JSON.stringify(await db.flows.get('depress'));
    for (const word of ['Highs most days', 'call or text', 'The bottom', 'Locked in']) expect(raw).not.toContain(word);
    expect(raw).toContain('"print":true');
    expect((await store.get('flows', 'energize'))!.steps[3].tips.at(-1)!.text).toMatch(/^Highs most days/);
  });
});
