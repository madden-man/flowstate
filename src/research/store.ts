// Research's rows (PLAN-RESEARCH.md section 5, Q2): the only place Research reads or writes the database, and it does
// so through the fields layer (src/db/fields.ts), which seals an inquiry's question and runs and the keys in settings.
// Papers are an index's public record and stay clear. Locked, the reads come back empty (as model/acts.ts does: a
// sealed row has nothing to show) and every write throws LockedError from the store, as the music tie-in's do
// (music/connect.ts), so the page and Settings can say nothing rather than something half read.
//
// The keys live in the settings row, which the UI also holds as a signal (ui/settings.ts). saveResearchKey and
// removeResearchKey write the stored row as it stands now (one unit in the write queue), so a stale copy never drops
// the Spotify tokens or a switch; the caller reloads the signal afterwards (loadSettings), so the next saveSettings
// carries the key instead of writing over it.
import { signal } from '@preact/signals';
import { keyState, store, tombstone } from '../db/fields';
import type { ResearchKey, Settings } from '../db/schema';
import type { Inquiry, Paper } from './types';

/** Bumped on every Research write, so the page and the Asked list read again (as shelfVersion is for a sign's shelf).
 *  dataVersion stays the import's: it remounts every page. */
export const researchVersion = signal(0);
const wrote = () => { researchVersion.value++; };

const open = () => keyState() !== 'locked';

/** Every question asked, newest first. Locked: none (the questions are sealed). */
export async function listInquiries(): Promise<Inquiry[]> {
  if (!open()) return [];
  const rows = await store.query('inquiries', t => t.orderBy('askedAt').reverse());
  return rows.filter(r => !r.locked);
}

/** One question by id; undefined when there is none, or the journal is locked. */
export async function getInquiry(id: string): Promise<Inquiry | undefined> {
  if (!open()) return undefined;
  const row = await store.get('inquiries', id);
  return row && !row.locked ? row : undefined;
}

/** Writes a question whole (a new one, a finished turn, the end of a run). Sealed with the key; LockedError when locked. */
export async function putInquiry(inquiry: Inquiry): Promise<void> {
  await store.put('inquiries', inquiry);
  wrote();
}

/** Takes a question away, and puts its id on the deleted list in the same transaction, so a merge import of an older
 *  backup never brings it back (PLAN-VALUES.md C0). Its papers stay: another question may cite them. */
export async function deleteInquiry(id: string): Promise<void> {
  await store.tx(['inquiries', 'settings'], async tb => {
    await tb('inquiries').delete(id);
    await tombstone(tb, [id]);
  });
  wrote();
}

/** Keeps papers by id, a later fetch of the same paper replacing the row (one row a paper, section 5). */
export async function putPapers(papers: Paper[]): Promise<void> {
  if (!papers.length) return;
  await store.bulkPut('papers', papers);
  wrote();
}

/** The papers asked for, in the order asked, any not kept left out. Papers are clear, so this reads locked too. */
export async function getPapers(ids: string[]): Promise<Paper[]> {
  if (!ids.length) return [];
  const rows = await store.query('papers', t => t.where('id').anyOf(ids));
  const byId = new Map(rows.map(r => [r.id, r as Paper]));
  return ids.map(id => byId.get(id)).filter((p): p is Paper => !!p);
}

/** The keys Research asks with, or undefined when none is saved or the journal is locked. */
export async function researchKey(): Promise<ResearchKey | undefined> {
  if (!open()) return undefined;
  const s = await store.get('settings', 'app');
  return s && !s.locked && s.research?.key ? { ...s.research } : undefined;
}

/** Saves the Anthropic key (and the OpenAlex key, when one is given), trimmed; a blank key is refused. Writes the
 *  stored settings row as it stands, in the write queue; LockedError when locked. */
export async function saveResearchKey(key: string, openAlexKey?: string): Promise<void> {
  const k = key.trim();
  if (!k) throw new Error('No key');
  const oa = openAlexKey?.trim();
  const research: ResearchKey = oa ? { key: k, openAlexKey: oa } : { key: k };
  await patchSettings(s => ({ ...s, research }));
}

/** Forgets both keys; Research sends nothing again until one is pasted. LockedError when locked. */
export async function removeResearchKey(): Promise<void> {
  await patchSettings(({ research: _, ...s }) => s as Settings);
}

async function patchSettings(change: (s: Settings) => Settings): Promise<void> {
  await store.unit(async u => {
    const s = await u.get('settings', 'app');
    if (!s) throw new Error('No settings row');
    const { locked: _, ...row } = s;
    await u.put('settings', change(row as Settings));
  });
  wrote();
}
