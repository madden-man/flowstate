// The example data the worlds' screens are taken on (PLAN-WORLDS.md W1): the fixture registry (test/fixtures/worlds.json)
// put into home's settings row as the bridge will leave it, one line on yesterday's page, a ticked playlist, and its
// kept covers as stand-ins: squares of one colour each, never a real album's art. Written straight into the personal
// notebook's database, as the app stores rows with no PIN. Used by script/snap-worlds.mjs and script/snap-worlds-steps.mjs.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLDS = JSON.parse(await readFile(path.join(root, 'test/fixtures/worlds.json'), 'utf8'));

export async function seed(tab) {
  await tab.evaluate(async ({ worlds }) => {
    const put = (name, rows) => new Promise((resolve, reject) => {
      const open = indexedDB.open(name);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const stores = Object.keys(rows).filter(s => db.objectStoreNames.contains(s));
        const tx = db.transaction(stores, 'readwrite');
        for (const s of stores) for (const r of rows[s]) {
          if (typeof r === 'function') { const st = tx.objectStore(s); const g = st.get('app'); g.onsuccess = () => st.put(r(g.result)); }
          else tx.objectStore(s).put(r);
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    const at = (d, h, m) => new Date(2026, 10, d, h, m).getTime();
    // stand-in covers: a square of one colour each (example data)
    const square = hue => new Promise(r => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = `hsl(${hue} 45% 52%)`; g.fillRect(0, 0, 64, 64);
      g.fillStyle = `hsl(${hue} 50% 34%)`; g.fillRect(0, 40, 64, 24);
      c.toBlob(b => b.arrayBuffer().then(r), 'image/png');
    });
    const albums = [];
    for (const [i, h] of [215, 280, 140, 30, 0, 50].entries()) albums.push({ albumUri: `spotify:album:ex${i}`, album: `Example ${i + 1}`, artist: 'Example', cover: await square(h), coverType: 'image/png', coverAt: Date.now() });
    await put('flowstate', {
      settings: [s => ({ ...s, worlds, spotify: { connectedAt: 1, tokens: { accessToken: 'x', refreshToken: 'x', expiresAt: Date.now() + 3.6e6, name: 'Example' } }, cover: { albums: [] } })],
      pages: [{ id: 'pg-own', kind: 'entry', createdAt: at(24, 21, 40), updatedAt: at(24, 21, 40), state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] }],
      messages: [{ id: 'm-own', pageId: 'pg-own', at: at(24, 21, 40), text: 'Then the answer is not a list of people. It is the pace.', kept: false }],
      albums,
      playlists: [{ id: 'pl-ex', name: 'Example playlist', uri: 'spotify:playlist:pl-ex', order: 0, snapshotId: 's', total: 6, chosen: true }],
      shelves: albums.map((a, order) => ({ playlistId: 'pl-ex', albumUri: a.albumUri, order, firstTrackUri: `t${order}` })),
    });
  }, { worlds: WORLDS });
}

