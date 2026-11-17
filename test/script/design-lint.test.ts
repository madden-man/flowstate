// design-lint's DL22 (DESIGN.md rule 34): the seven are named Crown to Root, so a Sanskrit name in any of its common
// spellings, a lotus, petals, Meru, kundalini or a seed letter's name fails the lint, and the app's own words pass.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const lint = (line: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'dl22-'));
  const f = path.join(dir, 'a.ts');
  writeFileSync(f, `${line}\n`);
  try { execFileSync(process.execPath, ['script/design-lint.mjs', f], { stdio: 'pipe' }); return ''; } catch (e) { return String((e as { stdout: Buffer }).stdout); }
};

const BANNED = [
  'Sahasrara', 'Sahasara', 'Sahasrar', 'Ajna', 'Agya', 'Vishuddha', 'Vishuddhi', 'Visuddha', 'Anahata', 'Manipura', 'Manipuraka', 'Mani-pura',
  'Svadhisthana', 'Svadhishthana', 'Swadhisthana', 'Swadhishthana', 'Muladhara', 'Mooladhara', 'lotus', 'lotuses', 'petal', 'petals',
  'Meru', 'kundalini', 'bija',
];
const FINE = ['Crown', 'Third eye', 'Throat', 'Heart chakra', 'Solar plexus', 'Sacral', 'Root · feeling safe', 'the narrows', 'manipulate', 'merge', 'adjunct'];

describe('DL22', () => {
  it.each(BANNED)('fails on %s', w => { expect(lint(`// the ${w} fall`)).toMatch(/DL22/); });
  it.each(FINE)('passes %s', w => { expect(lint(`// ${w}`)).toBe(''); });
});

// DL23 (PLAN-SIGN-LINES.md L1): each sign's line in CHAKRAS, the fifth string of its stop(...), is at most 70
// characters with no em dash; only model/mountain.ts is read for it.
const lintMountain = (stops: string[], name = 'mountain.ts') => {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), 'dl23-')), 'src', 'model');
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name);
  writeFileSync(f, `const stop = (a: string) => a;\n${stops.join('\n')}\n`);
  try { execFileSync(process.execPath, ['script/design-lint.mjs', f], { stdio: 'pipe' }); return ''; } catch (e) { return String((e as { stdout: Buffer }).stdout); }
};
const at = (line: string) => `  stop('root', 'Root', 'sprout', 25, 'feeling safe', '${line}', ['Safety', 'fear']),`;

describe('DL23', () => {
  it('passes the real file and a line of 70', () => {
    expect(lintMountain([at('x'.repeat(70))])).toBe('');
    expect(execFileSync(process.execPath, ['script/design-lint.mjs', 'src/model/mountain.ts']).toString()).toMatch(/PASS/);
  });
  it('fails a line of 71, a line with an em dash, and a stop with no line', () => {
    expect(lintMountain([at('x'.repeat(71))])).toMatch(/DL23/);
    expect(lintMountain([at('You want to be safe \u2014 the alarm rings.')])).toMatch(/DL23/);
    expect(lintMountain(["  stop('root', 'Root', 'sprout', 25, 'feeling safe'),"])).toMatch(/DL23/);
  });
  it('reads no other file for it', () => {
    expect(lintMountain([at('x'.repeat(90))], 'other.ts')).toBe('');
  });
});
