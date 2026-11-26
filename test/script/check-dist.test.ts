// check-dist (DESIGN.md rule 22; PLAN-PUSH.md N0; PLAN-WORLDS.md section 5): a build may name the same-origin
// /api/push/ paths and the bridge's one function, nothing else under /api/ or /.netlify/, and no host that is not listed.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const check = (js: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'dist-'));
  writeFileSync(path.join(dir, 'a.js'), js);
  try { return { ok: true, out: execFileSync(process.execPath, ['script/check-dist.mjs', dir], { stdio: 'pipe' }).toString() }; } catch (e) { return { ok: false, out: String((e as { stdout: Buffer }).stdout) }; }
};

describe('check-dist', () => {
  it('passes the push paths, plain and as a template', () => {
    const r = check('fetch("/api/push/key");fetch(`/api/push/${route}`,{method:"POST"});const b="/api/push";');
    expect(r.ok).toBe(true);
    expect(r.out).toMatch(/PASS.*3 same-origin \/api\/push\/ or bridge paths/);
  });
  it('fails any other path under /api/', () => {
    const r = check('fetch("/api/track?u=1")');
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/\/api\/track\?u=1 \(same origin, not named\)/);
  });
  it('passes the bridge\'s one function, plain, with its query, and as the template net.ts builds', () => {
    const r = check('const B="/.netlify/functions/bridge";fetch("/.netlify/functions/bridge?op=worlds");fetch(`/.netlify/functions/bridge?${q}`);');
    expect(r.ok).toBe(true);
    expect(r.out).toMatch(/PASS.*3 same-origin \/api\/push\/ or bridge paths/);
  });
  it('fails any other function, and the push function by its /.netlify/ name', () => {
    for (const p of ['/.netlify/functions/push', '/.netlify/functions/checkin', '/.netlify/functions/bridgex', '/.netlify/functions/other', '/.netlify/blobs/x']) {
      const r = check(`fetch("${p}")`);
      expect(r.ok, p).toBe(false);
      expect(r.out).toMatch(/same origin, not named/);
    }
  });
  it('still fails an unlisted host', () => {
    expect(check('fetch("https://example.com/push")').ok).toBe(false);
  });
});
