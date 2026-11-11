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

// Rule 19: unlock, tab change, a check, an item dropped, a lean or flow detent, entering Still, keep close, a sheet opening,
// the ring's turn points while a thumb holds it (F2), a cover chosen on the music sheet (M3), beginning and ending a
// sit (Meditate, S1), a swap and a deal on the deck sheet (PLAN-ENERGIZE.md X3).
// PLAN-PICKS.md P1: the On sheet opening is a sheet opening (On.tsx showOn); its covers tick through music/state.ts play.
const TICKS: Record<string, string[]> = {
  tab: ['src/app.tsx'],
  // F6: the person row is a drawn check that is also a link (Person.tsx); a stamp the morning after draws one (Stamps.tsx)
  check: ['src/ui/parts/Check.tsx', 'src/ui/flow/Person.tsx', 'src/ui/flow/Stamps.tsx'],
  drop: ['src/ui/parts/Spread.tsx', 'src/ui/voices/Voices.tsx', 'src/ui/be/Be.tsx', 'src/ui/flow/StepSheet.tsx'],
  detent: ['src/ui/parts/LeanSlider.tsx', 'src/ui/parts/Cycle.tsx'],
  // PLAN-MOUNTAIN.md R3: a sign's gate, when the mark lands on fully shut and on fully open (rule 19 amended in R5)
  gate: ['src/ui/parts/Gate.tsx'],
  still: ['src/ui/still.ts'],
  keep: ['src/ui/journal/PageView.tsx', 'src/ui/council/MessageSheet.tsx'],
  sheet: ['src/ui/parts/Page.tsx', 'src/ui/flow/door.ts', 'src/ui/journal/PageView.tsx', 'src/ui/be/state.ts', 'src/ui/council/Council.tsx', 'src/ui/voices/Voices.tsx', 'src/ui/music/state.ts', 'src/ui/music/MusicLine.tsx', 'src/ui/lock/PinRows.tsx', 'src/ui/flow/NewFlow.tsx', 'src/ui/flow/StepSheet.tsx', 'src/ui/flow/Person.tsx', 'src/ui/flow/On.tsx'],
  unlock: ['src/ui/lock/Lock.tsx'],
  // PLAN-MOUNTAIN.md R2: the Depression meter, when its mark lands on either end (rule 19 amended in R5)
  meter: ['src/ui/flow/mountain/Meter.tsx'],
  breath: ['src/ui/flow/breath.ts'],
  // M3: beside bell('album'), inside the tap
  album: ['src/ui/music/'],
  sit: ['src/ui/flow/Meditate.tsx'],
  // PLAN-ENERGIZE.md X3: a fixation put in a slot, and Deal me one, both on the deck sheet
  swap: ['src/ui/flow/DeckSheet.tsx'],
  deal: ['src/ui/flow/DeckSheet.tsx'],
};
// Rule 21: unlock, settling, keep close, the lean's two ends, choosing an album, the breath tone while the ring is held (F2),
// the bell that closes a sit with an end (Meditate, S2), the rising fifth on a swap (PLAN-ENERGIZE.md X3).
const BELLS: Record<string, string[]> = {
  settle: ['src/ui/still.ts'],
  keep: ['src/ui/journal/PageView.tsx', 'src/ui/council/MessageSheet.tsx'],
  leanLow: ['src/ui/parts/LeanSlider.tsx'],
  leanHigh: ['src/ui/parts/LeanSlider.tsx'],
  album: ['src/ui/music/'],
  unlock: ['src/ui/lock/Lock.tsx'],
  breathIn: ['src/ui/flow/breath.ts'],
  breathOut: ['src/ui/flow/breath.ts'],
  sitEnd: ['src/ui/flow/Meditate.tsx'],
  // PLAN-ENERGIZE.md X3: the rising fifth on a swap
  swap: ['src/ui/flow/DeckSheet.tsx'],
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
    for (const t of ['unlock', 'tab', 'check', 'drop', 'detent', 'still', 'keep', 'sheet', 'breath', 'album', 'sit', 'swap', 'deal']) expect(ticks, t).toContain(t);
    for (const b of ['unlock', 'settle', 'keep', 'leanLow', 'leanHigh', 'album', 'breathIn', 'breathOut', 'sitEnd', 'swap']) expect(bells, b).toContain(b);
  });
  it('the ring is silent: leaving Still neither ticks nor rings', () => {
    const ring = fs.readFileSync('src/ui/parts/Ring.tsx', 'utf8');
    expect(ring).not.toMatch(/\b(tick|bell)\(/);
    const rise = fs.readFileSync('src/ui/still.ts', 'utf8').match(/export function rise\(\)[^}]*\}/)![0];
    expect(rise).not.toMatch(/\b(tick|bell)\(/);
  });
  it('an AudioContext is made in one place, for the bells or for a sit, which only a tap begins', () => {
    const sound = fs.readFileSync('src/ui/parts/Sound.ts', 'utf8');
    expect(sound.match(/new AC\(/g)).toHaveLength(1);
    // make(): its definition, the bells' kept context, and a sit's own
    expect(sound.match(/\bmake\(\)/g)).toHaveLength(3);
    expect(sound).toMatch(/function ctx\(\)[\s\S]*?ac = make\(\)/);
    expect(sound).toMatch(/export function bell[\s\S]*?const a = sounding \?\? ctx\(\)/);
    // a sit never borrows the bells' context: the iPhone leaves that one silent after Spotify or a lock
    expect(sound).toMatch(/export function scape[\s\S]*?const a = make\(\)/);
    expect(sound.slice(sound.indexOf('export function scape'))).not.toMatch(/\bctx\(\)/);
    expect(sound).toMatch(/if \(!settings\.value\.sounds\) return;/);
  });
  it('a sit\'s sound is begun only by the tap on the circle', () => {
    const at = code.filter(([, text]) => /\bscape\(/.test(text)).map(([f]) => f);
    expect(at.sort()).toEqual(['src/ui/flow/Meditate.tsx', 'src/ui/parts/Sound.ts']);
    const page = fs.readFileSync('src/ui/flow/Meditate.tsx', 'utf8');
    expect(page.match(/\bscape\(/g)).toHaveLength(1);
    expect(page).toMatch(/const begin = \(\) => \{[\s\S]*?scape\(sound\)/);
    expect(page).toMatch(/const tap = \(\) => \{[^}]*begin\(\)/);
  });
  it('the breath tone has its own switch, off unless set, behind Sounds', () => {
    const sound = fs.readFileSync('src/ui/parts/Sound.ts', 'utf8');
    expect(sound).toMatch(/if \(BREATH\.includes\(name\) && !settings\.value\.breathTone\) return;/);
  });
});
