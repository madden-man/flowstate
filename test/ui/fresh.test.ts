// A stop's page applies only fresh reads (R3 review finding 3: the dot went 1, 2, 3, 2, 3).
import { describe, it, expect } from 'vitest';
import { readGuard } from '../../src/ui/flow/chakra/fresh';

describe('readGuard', () => {
  it('drops a read that began before a write, even when it lands after the write has ended', () => {
    const g = readGuard();
    const fresh = g.read();
    const end = g.write();
    end();
    expect(fresh()).toBe(false);
    // the write's own end reads again, and that read applies
    expect(g.read()()).toBe(true);
  });
  it('drops a read that lands while a write is under way, and an older read once a newer one began', () => {
    const g = readGuard();
    const end = g.write();
    const during = g.read();
    expect(during()).toBe(false);
    end();
    const older = g.read(), newer = g.read();
    expect(older()).toBe(false);
    expect(newer()).toBe(true);
  });
  it('ends a write once, however often its end is called', () => {
    const g = readGuard();
    const a = g.write(), b = g.write();
    a(); a();
    expect(g.read()()).toBe(false);
    b();
    expect(g.read()()).toBe(true);
  });
});
