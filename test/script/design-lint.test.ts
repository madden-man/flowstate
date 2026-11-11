// design-lint's DL22 (DESIGN.md rule 34): the seven are named Crown to Root, so a Sanskrit name in any of its common
// spellings, a lotus, petals, Meru, kundalini or a seed letter's name fails the lint, and the app's own words pass.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
