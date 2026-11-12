// The rules that keep the layers honest (PLAN.md section 7, CLAUDE.md rule 6).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SECRET_TABLES } from '../../src/db/fields';

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const src = (dir: string) => files(dir).filter(f => /\.(ts|tsx)$/.test(f)).map(f => [f, fs.readFileSync(f, 'utf8')] as const);

describe('layers', () => {
  it('UI code never opens the database itself: it goes through src/db/fields.ts', () => {
    const ui = [...src('src/ui'), ['src/app.tsx', fs.readFileSync('src/app.tsx', 'utf8')] as const];
    for (const [f, text] of ui) {
      expect(text, f).not.toMatch(/from ['"]dexie['"]/);
      for (const line of text.split('\n').filter(l => /from ['"][./]*db\/schema['"]/.test(l))) expect(line, f).toMatch(/^import type /);
    }
  });
  it('only src/db and src/model import the fields layer\'s store', () => {
    for (const [f, text] of src('src/ui').filter(([f]) => !f.endsWith('settings.ts'))) {
      expect(text, f).not.toMatch(/\bstore\./);
    }
  });
  it('every table holding Tommy\'s own text goes through the sealing spec, page titles included', () => {
    expect([...SECRET_TABLES].sort()).toEqual(['days', 'episodes', 'fixations', 'flows', 'inquiries', 'items', 'leans', 'marks', 'messages', 'pages', 'paradoxes', 'readings', 'settings', 'signShelves', 'values']);
  });
  it('the Questions list reads titles through the model and store, never the database', () => {
    const journal = fs.readFileSync('src/ui/questions/Questions.tsx', 'utf8');
    expect(journal).toMatch(/questions\(\)/);
    expect(fs.readFileSync('src/model/pages.ts', 'utf8')).toMatch(/export async function questions[\s\S]*?store\.query\('pages'/);
  });
  it('no file outside src/music and src/research fetches (DESIGN.md rule 22)', () => {
    const fenced = (f: string) => f.startsWith(path.join('src', 'music')) || f.startsWith(path.join('src', 'research'));
    for (const [f, text] of src('src').filter(([f]) => !fenced(f))) expect(text, f).not.toMatch(/\bfetch\s*\(/);
  });
  it('papers are an index\'s public record and stay clear; the questions are sealed (PLAN-RESEARCH.md section 5)', () => {
    expect(SECRET_TABLES).toContain('inquiries');
    expect(SECRET_TABLES).not.toContain('papers');
  });
});
