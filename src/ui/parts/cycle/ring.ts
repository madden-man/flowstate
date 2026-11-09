// The ring (PLAN-FLOWS.md 3.1, Panic): a drawn circle, a mark at each step, arrowheads clockwise, and the arc from
// the last step back to the first dotted: the way back to ordinary, which carries no step. The dot rests in the
// middle of that dotted arc between episodes. The truth it draws: a loop that closes.
import { arrowHead, type Drawn, type Label, type Pt, type Shape } from './shape';

const W = 328, H = 224;
const C = { x: W / 2, y: H / 2 }, R = 72;

/** t = 0 is the top; the walk runs clockwise. */
const at = (t: number): Pt => {
  const a = (t * 360 - 90) * (Math.PI / 180);
  return { x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) };
};
const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
/** A clockwise arc from t0 to t1 (t1 > t0). */
const arc = (t0: number, t1: number) => `M${f(at(t0))} A${R} ${R} 0 ${t1 - t0 > 0.5 ? 1 : 0} 1 ${f(at(t1))}`;

export const ring: Shape = {
  title: 'The ring',
  w: W,
  h: H,
  closed: true,
  at,
  slotT: (i, n) => i / n,
  restT: n => (n - 0.5) / n,
  // the stream (M5): the dotted way back carries the water thin, from the last step round to the first
  stream: n => (n < 2 ? {} : { thin: [[(n - 1) / n, 1]] }),
  paths(n) {
    const out: Drawn[] = [];
    if (n < 2) return [{ kind: 'path', d: arc(0, 0.5) + arc(0.5, 1).replace('M', ' M'), cls: 'arc pass' }];
    out.push({ kind: 'path', d: arc(0, (n - 1) / n), cls: 'arc' });
    out.push({ kind: 'path', d: arc((n - 1) / n, 1), cls: 'arc pass' });
    // an arrowhead halfway between each pair of steps, along the way round
    for (let i = 0; i < n - 1; i++) {
      const t = (i + 0.5) / n;
      out.push({ kind: 'path', d: arrowHead(at(t), t * 360), cls: 'arrow' });
    }
    return out;
  },
  label(i, n): Label {
    const t = i / n, p = at(t), a = (t * 360 - 90) * (Math.PI / 180), c = Math.cos(a), s = Math.sin(a);
    if (s < -0.7) return { x: p.x, y: p.y - 12, anchor: 'middle', hang: 'above' };
    if (s > 0.7) return { x: p.x, y: p.y + 10, anchor: 'middle', hang: 'below' };
    return c > 0 ? { x: p.x + 12, y: p.y, anchor: 'start', hang: 'centre' } : { x: p.x - 12, y: p.y, anchor: 'end', hang: 'centre' };
  },
};
