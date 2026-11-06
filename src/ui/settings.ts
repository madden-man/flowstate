// The settings row as a signal. Reads and writes go through the fields layer (src/db/fields.ts).
import { signal } from '@preact/signals';
import type { Settings } from '../db/schema';
import { store } from '../db/fields';
import { defaultSettings } from '../db/seed';

export const settings = signal<Settings>(defaultSettings(0));

export async function loadSettings(): Promise<Settings> {
  const s = await store.get('settings', 'app');
  if (s) settings.value = s;
  return settings.value;
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const next = { ...settings.value, ...patch };
  settings.value = next;
  await store.put('settings', next);
}
