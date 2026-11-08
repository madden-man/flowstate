// The shapes, by the name a flow stores in flow.diagram. Adding a shape: one module beside this file exporting a
// Shape (./shape.ts), and one line here.
import type { DiagramName } from '../../../db/schema';
import type { Shape } from './shape';
import { ring } from './ring';
import { valley } from './valley';
import { arc } from './arc';
import { mountain } from './mountain';

export const SHAPES: Partial<Record<DiagramName, Shape>> = {
  ring,
  valley,
  arc,
  mountain,
};

/** A flow's shape; a name with no module yet draws as the ring, so a flow is never without its drawing. */
export const shapeOf = (name: DiagramName): Shape => SHAPES[name] ?? ring;
