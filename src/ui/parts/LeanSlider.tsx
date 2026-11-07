// The lean slider (PLAN.md section 5 item 4, DESIGN.md rule 20): a rule between a paradox's two poles,
// pole A's value at the left and pole B's at the right. A drawn mark slides under the finger with no
// transition and clicks into three detents (-1, 0, +1): a tick at each (rule 19), a bell at the two
// ends (rule 21). Release writes the lean. "note" opens one line beneath. Quiet: it shows the latest
// lean and never asks for another. The mark sits in percent, so nothing is laid out while hidden; the
// rule is measured only when touched.
import { useEffect, useRef, useState } from 'preact/hooks';
import { tick } from './Haptic';
import { bell } from './Sound';
import { detentOf, snapLean } from '../../model/flow';

type Props = {
  a: string;
  b: string;
  /** The latest lean, if there is one. */
  lean?: number;
  note?: string;
  onLean: (lean: number) => void;
  onNote?: (note: string) => void;
  /** Disabled while the journal is locked. */
  disabled?: boolean;
};

const pct = (l: number) => `${((l + 1) / 2) * 100}%`;

export function LeanSlider({ a, b, lean, note = '', onLean, onNote, disabled }: Props) {
  const rule = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<number | null>(null);
  const [noting, setNoting] = useState(false);
  const [draft, setDraft] = useState(note);
  const drag = useRef<{ pointer: number; value: number; at?: number } | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!noting) setDraft(note); }, [note, noting]);
  useEffect(() => { if (noting) field.current?.focus(); }, [noting]);

  const shown = live ?? lean;

  /** A detent entered: one tick, and a bell if it is an end. */
  const arrive = (value: number, prev?: number) => {
    const d = detentOf(value);
    if (d === undefined || d === prev) return d;
    tick('detent');
    if (d === -1) bell('leanLow');
    if (d === 1) bell('leanHigh');
    return d;
  };

  const fromX = (x: number) => {
    const r = rule.current!.getBoundingClientRect();
    return snapLean(((x - r.left) / Math.max(1, r.width)) * 2 - 1);
  };

  const down = (e: PointerEvent) => {
    if (disabled || e.button > 0) return;
    const value = fromX(e.clientX);
    drag.current = { pointer: e.pointerId, value, at: arrive(value) };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* the pointer has gone */ }
    setLive(value);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    d.value = fromX(e.clientX);
    d.at = arrive(d.value, d.at) ?? undefined;
    setLive(d.value);
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    onLean(d.value);
    setLive(null);
  };
  const cancel = () => { drag.current = null; setLive(null); };

  const key = (e: KeyboardEvent) => {
    if (disabled) return;
    const step = { ArrowLeft: -0.5, ArrowDown: -0.5, ArrowRight: 0.5, ArrowUp: 0.5 }[e.key];
    const to = e.key === 'Home' ? -1 : e.key === 'End' ? 1 : step !== undefined ? snapLean(Math.round(((lean ?? 0) + step) * 2) / 2) : undefined;
    if (to === undefined) return;
    e.preventDefault();
    arrive(to, detentOf(lean ?? NaN));
    onLean(to);
  };

  const saveNote = () => {
    setNoting(false);
    if (draft.trim() !== note.trim()) onNote?.(draft);
  };

  return (
    <div class="fs-lean">
      <div class="fs-lean-poles" aria-hidden="true"><span>{a}</span><span>{b}</span></div>
      <div ref={rule} class={`fs-lean-rule${live !== null ? ' drag' : ''}`} role="slider" tabIndex={disabled ? -1 : 0}
        aria-label={`Lean between ${a} and ${b}`} aria-valuemin={-1} aria-valuemax={1}
        aria-valuenow={shown ?? undefined} aria-valuetext={shown === undefined ? 'no lean yet' : leanWords(shown, a, b)}
        aria-disabled={disabled || undefined} data-lean={shown ?? ''}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onKeyDown={key}>
        <svg class="fs-lean-ink" aria-hidden="true">
          <line x1="0" y1="50%" x2="100%" y2="50%" />
          <line class="fs-lean-detent" x1="1" y1="35%" x2="1" y2="65%" />
          <line class="fs-lean-detent" x1="50%" y1="35%" x2="50%" y2="65%" />
          <line class="fs-lean-detent" x1="99.6%" y1="35%" x2="99.6%" y2="65%" />
        </svg>
        {shown !== undefined && (
          <svg class="fs-lean-mark" style={{ left: pct(shown) }} viewBox="0 0 12 24" width="12" height="24" aria-hidden="true">
            <path d="M6.4 2.5 C5.8 8 6.2 15 5.6 21.5" />
          </svg>
        )}
      </div>
      {onNote && shown !== undefined && (noting ? (
        <input ref={field} class="fs-input fs-lean-note" aria-label={`Note on the lean between ${a} and ${b}`} value={draft} enterKeyHint="done"
          onInput={e => setDraft((e.target as HTMLInputElement).value)} onBlur={saveNote}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setDraft(note); setNoting(false); } }} />
      ) : (
        <button type="button" class="fs-word fs-lean-noteword" onClick={() => setNoting(true)} disabled={disabled}>
          {note ? <span class="fs-lean-notetext">{note}</span> : 'note'}
        </button>
      ))}
    </div>
  );
}

/** For a screen reader: which pole, or between. */
function leanWords(l: number, a: string, b: string): string {
  const d = detentOf(l);
  if (d === -1) return a;
  if (d === 1) return b;
  if (d === 0) return 'between';
  return l < 0 ? `toward ${a}` : `toward ${b}`;
}
