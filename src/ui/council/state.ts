// What the council screens share: the pantheon as a signal, who speaks next, which voice the sheet
// is editing, and the long press (pick up or keep close; DESIGN.md rule 8).
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Voice, VoiceColour } from '../../db/schema';
import type { Read } from '../../db/fields';
import { allVoices, type Tapped } from '../../model/council';

/** Every voice, archived ones included, in order. Reloaded after any voice edit. */
export const voiceList = signal<Read<Voice>[]>([]);
export async function reloadVoices(): Promise<void> {
  voiceList.value = await allVoices();
}

/** The chip you tapped: a voice's id, null for Ink, undefined for none. At a seated council it speaks
 *  for one line and is cleared; with nobody seated it holds until another is tapped (model nextSpeaker). */
export const speaker = signal<Tapped>(undefined);

/** The voice the voice sheet is editing; null adds a new one. */
export const editing = signal<string | null>(null);

/** Set before opening the voice sheet to start a new voice as someone's twin (the Voices screen's "+ twin"). */
export const draft = signal<{ colour: VoiceColour; shade: 'light' | 'deep'; twinId: string } | null>(null);

const LONG_MS = 450;
const SLOP_PX = 8;

/** Long press: fires after LONG_MS held still, and swallows the click that follows it. A right click
 *  (or the platform's own long-press menu) counts too, so it works with a mouse. */
export function useLongPress<T extends HTMLElement = HTMLElement>(onLong: (target: T, e: Event) => void, selector?: string) {
  const st = useRef<{ x: number; y: number; t: ReturnType<typeof setTimeout>; el: T } | null>(null);
  const fired = useRef(false);
  const cb = useRef(onLong);
  cb.current = onLong;
  useEffect(() => () => { if (st.current) clearTimeout(st.current.t); }, []);
  const pick = (e: Event): T | null => {
    const el = e.currentTarget as T;
    return selector ? ((e.target as HTMLElement).closest(selector) as T | null) : el;
  };
  const cancel = () => { if (st.current) { clearTimeout(st.current.t); st.current = null; } };
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button > 0) return;
      const el = pick(e);
      if (!el) return;
      fired.current = false;
      cancel();
      st.current = { x: e.clientX, y: e.clientY, el, t: setTimeout(() => { fired.current = true; st.current = null; cb.current(el, e); }, LONG_MS) };
    },
    onPointerMove: (e: PointerEvent) => {
      const s = st.current;
      if (s && (Math.abs(e.clientX - s.x) > SLOP_PX || Math.abs(e.clientY - s.y) > SLOP_PX)) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (e: MouseEvent) => {
      if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false; }
    },
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      const el = pick(e);
      if (!el || fired.current) return;
      cancel();
      fired.current = true;
      cb.current(el, e);
    },
  };
}
