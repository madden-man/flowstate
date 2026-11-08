// The shapes, by the name a flow stores in flow.diagram. Adding a shape: one module beside this file exporting a
// Shape (./shape.ts), and one line here.
import type { DiagramName } from '../../../db/schema';
import type { Shape } from './shape';
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

/** A flow's shape; a name with no module yet draws as the ring, so a flow is never without its drawing. */
export const shapeOf = (name: DiagramName): Shape => SHAPES[name] ?? ring;
