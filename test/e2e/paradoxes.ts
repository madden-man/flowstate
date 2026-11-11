// The notebook's two paradoxes and their goals, written straight into IndexedDB as the app stores them (plain, no lock).
// PLAN-VALUES.md C1: a fresh install seeds values and no paradoxes, so a spec of the paradox Be screen (retired in C2)
// writes them itself after the first load, then reloads.
import type { Page } from '@playwright/test';
import { seedParadoxes } from '../../src/db/seed';

export const writeParadoxes = (page: Page) => page.evaluate(rows => new Promise<void>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction(['paradoxes', 'items'], 'readwrite');
    for (const p of rows.paradoxes) tx.objectStore('paradoxes').put(p);
    for (const i of rows.items) tx.objectStore('items').put(i);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), seedParadoxes());
