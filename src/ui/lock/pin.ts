// The PIN, end to end (PLAN.md section 7). The PIN itself is never stored: a key is derived from it with
// PBKDF2 (src/db/crypto.ts) and handed to the fields layer, which seals or opens every row. This file holds
// the steps the keypad drives: choose, check, change, turn off, and the wrong-try pause.
import { signal } from '@preact/signals';
import { deriveKey, randomSalt, checkVerifier, PBKDF2_ITERATIONS } from '../../db/crypto';
import { setKey, removeKey, unlock, lock, keyState, type KeyState } from '../../db/fields';
import { settings, loadSettings } from '../settings';
import { openSheet } from '../sheets';

export { PIN_MIN, PIN_MAX, validPin } from './keys';
import { validPin } from './keys';

/** What the gate shows. null until the first look, so it reads the fields layer after init(). */
export const gate = signal<KeyState | null>(null);
export const gateState = (): KeyState => gate.value ?? keyState();
const sync = () => { gate.value = keyState(); };

/**
 * The pause after a wrong PIN: none for the first five, then 1s, 2s, 4s, 8s, and 8s from then on.
 * Never a lockout; it only slows a guesser down. wrong is the number of wrong tries so far.
 */
export function wrongDelayMs(wrong: number): number {
  if (wrong < 5) return 0;
  return Math.min(8000, 1000 * 2 ** (wrong - 5));
}

/** Wrong tries since the last right one. In memory only: a reload is a fresh start, never a lockout. */
let wrong = 0;
export const wrongTries = () => wrong;
export const resetWrong = () => { wrong = 0; };

/** Sets a first PIN or a new one. Every row is sealed (or re-sealed) with the new key in one pass. */
export async function choosePin(pin: string, iterations = PBKDF2_ITERATIONS): Promise<void> {
  if (!validPin(pin)) throw new Error('A PIN is 4 to 8 digits');
  const salt = randomSalt();
  const key = await deriveKey(pin, salt, iterations);
  await setKey(key, { salt, iterations, relockAfterMin: settings.value.lock.relockAfterMin, digits: pin.length });
  wrong = 0;
  await loadSettings();
  sync();
}

/** The key a PIN gives with this journal's stored salt, or null when the lock is off. */
async function keyFor(pin: string): Promise<CryptoKey | null> {
  const { salt, iterations } = settings.value.lock;
  if (!salt) return null;
  return deriveKey(pin, salt, iterations ?? PBKDF2_ITERATIONS);
}

/** True when the PIN fits the stored verifier. Does not change what is in memory. */
export async function pinFits(pin: string): Promise<boolean> {
  const k = await keyFor(pin);
  const v = settings.value.lock.verifier;
  return !!k && !!v && checkVerifier(k, v);
}

export type TryResult = { ok: true } | { ok: false; waitMs: number };

/** The lock screen: the right PIN opens the journal; a wrong one counts towards the pause. */
export async function tryPin(pin: string): Promise<TryResult> {
  const k = await keyFor(pin);
  if (k && (await unlock(k))) {
    wrong = 0;
    await loadSettings(); // the sealed parts of settings (the Spotify tokens) open now
    sync();
    return { ok: true };
  }
  wrong++;
  return { ok: false, waitMs: wrongDelayMs(wrong) };
}

/** Turn off asks for the PIN once; the right one writes every row back plain. */
export async function turnOff(pin: string): Promise<TryResult> {
  if (!(await pinFits(pin))) return { ok: false, waitMs: 0 }; // the sheet keeps its own pause

  await removeKey();
  wrong = 0;
  await loadSettings();
  sync();
  return { ok: true };
}

/** Relock: the key leaves memory, open sheets close, nothing is written. */
export function relock(): void {
  if (keyState() !== 'open') return;
  lock();
  openSheet.value = null;
  sync();
}
