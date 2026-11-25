// Your own flows (F3): "+ step" names a flow's unnamed step first, then adds at the end; every change is kept as a
// revision; a locked journal writes nothing. "+ flow" left with the mountain (PLAN-WORLDS.md section 4.1), so the flow
// here is one he made before, written as it was kept.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { flowById } from '../../src/model/flows';
import { addStep, isUnnamed } from '../../src/model/flow-make';
import { store, setKey, lock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import type { Flow, Step } from '../../src/db/schema';

beforeEach(async () => { await freshDB(); await ensureSeeded(); });

/** A flow he made with "+ flow": one unnamed step. */
async function made(name: string, at = 1000): Promise<Flow> {
  const steps: Step[] = [{ id: 'grief-1', name: '', tips: [] }];
  const flow: Flow = { id: 'grief', name, order: 99, diagram: 'ring', createdAt: at, updatedAt: at, steps, revisions: [{ at, name, steps: structuredClone(steps) }] };
  await store.put('flows', flow);
  return flow;
}

describe('adding a step', () => {
  it('the first step names the empty one; the next is added; each change a revision', async () => {
    const f = await made('Grief');
    expect(isUnnamed(f.steps[0])).toBe(true);
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
    const f = await made('Grief');
    expect(await addStep(f.id, { name: '  ' })).toBeUndefined();
    const salt = randomSalt();
    await setKey(await deriveKey('3569', salt, 1000), { salt, iterations: 1000 });
    lock();
    expect(await addStep(f.id, { name: 'Facing it' })).toBeUndefined();
  });
});
