// The Sunday question's two service worker handlers (PLAN-PUSH.md section 5, N3), loaded into the generated worker by
// vite.config.ts (workbox importScripts), so the worker itself stays generated and precaching is untouched. Plain JS,
// no imports. Copied and slimmed from Semper Dulce's public/sw.js.
//
// push: every push is exactly {"kind":"checkin"} and carries no words. The line is read from this phone's own fs-push
//   IndexedDB (src/push/store.ts). A notification is ALWAYS shown, the bare title if the line cannot be read, because
//   iOS withdraws a subscription whose pushes show nothing. Then lastArrivedAt is written, for "Last arrived".
// notificationclick: focus the open app and land it on the question (a message, and the address), or open the address.
//
// Kept in step by hand, and by test/push/push-sw.test.ts, which reads both sides:
//   PUSH_DB, PUSH_STORE, PUSH_DB_VERSION   = src/push/store.ts
//   CHECKIN_URL                            = '/' + CHECKIN_HASH in src/ui/journal/checkin.tsx
/* eslint-env serviceworker */
const PUSH_DB = 'fs-push';
const PUSH_STORE = 'push';
const PUSH_DB_VERSION = 1;
const CHECKIN_URL = '/#/journal?ask=checkin';
const PUSH_TITLE = 'FlowState';
const PUSH_ICON = '/icon-192.png';

function pushDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_DB, PUSH_DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PUSH_STORE)) req.result.createObjectStore(PUSH_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readPushLine() {
  try {
    const db = await pushDb();
    try {
      return await new Promise((resolve, reject) => {
        const q = db.transaction(PUSH_STORE, 'readonly').objectStore(PUSH_STORE).get('line');
        q.onsuccess = () => resolve(typeof q.result === 'string' && q.result.trim() ? q.result : null);
        q.onerror = () => reject(q.error);
      });
    } finally {
      db.close();
    }
  } catch (e) {
    return null;
  }
}

async function stampArrived(at) {
  const db = await pushDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PUSH_STORE, 'readwrite');
      tx.objectStore(PUSH_STORE).put(at, 'lastArrivedAt');
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function showCheckin() {
  const options = { tag: 'checkin', icon: PUSH_ICON, data: { url: CHECKIN_URL } };
  const line = await readPushLine();
  if (line) options.body = line;
  let failed = null;
  try {
    await self.registration.showNotification(PUSH_TITLE, options);
  } catch (e) {
    // never nothing: the bare title
    try {
      await self.registration.showNotification(PUSH_TITLE, { tag: 'checkin', icon: PUSH_ICON, data: { url: CHECKIN_URL } });
    } catch (e2) {
      failed = e2;
    }
  }
  // the push arrived either way: "Last arrived" says so
  const at = Date.now();
  try { await stampArrived(at); } catch (e) { /* "Last arrived" waits for the next one */ }
  try {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) w.postMessage({ kind: 'arrived', at });
  } catch (e) { /* no window open */ }
  if (failed) throw failed;
}

self.addEventListener('push', event => {
  event.waitUntil(showCheckin());
});

async function openCheckin(data) {
  const url = new URL((data && data.url) || CHECKIN_URL, self.location.origin).href;
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const app = wins.find(w => new URL(w.url).origin === self.location.origin);
  if (!app) return self.clients.openWindow(url);
  let win = app;
  try { win = (await app.focus()) || app; } catch (e) { /* focus refused: still land it */ }
  // on iOS navigate can come to nothing for an app already open: the message lands it too (landing twice is harmless)
  try { win.postMessage({ kind: 'checkin' }); } catch (e) { /* the address does it */ }
  try { await win.navigate(url); } catch (e) { /* the message did it */ }
  return undefined;
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(openCheckin(event.notification.data));
});
