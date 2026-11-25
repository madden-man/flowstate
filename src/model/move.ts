// A song moved from one world to another (W6; Tommy, 2026-11-25: "sure, add it"). Only a song moves, with every take of
// it, audio and all; a loose hum, a page, a council or a question never does, and his own pages are never offered (they
// have no Songs). The song and its takes keep their ids for life: the same id arriving under another world is the same
// song moved (docs/BRIDGE.md).
//
// IndexedDB holds no transaction across two databases, so the move is made safe to stop halfway, in the order the PIN
// change uses (db/fields.ts setKey):
//   1. the destination is written whole: the song (marked movedFrom the source) and every take, same ids, sealed with
//      the one key, in one transaction on that notebook, its outbox recording them as rows of the new world;
//   2. it is read back and checked: the song and every take there, each take's audio the same length;
//   3. the source's song and takes are deleted in one transaction on that notebook, its outbox recording the deletes;
//   4. the destination's song (its mark cleared) and takes are written once more, so their revs under the new world are
//      newer than the deletes under the old: a reader that sees the id under both worlds takes the newest rev.
// A stop after 1 or 2 leaves the song in both notebooks, never in neither. settleMoves finishes any such move (on the
// Songs list, and before a move), and running a move again is the same move: every step is idempotent.
//
// Characters belong to a bible. Moving out of a novel world keeps the song's characterIds tucked on it with that world's
// id; moving into a world brings back what was tucked for it. The row sent under the new world carries only the ids it
// holds there (none, unless they were tucked for that world).
//
// Clips: a take whose clip was already acknowledged keeps its mark and is not sent again (Music Companion keys sketches
// by take id); one whose clip had not gone up yet sends it under the new world, once its row there is acknowledged.
// The old world's deletes wait in the old world's outbox; model/carry.ts drains every world's outbox, worn or not, so
// they are not stranded if he never wears that world again.
import { into, type Read } from '../db/fields';
import type { Song, Take } from '../db/schema';

const opened = <T extends object>(r: Read<T>): T => { const { locked: _, ...rest } = r as Read<T> & { locked?: true }; return rest as T; };

/** The song as it is written into the destination: its characters tucked or brought back, the move marked. */
export function songFor(song: Song, from: string, to: string): Song {
  const { movedFrom: _m, tucked, characterIds, ...rest } = song;
  let keep = (tucked ?? []).filter(t => t.world !== to && t.world !== from);
  if (characterIds?.length) keep = [...keep, { world: from, characterIds }];
  const back = tucked?.find(t => t.world === to)?.characterIds;
  const out: Song = { ...rest, movedFrom: from };
  if (back?.length) out.characterIds = back;
  if (keep.length) out.tucked = keep;
  return out;
}

export class MoveError extends Error {}

/** Moves a song and its takes from one world's notebook to another's. Refuses his own pages and a move to itself. */
export async function moveSong(songId: string, from: string, to: string): Promise<void> {
  if (!from || !to || from === to) throw new MoveError('A song moves between two worlds');
  const src = into(from), dst = into(to);
  const s = await src.get('songs', songId);
  if (!s) {
    // already moved (a stop after step 3): only the mark may be left
    await settleMoves(to);
    return;
  }
  if (s.locked) throw new MoveError('Locked');
  const song = opened(s);
  const takes = (await src.query('takes', t => t.where('songId').equals(songId))).map(t => {
    if (t.locked) throw new MoveError('Locked');
    return opened(t) as Take;
  });
  // 1. the destination whole
  const moved = songFor(song, from, to);
  await dst.many({ songs: [moved], takes });
  // 2. read back and checked
  const back = await dst.get('songs', songId);
  if (!back || back.locked) throw new MoveError('The song did not land');
  const there = await dst.query('takes', t => t.where('songId').equals(songId));
  for (const t of takes) {
    const b = there.find(x => x.id === t.id);
    if (!b || b.locked || b.audio.byteLength !== t.audio.byteLength) throw new MoveError('A take did not land');
  }
  // 3 and 4
  await finish(songId, from, to, takes.map(t => t.id));
}

/** Deletes the source's copy, then writes the destination's song (its mark cleared) and takes once more, so their
 *  envelopes under the new world carry revs newer than the deletes under the old (Music Companion resolves a song seen
 *  under two worlds to the newest rev: a half-finished move ends in the new world). Idempotent. */
async function finish(songId: string, from: string, to: string, takeIds: string[]) {
  const src = into(from), dst = into(to);
  const leftRows = await src.query('takes', t => t.where('songId').equals(songId));
  // a take made in the old world after a stop halfway is carried over before the old copy goes, never lost
  const have = new Set((await dst.query('takes', t => t.where('songId').equals(songId))).map(t => t.id));
  const late = leftRows.filter(t => !have.has(t.id));
  if (late.some(t => t.locked)) throw new MoveError('Locked');
  if (late.length) await dst.many({ takes: late.map(t => opened(t) as Take) });
  const ids = [...new Set([...takeIds, ...leftRows.map(t => t.id)])];
  if ((await src.get('songs', songId)) || leftRows.length) await src.many({}, { songs: [songId], takes: ids });
  const song = await dst.get('songs', songId);
  if (!song || song.locked) return;
  const { movedFrom: _m, ...rest } = opened(song) as Song;
  const takes = (await dst.query('takes', t => t.where('songId').equals(songId))).filter(t => !t.locked).map(t => opened(t) as Take);
  await dst.many({ songs: [rest], takes });
}

/** Finishes every move into this world that stopped halfway: a song here marked movedFrom a world that still holds its
 *  old copy has that copy deleted there, and the mark cleared. */
export async function settleMoves(world: string): Promise<number> {
  const dst = into(world);
  const marked = (await dst.query('songs', t => t.toCollection())).filter(s => !s.locked && s.movedFrom);
  for (const s of marked) {
    const takeIds = (await dst.query('takes', t => t.where('songId').equals(s.id))).map(t => t.id);
    await finish(s.id, s.movedFrom!, world, takeIds);
  }
  return marked.length;
}
