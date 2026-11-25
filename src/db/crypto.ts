// PIN key derivation and record sealing (PLAN.md section 7). WebCrypto only, no library.
// PBKDF2-SHA256 turns the PIN into an AES-GCM key; each record's secret fields are sealed together
// with a fresh 96-bit IV, and the envelope is bound to its table and id (additional data) so an
// envelope copied onto another record will not open.
import type { Sealed } from './schema';

/** OWASP 2023 guidance for PBKDF2-HMAC-SHA256. A short PIN is still a curtain, not a vault (PLAN section 7). */
export const PBKDF2_ITERATIONS = 600_000;
const VERIFIER_TEXT = 'I determine my core. I choose how to flow.';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomSalt(bytes = 16): string {
  return toB64(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** The PIN is never stored. Only the salt, the iteration count and a verifier are (settings.lock).
 *  The key can be exported (PLAN-WORLDS.md section 3, W1): a PIN change seals the old key under the new one and the new
 *  under the old in home's row while it rewrites every notebook, so a stop halfway is finished by either PIN
 *  (fields.ts setKey). It is only ever exported to be sealed again, never stored or sent as it is. */
export async function deriveKey(pin: string, salt: string, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** A key's bytes as base64, to be sealed under another key (fields.ts setKey). */
export async function rawKey(key: CryptoKey): Promise<string> {
  return toB64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

/** A key from the bytes rawKey gave, as deriveKey would make it. */
export function keyFromRaw(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromB64(b64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, value: unknown, aad: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
    key,
    enc.encode(JSON.stringify(value)),
  );
  return { v: 1, iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

/** Throws (OperationError) when the key is wrong, the envelope was altered or it belongs to another record. */
export async function unseal<T = unknown>(key: CryptoKey, sealed: Sealed, aad: string): Promise<T> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: enc.encode(aad) },
    key,
    fromB64(sealed.ct),
  );
  return JSON.parse(dec.decode(pt)) as T;
}

export const isSealed = (x: unknown): x is Sealed =>
  !!x && typeof x === 'object' && (x as Sealed).v === 1 && typeof (x as Sealed).iv === 'string' && typeof (x as Sealed).ct === 'string';

/** A known line sealed with the key, so a typed PIN can be checked without storing it. */
export const makeVerifier = (key: CryptoKey) => seal(key, VERIFIER_TEXT, 'verifier');

export async function checkVerifier(key: CryptoKey, verifier: Sealed): Promise<boolean> {
  try {
    return (await unseal(key, verifier, 'verifier')) === VERIFIER_TEXT;
  } catch {
    return false;
  }
}
