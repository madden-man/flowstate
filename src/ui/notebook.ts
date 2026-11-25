// The notebook worn, for the UI (PLAN-WORLDS.md section 4, W1). The fields layer holds which database is worn
// (db/fields.ts don and doff); this holds the same as a signal, so the header, the lock screen and the routes follow it,
// and wear() is the one way the UI puts a notebook on or takes it off: it swaps the database, reads the settings row
// again (the notebook's own fields), reads the ♪ shelves again (a world's playlists are its own) and remounts every page.
import { computed, signal } from '@preact/signals';
import { don, doff, worn } from '../db/fields';
import { settings, loadSettings } from './settings';
import { dataVersion } from './sheets';
import { loadMusic } from './music/state';

/** The world worn, by id; null for his own pages. */
export const wornWorld = signal<string | null>(null);

/** Reads what the fields layer has worn since boot (main.tsx, after init reopens the world left). */
export const syncWorn = () => { wornWorld.value = worn(); };

/** The world worn's name, for the header and the lock screen; null for his own pages. A world no longer in the
 *  registry still names itself by its id, so he always knows where he is. */
export const wornName = computed(() => {
  const id = wornWorld.value;
  if (id === null) return null;
  return settings.value.worlds?.find(w => w.id === id)?.name ?? id;
});

/** Puts a notebook on (a world's id) or takes the world off (null). Nothing happens when it is already worn. */
export async function wear(world: string | null): Promise<void> {
  if (world === worn()) { wornWorld.value = world; return; }
  if (world === null) await doff(); else await don(world);
  wornWorld.value = worn();
  await loadSettings();
  await loadMusic().catch(() => undefined);
  dataVersion.value++;
}
