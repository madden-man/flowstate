// Persistence, install state and the update toast (PLAN.md section 7).
import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

export const needRefresh = signal(false);
let update: ((reload?: boolean) => Promise<void>) | null = null;

/** registerType 'prompt': a new version waits until the user taps Reload on the toast. */
export function startUpdates(): void {
  if (!('serviceWorker' in navigator)) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() { needRefresh.value = true; },
  });
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
