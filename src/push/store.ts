// The fs-push store (PLAN-PUSH.md section 5, N3): a tiny IndexedDB database of its own, one object store, so the
// service worker (public/push-sw.js) can read his line with the raw API when a push wakes it cold. Outside Dexie and
// outside the PIN's encryption: the worker has no key, and the line is one sentence he chose to show on a lock screen.
// Two keys: 'line' (the app writes it whenever the line changes while push is on) and 'lastArrivedAt' (the worker
// writes it when a push lands; the Settings row reads it). Not exported: nothing here is the journal's.
// public/push-sw.js keeps its own copy of these three names; test/push/push-sw.test.ts reads both files to keep them in step.

export const PUSH_DB = 'fs-push';
export const PUSH_STORE = 'push';
export const PUSH_DB_VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_DB, PUSH_DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PUSH_STORE)) req.result.createObjectStore(PUSH_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(db => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(PUSH_STORE, mode);
    const req = work(tx.objectStore(PUSH_STORE));
    tx.oncomplete = () => { db.close(); resolve(req ? req.result : undefined); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  }));
}

/** The line the worker shows. Quiet on failure: a push with no line shows the bare title. */
export const writePushLine = (line: string): Promise<void> =>
  run('readwrite', s => { s.put(line, 'line'); }).then(() => undefined, () => undefined);

export const readPushLine = (): Promise<string | null> =>
  run<unknown>('readonly', s => s.get('line')).then(v => (typeof v === 'string' && v.trim() ? v : null), () => null);

/** When the last push landed (ms), as the worker wrote it; null until one has. */
export const readLastArrived = (): Promise<number | null> =>
  run<unknown>('readonly', s => s.get('lastArrivedAt')).then(v => (typeof v === 'number' ? v : null), () => null);

/** Empties the store (push turned off, or a journal replaced by an import with push off). */
export const clearPushStore = (): Promise<void> =>
  run('readwrite', s => { s.clear(); }).then(() => undefined, () => undefined);
