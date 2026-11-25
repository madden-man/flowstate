// Into the app (PLAN-RESEARCH.md Q4): one rule holds one line, the shape a paper's title is carried in. The signs'
// touches that carried his lines here left with the mountain (PLAN-WORLDS.md section 4.1).
import { describe, it, expect } from 'vitest';
import { oneLine } from '../../src/model/into';

describe('one rule holds one line', () => {
  it('breaks and runs of space are one space, trimmed; nothing written is empty', () => {
    expect(oneLine('  What am I\n not   seeing? ')).toBe('What am I not seeing?');
    expect(oneLine(' \n ')).toBe('');
  });
});

