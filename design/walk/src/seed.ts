// Example data for the walk walkthrough, on top of the app's own seed: the passes the app runs once the journal is
// open are run here first (the walk's audit last, as in app.tsx), then two things are written through the app's own
// store and model so the cards have something to show. The covers of the six albums Panic's two On cards offer are
// kept as the ♪ grid keeps them (bytes in the albums table; the files are design/flows/covers, inlined at build), so
// the cards draw their pictures with no Spotify here. And the person on Settling is named: Ali, an example, with a
// made-up number. No PIN: the journal is open, and nothing is kept past the page (design/motion/src/fakes.ts).
import { store } from '../../../src/db/fields';
import { moveDoctorLineOnce, seedFixationsOnce, seedFlowsOnce, seedPicksOnce, walkOnce } from '../../../src/db/seed';
import { savePerson } from '../../../src/model/carried';
import type { Album } from '../../../src/db/schema';
import romantic from '../../flows/covers/4TFQoPpiHkSsYDbhfXMqCM.jpg?inline';
import solitudes from '../../flows/covers/1Zrfkm3Oc8xhCLGCGmmKev.jpg?inline';
import grow from '../../flows/covers/7hoiuRyh1XBh4YUOB0ZeGx.jpg?inline';
import lonesome from '../../flows/covers/2ZDjruwuzzzT8JMJRXvLtl.jpg?inline';
import head from '../../flows/covers/3MhJ8lLj98SPgtiH16ZmXo.jpg?inline';
import animal from '../../flows/covers/1oQYM3uKcmLBHvdO7vzRLo.jpg?inline';

const COVERS: [id: string, album: string, artist: string, data: string][] = [
  ['4TFQoPpiHkSsYDbhfXMqCM', 'Romantic Piano', 'Gia Margaret', romantic],
  ['1Zrfkm3Oc8xhCLGCGmmKev', 'Solitudes', 'Tom Ashbrook', solitudes],
  ['7hoiuRyh1XBh4YUOB0ZeGx', 'All We Grow', 'S. Carey', grow],
  ['2ZDjruwuzzzT8JMJRXvLtl', 'Lonesome Dreams', 'Lord Huron', lonesome],
  ['3MhJ8lLj98SPgtiH16ZmXo', 'The Head and the Heart', 'The Head And The Heart', head],
  ['1oQYM3uKcmLBHvdO7vzRLo', 'My Head Is An Animal (The Cabin Sessions)', 'Of Monsters and Men', animal],
];

/** A data: URL's bytes. */
function bytes(data: string): ArrayBuffer {
  const bin = atob(data.slice(data.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** The person on Settling: example data. */
export const PERSON = { name: 'Ali', tel: '555 010 4471', text: 'Hard hour. Can you talk to me about anything for ten minutes?' };

export async function seedDemo(): Promise<void> {
  await seedFlowsOnce();
  await seedPicksOnce();
  await seedFixationsOnce();
  await moveDoctorLineOnce();
  await walkOnce();
  const at = Date.now();
  const albums: Album[] = COVERS.map(([id, album, artist, data]) => ({ albumUri: `spotify:album:${id}`, album, artist, cover: bytes(data), coverType: 'image/jpeg', coverAt: at }));
  await store.many({ albums });
  await savePerson('panic', 'panic-3', 'panic-3-person', PERSON);
}
