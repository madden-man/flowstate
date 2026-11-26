// design-lint's network fence, DL21 (DESIGN.md rule 22). The file once also held DL22 and DL23 (the signs' Sanskrit
// names and the signs' lines); both lints were retired with the mountain (PLAN-WORLDS.md section 4.1, WF), and their
// cases went with them. What stays: a fetch is allowed under src/music, src/research, src/push (PLAN-PUSH.md N0) and
// src/bridge (PLAN-WORLDS.md section 5, W2) only, and fails anywhere else in src. And DL20 (rule 21, W6): the
// microphone and a recorder belong to parts/Sound alone.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const lintAt = (rel: string, line: string) => {
  const root = mkdtempSync(path.join(tmpdir(), 'dl21-'));
  const f = path.join(root, rel);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, `${line}\n`);
  try { execFileSync(process.execPath, ['script/design-lint.mjs', f], { stdio: 'pipe' }); return ''; } catch (e) { return String((e as { stdout: Buffer }).stdout); }
};

describe('DL21', () => {
  const call = "await fetch('/api/push/subscribe', { method: 'POST' });";
  it.each(['src/push/push.ts', 'src/music/spotify.ts', 'src/research/client.ts', 'src/bridge/net.ts'])('passes a fetch in %s', f => {
    expect(lintAt(f, call)).toBe('');
  });
  it.each([
    'src/ui/settings/CheckinRow.tsx', 'src/model/pages.ts', 'src/pwa/install.ts', 'src/pushy/a.ts', 'src/ui/push/a.ts',
    'src/bridges/a.ts', 'src/ui/bridge/a.ts', 'src/db/writes.ts', 'src/ui/flow/Shelf.tsx',
  ])('fails a fetch in %s', f => {
    expect(lintAt(f, call)).toMatch(/DL21/);
  });
  it('fails a beacon to the same origin outside src/push and src/bridge', () => {
    expect(lintAt('src/ui/a.ts', 'navigator.sendBeacon("/api/push/x");')).toMatch(/DL21/);
    expect(lintAt('src/ui/a.ts', 'navigator.sendBeacon("/.netlify/functions/bridge");')).toMatch(/DL21/);
  });
});

describe('DL20', () => {
  it.each(['navigator.mediaDevices.getUserMedia({ audio: true });', 'const r = new MediaRecorder(s);', 'MediaRecorder.isTypeSupported("audio/mp4");'])(
    'fails %s outside parts/Sound, src/push included', line => {
      expect(lintAt('src/push/push.ts', line)).toMatch(/DL20/);
      expect(lintAt('src/ui/songs/Hum.tsx', line)).toMatch(/DL20/);
      expect(lintAt('src/ui/parts/Sound.ts', line)).toBe('');
    },
  );
});
