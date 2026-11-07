// Package 7: the PKCE round trip with mocked fetch. The verifier rides in sessionStorage, the ?code= is
// read and the URL cleaned, the tokens land sealed in settings.spotify.tokens, and refresh happens before
// expiry, once even when two calls race, and again on a 401.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB, Settings } from '../../src/db/schema';
import { store, setKey } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { defaultSettings } from '../../src/db/seed';
import {
  startConnect, takeReturn, finishConnect, cameBackEmpty, readPending, withTokens, NotConnected, type Keep,
} from '../../src/music/connect';
import { nowPlaying, CLIENT_ID } from '../../src/music/spotify';

class MemStorage implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

/** A Keep on the real store, as the app's settings signal does it. */
function storeKeep(): Keep & { row: Settings } {
  const k = {
    row: defaultSettings(0),
    read: () => k.row.spotify,
    write: async (next: Settings['spotify']) => { k.row = { ...k.row, spotify: next }; await store.put('settings', k.row); },
  };
  return k;
}

type Call = { url: string; init?: RequestInit };
function mockFetch(answer: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => { calls.push({ url: String(url), init }); return answer(String(url), init); });
  return calls;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const form = (c: Call) => new URLSearchParams(String(c.init?.body));

let db: FlowDB;
beforeEach(async () => {
  db = await freshDB();
  vi.stubGlobal('sessionStorage', new MemStorage());
  vi.stubGlobal('localStorage', new MemStorage());
  vi.stubGlobal('location', { origin: 'https://flowstate-journal.netlify.app', hostname: 'flowstate-journal.netlify.app', hash: '#/journal/abc', href: '' });
});
afterEach(() => vi.unstubAllGlobals());

describe('connect', () => {
  it('leaves for Spotify with a PKCE challenge and keeps the verifier for the way back', async () => {
    let went = '';
    expect(await startConnect(h => { went = h; })).toBe('leaving');
    const url = new URL(went);
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('redirect_uri')).toBe('https://flowstate-journal.netlify.app/');
    const p = readPending()!;
    expect(url.searchParams.get('state')).toBe(p.state);
    expect(JSON.parse(sessionStorage.getItem('flowstate.spotify.pending')!).verifier).toBe(p.verifier);
    expect(p.back).toBe('#/journal/abc');
  });

  it('refuses to start on localhost, which Spotify will not take as a redirect', async () => {
    vi.stubGlobal('location', { origin: 'http://localhost:5173', hostname: 'localhost', hash: '' });
    const go = vi.fn();
    expect(await startConnect(go)).toBe('loopback');
    expect(go).not.toHaveBeenCalled();
  });

  it('reads the code off the URL, cleans it, exchanges it and keeps the tokens sealed', async () => {
    await startConnect(() => {});
    const { state, verifier } = readPending()!;
    let cleaned = '';
    const ret = takeReturn(`https://flowstate-journal.netlify.app/?code=C0DE&state=${state}`, u => { cleaned = u; })!;
    expect(cleaned).toBe('/#/journal/abc');
    expect(ret).toEqual({ code: 'C0DE', state, error: undefined });

    const calls = mockFetch(url => url.endsWith('/api/token')
      ? json({ access_token: 'A1', refresh_token: 'R1', expires_in: 3600 })
      : json({ display_name: 'Thomas Madden', id: 'tommy' }));
    const keep = storeKeep();
    expect(await finishConnect(ret, keep, 1000)).toBe('connected');
    const tok = form(calls[0]);
    expect(tok.get('grant_type')).toBe('authorization_code');
    expect(tok.get('code')).toBe('C0DE');
    expect(tok.get('code_verifier')).toBe(verifier);
    expect(tok.get('client_id')).toBe(CLIENT_ID);
    expect(tok.get('redirect_uri')).toBe('https://flowstate-journal.netlify.app/');
    expect(tok.has('client_secret')).toBe(false);
    expect(calls[1].url).toBe('https://api.spotify.com/v1/me');
    expect(readPending()).toBeNull();

    const s = await store.get('settings', 'app');
    expect(s?.spotify?.tokens).toMatchObject({ accessToken: 'A1', refreshToken: 'R1', name: 'Thomas Madden' });
    expect(s?.spotify?.connectedAt).toBe(1000);
  });

  it('seals the tokens when the lock is on: the stored row carries no token text', async () => {
    const key = await deriveKey('1234', randomSalt(), 1000);
    await store.put('settings', defaultSettings(0));
    await setKey(key, { salt: 'x', iterations: 1000 });
    await startConnect(() => {});
    const ret = takeReturn(`https://x.test/?code=C&state=${readPending()!.state}`, () => {})!;
    mockFetch(url => url.endsWith('/api/token') ? json({ access_token: 'SECRET-A', refresh_token: 'SECRET-R', expires_in: 3600 }) : json({ display_name: 'T' }));
    const keep = storeKeep();
    keep.row = (await store.get('settings', 'app'))!;
    expect(await finishConnect(ret, keep)).toBe('connected');
    const raw = JSON.stringify(await db.settings.get('app'));
    expect(raw).not.toContain('SECRET');
    expect((await store.get('settings', 'app'))?.spotify?.tokens?.accessToken).toBe('SECRET-A');
  });

  it('a declined sign-in, a state that does not match, and a refused code each say so', async () => {
    const keep = storeKeep();
    await startConnect(() => {});
    const st = readPending()!.state;
    expect(await finishConnect({ error: 'access_denied', state: st }, keep)).toBe('declined');
    await startConnect(() => {});
    expect(await finishConnect({ code: 'C', state: 'forged' }, keep)).toBe('refused');
    await startConnect(() => {});
    mockFetch(() => json({ error: 'invalid_grant' }, 400));
    expect(await finishConnect({ code: 'C', state: readPending()!.state }, keep)).toBe('refused');
    expect(keep.read()).toBeUndefined();
  });

  it('notices a sign-in that left and came back without a code (the redirect was refused)', async () => {
    await startConnect(() => {}, 1000);
    expect(cameBackEmpty(1500)).toBeNull(); // still leaving
    expect(cameBackEmpty(5000)).toBe('empty');
    expect(readPending()).toBeNull();
    expect(takeReturn('https://flowstate-journal.netlify.app/#/journal', () => { throw new Error('no clean'); })).toBeNull();
  });
});

describe('tokens', () => {
  const connectedKeep = (expiresAt: number) => {
    const k = storeKeep();
    k.row = { ...k.row, spotify: { connectedAt: 1, tokens: { accessToken: 'old', refreshToken: 'R1', expiresAt, name: 'Thomas Madden' } } };
    return k;
  };

  it('refreshes before expiry, keeps a rotated refresh token and the name, and refreshes once for two callers', async () => {
    const calls = mockFetch(url => url.endsWith('/api/token')
      ? json({ access_token: 'new', refresh_token: 'R2', expires_in: 3600 })
      : new Response(null, { status: 204 }));
    const keep = connectedKeep(Date.now() - 1);
    await Promise.all([withTokens(keep, nowPlaying), withTokens(keep, nowPlaying)]);
    const tokenCalls = calls.filter(c => c.url.endsWith('/api/token'));
    expect(tokenCalls).toHaveLength(1);
    expect(form(tokenCalls[0]).get('grant_type')).toBe('refresh_token');
    expect(form(tokenCalls[0]).get('refresh_token')).toBe('R1');
    expect(keep.read()?.tokens).toMatchObject({ accessToken: 'new', refreshToken: 'R2', name: 'Thomas Madden' });
    const api = calls.filter(c => c.url.includes('currently-playing'));
    expect(api.every(c => (c.init?.headers as Record<string, string>).Authorization === 'Bearer new')).toBe(true);
  });

  it('keeps the old refresh token when Spotify sends none back', async () => {
    mockFetch(url => url.endsWith('/api/token') ? json({ access_token: 'new', expires_in: 3600 }) : new Response(null, { status: 204 }));
    const keep = connectedKeep(Date.now() - 1);
    await withTokens(keep, nowPlaying);
    expect(keep.read()?.tokens?.refreshToken).toBe('R1');
  });

  it('a 401 refreshes and tries once more; a spent refresh token disconnects', async () => {
    let n = 0;
    mockFetch(url => url.endsWith('/api/token') ? json({ access_token: 'new', expires_in: 3600 }) : new Response(null, { status: n++ === 0 ? 401 : 204 }));
    const keep = connectedKeep(Date.now() + 60_000);
    expect(await withTokens(keep, nowPlaying)).toBeNull();
    expect(keep.read()?.tokens?.accessToken).toBe('new');

    mockFetch(url => url.endsWith('/api/token') ? json({ error: 'invalid_grant' }, 400) : new Response(null, { status: 204 }));
    const spent = connectedKeep(Date.now() - 1);
    await expect(withTokens(spent, nowPlaying)).rejects.toMatchObject({ code: 'invalid_grant' });
    expect(spent.read()).toEqual({ connectedAt: 1 });
    await expect(withTokens(spent, nowPlaying)).rejects.toBeInstanceOf(NotConnected);
  });
});
