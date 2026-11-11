// A sign's page carries no flow drawing (Tommy, 2026-11-11: "remove the old ones"); the drawing machinery (parts/Cycle,
// parts/Stream, the clock, ghost rings, stamps) lives on FlowPage, which a flow under no sign still opens. A spec whose
// subject is that machinery on a seeded flow's own shape (Panic's ring, the valley, the fork, the 3 a.m. clock) takes
// the flow off its sign first, exactly as he would by leaving a flow unplaced.
import { expect, type Page } from '@playwright/test';

/**
 * Clears `chakra` on the named flows (IndexedDB `flowstate`, store `flows`) and reloads, so `#/flow/<id>` opens
 * FlowPage. The app must have been opened once (the first load seeds the flows); the reload is needed because
 * FlowRoute keeps each flow's home in a module map (src/ui/flow/ChakraPage.tsx `known`).
 */
export async function offItsSign(page: Page, ...ids: string[]) {
  await page.locator('.fs-app').waitFor();
  await expect.poll(() => stored(page, ids)).toBe(ids.length);
  await page.evaluate(ids => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('flowstate');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('flows', 'readwrite');
      const st = tx.objectStore('flows');
      for (const id of ids) {
        const g = st.get(id);
        g.onsuccess = () => { const f = g.result; delete f.chakra; st.put(f); };
      }
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  }), ids);
  await page.reload();
  await page.locator('.fs-app').waitFor();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click().catch(() => {});
  await expect(t).toHaveCount(0);
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
