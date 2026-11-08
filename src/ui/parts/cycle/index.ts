// The shapes, by the name a flow stores in flow.diagram. Adding a shape: one module beside this file exporting a
// Shape (./shape.ts), and one line here.
import type { DiagramName } from '../../../db/schema';
import type { JSX } from 'preact';
import { midOf, type Shape, type Stamp } from './shape';
import { ring } from './ring';
import { valley } from './valley';
import { arc } from './arc';
import { mountain } from './mountain';
import { curve } from './curve';
import { coil } from './coil';
import { clock } from './clock';
import { stairs } from './stairs';
import { fork } from './fork';

export const SHAPES: Partial<Record<DiagramName, Shape>> = {
  ring,
  valley,
  arc,
  mountain,
  curve,
  coil,
  clock,
  stairs,
  fork,
};

/** A flow's shape; a name with no module yet draws as the ring, so a flow is never without its drawing. With his
 *  outcomes (F6's stamps), a shape that draws them itself (the curve) comes back with them on it. */
export function shapeOf(name: DiagramName, stamps?: Stamp[]): Shape {
  const s = SHAPES[name] ?? ring;
  return stamps?.length && s.withStamps ? s.withStamps(stamps) : s;
}

/** Where the page's middle (F2's clock and hold) sits over a flow's drawing, as CSS variables for .fl-drawing (F4). */
export function midStyle(name: DiagramName): JSX.CSSProperties {
  const m = midOf(shapeOf(name));
  return { '--mid-x': `${(m.x * 100).toFixed(1)}%`, '--mid-y': `${(m.y * 100).toFixed(1)}%` } as JSX.CSSProperties;
}
