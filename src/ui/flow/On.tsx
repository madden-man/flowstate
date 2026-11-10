// The On sheet (PLAN-PICKS.md sections 4 and 5, P1): what to put on at a step, from the On row. On parts/Sheet, no
// dialog. The step's printed line first (onLine, print like a step's said line), then up to three covers and up to
// three lines. Nothing says why anything is offered, and nothing counts.
//
// Covers are the ♪ grid's own Tile (MusicSheet.tsx), so a tap plays as a ♪ tile does (on its playlist at its first song
// when a chosen playlist holds it, V9; the album itself otherwise) with M3's bell, tick, drop, hush, ring and flight to
// the ♪. Wordless, as in ♪. Only a kept cover is a tile: the covers come from the cache the ♪ grid fills, never fetched
// here, and an album with none is a written line instead. Spotify's yes on a live episode writes episodes.music and
// ticks the On row.
//
// Lines are the page's own check rows (parts/Check): the title, its kind word in small print, a blank rule. Ticking one
// on a live episode writes episodes.on and ticks the On row, which then reads its pick; ticking another puts that one on
// instead; un-ticking takes it off. At rest a tick only draws (walk it once, PLAN-FLOWS.md 3.7). In Still (rule 13) the
// lines leave (fs-notstill, so the light alone decides) and the covers stay, dimmed by the ♪ grid's own Still rule; the printed line stays (words, no digits).
// ♪ beside Done reaches the whole grid.
import { useEffect, useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { tick } from '../parts/Haptic';
import { openSheet } from '../sheets';
import { Check } from '../parts/Check';
import { Tile, useHush } from '../music/MusicSheet';
import { playing, playNote, tapMusic } from '../music/state';
import { keptAlbums } from '../../music/covers';
import type { ShelfAlbum } from '../../music/covers';
import type { Episode, OnPick, PickKind, Step, Tip } from '../../db/schema';
import type { Read } from '../../db/fields';
import { albumUriOf } from '../../db/seed/picks';
import { livePicks, setOn, setOnAlbum } from '../../model/tips';

/** The kind word at a line's end, the same small print as a helper's word (rule 7: words, never icons). */
export const KIND_WORD: Record<PickKind, string> = { album: 'Album', show: 'Show', film: 'Film', switch: 'Switch', phone: 'Phone' };

/** The most covers and lines a sheet shows (PLAN-PICKS.md section 2: fewer, not all). */
const MOST = 3;

/** The On row tapped: the sheet rises, and its opening is felt (rule 19), once: felt is true when the row's own Check
 *  already ticked under the thumb. */
export function showOn(felt: boolean) {
  if (!felt) tick('sheet');
  openSheet.value = 'on';
}

type Kept = Map<string, { row: ShelfAlbum; playlist: { id: string; uri: string } }>;

/** The kept albums of these picks, each as a tile plays it: on the first chosen playlist that holds it, else itself. */
async function keep(picks: OnPick[]): Promise<Kept> {
  const uris = picks.flatMap(p => albumUriOf(p) ?? []);
  const found = await keptAlbums(uris);
  const out: Kept = new Map();
  for (const [uri, { row, shelf }] of found) {
    if (!row.cover) continue;
    out.set(uri, shelf
      ? { row: { ...row, ...shelf }, playlist: { id: shelf.playlistId, uri: `spotify:playlist:${shelf.playlistId}` } }
      : { row: { ...row, playlistId: '', order: 0, firstTrackUri: '' }, playlist: { id: '', uri } });
  }
  return out;
}

type Props = {
  open: boolean; onClose: () => void;
  step: Step; tip: Tip;
  /** The live episode, if one is open: a tick writes on it. */
  live?: Read<Episode>;
  /** The line drawn at rest (in memory only), and its setter: the row reads it too. */
  rest?: OnPick | null; onRest: (p: OnPick | null) => void;
  onChanged: () => void;
};

export function OnSheet({ open, onClose, step, tip, live, rest, onRest, onChanged }: Props) {
  const picks = livePicks(step);
  const [kept, setKept] = useState<Kept | null>(null);
  useEffect(() => {
    if (!open) return;
    let on = true;
    void keep(picks).then(k => on && setKept(k));
    return () => { on = false; };
  }, [open, step.id, JSON.stringify(picks.map(p => p.id))]);
  const hushed = useHush();
  const now = playing.value?.albumUri;

  const albums = picks.filter(p => p.kind === 'album');
  const covers = kept ? albums.filter(p => kept.has(albumUriOf(p)!)).slice(0, MOST) : [];
  // an album with no kept cover is a written line instead of a blank tile; until the cache is read, nothing shows
  const written = kept ? albums.filter(p => !kept.has(albumUriOf(p)!)) : [];
  // the written albums take the covers' places, so the sheet still holds three and three
  const lines = [...picks.filter(p => p.kind !== 'album').slice(0, MOST), ...written.slice(0, MOST)];
  const onId = live ? live.on?.pickId : rest?.id;

  const tick = async (p: OnPick, on: boolean) => {
    if (!live) { onRest(on ? p : null); return; }
    await setOn(live.id, tip.id, on ? p : null);
    onChanged();
  };
  const played = (uri: string, p: OnPick) => async (run: Promise<void>) => {
    await run;
    const m = playing.peek();
    if (!live || m?.albumUri !== uri) return;
    await setOnAlbum(live.id, tip.id, { albumUri: uri, album: m.album || p.title, artist: m.artist || p.by || '' });
    onChanged();
  };

  return (
    <Sheet open={open} onClose={onClose} title={tip.text} action={{ label: '♪', onPress: tapMusic }}>
      <div class="fl-on" data-on={step.id}>
        {step.onLine && <p class="fl-said">{step.onLine}</p>}
        {playNote.value && covers.length > 0 && <p class="fs-note" role="status">{playNote.value}</p>}
        {covers.length > 0 && (
          <div class={`fs-tiles${hushed ? ' hush' : ''}`} role="group" aria-label="Albums">
            {covers.map(p => {
              const uri = albumUriOf(p)!;
              const k = kept!.get(uri)!;
              return <Tile key={p.id} playlist={k.playlist} album={k.row} pressed={now === uri} chosen={hushed === uri} row={0} onTap={played(uri, p)} />;
            })}
          </div>
        )}
        {lines.length > 0 && (
          <div class="fl-tips fs-notstill" aria-label="Lines">
            {lines.map(p => (
              <div key={p.id} class="fl-tip" data-pick={p.id}>
                <Check checked={onId === p.id} onChange={on => void tick(p, on)} word={KIND_WORD[p.kind]}>{p.title}</Check>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
