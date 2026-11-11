// What the in-place touches are drawn with (PLAN-TASKS.md T2, section 2 "In the place"): shared by ./place*.tsx, and
// registers nothing itself.
//
//   Box    the plate's own box (390 by 220, covering the plate as .ck-box does), so a touch draws in the place's units
//          and lands on the very rock, snow or water the scene drew there (../scenes.ts). Its SVG takes the drawing; HTML
//          children are placed with at() in the same units.
//   Rule   one rule drawn on the plate, with the caret on it: his words in the serif, in the water's light. Enter keeps
//          them (the plate's touch decides what keeping is). No placeholder: the app writes no words of its own. It sits
//          in the plate's upper part, so the iPhone's keyboard rising over a 390 by 844 screen never covers it.
//   Thumb  a held thumb anywhere on the place (a button named "the ring"), with the app's breath under it (../../breath.ts useBreath: four in, six
//          out, the breath tick through parts/Haptic and the breath tone only with its own switch on). A key held on it
//          does the same. Says each turn of the breath, and where the thumb is, in box units.
//
// Every colour is a token: the light is --glow, the chalk --plate-line, the print --plate-print, and the sign's hue
// --pl-hue (place.css), which Still turns to the line colour (rule 13: no hue). Reduce Motion: every duration is zero,
// so a mark lights at once and nothing travels; calm() tells a touch to skip its travel and keep only its end.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { IN_MS, OUT_MS, useBreath, type Breath } from '../../breath';
import { H, W } from '../scenes';
import './place.css';

export { W, H };

/** Reduce Motion is on: nothing travels, marks light at once. */
export const calm = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A place on the box as CSS: x and y in box units (the left edge, or the centre with mid). */
export function at(x: number, y: number, w?: number): JSX.CSSProperties {
  const s: Record<string, string> = { left: `${((x / W) * 100).toFixed(3)}%`, top: `${((y / H) * 100).toFixed(3)}%` };
  if (w !== undefined) s.width = `${((w / W) * 100).toFixed(3)}%`;
  return s as JSX.CSSProperties;
}

/** A seeded random, so a stone or a stepping stone is laid the same way every time. */
export function seeded(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/** A string's seed. */
export const seedOf = (s: string): number => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/** A small stone, irregular, as a closed path round (cx, cy). */
export function stonePath(cx: number, cy: number, rx: number, ry: number, r: () => number): string {
  const n = 9, pts: string[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, j = 0.82 + r() * 0.3;
    pts.push(`${(cx + Math.cos(a) * rx * j).toFixed(1)} ${(cy + Math.sin(a) * ry * j * (a > Math.PI ? 0.85 : 1)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

type BoxProps = { children?: ComponentChildren; svg?: ComponentChildren; class?: string; boxRef?: { current: HTMLDivElement | null } } & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'class'>;

/** The plate's box, for a touch to draw in. */
export function Box({ children, svg, class: cls, boxRef, ...rest }: BoxProps) {
  return (
    <div ref={boxRef} class={`pl-box${cls ? ` ${cls}` : ''}`} {...rest}>
      {svg !== undefined && (
        <svg class="pl-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">{svg}</svg>
      )}
      {children}
    </div>
  );
}

type RuleProps = {
  /** Where the rule lies: its left end and its line, and its length, in box units. */
  x: number; y: number; w: number;
  /** What he is writing on it. */
  value: string;
  onInput: (v: string) => void;
  /** Enter: what was on it, trimmed and not empty. */
  onEnter: (v: string) => void;
  /** For a screen reader: the touch's own word. */
  label: string;
  /** One word only (Sacral's Feel): a space is not taken. */
  word?: boolean;
  focus?: boolean;
  inputRef?: { current: HTMLInputElement | null };
  class?: string;
  maxLength?: number;
};

/** One rule drawn on the plate, his words on it in the water's light. */
export function Rule({ x, y, w, value, onInput, onEnter, label, word, focus = true, inputRef, class: cls, maxLength = 120 }: RuleProps) {
  const own = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? own;
  useEffect(() => {
    if (!focus) return;
    // asked inside the tap's own turn where it can be (the iPhone raises its keyboard only then); the rule lies in the
    // plate's upper part, so the keyboard does not cover it once it has risen
    const el = ref.current;
    el?.focus({ preventScroll: true });
  }, [focus]);
  return (
    <label class={`pl-rule${cls ? ` ${cls}` : ''}`} style={at(x, y, w)}>
      <input ref={ref} class="pl-input" type="text" value={value} aria-label={label} maxLength={maxLength}
        autocomplete="off" autocapitalize={word ? 'none' : 'sentences'} spellcheck={false} enterkeyhint="done"
        onInput={e => { const v = (e.currentTarget as HTMLInputElement).value; onInput(word ? v.replace(/\s+/g, '') : v); }}
        onKeyDown={e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const v = value.trim();
          if (v) onEnter(v);
        }} />
      <i class="pl-line" aria-hidden="true" />
    </label>
  );
}

/** His words as letters, each a span, for a touch that carries them off one by one (spindrift, the fall). */
export function Letters({ text, class: cls, style, spanRef, vars }: {
  text: string; class?: string; style?: JSX.CSSProperties; spanRef?: { current: HTMLSpanElement | null };
  /** Each letter's own custom properties (where it goes). */
  vars?: (i: number) => Record<string, string> | undefined;
}) {
  return (
    <span ref={spanRef} class={`pl-letters${cls ? ` ${cls}` : ''}`} style={style} aria-hidden="true">
      {[...text].map((ch, i) => <span key={i} class="pl-ch" style={{ '--i': String(i), ...vars?.(i) }}>{ch === ' ' ? ' ' : ch}</span>)}
    </span>
  );
}

export type Thumb = {
  breath: Breath;
  /** Where the thumb is, in box units, or null when none is down. */
  at: [number, number] | null;
  /** Whole breaths taken (in and out) since the thumb went down. */
  breaths: number;
  /** The surface's handlers. */
  surface: JSX.HTMLAttributes<HTMLDivElement> & { ref: { current: HTMLDivElement | null }; 'data-touch-of': string };
};

/**
 * A held thumb on the place. onTurn hears each turn of the breath while it is held ('in' first, inside the touch), and
 * onLift when the thumb comes up, with the whole breaths it held for.
 */
export function useThumb(label: string, onTurn?: (phase: 'in' | 'out', at: [number, number]) => void, onLift?: (breaths: number) => void): Thumb {
  const breath = useBreath();
  const ref = useRef<HTMLDivElement | null>(null);
  const [pt, setPt] = useState<[number, number] | null>(null);
  const [breaths, setBreaths] = useState(0);
  const last = useRef<[number, number]>([W / 2, H / 2]);
  // the turns heard so far while held: out-breaths begun, and whole breaths
  const heard = useRef({ outs: 0, whole: 0 });
  const count = useRef(0);
  const cb = useRef({ onTurn, onLift });
  cb.current = { onTurn, onLift };

  const toBox = (e: PointerEvent): [number, number] => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width) return last.current;
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const down = (p: [number, number]) => {
    last.current = p; setPt(p); count.current = 0; setBreaths(0); heard.current = { outs: 0, whole: 0 };
    breath.start();
    cb.current.onTurn?.('in', p);
  };
  const up = () => {
    if (!breath.held) return;
    breath.stop(); setPt(null);
    cb.current.onLift?.(count.current);
  };
  // each turn while held, on the breath's own clock from when the thumb went down (useBreath keeps the same one): an
  // out-breath begins IN_MS into each breath, a whole one ends at its end. A timer of its own wakes at each, so no turn
  // is missed when two land between one drawing and the next.
  useEffect(() => {
    if (!breath.held || breath.since === null) return;
    const since = breath.since, cycle = IN_MS + OUT_MS;
    let t: ReturnType<typeof setTimeout>;
    const hear = () => {
      const e = Date.now() - since;
      const outs = e >= IN_MS ? 1 + Math.floor((e - IN_MS) / cycle) : 0, whole = Math.floor(e / cycle);
      const h = heard.current;
      while (h.outs < outs || h.whole < whole) {
        // in the order they came: the out-breath of breath k before the in-breath that ends it
        if (h.outs <= h.whole && h.outs < outs) { h.outs++; cb.current.onTurn?.('out', last.current); }
        else { h.whole++; count.current = h.whole; setBreaths(h.whole); cb.current.onTurn?.('in', last.current); }
      }
      const next = Math.min(since + h.outs * cycle + IN_MS, since + (h.whole + 1) * cycle);
      t = setTimeout(hear, Math.max(0, next - Date.now()));
    };
    hear();
    return () => clearTimeout(t);
  }, [breath.held, breath.since]);
  useEffect(() => () => breath.stop(), []);

  return {
    breath, at: pt, breaths,
    surface: {
      ref,
      class: 'pl-thumb',
      role: 'button',
      tabIndex: 0,
      // the ring the thumb holds (the app's own word for it, F2), named apart from the touch word that opened it;
      // aria-describedby is not used: the word is the button beside it, and its name is the touch's (label)
      'aria-label': 'the ring',
      'data-touch-of': label,
      'aria-pressed': breath.held ? 'true' : 'false',
      onPointerDown: (e: PointerEvent) => {
        if (e.button > 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        down(toBox(e));
      },
      onPointerMove: (e: PointerEvent) => { if (breath.held) { const p = toBox(e); last.current = p; setPt(p); } },
      onPointerUp: up,
      onPointerCancel: up,
      onLostPointerCapture: up,
      onContextMenu: (e: Event) => e.preventDefault(),
      onKeyDown: (e: KeyboardEvent) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); down(last.current); }
      },
      onKeyUp: (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); up(); } },
      onBlur: up,
    },
  };
}

/** Calls done once for this showing of the touch, however many times it is asked. */
export function useOnce(done: () => void): () => void {
  const fired = useRef(false);
  const cb = useRef(done);
  cb.current = done;
  return () => { if (fired.current) return; fired.current = true; cb.current(); };
}
