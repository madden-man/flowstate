// Sound and haptics, audited by grep (DESIGN.md rules 19 and 21): every tick and bell fires where the
// rules list it and nowhere else. A new call site has to be added here, against the rule, on purpose.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const code = files('src').filter(f => /\.(ts|tsx)$/.test(f)).map(f => [f.split(path.sep).join('/'), fs.readFileSync(f, 'utf8')] as const);

/** Every call, as "file: kind(name)". */
function calls(kind: 'tick' | 'bell'): string[] {
  const re = new RegExp(`\\b${kind}\\(\\s*'([A-Za-z]+)'\\s*\\)`, 'g');
  return code.flatMap(([f, text]) => [...text.matchAll(re)].map(m => `${f}: ${kind}(${m[1]})`));
}

// Rule 19: unlock, tab change, a check, an item dropped, a lean or flow detent, entering Still, keep close, a sheet opening.
const TICKS: Record<string, string[]> = {
  tab: ['src/app.tsx'],
  check: ['src/ui/parts/Check.tsx'],
  drop: ['src/ui/parts/Spread.tsx', 'src/ui/voices/Voices.tsx', 'src/ui/be/Be.tsx'],
  detent: ['src/ui/parts/LeanSlider.tsx', 'src/ui/parts/Cycle.tsx'],
  still: ['src/ui/still.ts'],
  keep: ['src/ui/journal/PageView.tsx', 'src/ui/council/MessageSheet.tsx'],
  sheet: ['src/ui/parts/Page.tsx', 'src/ui/flow/door.ts', 'src/ui/journal/PageView.tsx', 'src/ui/be/state.ts', 'src/ui/council/Council.tsx', 'src/ui/voices/Voices.tsx', 'src/ui/music/state.ts', 'src/ui/music/MusicLine.tsx', 'src/ui/lock/PinRows.tsx', 'src/ui/flow/NewFlow.tsx', 'src/ui/flow/NewStep.tsx'],
  unlock: ['src/ui/lock/Lock.tsx'],
};
// Rule 21: unlock, settling, keep close, the lean's two ends, choosing an album.
const BELLS: Record<string, string[]> = {
  settle: ['src/ui/still.ts'],
  keep: ['src/ui/journal/PageView.tsx', 'src/ui/council/MessageSheet.tsx'],
  leanLow: ['src/ui/parts/LeanSlider.tsx'],
  leanHigh: ['src/ui/parts/LeanSlider.tsx'],
  album: ['src/ui/music/'],
  unlock: ['src/ui/lock/Lock.tsx'],
};

const allowed = (table: Record<string, string[]>, line: string) => {
  const [, f, name] = line.match(/^(.*): \w+\((\w+)\)$/)!;
  return (table[name] ?? []).some(p => f === p || (p.endsWith('/') && f.startsWith(p)));
};

describe('ticks and bells fire only where DESIGN.md lists them', () => {
  it('every tick() is a listed event in a listed place', () => {
    const bad = calls('tick').filter(l => !allowed(TICKS, l));
    expect(bad).toEqual([]);
  });
  it('every bell() is a listed event in a listed place', () => {
    const bad = calls('bell').filter(l => !allowed(BELLS, l));
    expect(bad).toEqual([]);
  });
  it('the listed events that exist so far all fire somewhere', () => {
    const ticks = new Set(calls('tick').map(l => l.replace(/^.*\((\w+)\)$/, '$1')));
    const bells = new Set(calls('bell').map(l => l.replace(/^.*\((\w+)\)$/, '$1')));
    for (const t of ['unlock', 'tab', 'check', 'drop', 'detent', 'still', 'keep', 'sheet']) expect(ticks, t).toContain(t);
    for (const b of ['unlock', 'settle', 'keep', 'leanLow', 'leanHigh', 'album']) expect(bells, b).toContain(b);
  });
  it('the ring is silent: leaving Still neither ticks nor rings', () => {
    const ring = fs.readFileSync('src/ui/parts/Ring.tsx', 'utf8');
    expect(ring).not.toMatch(/\b(tick|bell)\(/);
    const rise = fs.readFileSync('src/ui/still.ts', 'utf8').match(/export function rise\(\)[^}]*\}/)![0];
    expect(rise).not.toMatch(/\b(tick|bell)\(/);
  });
  it('the AudioContext is made in one place, on the first bell, which only a tap rings', () => {
    const sound = fs.readFileSync('src/ui/parts/Sound.ts', 'utf8');
    expect(sound.match(/new AC\(/g)).toHaveLength(1);
    expect(sound.match(/\bctx\(\)/g)).toHaveLength(2); // its definition and the one call inside bell()
    expect(sound).toMatch(/export function bell[\s\S]*?const a = ctx\(\)/);
    expect(sound).toMatch(/if \(!settings\.value\.sounds\) return;/);
  });
});
