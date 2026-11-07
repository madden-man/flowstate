// The install hint and the backup nag (package 8): when each shows, and that each remembers once.
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { installHintWanted, dismissInstallHint, countLaunch, backupDue, backupDueLine, takeNagDay, HINT_LAUNCHES } from '../../src/pwa/hints';

const DAY = 86_400_000;
const T = Date.UTC(2026, 10, 7, 12);

beforeEach(() => localStorage.clear());

describe('the install hint', () => {
  it('shows in Safari for the first three launches only', () => {
    expect(installHintWanted(0, false)).toBe(false);
    for (let i = 1; i <= HINT_LAUNCHES; i++) expect(installHintWanted(countLaunch(), false)).toBe(true);
    expect(installHintWanted(countLaunch(), false)).toBe(false);
  });
  it('never shows from the Home Screen', () => {
    expect(installHintWanted(1, true)).toBe(false);
  });
  it('a tap puts it away for good', () => {
    countLaunch();
    dismissInstallHint();
    expect(installHintWanted(undefined, false)).toBe(false);
  });
});

describe('the backup nag', () => {
  it('is due two weeks after the last export, not before', () => {
    expect(backupDue({ lastBackupAt: T - 13 * DAY, seededAt: T - 100 * DAY }, T)).toBe(false);
    expect(backupDue({ lastBackupAt: T - 15 * DAY }, T)).toBe(true);
  });
  it('with no export, waits seven days of use from the seed date', () => {
    expect(backupDue({ seededAt: T - 6 * DAY }, T)).toBe(false);
    expect(backupDue({ seededAt: T - 8 * DAY }, T)).toBe(true);
    expect(backupDue({}, T)).toBe(false);
  });
  it('says which it is, in words, never a count', () => {
    expect(backupDueLine({ lastBackupAt: T })).toBe('Two weeks since the last export');
    expect(backupDueLine({})).toBe('Not exported yet');
  });
  it('shows once a day', () => {
    expect(takeNagDay(T)).toBe(true);
    expect(takeNagDay(T + 60_000)).toBe(false);
    expect(takeNagDay(T + DAY)).toBe(true);
  });
});
