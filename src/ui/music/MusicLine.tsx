// The ♪ line in the page header (PLAN.md section 8.1): a word drawn as text, never an icon. Beside it the
// album this page heard (or, on a page without one, what is playing now) as a small cover from its
// kept blob, offline. Long press the cover for the pages that heard the same album. A new album on the line
// lands there (from 1.3 to its size, PLAN-MOTION.md M3), unless a tapped cover is on its way to land it.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PageMusic } from '../../db/schema';
import { useHold } from '../parts/Hold';
import { tick } from '../parts/Haptic';
import { openSheet } from '../sheets';
import { albumFor, asked, connected, coverUrl, playing, pollOnce, tapMusic, POLL_MS } from './state';
import { flyingTo, inFlight, land } from './motion';

/** The page the header sits on, when it is one you write on (an entry, a question, a council page). */
export type MusicPage = { id: string; music?: PageMusic; onMusic?: (m: PageMusic) => void };

/** Every 20 s while the page is open, in front and connected: what is playing, written once onto the page. */
function usePoll(page?: MusicPage) {
  const onMusic = useRef(page?.onMusic);
  onMusic.current = page?.onMusic;
  const id = page?.id;
  const on = connected.value;
  useEffect(() => {
    if (!id || !on) return;
    const look = () => { if (document.visibilityState === 'visible') void pollOnce(id, m => onMusic.current?.(m)); };
    look();
    const t = setInterval(look, POLL_MS);
    document.addEventListener('visibilitychange', look);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', look); };
  }, [id, on]);
}

export function Cover({ id, class: cls }: { id: string; class?: string }) {
  const [src, setSrc] = useState<string | undefined>();
  useEffect(() => {
    let live = true;
    void coverUrl(id).then(u => live && setSrc(u));
    return () => { live = false; };
  }, [id]);
  return src ? <img class={cls} src={src} alt="" draggable={false} /> : <span class={cls} />;
}

export function MusicLine({ page }: { page?: MusicPage }) {
  usePoll(page);
  const shown = page?.music ?? playing.value;
  const mini = useRef<HTMLButtonElement>(null);
  const had = useRef(shown?.albumUri);
  useEffect(() => {
    const uri = shown?.albumUri;
    if (uri === had.current) return;
    had.current = uri;
    // a frame later, when a tile's flight (started in the same render) has claimed it; a tap no tile took
    // (its grid was closed when Spotify answered) is let go, and the cover lands by itself
    if (uri) requestAnimationFrame(() => {
      if (inFlight(uri)) return;
      if (asked.peek() === uri) asked.value = null;
      land(mini.current);
    });
  }, [shown?.albumUri]);
  // the cover a tap is sending here stays unseen until the copy arrives, so it never shows twice
  const awaited = !!shown && (flyingTo.value === shown.albumUri || (asked.value === shown.albumUri && playing.value?.albumUri === shown.albumUri));
  const hold = useHold(() => {
    if (!shown) return;
    albumFor.value = shown;
    openSheet.value = 'album';
    tick('sheet');
  }, tapMusic);
  return (
    <>
      <button type="button" class="fs-word fs-musicword" aria-label="Music" onClick={tapMusic}>♪</button>
      {shown?.coverId && (
        <button ref={mini} type="button" class="fs-mini" aria-label={`${shown.album}, hold for pages with this album`} data-mini={shown.albumUri} data-landing={awaited ? '' : undefined} {...hold}>
          <Cover id={shown.coverId} />
        </button>
      )}
    </>
  );
}
