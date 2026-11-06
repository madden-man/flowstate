// The rules that keep the layers honest (PLAN.md section 7, CLAUDE.md rule 6).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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
  it('no file outside src/music fetches', () => {
    for (const [f, text] of src('src').filter(([f]) => !f.startsWith(path.join('src', 'music')))) expect(text, f).not.toMatch(/\bfetch\s*\(/);
  });
});
