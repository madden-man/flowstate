// PLAN-SELF.md section 4: the creed, the five held, delete entire, the refusals and who().
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB, Paradox } from '../../src/db/schema';
import { store, setKey, lock, unlock, LockedError } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { defaultSettings } from '../../src/db/seed';
import { addLean, setDone } from '../../src/model/flow';
import {
  HELD, REFUSALS, HeldError, canHold, createParadox, saveParadox, sameVersion, sameCreed, deleteParadox, deleteGoal,
  addGoals, goalsOf, openSlots, addRefusal, saveRefusal, who, moveParadox, threeWords,
} from '../../src/model/paradox';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); });

const pole = (value: string, aspect: string) => ({ value, aspect });
const draft = (a: string, b: string, extra: object = {}) => ({ poleA: pole(a, `${a} aspect`), poleB: pole(b, `${b} aspect`), ...extra });
const make = async (n: number) => { const out: Paradox[] = []; for (let i = 0; i < n; i++) out.push(await createParadox(draft(`a${i}`, `b${i}`), i + 1)); return out; };

describe('the creed', () => {
  it('is saved plainly: tidied on create, written over on save, never a revision', async () => {
    const p = await createParadox(draft('selfless', 'selfish', { creed: '  I give and I keep enough to give again ' }), 1);
    expect(p.creed).toBe('I give and I keep enough to give again');
    const v2 = await saveParadox(p, { ...draft('selfless', 'selfish'), creed: 'I give from a full cup' }, 'active', 2);
    expect(v2.revisions).toEqual([]);
    expect(v2.updatedAt).toBe(2);
    expect((await store.get('paradoxes', p.id))!.creed).toBe('I give from a full cup');
  });

  it('a draft without a creed keeps the one written; an empty one removes it', async () => {
    const p = await createParadox(draft('a', 'b', { creed: 'both' }), 1);
    const same = await saveParadox(p, draft('a', 'b'), 'active', 2);
    expect(same).toBe(p); // nothing changed, nothing written
    const gone = await saveParadox(p, { ...draft('a', 'b'), creed: '  ' }, 'active', 3);
    expect(gone.creed).toBeUndefined();
    expect('creed' in (await store.get('paradoxes', p.id))!).toBe(false);
  });

  it('sameCreed reads the creed alone; sameVersion still ignores it', async () => {
    const p = await createParadox(draft('a', 'b', { creed: 'both' }), 1);
    expect(sameCreed(p, { creed: ' both ' })).toBe(true);
    expect(sameCreed(p, {})).toBe(true);
    expect(sameCreed(p, { creed: 'other' })).toBe(false);
    expect(sameCreed({}, { creed: '' })).toBe(true);
    expect(sameVersion(p, { ...draft('a', 'b'), creed: 'other' })).toBe(true);
  });

  it('a pole edit and a creed edit together: one revision for the poles, the creed written over', async () => {
    const p = await createParadox(draft('a', 'b', { creed: 'one' }), 1);
    const v2 = await saveParadox(p, { ...draft('a', 'c'), creed: 'two' }, 'active', 2);
    expect(v2.revisions).toHaveLength(1);
    expect(v2.revisions[0]).not.toHaveProperty('creed');
    expect(v2.creed).toBe('two');
  });
});

describe('five are held', () => {
  it('canHold counts the others that are active', () => {
    const rows = Array.from({ length: HELD }, (_, i) => ({ id: `p${i}`, status: 'active' as const }));
    expect(HELD).toBe(5);
    expect(canHold(rows)).toBe(false);
    expect(canHold(rows, 'p0')).toBe(true); // one of the five may stay held
    expect(canHold([...rows.slice(1), { id: 'p0', status: 'resting' }])).toBe(true);
    expect(canHold([])).toBe(true);
  });

  it('a sixth lands resting', async () => {
    const five = await make(HELD);
    expect(five.every(p => p.status === 'active')).toBe(true);
    const sixth = await createParadox(draft('patient', 'urgent'), 9);
    expect(sixth.status).toBe('resting');
    expect((await store.get('paradoxes', sixth.id))!.status).toBe('resting');
  });

  it('going active with five held throws HeldError and writes nothing; once one rests it goes', async () => {
    const five = await make(HELD);
    const sixth = await createParadox(draft('patient', 'urgent'), 9);
    await expect(saveParadox(sixth, draft('patient', 'urgent'), 'active', 10)).rejects.toBeInstanceOf(HeldError);
    expect((await store.get('paradoxes', sixth.id))!.status).toBe('resting');
    await saveParadox(five[0], draft('a0', 'b0'), 'resting', 11);
    const held = await saveParadox(sixth, draft('patient', 'urgent'), 'active', 12);
    expect(held.status).toBe('active');
  });

  it('a paradox already active stays saveable, even past five (older data)', async () => {
    const five = await make(HELD);
    await store.put('paradoxes', { ...five[0], id: 'extra', status: 'active' });
    const edited = await saveParadox(five[1], { ...draft('a1', 'b1'), creed: 'still mine' }, 'active', 20);
    expect(edited.creed).toBe('still mine');
  });
});

describe('delete, entirely', () => {
  it('a paradox goes with its goals, its leans, its refusals and every page\'s link to it, and nothing else', async () => {
    const [p, q] = await make(2);
    await addGoals(p.id, { a: 'one', b: 'two' });
    const [kept] = await addGoals(q.id, { a: 'stays' });
    await addRefusal(p.id, "I don't keep score");
    await store.bulkPut('leans', [
      { id: 'l1', paradoxId: p.id, at: 5, lean: 0.2, note: 'n' },
      { id: 'l2', paradoxId: q.id, at: 5, lean: 0.1, note: 'kept' },
    ]);
    const page = { kind: 'entry' as const, createdAt: 1, updatedAt: 1, state: 'open' as const, tags: [], linkedPageIds: [] };
    await store.bulkPut('pages', [{ ...page, id: 'pg1', paradoxIds: [p.id, q.id] }, { ...page, id: 'pg2', paradoxIds: [q.id] }]);
    await deleteParadox(p.id);
    expect(await store.get('paradoxes', p.id)).toBeUndefined();
    expect(await db.items.where('paradoxId').equals(p.id).count()).toBe(0);
    expect(await store.get('leans', 'l1')).toBeUndefined();
    expect((await store.get('pages', 'pg1'))!.paradoxIds).toEqual([q.id]);
    expect((await store.get('pages', 'pg1'))!.updatedAt).toBe(1);
    expect((await store.get('pages', 'pg2'))!.paradoxIds).toEqual([q.id]);
    expect(await store.get('paradoxes', q.id)).toBeDefined();
    expect((await store.get('items', kept.id))!.text).toBe('stays');
    expect(await store.get('leans', 'l2')).toBeDefined();
    await deleteParadox('missing'); // nothing to do
  });

  it('the rest of the list keeps its order', async () => {
    const [a, b, c] = await make(3);
    await moveParadox([a.id, b.id, c.id], c.id, 0, 5);
    await deleteParadox(c.id);
    expect((await who()).map(w => w.paradox.id)).toEqual([a.id, b.id]);
  });

  it('a goal is removed; its balance shows its slot again; a goal that followed it follows nothing', async () => {
    const [p] = await make(1);
    const [a, b] = await addGoals(p.id, { a: 'one', b: 'two' });
    const [c] = await addGoals(p.id, { a: 'three', nextTo: b.id });
    await deleteGoal(b.id);
    expect(await store.get('items', b.id)).toBeUndefined();
    const left = await goalsOf(p.id);
    expect(left.map(i => i.id)).toEqual([a.id, c.id]);
    expect(left[0].pairId).toBeUndefined();
    expect(left[1].nextTo).toBeUndefined();
    expect(openSlots(left).map(s => s.forId)).toEqual([a.id, c.id]);
    await deleteGoal('missing');
  });
});

describe('delete in the write queue', () => {
  it('a lean, a goal and a page edit called just before a paradox delete go with it or keep their words', async () => {
    const [p, q] = await make(2);
    const page = { id: 'pg', kind: 'entry' as const, createdAt: 1, updatedAt: 1, state: 'open' as const, tags: [], linkedPageIds: [], paradoxIds: [p.id, q.id] };
    await store.put('pages', page);
    const lean = addLean(p.id, 0.4, { note: 'just now' });
    const goals = addGoals(p.id, { a: 'one', b: 'two' });
    const edit = store.put('pages', { ...page, title: 'written just before', updatedAt: 2 });
    await Promise.all([lean, goals, edit, deleteParadox(p.id)]);
    expect(await db.leans.count()).toBe(0);
    expect(await db.items.count()).toBe(0);
    const pg = (await store.get('pages', 'pg'))!;
    expect(pg.title).toBe('written just before'); // the edit is not overwritten by a stale copy
    expect(pg.paradoxIds).toEqual([q.id]);
  });

  it('a check on a follower and a goal added just before a goal delete: no link to it survives, no check is lost', async () => {
    const [p] = await make(1);
    const [a, b] = await addGoals(p.id, { a: 'one', b: 'two' });
    const [c] = await addGoals(p.id, { a: 'three', nextTo: b.id });
    const check = setDone(c.id, true, 50);
    const added = addGoals(p.id, { b: 'four', nextTo: b.id });
    await Promise.all([check, added, deleteGoal(b.id)]);
    const left = await goalsOf(p.id);
    expect(left.some(i => i.id === b.id || i.pairId === b.id || i.nextTo === b.id)).toBe(false);
    expect(left.find(i => i.id === c.id)!.doneLog).toEqual([{ at: 50 }]);
    expect(left.find(i => i.id === a.id)!.pairId).toBeUndefined();
    expect(left.map(i => i.text)).toEqual(['one', 'three', 'four']);
  });

  it('a delete while locked still refuses, and seals nothing new: a sealed goal\'s words open after a loosen', async () => {
    const [p] = await make(1);
    const [, b] = await addGoals(p.id, { a: 'one', b: 'two' });
    const [c] = await addGoals(p.id, { a: 'three', nextTo: b.id });
    const salt = randomSalt();
    const key = await deriveKey('1', salt, 1000);
    await db.settings.put(defaultSettings(1));
    await setKey(key, { salt, iterations: 1000 });
    lock();
    await expect(deleteGoal(b.id)).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(key)).toBe(true);
    await deleteGoal(b.id);
    const row = (await store.get('items', c.id))!;
    expect(row.text).toBe('three');
    expect(row.nextTo).toBeUndefined();
  });
});

describe('not me', () => {
  it('adds fired at once all count: three lines, and a fourth is refused', async () => {
    const [p] = await make(1);
    const r = await Promise.all(['one', 'two', 'three', 'four'].map(t => addRefusal(p.id, t)));
    expect(r.slice(0, 3).every(Boolean)).toBe(true);
    expect(r[3]).toBeUndefined();
    expect((await store.get('paradoxes', p.id))!.refusals!.map(x => x.text)).toEqual(['one', 'two', 'three']);
  });


  it('adds up to REFUSALS lines, tidied; an empty line adds nothing', async () => {
    const [p] = await make(1);
    expect(REFUSALS).toBe(3);
    expect(await addRefusal(p.id, '   ')).toBeUndefined();
    const first = await addRefusal(p.id, " I don't keep score ", 7);
    expect(first).toMatchObject({ text: "I don't keep score", at: 7 });
    await addRefusal(p.id, "I don't vanish");
    await addRefusal(p.id, "I don't rescue");
    expect(await addRefusal(p.id, 'a fourth')).toBeUndefined();
    expect(await addRefusal('missing', 'x')).toBeUndefined();
    expect((await store.get('paradoxes', p.id))!.refusals!.map(r => r.text)).toEqual(["I don't keep score", "I don't vanish", "I don't rescue"]);
  });

  it('edits a line in place; emptied, it is removed', async () => {
    const [p] = await make(1);
    const r1 = (await addRefusal(p.id, 'one', 1))!;
    const r2 = (await addRefusal(p.id, 'two', 2))!;
    await saveRefusal(p.id, r1.id, ' one, better ', 3);
    let row = (await store.get('paradoxes', p.id))!;
    expect(row.refusals).toEqual([{ ...r1, text: 'one, better' }, r2]);
    expect(row.updatedAt).toBe(3);
    await saveRefusal(p.id, r1.id, '');
    await saveRefusal(p.id, 'missing', 'x');
    row = (await store.get('paradoxes', p.id))!;
    expect(row.refusals).toEqual([r2]);
    await saveRefusal(p.id, r2.id, ' ');
    expect('refusals' in (await store.get('paradoxes', p.id))!).toBe(false);
  });
});

describe('who', () => {
  it('one line per held paradox in the order of the list: the creed, else its three words', async () => {
    const [a, b, c] = await make(3);
    await saveParadox(b, { ...draft('b1', 'b2'), creed: '' }, 'active', 4);
    await saveParadox(a, { ...draft('a0', 'b0'), creed: 'both, gladly' }, 'active', 5);
    await saveParadox(c, draft('a2', 'b2'), 'resting', 6);
    await moveParadox([a.id, b.id, c.id], b.id, 0, 7);
    const lines = await who();
    expect(lines.map(w => [w.paradox.id, w.line, w.own])).toEqual([
      [b.id, threeWords(draft('b1', 'b2')), false],
      [a.id, 'both, gladly', true],
    ]);
  });
});

describe('sealing (PLAN-SELF.md section 4)', () => {
  it('the creed and the refusals are sealed at rest; a locked read keeps the shape and withholds the words', async () => {
    await store.put('settings', defaultSettings(1)); // the lock's verifier lives here
    const p = await createParadox(draft('selfless', 'selfish', { creed: 'I give from a full cup' }), 1);
    const r = (await addRefusal(p.id, "I don't keep score", 2))!;
    const salt = randomSalt();
    const key = await deriveKey('1', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    const raw = JSON.stringify(await db.paradoxes.get(p.id));
    expect(raw).not.toContain('full cup');
    expect(raw).not.toContain('keep score');
    expect(raw).toContain(r.id); // ids and dates stay clear
    const open = (await store.get('paradoxes', p.id))!;
    expect(open.creed).toBe('I give from a full cup');
    expect(open.refusals).toEqual([r]);
    lock();
    const shut = (await store.get('paradoxes', p.id))!;
    expect(shut.locked).toBe(true);
    expect(shut.creed).toBe('');
    expect(shut.refusals).toEqual([{ ...r, text: '' }]);
    const [line] = await who();
    expect(line).toMatchObject({ line: threeWords(open), own: true });
    // writes refuse while locked, so a withheld word is never written back empty
    await expect(addRefusal(p.id, 'x')).rejects.toBeInstanceOf(LockedError);
    await expect(saveRefusal(p.id, r.id, 'y')).rejects.toBeInstanceOf(LockedError);
    await expect(saveParadox(shut, { ...draft('selfless', 'selfish'), creed: 'z' })).rejects.toBeInstanceOf(LockedError);
    await expect(deleteParadox(p.id)).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(key)).toBe(true);
    expect((await store.get('paradoxes', p.id))!.creed).toBe('I give from a full cup');
  });
});
