// The walkthrough's app runs in a sandboxed frame (an opaque origin) where IndexedDB and Web Storage may be missing
// or throw. Before any of the app's modules are evaluated (this is the shim's first import), every storage the app
// touches is replaced with one that lives in this page's memory: fake-indexeddb for Dexie, and a plain map for
// localStorage and sessionStorage. The demo never reads or writes real storage, sandboxed or not.
import * as fake from 'fake-indexeddb';

const g = globalThis as unknown as Record<string, unknown>;

/** Puts a value on the global, over the browser's own accessor where it is configurable. */
function put(name: string, value: unknown): void {
  try {
    Object.defineProperty(g, name, { value, configurable: true, writable: true });
  } catch {
    try { g[name] = value; } catch { /* the app's own try/catch covers it */ }
  }
}

put('indexedDB', fake.indexedDB);
put('IDBKeyRange', fake.IDBKeyRange);
put('IDBCursor', fake.IDBCursor);
put('IDBCursorWithValue', fake.IDBCursorWithValue);
put('IDBDatabase', fake.IDBDatabase);
put('IDBFactory', fake.IDBFactory);
put('IDBIndex', fake.IDBIndex);
put('IDBObjectStore', fake.IDBObjectStore);
put('IDBOpenDBRequest', fake.IDBOpenDBRequest);
put('IDBRequest', fake.IDBRequest);
put('IDBTransaction', fake.IDBTransaction);
put('IDBVersionChangeEvent', fake.IDBVersionChangeEvent);

/** Web Storage in memory: the same five calls, nothing kept past the page. */
class MemoryStorage {
  #m = new Map<string, string>();
  get length() { return this.#m.size; }
  key(i: number) { return [...this.#m.keys()][i] ?? null; }
  getItem(k: string) { return this.#m.has(k) ? this.#m.get(k)! : null; }
  setItem(k: string, v: string) { this.#m.set(String(k), String(v)); }
  removeItem(k: string) { this.#m.delete(k); }
  clear() { this.#m.clear(); }
}

const local = new MemoryStorage();
// past the first three launches: the Safari install hint is not part of this walkthrough
local.setItem('fs-launches', '3');
put('localStorage', local);
const session = new MemoryStorage();
// the cold-load breath has been seen: the walkthrough opens on the step, not on the threshold (step 1 locks it)
session.setItem('fs-threshold', String(Date.now()));
put('sessionStorage', session);

// No Wake Lock: a phone drawn in a page has no screen of its own to keep awake, and a nested frame without the
// permission logs a policy violation for every ask. The app's own guard ("no Wake Lock API, nothing happens") holds.
try { Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true }); } catch { /* the app catches the refusal */ }

// In a sandboxed frame the browser refuses focus() that no tap asked for (a sheet the walkthrough opens) and logs a
// policy violation. There, such a focus is skipped instead of refused; a focus after a tap goes through as ever.
if (self.origin === 'null' && 'userActivation' in navigator) {
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
    if (!(navigator as Navigator & { userActivation: { isActive: boolean } }).userActivation.isActive) return;
    focus.call(this, options);
  };
}
