// The mountain (PLAN-MOUNTAIN.md, R0): the seven stops, the water's maths (section 4), and the readings (section 8).
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { store, setKey, lock, unlock, LockedError } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded } from '../../src/db/seed';
import {
  CHAKRA_IDS, CHAKRAS, chakraOf, spring, pass, reach, stretch, pool, sea, POOL_UNITS,
  writeReading, latestReadings, isStale, flowsUnder,
} from '../../src/model/mountain';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 10);

describe('the seven', () => {
  it('run summit to foot with their names, signs, hues and print lines', () => {
    expect(CHAKRA_IDS).toEqual(['crown', 'third-eye', 'throat', 'heart', 'solar-plexus', 'sacral', 'root']);
    expect(CHAKRAS.map(c => c.id)).toEqual([...CHAKRA_IDS]);
    expect(CHAKRAS.map(c => c.sign)).toEqual(['crown', 'eye', 'voice', 'heart', 'sun', 'drop', 'sprout']);
    expect(CHAKRAS.map(c => c.hue)).toEqual([305, 275, 250, 150, 95, 55, 25]);
    expect(chakraOf('heart')).toEqual({ id: 'heart', name: 'Heart', pageName: 'Heart chakra', sign: 'heart', hue: 150, gloss: 'Heart · love and grief' });
    expect(chakraOf('root').gloss).toBe('Root · feeling safe');
    expect(chakraOf('third-eye').pageName).toBe('Third eye chakra');
  });
  it('borrow no word from the tradition and no dash', () => {
    const words = CHAKRAS.flatMap(c => [c.name, c.pageName, c.gloss]).join(' ');
    expect(words).not.toMatch(/sahasrara|ajna|vishuddha|anahata|manipura|svadhisthana|muladhara|lotus|meru|\u2014/i);
  });
});

describe('the water', () => {
  it('the spring and a gate never reach zero', () => {
    expect(spring(0)).toBe(1);
    close(spring(1), 0.2);
    expect(pass(0)).toBe(1);
    close(pass(1), 0.15);
    close(spring(0.5), 0.6);
    close(pass(0.5), 0.575);
  });
  it('clamps what it is given to 0..1', () => {
    expect(spring(-3)).toBe(1);
    close(spring(7), 0.2);
    close(pass(2), 0.15);
    expect(pass(Number.NaN)).toBe(1);
    expect(stretch(5)).toEqual(stretch(1));
    expect(stretch(-1)).toEqual(stretch(0));
  });
  it('reach is cumulative down the mountain: seven values, each the one above times its gate', () => {
    const gates = [0, 0.5, 0, 1, 0, 0.2, 0];
    const q = reach(0.25, gates);
    expect(q).toHaveLength(7);
    let want = spring(0.25);
    gates.forEach((b, i) => { want *= pass(b); close(q[i], want); });
    // never rising on the way down
    for (let i = 1; i < 7; i++) expect(q[i]).toBeLessThanOrEqual(q[i - 1]);
    close(sea(0.25, gates), q[6]);
  });
  it('a gate shut high starves every sign below it', () => {
    const high = reach(0, [1, 0, 0, 0, 0, 0, 0]);
    const low = reach(0, [0, 0, 0, 0, 0, 0, 1]);
    expect(high.every(v => v <= 0.15 + 1e-12)).toBe(true);
    expect(low.slice(0, 6).every(v => v === 1)).toBe(true);
    close(sea(0, [1, 0, 0, 0, 0, 0, 0]), sea(0, [0, 0, 0, 0, 0, 0, 1]));
  });
  it('missing gates are open, and the heaviest day still reaches the sea', () => {
    expect(reach(0, [])).toEqual([1, 1, 1, 1, 1, 1, 1]);
    const worst = sea(1, [1, 1, 1, 1, 1, 1, 1]);
    expect(worst).toBeGreaterThan(0);
    close(worst, 0.2 * 0.15 ** 7);
  });
  it('a stretch shows its share, pace and width', () => {
    expect(stretch(0)).toEqual({ share: 0.15, pace: 0.3, width: 1 });
    const one = stretch(1);
    close(one.share, 1); close(one.pace, 1.5); close(one.width, 3.5);
  });
  it('pools above a part-closed sign over the last 26 units, by up to 0.75b', () => {
    expect(POOL_UNITS).toBe(26);
    expect(pool(1, 26)).toBe(1);
    expect(pool(1, 100)).toBe(1);
    close(pool(1, 0), 0.25);
    close(pool(0.5, 0), 0.625);
    close(pool(1, 13), 0.625);
    expect(pool(0, 0)).toBe(1);
    expect(pool(1, -5)).toBe(pool(1, 0));
    // slower the closer to the sign
    expect(pool(0.8, 5)).toBeLessThan(pool(0.8, 20));
    expect(pool(0.8, 0)).toBeGreaterThan(0);
  });
});

describe('the readings', () => {
  beforeEach(async () => { await freshDB(); });
  const H = 60 * 60_000;
  const T = new Date(2026, 10, 11, 20).getTime();

  it('none yet: no mountain reading and no gates', async () => {
    expect(await latestReadings()).toEqual({ gates: {} });
  });
  it('the newest per what it is of, with the history kept', async () => {
    await writeReading('mountain', 0.3, T);
    await writeReading('mountain', 0.7, T + H);
    await writeReading('heart', 0.5, T + 2 * H);
    await writeReading('heart', 0.1, T + H);
    await writeReading('root', 2, T);
    const r = await latestReadings();
    expect(r.mountain).toMatchObject({ of: 'mountain', value: 0.7, at: T + H });
    expect(r.gates.heart).toMatchObject({ of: 'heart', value: 0.5, at: T + 2 * H });
    expect(r.gates.root!.value).toBe(1);
    expect(Object.keys(r.gates).sort()).toEqual(['heart', 'root']);
    expect(await store.all('readings')).toHaveLength(5);
  });
  it('writes nothing for what is not the mountain or a sign', async () => {
    await expect(writeReading('elbow' as never, 0.5)).rejects.toThrow();
    expect(await store.all('readings')).toHaveLength(0);
  });
  it('sealed with the PIN: no value in the database, nothing from latestReadings while locked, all of it once open', async () => {
    const db = await freshDB();
    await ensureSeeded();
    await writeReading('mountain', 0.6, T);
    await writeReading('throat', 0.3, T);
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    await writeReading('throat', 0.9, T + H);
    for (const r of await db.readings.toArray()) { expect(r).not.toHaveProperty('value'); expect(r.sealed).toBeTruthy(); }
    lock();
    expect(await latestReadings()).toEqual({ gates: {} });
    await expect(writeReading('heart', 0.5)).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(key)).toBe(true);
    const r = await latestReadings();
    expect(r.mountain!.value).toBe(0.6);
    expect(r.gates.throat).toMatchObject({ value: 0.9, at: T + H });
  });
  it('a reading older than a day is stale', () => {
    expect(isStale({ at: T }, T + 24 * H)).toBe(false);
    expect(isStale({ at: T }, T + 24 * H + 1)).toBe(true);
    expect(isStale({ at: T }, T + H)).toBe(false);
  });
  it('the flows under a sign, in the flow list\'s order (order, then createdAt, then id)', async () => {
    await ensureSeeded();
    const panic = (await store.get('flows', 'panic'))!;
    await store.put('flows', { ...panic, id: 'mine-early', order: 1, createdAt: panic.createdAt - 1, chakra: 'root' });
    await store.put('flows', { ...panic, id: 'a-late', order: 1, createdAt: panic.createdAt + 1, chakra: 'root' });
    expect((await flowsUnder('root')).map(f => f.id)).toEqual(['mine-early', 'panic', 'a-late', 'whatif']);
    await store.delete('flows', 'mine-early');
    await store.delete('flows', 'a-late');
    expect((await flowsUnder('root')).map(f => f.id)).toEqual(['panic', 'whatif']);
    expect((await flowsUnder('heart')).map(f => f.id)).toEqual(['depress']);
    expect((await flowsUnder('crown')).map(f => f.id)).toEqual(['night']);
    const all = (await Promise.all(CHAKRA_IDS.map(flowsUnder))).flat().map(f => f.id);
    expect(all).not.toContain('energize');
    expect(all).toHaveLength(8);
  });
});
