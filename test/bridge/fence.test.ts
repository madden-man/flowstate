// The bridge's fence (PLAN-WORLDS.md sections 2 and 3, W2; DESIGN.md rule 22): src/bridge, the third place allowed to
// reach out, only ever asks this origin's one function path; and it is never handed the personal notebook: no file in
// it imports home, the default database, openDB or the personal database's name.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BRIDGE_PATH } from '../../src/bridge/protocol';
import { listWorlds, getPocket, postUp } from '../../src/bridge/net';

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const bridge = files('src/bridge').filter(f => /\.(ts|tsx)$/.test(f)).map(f => [f, fs.readFileSync(f, 'utf8')] as const);
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('src/bridge asks only its own function, same origin', () => {
  it('the path is this origin\'s function, never an absolute URL', () => {
    expect(BRIDGE_PATH).toBe('/.netlify/functions/bridge');
    expect(BRIDGE_PATH.startsWith('//')).toBe(false);
  });
  it('no file holds a URL with a scheme or a host, and no other way out', () => {
    expect(bridge.length).toBeGreaterThan(3);
    for (const [f, text] of bridge) {
      const c = code(text);
      expect(c, f).not.toMatch(/\b(?:https?|wss?):/i);
      expect(c, f).not.toMatch(/['"`]\/\//);
      expect(c, f).not.toMatch(/XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts|new\s+URL\s*\(|location\.(?:href|assign|replace)|window\.open/);
    }
  });
  it('only net.ts makes a request, and it builds every one from BRIDGE_PATH', () => {
    for (const [f, text] of bridge) {
      if (f.endsWith(`${path.sep}net.ts`)) continue;
      expect(code(text), f).not.toMatch(/\bfetch\s*\(|\bfetcher\s*\(|\bglobalThis\.fetch\b|\bwindow\.fetch\b/);
    }
    const net = code(fs.readFileSync('src/bridge/net.ts', 'utf8'));
    expect(net.match(/fetcher\(/g)).toHaveLength(1);
    expect(net).toMatch(/const path = `\$\{BRIDGE_PATH\}\?/);
    expect(net).toMatch(/await fetcher\(path,/);
  });
  it('at run time every request is this path, with the token as a bearer and no cookies', async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    const f = (async (u: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(u), init });
      return new Response(JSON.stringify({ worlds: [], acks: [], world: 'w', stamp: 's', unchanged: true }), { status: 200 });
    }) as typeof fetch;
    await listWorlds('tok', f);
    await getPocket('tok', 'eastwinds', 's1', f);
    await postUp('tok', JSON.stringify({ world: 'eastwinds', envelopes: [] }), true, f);
    expect(seen.map(s => s.url)).toEqual([
      `${BRIDGE_PATH}?op=worlds`, `${BRIDGE_PATH}?op=pocket&world=eastwinds&stamp=s1`, `${BRIDGE_PATH}?op=up`,
    ]);
    for (const s of seen) {
      expect((s.init!.headers as Record<string, string>).authorization).toBe('Bearer tok');
      expect(s.init!.credentials).toBe('omit');
      expect(s.init!.cache).toBe('no-store');
    }
    expect(seen[2].init!.keepalive).toBe(true);
  });
});

describe('src/bridge is never handed the personal notebook', () => {
  it('no file imports home, the default database, openDB or the personal name', () => {
    for (const [f, text] of bridge) {
      const imports = text.split('\n').filter(l => /^\s*import\b/.test(l)).join('\n');
      expect(imports, f).not.toMatch(/\bhome\b/);
      expect(imports, f).not.toMatch(/\bbook\b/);
      expect(imports, f).not.toMatch(/\{[^}]*\bdb\b[^}]*\}\s*from\s*['"][./]*db\/schema['"]/);
      expect(imports, f).not.toMatch(/\bopenDB\b|\bDB_NAME\b|\binit\b|\bstore\b/);
      expect(code(text), f).not.toMatch(/['"]flowstate['"]/);
      // types only from the schema: the tables reach src/bridge through the notebook it is handed
      for (const l of imports.split('\n').filter(l => /db\/schema['"]/.test(l))) expect(l, f).toMatch(/^import type /);
    }
  });
});

describe('the companion table is not FlowState\'s by name (the send path is pinned in outbox.test.ts)', () => {
  it('TRAVELS does not hold it, and no code in src but the protocol spells it', async () => {
    const { TRAVELS, UP_TABLES } = await import('../../src/bridge/protocol');
    expect((TRAVELS as readonly string[]).includes('companion')).toBe(false);
    expect(UP_TABLES.filter(t => !(TRAVELS as readonly string[]).includes(t))).toEqual(['companion']);
    const src = files('src').filter(f => /\.(ts|tsx)$/.test(f) && f !== path.join('src', 'bridge', 'protocol.ts'));
    expect(src.length).toBeGreaterThan(20);
    for (const f of src) expect(code(fs.readFileSync(f, 'utf8')), f).not.toMatch(/companion|OTHER_CLIENTS|UP_TABLES/i);
  });
});
