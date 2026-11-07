// Persistence, install state and the update toast (PLAN.md section 7).
import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

export const needRefresh = signal(false);
let update: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;

/** How often an open app looks for a new version. */
export const UPDATE_EVERY_MS = 15 * 60_000;

/** registerType 'prompt': a new version waits until the user taps Reload on the quiet line. */
export function startUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() { needRefresh.value = true; },
    onRegisteredSW(_url, r) {
      registration = r ?? null;
      if (r) watchForUpdates();
    },
  });
}

/**
 * Looks for a new version whenever the app comes to the front, when the connection returns, and every
 * fifteen minutes while it is open. The browser checks on its own only at launch, and a home-screen app is
 * resumed far more often than it is launched, so without this a push waited for the next cold start.
 * A check that fails (offline) is just missed. Returns a stop function.
 */
export function watchForUpdates(
  check: () => Promise<unknown> = () => registration?.update() ?? Promise.resolve(),
  every = UPDATE_EVERY_MS,
  doc: Document = document,
  win: Window = window,
): () => void {
  const look = () => { if (doc.visibilityState === 'visible') void check().catch(() => { /* offline: the next look will do */ }); };
  doc.addEventListener('visibilitychange', look);
  win.addEventListener('online', look);
  win.addEventListener('pageshow', look);
  const iv = setInterval(look, every);
  return () => {
    doc.removeEventListener('visibilitychange', look);
    win.removeEventListener('online', look);
    win.removeEventListener('pageshow', look);
    clearInterval(iv);
  };
}

export const applyUpdate = () => update?.(true);

export { isStandalone, installHintWanted, dismissInstallHint, countLaunch, backupDue, backupDueLine, takeNagDay } from './hints';

export type StorageHealth = { persisted: boolean | null; usage?: number; quota?: number };

export async function storageHealth(): Promise<StorageHealth> {
  const s = navigator.storage;
  if (!s) return { persisted: null };
  const [persisted, est] = await Promise.all([s.persisted?.() ?? Promise.resolve(null), s.estimate?.() ?? Promise.resolve(undefined)]);
  return { persisted, usage: est?.usage, quota: est?.quota };
}

/** Asks Safari to keep the data; called on first run and from the Storage row. */
export async function askPersist(): Promise<boolean | null> {
  try { return (await navigator.storage?.persist?.()) ?? null; } catch { return null; }
}

export function bytes(n?: number): string {
  if (n === undefined) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
