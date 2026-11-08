// The door without the PIN (F5, PLAN-FLOWS.md 3.7): the route gate, what a locked flow reads as, and the Right now rows.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { PANIC } from '../../src/db/seed-flows';
import { store, setKey, lock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { flowById, flows, moveDot, liveEpisode } from '../../src/model/flows';
import { doorPasses, doorRead, nowRows } from '../../src/model/door';

describe('the route gate', () => {
  const PASS = ['/flow/now', '/flow/now/', '/flow/panic/1', '/flow/panic/4', '/flow/a-flow-of-mine/12'];
  const KEYPAD = [
    '/', '/journal', '/journal/pages', '/journal/abc', '/questions', '/questions/q1', '/council', '/council/c1', '/be', '/be/p1',
    '/voices', '/flow', '/flow/panic', '/flow/panic/0', '/flow/panic/one', '/flow/panic/1/edit', '/flow/now/1', '/flow/now/x', '/settings',
  ];
  it('with the door on, only Right now and a flow\'s step pass', () => {
    for (const p of PASS) expect(doorPasses(p, true), p).toBe(true);
    for (const p of KEYPAD) expect(doorPasses(p, true), p).toBe(false);
  });
  it('with the door off, nothing passes', () => {
    for (const p of [...PASS, ...KEYPAD]) expect(doorPasses(p, false), p).toBe(false);
  });
  it('a query does not change the answer', () => {
    expect(doorPasses('/flow/panic/2?x=1', true)).toBe(true);
    expect(doorPasses('/journal?flow/now', true)).toBe(false);
  });
});

describe('what the door shows', () => {
  beforeEach(async () => { await freshDB(); await ensureSeeded(); });

  const sealWith3569 = async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('3569', salt, 1000), { salt, iterations: 1000 });
  };

  it('an open flow reads as it is, his words included', async () => {
    const f = (await flowById('panic'))!;
    await store.put('flows', { ...f, steps: f.steps.map((s, i) => (i ? s : { ...s, line: 'My own line.' })) });
    expect(doorRead((await flowById('panic'))!).steps[0].line).toBe('My own line.');
  });

  it('locked, a flow reads as its seed: the seed revision, never his rewrite', async () => {
    const f = (await flowById('panic'))!;
    await store.put('flows', {
      ...f, name: 'My panic',
      steps: f.steps.map((s, i) => (i ? s : {
        ...s, line: 'My own line.', said: 'My said.',
        tips: [...s.tips.map(t => (t.id === 'panic-1-cold' ? { ...t, struck: true } : t)), { id: 'mine', text: 'Ring Ali' }],
      })),
    });
    await sealWith3569();
    lock();
    const locked = (await flowById('panic'))!;
    expect(locked.locked).toBe(true);
    const shown = doorRead(locked);
    expect(shown.name).toBe('Panic');
    expect(shown.steps.map(s => s.name)).toEqual(PANIC.steps.map(s => s.name));
    expect(shown.steps[0].line).toBe('Too much coming in at once.');
    expect(shown.steps[0].said).toBe(PANIC.steps[0].said);
    // his struck tip stays struck (hidden), his own tip has no seed words and is left out
    expect(shown.steps[0].tips.map(t => t.id)).toEqual(PANIC.steps[0].tips.map(t => t.id).filter(id => id !== 'panic-1-cold'));
    expect(JSON.stringify(shown)).not.toMatch(/My own line|My said|Ring Ali|My panic/);
  });

  it('locked, a step or a flow he made has no words; the ring keeps its shape', async () => {
    const f = (await flowById('panic'))!;
    await store.put('flows', { ...f, steps: [...f.steps, { id: 'mine', name: 'After', line: 'Mine.', tips: [] }] });
    await store.put('flows', { ...f, id: 'own', name: 'Own', order: 9, steps: [{ id: 'own-1', name: 'One', line: 'Secret.', tips: [] }] });
    await sealWith3569();
    lock();
    const fs = (await flows()).map(doorRead);
    expect(fs.find(x => x.id === 'panic')!.steps.at(-1)).toMatchObject({ id: 'mine', name: '', tips: [] });
    expect(fs.find(x => x.id === 'own')!.steps[0].name).toBe('');
    const rows = nowRows(fs);
    expect(rows.map(r => r.stepId)).toEqual(PANIC.steps.map(s => s.id));
    expect(JSON.stringify(rows)).not.toMatch(/Mine|Secret|Own|After/);
  });

  it('Right now: every step\'s line in flow order, the flow and step beside it; no line, the name alone', async () => {
    const f = (await flowById('panic'))!;
    await store.put('flows', { ...f, steps: f.steps.map((s, i) => (i === 2 ? { ...s, line: undefined } : s)) });
    const rows = nowRows(await flows());
    expect(rows.map(r => [r.flow, r.step, r.name, r.line ?? null])).toEqual([
      ['Panic', 1, 'Overstimulated', 'Too much coming in at once.'],
      ['Panic', 2, 'The wave', 'The wave. Loud, fast, certain.'],
      ['Panic', 3, 'Settling', null],
      ['Panic', 4, 'Under the skin', 'Gross. Lingering. Under the skin.'],
    ]);
  });

  it('locked, the live episode still reads (its marks are clear) and nothing can be written', async () => {
    await moveDot('panic', [], 'panic-2');
    await sealWith3569();
    lock();
    expect((await liveEpisode('panic'))!.marks.map(m => m.stepId)).toEqual(['panic-2']);
    await moveDot('panic', [], 'panic-3').catch(() => undefined);
    expect((await liveEpisode('panic'))!.marks.map(m => m.stepId)).toEqual(['panic-2']);
  });
});
