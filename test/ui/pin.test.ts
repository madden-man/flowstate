// The PIN flow (package 6): set, unlock, the wrong-try pause, change, turn off. Small iteration counts
// keep the tests quick; the app uses PBKDF2_ITERATIONS.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB } from '../../src/db/schema';
import { ensureSeeded } from '../../src/db/seed';
import { store, keyState, lock, init } from '../../src/db/fields';
import { loadSettings, settings } from '../../src/ui/settings';
import { choosePin, tryPin, turnOff, pinFits, relock, wrongDelayMs, resetWrong, gate, gateState } from '../../src/ui/lock/pin';
import { digitOf, spell, validPin } from '../../src/ui/lock/keys';
import { openSheet } from '../../src/ui/sheets';

const FAST = 1000;
let db: FlowDB;
beforeEach(async () => {
  db = await freshDB();
  await ensureSeeded();
  await loadSettings();
  resetWrong();
  gate.value = null;
});

const manifestoRaw = async () => JSON.stringify(await db.messages.toArray());

describe('the keypad letters', () => {
  it('turn a word into its digits, from a hardware keyboard too', () => {
    expect(spell('FLOW')).toBe('3569');
    expect(spell('flow')).toBe('3569');
    expect(digitOf('7')).toBe('7');
    expect(digitOf('s')).toBe('7');
    expect(digitOf('Enter')).toBeNull();
    expect(digitOf('-')).toBeNull();
  });
  it('a PIN is 4 to 8 digits', () => {
    expect(validPin('356')).toBe(false);
    expect(validPin('3569')).toBe(true);
    expect(validPin('35693569')).toBe(true);
    expect(validPin('356935690')).toBe(false);
    expect(validPin('35a9')).toBe(false);
  });
});

describe('set a PIN', () => {
  it('seals every row, stores no PIN, and keeps the journal open', async () => {
    expect(await manifestoRaw()).toContain('I choose how to flow.');
    await choosePin('3569', FAST);
    expect(keyState()).toBe('open');
    expect(gateState()).toBe('open');
    expect(await manifestoRaw()).not.toContain('I choose how to flow.');
    const raw = (await db.settings.get('app'))!;
    expect(raw.lock).toMatchObject({ enabled: true, iterations: FAST, digits: 4, relockAfterMin: 5 });
    expect(JSON.stringify(raw)).not.toContain('3569');
    expect(settings.value.lock.enabled).toBe(true);
    expect((await store.get('messages', 'm-manifesto-2'))!.text).toBe('I choose how to flow.');
  });
  it('refuses a PIN outside 4 to 8 digits', async () => {
    await expect(choosePin('12', FAST)).rejects.toThrow();
    expect(keyState()).toBe('plain');
  });
});

describe('unlock', () => {
  it('a fresh start is locked; the right PIN opens it and the rows read whole', async () => {
    await choosePin('3569', FAST);
    await init(db);
    await loadSettings();
    gate.value = null;
    expect(gateState()).toBe('locked');
    expect((await store.all('messages')).every(m => m.locked)).toBe(true);
    expect(await tryPin('3569')).toEqual({ ok: true });
    expect(gateState()).toBe('open');
    expect((await store.all('messages')).map(m => m.text).join(' ')).toContain('I determine my core.');
  });

  it('a wrong PIN changes nothing; after five the pause grows 1s, 2s, 4s, 8s and stays at 8s', async () => {
    await choosePin('3569', FAST);
    lock();
    const before = JSON.stringify(await Promise.all(db.tables.map(t => t.toArray())));
    const waits: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await tryPin('0000');
      expect(r.ok).toBe(false);
      waits.push(r.ok ? -1 : r.waitMs);
    }
    expect(waits).toEqual([0, 0, 0, 0, 1000, 2000, 4000, 8000, 8000, 8000]);
    expect(keyState()).toBe('locked');
    expect(JSON.stringify(await Promise.all(db.tables.map(t => t.toArray())))).toBe(before);
    // never a lockout: the right one still opens, and the count starts over
    expect(await tryPin('3569')).toEqual({ ok: true });
    expect(wrongDelayMs(0)).toBe(0);
  });
});

describe('change PIN', () => {
  it('checks the current one, then re-seals with the new one in one pass', async () => {
    await choosePin('3569', FAST);
    expect(await pinFits('0000')).toBe(false);
    expect(await pinFits('3569')).toBe(true);
    const saltBefore = settings.value.lock.salt;
    await choosePin('76937', FAST); // five digits this time
    expect(settings.value.lock.salt).not.toBe(saltBefore);
    expect(settings.value.lock.digits).toBe(5);
    lock();
    expect((await tryPin('3569')).ok).toBe(false);
    expect((await tryPin('76937')).ok).toBe(true);
    expect((await store.all('messages')).map(m => m.text).join(' ')).toContain('I choose how to flow.');
  });
});

describe('turn off', () => {
  it('asks for the PIN once; a wrong one changes nothing, the right one writes every row plain', async () => {
    await choosePin('3569', FAST);
    expect((await turnOff('1111')).ok).toBe(false);
    expect(keyState()).toBe('open');
    expect((await turnOff('3569')).ok).toBe(true);
    expect(keyState()).toBe('plain');
    expect(gateState()).toBe('plain');
    expect(await manifestoRaw()).toContain('I choose how to flow.');
    expect((await db.settings.get('app'))!.lock).toEqual({ enabled: false, relockAfterMin: 5 });
  });
});

describe('relock', () => {
  it('drops the key, closes any sheet and writes nothing', async () => {
    await choosePin('3569', FAST);
    openSheet.value = 'settings';
    const before = JSON.stringify(await Promise.all(db.tables.map(t => t.toArray())));
    relock();
    expect(keyState()).toBe('locked');
    expect(gateState()).toBe('locked');
    expect(openSheet.value).toBeNull();
    expect(JSON.stringify(await Promise.all(db.tables.map(t => t.toArray())))).toBe(before);
  });
  it('does nothing with no PIN', () => {
    relock();
    expect(keyState()).toBe('plain');
  });
});

describe('the lock settings are the lock\'s own', () => {
  it('a stale copy of settings cannot turn the lock off over sealed rows', async () => {
    const stale = settings.value; // read before the PIN was set
    await choosePin('3569', FAST);
    await store.put('settings', { ...stale, light: 'night', lock: { ...stale.lock, relockAfterMin: 15 } });
    const raw = (await db.settings.get('app'))!;
    expect(raw.lock.enabled).toBe(true);
    expect(raw.lock.verifier).toBeDefined();
    expect(raw.lock.relockAfterMin).toBe(15);
    expect(raw.light).toBe('night');
  });
});
