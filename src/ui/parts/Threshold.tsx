// The threshold (DESIGN.md section 1: "the threshold is a breath"): after a cold load the app opens on
// the manifesto's two lines on the page colour while the ring breathes once, then the page comes up.
// A tap goes straight through. It is skipped under reduced motion and when the page is reloaded within
// the same session. Package 6 puts the keypad on this same screen: pass it as `keypad`, and the
// threshold then waits for `onDone` from the lock instead of the breath.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { MANIFESTO } from '../../db/seed';
import { RingMark } from './Ring';

const SEEN_KEY = 'fs-threshold';

/** A duration token in milliseconds, as the current light sets it. */
function tokenMs(name: string): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith('ms') ? n : n * 1000;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A breath before the page: on a cold load only, never under reduced motion, never twice in a session. */
export function thresholdWanted(): boolean {
  if (reducedMotion()) return false;
  try { return !sessionStorage.getItem(SEEN_KEY); } catch { return true; }
}

type Props = {
  /** Called once the breath is over (or on a tap); the app then shows the page. */
  onDone: () => void;
  /** The slot for package 6's keypad. With a keypad the breath does not end the threshold: the lock does. */
  keypad?: ComponentChildren;
};

export function Threshold({ onDone, keypad }: Props) {
  const [out, setOut] = useState(false);
  const leave = () => {
    if (out) return;
    setOut(true);
    setTimeout(onDone, tokenMs('--t-page'));
  };
  useEffect(() => {
    try { sessionStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* private mode: the breath shows again */ }
    if (keypad) return;
    const t = setTimeout(leave, tokenMs('--t-breath'));
    return () => clearTimeout(t);
  }, []);
  return (
    <div class={`fs-threshold${out ? ' out' : ''}`} data-threshold onPointerDown={keypad ? undefined : leave}>
      <p class="fs-threshold-title">Who to Be, How to Flow</p>
      <p class="fs-manifesto">{MANIFESTO[0]}<br />{MANIFESTO[1]}</p>
      <RingMark />
      {keypad && <div class="fs-threshold-keypad">{keypad}</div>}
    </div>
  );
}
