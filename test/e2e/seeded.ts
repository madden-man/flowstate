// The seed flows are written on the first open, after the PIN (or none) opens the journal. A spec that deep-links to a
// seeded flow's page waits for its row first, so the page never reads before the seed has landed.
import { expect, type Page } from '@playwright/test';

/** Waits until the named flows are in IndexedDB (`flowstate`, store `flows`). The app must have been opened once. */
export async function whenSeeded(page: Page, ...ids: string[]) {
  await page.locator('.fs-app').waitFor();
  await expect.poll(() => stored(page, ids)).toBe(ids.length);
}

/** How many of the named flows are seeded yet. */
const stored = (page: Page, ids: string[]) => page.evaluate(ids => new Promise<number>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    if (!open.result.objectStoreNames.contains('flows')) { open.result.close(); resolve(0); return; }
    const r = open.result.transaction('flows').objectStore('flows').getAll();
    r.onsuccess = () => { open.result.close(); resolve((r.result as { id: string }[]).filter(f => ids.includes(f.id)).length); };
    r.onerror = () => reject(r.error);
  };
}), ids);
