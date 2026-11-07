// Connecting FlowState to Spotify (PLAN.md section 8.1, docs/SPOTIFY.md): Authorization Code with PKCE
// from the phone, no server and no secret. The verifier survives the trip to accounts.spotify.com in
// sessionStorage (with a localStorage copy, because iOS may hand the return to a fresh web view of the
// installed app); the ?code= that comes back is read on load, the URL is cleaned at once with
// history.replaceState, and the tokens are kept sealed in settings.spotify.tokens through the store.
import type { Settings } from '../db/schema';
import { LockedError } from '../db/fields';
import { ApiError, TokenError, buildAuthUrl, exchangeCode, fresh, makeVerifier, me, redirectUri, type Tokens } from './spotify';

export type SpotifyState = NonNullable<Settings['spotify']>;
/** Where the Spotify settings live. The app passes the settings signal (src/ui/music/state.ts), tests pass a stub. */
export type Keep = { read(): SpotifyState | undefined; write(next: SpotifyState | undefined): Promise<void> };

/** What the last connect attempt came to; Settings shows one plain line for each. */
export type Outcome = 'connected' | 'declined' | 'refused' | 'no-return' | 'loopback' | 'locked' | 'expired';

const PENDING = 'flowstate.spotify.pending';
type Pending = { verifier: string; state: string; redirect: string; back: string; at: number };

const stores = (): Storage[] => {
  const out: Storage[] = [];
  try { out.push(sessionStorage); } catch { /* none */ }
  try { out.push(localStorage); } catch { /* none */ }
  return out;
};

export function readPending(): Pending | null {
  for (const s of stores()) {
    const raw = s.getItem(PENDING);
    if (!raw) continue;
    try { return JSON.parse(raw) as Pending; } catch { /* a broken one is no one */ }
  }
  return null;
}
export const clearPending = () => { for (const s of stores()) s.removeItem(PENDING); };

/** Spotify takes only the loopback IP for local work, never "localhost"; the redirect would be refused. */
export const isLoopbackName = (host = location.hostname) => host === 'localhost';

/** Starts the sign-in: remembers the verifier, then leaves for Spotify's own page. */
export async function startConnect(go: (href: string) => void = h => location.assign(h), now = Date.now()): Promise<'leaving' | 'loopback'> {
  if (isLoopbackName()) return 'loopback';
  const pending: Pending = { verifier: makeVerifier(), state: crypto.randomUUID(), redirect: redirectUri(), back: location.hash || '#/journal', at: now };
  for (const s of stores()) s.setItem(PENDING, JSON.stringify(pending));
  go(await buildAuthUrl(pending.verifier, pending.state, pending.redirect));
  return 'leaving';
}

export type Return = { code?: string; state?: string; error?: string };

/** Reads Spotify's answer off the URL and cleans it at once, back to where Connect was tapped. */
export function takeReturn(href = location.href, replace: (url: string) => void = u => history.replaceState(null, '', u)): Return | null {
  const url = new URL(href);
  const code = url.searchParams.get('code') ?? undefined;
  const error = url.searchParams.get('error') ?? undefined;
  if (!code && !error) return null;
  const state = url.searchParams.get('state') ?? undefined;
  replace(`${url.pathname}${readPending()?.back ?? (url.hash || '#/journal')}`);
  return { code, state, error };
}

/** Trades the code for tokens and keeps them, with the account's name for "Connected as". */
export async function finishConnect(ret: Return, keep: Keep, now = Date.now()): Promise<Outcome> {
  const pending = readPending();
  clearPending();
  if (!pending || !ret.state || pending.state !== ret.state) return 'refused';
  if (ret.error || !ret.code) return 'declined';
  let tokens: Tokens;
  try { tokens = await exchangeCode(ret.code, pending.verifier, pending.redirect); } catch { return 'refused'; }
  const name = await me(tokens).catch(() => '');
  try {
    await keep.write({ tokens: { ...tokens, name }, connectedAt: now });
  } catch (e) {
    if (e instanceof LockedError) return 'locked';
    throw e;
  }
  return 'connected';
}

/** A sign-in that left and came back without a code: Spotify refused the redirect address (or Back was
 *  tapped on its page). Checked on load and whenever the app comes to the front again. */
export function cameBackEmpty(now = Date.now(), graceMs = 1500): 'empty' | 'elsewhere' | null {
  const p = readPending();
  if (!p || now - p.at < graceMs) return null;
  let shared: string | null = null;
  try { shared = localStorage.getItem(PENDING); } catch { /* none */ }
  clearPending();
  // the code came back to another web view of the app, which finished and cleared the shared copy
  return shared ? 'empty' : 'elsewhere';
}

export const disconnect = (keep: Keep) => keep.write(undefined);

/** Not signed in (or locked: the sealed tokens cannot be read). */
export class NotConnected extends Error {
  constructor() { super('Spotify is not connected'); this.name = 'NotConnected'; }
}

/** Runs one Web API call with fresh tokens: refreshed before expiry, and once more on a 401. A spent
 *  refresh token (invalid_grant) disconnects, so Settings can offer Connect again. */
export async function withTokens<T>(keep: Keep, call: (t: Tokens) => Promise<T>): Promise<T> {
  const s = keep.read();
  if (!s?.tokens) throw new NotConnected();
  const name = s.tokens.name;
  const save = (n: Tokens) => keep.write({ ...keep.read(), tokens: { ...n, name } });
  try {
    let t = await fresh(s.tokens, save);
    try {
      return await call(t);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) throw e;
      t = await fresh(t, save, true);
      return await call(t);
    }
  } catch (e) {
    if (e instanceof TokenError && e.code === 'invalid_grant') await keep.write({ connectedAt: s.connectedAt });
    throw e;
  }
}
