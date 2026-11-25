// The settings row as a signal. Reads and writes go through the fields layer (src/db/fields.ts).
import { signal } from '@preact/signals';
import type { Settings } from '../db/schema';
import { store } from '../db/fields';
import { defaultSettings } from '../db/seed';
import { noteYearWorn } from '../model/story';

export const settings = signal<Settings>(defaultSettings(0));

export async function loadSettings(): Promise<Settings> {
  const s = await store.get('settings', 'app');
  if (s) settings.value = s;
  // a new page or council takes the year worn (PLAN-WORLDS.md section 4)
  noteYearWorn(settings.value);
  return settings.value;
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const next = { ...settings.value, ...patch };
  settings.value = next;
  noteYearWorn(next);
  await store.put('settings', next);
}
