// The notebooks on the Flow tab's shelf (PLAN-WORLDS.md section 4, WF). Today there is one, his own; W1 adds the worlds
// from their registry, each a cover beside it. A cover is the notebook's name in the serif, one hue on its spine and
// plain paper in its hue (decision 16): the app never draws one. No UI here.
import type { VoiceColour } from '../db/schema';

/** What the shelf needs to draw a notebook's cover. hue is a voice's (DESIGN.md rule 3): null is the black voice. sub is
 *  the cover's print line when it is not the one worn (the worn one says "Open"). */
export type Notebook = { id: string; name: string; sub: string; colour: VoiceColour };

/** The personal notebook: always first on the shelf, and the one worn when nothing else is. */
export const OWN: Notebook = { id: 'own', name: 'My own pages', sub: 'Who to Be, How to Flow', colour: { hue: null } };

/** The shelf, in order. W1 appends the worlds here. */
export const notebooks = (): readonly Notebook[] => [OWN];
