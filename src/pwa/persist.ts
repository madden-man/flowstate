// Asks Safari to keep the journal (PLAN.md section 7) and writes the answer to the settings row, so the
// Storage row in Settings reads it offline. Called on first run (main.tsx) and from the Storage row.
import { askPersist } from './install';
import { saveSettings, settings } from '../ui/settings';

export async function persistNow(): Promise<boolean | null> {
  const kept = await askPersist();
  if (kept !== null && settings.peek().persisted !== kept) await saveSettings({ persisted: kept });
  return kept;
}
