// The app's own seed passes, run before the first render (as design/mountain/src/seed.ts), then the example data every
// step shares: one person chosen once, Ali (example data), for Send, Call and Reach; and a held value with two
// champions for Stand on. Each step writes the rest itself (./driver.ts). No PIN unless the step is the door, and
// nothing is kept past the page (design/motion/src/fakes.ts).
import { moveDoctorLineOnce, seedFixationsOnce, seedFlowsOnce, seedPicksOnce, valuesFromParadoxesOnce } from '../../../src/db/seed';
import { choosePerson } from '../../../src/model/person';
import { champion, createValue, held, moveValue, setWhy } from '../../../src/model/values';
import { STARTERS } from '../../../src/model/acts';
import { CHAKRA_IDS } from '../../../src/model/mountain';
import { store } from '../../../src/db/fields';
import { saveSettings } from '../../../src/ui/settings';

/** Ali, chosen once from a sign (example data): the number is a fictional 555 one. */
export const PERSON = { name: 'Ali', tel: '555 010 4471', text: 'Hard hour. Ten minutes?' };

export async function seedDemo(): Promise<void> {
  await seedFlowsOnce();
  await seedPicksOnce();
  await seedFixationsOnce();
  await moveDoctorLineOnce();
  await valuesFromParadoxesOnce();
  await choosePerson(PERSON);
  const made = new Date(2026, 10, 6, 20).getTime();
  const honesty = await createValue({ word: 'honesty', shadow: 'discretion', looks: 'Saying the true thing while it can still help.' }, made);
  await champion(honesty.id, 'v-warrior', 'value', made + 1);
  await setWhy(honesty.id, 'v-warrior', 'value', 'I say it to their face, and I stay in the room after.', made + 1);
  await champion(honesty.id, 'v-skeptic', 'value', made + 2);
  const ids = (await held()).map(v => v.id);
  if (ids[0] !== honesty.id) await moveValue(ids, honesty.id, 0, made + 3);
}

/** Every starter album, kept as the ♪ grid would keep it, its cover the file beside app.html (vite.config.ts's seam). */
const COVERS = new Map(CHAKRA_IDS.flatMap(c => STARTERS[c].map((p, i) => [`spotify:album:${p.albumId}` as string, `c-${c}-${i + 1}.jpg`] as const)));

/** Spotify connected (tokens that go nowhere: the network is refused) and one chosen playlist holding the 21 starters,
 *  so the shelf shows its covers and its plus. */
export async function connectMusic(): Promise<void> {
  (globalThis as { fsCoverUrl?: (uri: string) => string | undefined }).fsCoverUrl = uri => COVERS.get(uri);
  const at = Date.now();
  const pl = 'T6signs00000000000000';
  await saveSettings({ spotify: { tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: at + 864e5 * 365, name: 'Tommy' }, connectedAt: at, ticked: [pl] } });
  await store.put('playlists', { id: pl, name: 'master (ii)', uri: `spotify:playlist:${pl}`, order: 0, snapshotId: 's', total: COVERS.size, chosen: true, readAt: at });
  let k = 0;
  for (const c of CHAKRA_IDS) {
    for (const p of STARTERS[c]) {
      const uri = `spotify:album:${p.albumId}`;
      await store.put('albums', { albumUri: uri, album: p.title, artist: p.by ?? '', cover: new Uint8Array([0xff]).buffer, coverType: 'image/jpeg', coverAt: at });
      await store.put('shelves', { playlistId: pl, albumUri: uri, order: k++, firstTrackUri: `spotify:track:${p.albumId}` });
    }
  }
}
