// Your own flows (F3): "+ flow" makes a flow with one unnamed step at the end of the list; "+ step" names that step
// first, then adds at the end; every change is kept as a revision; a locked journal writes nothing.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { flows, flowById } from '../../src/model/flows';
import { makeFlow, addStep, isUnnamed, DIAGRAMS } from '../../src/model/flow-make';
import { setKey, lock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';

beforeEach(async () => { await freshDB(); await ensureSeeded(); });

describe('making a flow', () => {
  it('a new flow goes last, with one unnamed step, and is never called now', async () => {
    const f = await makeFlow('  Grief ', 'valley', 1000);
    const all = await flows();
    expect(all.at(-1)!.id).toBe(f.id);
    expect(f.id).not.toBe('now');
    expect(f).toMatchObject({ name: 'Grief', diagram: 'valley', createdAt: 1000 });
    expect(f.order).toBeGreaterThan(Math.max(...all.slice(0, -1).map(x => x.order)));
    expect(f.steps).toHaveLength(1);
    expect(isUnnamed(f.steps[0])).toBe(true);
    expect(f.revisions).toEqual([{ at: 1000, name: 'Grief', steps: f.steps }]);
  });

  it('the first step names the empty one; the next is added; each change a revision', async () => {
    const f = await makeFlow('Grief', 'ring', 1000);
    await addStep(f.id, { name: ' Facing it ', line: 'Everything is heavy.', said: '  ' }, 2000);
    let g = (await flowById(f.id))!;
    expect(g.steps).toHaveLength(1);
    expect(g.steps[0]).toMatchObject({ id: f.steps[0].id, name: 'Facing it', line: 'Everything is heavy.' });
    expect(g.steps[0].said).toBeUndefined();
    await addStep(f.id, { name: 'A break from it' }, 3000);
    g = (await flowById(f.id))!;
    expect(g.steps.map(s => s.name)).toEqual(['Facing it', 'A break from it']);
    expect(g.revisions.map(r => r.steps.length)).toEqual([1, 1, 2]);
    expect(g.updatedAt).toBe(3000);
  });

  it('a step with no name is not added; a locked journal writes nothing', async () => {
    const f = await makeFlow('Grief', 'ring');
    expect(await addStep(f.id, { name: '  ' })).toBeUndefined();
    const salt = randomSalt();
    await setKey(await deriveKey('3569', salt, 1000), { salt, iterations: 1000 });
    lock();
    expect(await addStep(f.id, { name: 'Facing it' })).toBeUndefined();
  });

  it('offers all nine drawings', () => {
    expect(DIAGRAMS).toEqual(['ring', 'valley', 'arc', 'mountain', 'curve', 'coil', 'clock', 'stairs', 'fork']);
  });
});

describe('a flow he makes under a sign (PLAN-MOUNTAIN.md R3)', () => {
  it('keeps the sign he chose, and none when he chose none', async () => {
    await freshDB();
    await ensureSeeded();
    const under = await makeFlow('Grief', 'valley', 1000, 'heart');
    expect((await flowById(under.id))?.chakra).toBe('heart');
    const alone = await makeFlow('Alone', 'ring', 1000);
    expect((await flowById(alone.id))?.chakra).toBeUndefined();
  });
});
