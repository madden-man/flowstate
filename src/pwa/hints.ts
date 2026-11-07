// The install hint and the backup nag (PLAN.md section 7, package 8), kept apart from install.ts so they can be
// tested without the service worker. Both are one quiet line under the Journal page, nothing counted,
// never in Still. What they remember (launches, the day the nag last showed) sits in localStorage: it is about
// this browser, not the journal.

export const isStandalone = (): boolean =>
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const LAUNCHES_KEY = 'fs-launches';
const NAG_DAY_KEY = 'fs-backup-nag-day';
/** The Safari hint shows for the first three launches only. */
export const HINT_LAUNCHES = 3;
const DAY_MS = 86_400_000;
/** Settings nags once the last export is older than two weeks (PLAN.md section 7). */
export const BACKUP_DUE_MS = 14 * DAY_MS;
/** With no export ever, the nag waits for seven days of use, from the seed date. */
export const FIRST_BACKUP_MS = 7 * DAY_MS;

const local = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* private mode: nothing kept */ } },
};
const dayOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

/** Counted once per cold load, in main.tsx. */
export function countLaunch(): number {
  const n = (Number(local.get(LAUNCHES_KEY)) || 0) + 1;
  local.set(LAUNCHES_KEY, String(n));
  return n;
}

/** The Journal's one-line Safari hint: not standalone, and within the first three launches. */
export function installHintWanted(launches = Number(local.get(LAUNCHES_KEY)) || 0, standalone = isStandalone()): boolean {
  return !standalone && launches > 0 && launches <= HINT_LAUNCHES;
}

/** A tap puts the hint away for good (the Settings row stays until standalone). */
export function dismissInstallHint(): void { local.set(LAUNCHES_KEY, String(HINT_LAUNCHES + 1)); }

/** True when an export is due: the last is older than two weeks, or there is none after a week of use. */
export function backupDue(s: { lastBackupAt?: number; seededAt?: number }, now = Date.now()): boolean {
  if (s.lastBackupAt) return now - s.lastBackupAt > BACKUP_DUE_MS;
  return s.seededAt !== undefined && now - s.seededAt > FIRST_BACKUP_MS;
}

/** The words for the nag, on the Export row and the Journal's line. */
export const backupDueLine = (s: { lastBackupAt?: number }) => (s.lastBackupAt ? 'Two weeks since the last export' : 'Not exported yet');

/** Once a day: true the first time it is asked on a given day, and that day is remembered. */
export function takeNagDay(now = Date.now()): boolean {
  const today = dayOf(now);
  if (local.get(NAG_DAY_KEY) === today) return false;
  local.set(NAG_DAY_KEY, today);
  return true;
}

