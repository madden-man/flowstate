// The app's own seed passes, run before the first render (as design/tasks/src/seed.ts), so every sign's page opens on
// its Blockers as a journal that has run them: the eight old flows, the three second listings and the six drafts
// (db/seed.ts seedBlockersOnce). Each step writes the rest itself (./driver.ts): an episode, a resolved question, a
// line on today's page, three questions on the ? tab (example data). Nothing is kept past the page.
import { moveDoctorLineOnce, seedBlockersOnce, seedFlowsOnce, seedPicksOnce } from '../../../src/db/seed';
import { STARTERS } from '../../../src/model/acts';
import { store } from '../../../src/db/fields';
import { saveSettings } from '../../../src/ui/settings';

export async function seedDemo(): Promise<void> {
  await seedFlowsOnce();
  await seedPicksOnce();
  await moveDoctorLineOnce();
  await seedBlockersOnce();
}

/** Root's five starter albums, kept as the ♪ grid would keep them, each cover the file beside app.html (design/tasks'
 *  c-root-<n>.jpg, copied by the build; vite.config.ts's seam), so Root's shelf shows its covers as on the phone. */
const COVERS = new Map(STARTERS.root.map((p, i) => [`spotify:album:${p.albumId}` as string, `c-root-${i + 1}.jpg`] as const));

/** Spotify connected (tokens that go nowhere: the network is refused) and one chosen playlist holding Root's starters,
 *  as design/tasks/src/seed.ts connectMusic does for all seven. */
export async function connectMusic(): Promise<void> {
  (globalThis as { fsCoverUrl?: (uri: string) => string | undefined }).fsCoverUrl = uri => COVERS.get(uri);
  const at = Date.now();
  const pl = 'K6signs00000000000000';
  await saveSettings({ spotify: { tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: at + 864e5 * 365, name: 'Tommy' }, connectedAt: at, ticked: [pl] } });
  await store.put('playlists', { id: pl, name: 'master (ii)', uri: `spotify:playlist:${pl}`, order: 0, snapshotId: 's', total: COVERS.size, chosen: true, readAt: at });
  let k = 0;
  for (const p of STARTERS.root) {
    const uri = `spotify:album:${p.albumId}`;
    await store.put('albums', { albumUri: uri, album: p.title, artist: p.by ?? '', cover: new Uint8Array([0xff]).buffer, coverType: 'image/jpeg', coverAt: at });
    await store.put('shelves', { playlistId: pl, albumUri: uri, order: k++, firstTrackUri: `spotify:track:${p.albumId}` });
  }
}
