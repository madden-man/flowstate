// The shapes, by the name a flow stores in flow.diagram. Adding a shape: one module beside this file exporting a
// Shape (./shape.ts), and one line here.
import type { DiagramName } from '../../../db/schema';
import type { Shape } from './shape';
import { ring } from './ring';

export const SHAPES: Partial<Record<DiagramName, Shape>> = {
  ring,
};

/** A flow's shape; a name with no module yet draws as the ring, so a flow is never without its drawing. */
export const shapeOf = (name: DiagramName): Shape => SHAPES[name] ?? ring;
