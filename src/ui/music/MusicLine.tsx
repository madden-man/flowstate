// The ♪ line in the page header (PLAN.md section 8.1): a word drawn as text, never an icon. Beside it the
// album this page heard (or, on a page without one, what is playing now) as a small cover from its
// kept blob, offline. Long press the cover for the pages that heard the same album.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PageMusic } from '../../db/schema';
import { useHold } from '../parts/Hold';
import { tick } from '../parts/Haptic';
import { openSheet } from '../sheets';
import { albumFor, connected, coverUrl, playing, pollOnce, tapMusic, POLL_MS } from './state';

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
        <button type="button" class="fs-mini" aria-label={`${shown.album}, hold for pages with this album`} data-mini={shown.albumUri} {...hold}>
          <Cover id={shown.coverId} />
        </button>
      )}
    </>
  );
}
