// The notebooks on the Flow tab's shelf (PLAN-WORLDS.md section 4). His own first, then the worlds from the registry
// on home's row (settings.worlds: the bridge fills it in W2; with none, the shelf is his own cover alone, as WF built
// it). A cover is the notebook's name in the serif, one hue on its spine and plain paper in its hue (decision 16): the
// app never draws one. No UI here.
import type { VoiceColour, WorldEntry } from '../db/schema';

/** What the shelf needs to draw a notebook's cover. hue is a voice's (DESIGN.md rule 3): null is the black voice. sub is
 *  the cover's print line when it is not the one worn (the worn one says "Open"). world is the world's id, null for his
 *  own pages; kind says what lies under the cover. */
export type Notebook = { id: string; name: string; sub: string; colour: VoiceColour; world: string | null; kind: 'own' | WorldEntry['kind'] };

/** The personal notebook: always first on the shelf, and the one worn when nothing else is. */
export const OWN: Notebook = { id: 'own', name: 'My own pages', sub: 'Who to Be, How to Flow', colour: { hue: null }, world: null, kind: 'own' };

/** The print line under a world's name, by its kind (the plan's words). */
const SUB: Record<WorldEntry['kind'], string> = { novel: 'A novel', songs: 'Songs of no book' };

/** A world's spine, when the registry gives none: the voices' wheel in a fixed order (seed.ts HUES), by its place. */
const SPINES = [250, 55, 150, 305, 25, 350, 95, 60];

/** The shelf, in order: his own pages, then each world in the registry's order. */
export const notebooks = (worlds: readonly WorldEntry[] = []): readonly Notebook[] => [
  OWN,
  ...worlds.map((w, i) => ({
    id: w.id, name: w.name, sub: SUB[w.kind] ?? '', colour: { hue: w.hue ?? SPINES[i % SPINES.length] }, world: w.id, kind: w.kind,
  })),
];

/** The cover's id for a world worn (or none). */
export const coverId = (world: string | null) => world ?? OWN.id;
