import { describe, it, expect } from 'vitest';
import { deriveKey, seal, unseal, randomSalt, makeVerifier, checkVerifier, toB64, fromB64, PBKDF2_ITERATIONS } from '../../src/db/crypto';

const FAST = 1000; // tests only; the app uses PBKDF2_ITERATIONS

describe('crypto', () => {
  it('uses a high PBKDF2 iteration count', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it('base64 round-trips bytes', () => {
    const b = new Uint8Array(70_000).map((_, i) => (i * 7919) % 256);
    expect(fromB64(toB64(b))).toEqual(b);
  });

  it('the same PIN and salt derive the same key; another salt does not', async () => {
    const salt = randomSalt();
    const k1 = await deriveKey('2468', salt, FAST);
    const k2 = await deriveKey('2468', salt, FAST);
    const k3 = await deriveKey('2468', randomSalt(), FAST);
    const env = await seal(k1, 'stand tall, young one', 'messages:m1');
    expect(await unseal(k2, env, 'messages:m1')).toBe('stand tall, young one');
    await expect(unseal(k3, env, 'messages:m1')).rejects.toThrow();
  });

  it('seals with a fresh IV each time and keeps the text out of the envelope', async () => {
    const k = await deriveKey('7353', randomSalt(), FAST);
    const a = await seal(k, { text: 'boiling in my own soup' }, 'messages:x');
    const b = await seal(k, { text: 'boiling in my own soup' }, 'messages:x');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    expect(JSON.stringify(a)).not.toContain('soup');
    expect(await unseal(k, a, 'messages:x')).toEqual({ text: 'boiling in my own soup' });
  });

  it('a wrong PIN, an altered envelope or another record id will not open', async () => {
    const salt = randomSalt();
    const k = await deriveKey('1111', salt, FAST);
    const env = await seal(k, 'kept', 'messages:a');
    await expect(unseal(await deriveKey('1112', salt, FAST), env, 'messages:a')).rejects.toThrow();
    await expect(unseal(k, env, 'messages:b')).rejects.toThrow();
    const ct = fromB64(env.ct);
    ct[0] ^= 1;
    await expect(unseal(k, { ...env, ct: toB64(ct) }, 'messages:a')).rejects.toThrow();
  });

  it('a verifier checks a PIN without storing it', async () => {
    const salt = randomSalt();
    const k = await deriveKey('9999', salt, FAST);
    const v = await makeVerifier(k);
    expect(await checkVerifier(k, v)).toBe(true);
    expect(await checkVerifier(await deriveKey('9998', salt, FAST), v)).toBe(false);
  });
});
