// How it comes together (PLAN-MOUNTAIN.md pass 6, R1): the arrival, once per unlock. Pure timings, as fractions of
// --t-arrive, shared by the CSS (the pen drawing the land, land.ts's at and len) and the canvas (the water's light
// coming up, the kindling, the sea's first breath, the circles surfacing), so the two are one performance:
//
//   0      the plate is dark; stars prick in
//   .04    the horn draws itself from the summit down both flanks, the arete behind, the lesser horns and far ranges
//   .2     the hatching falls in behind, row by row; the gullies, the foot, the cliffs
//   .4     the snow settles on the cap
//   .5     the whole stream, already running as it always runs, comes up in light evenly, every sign with it
//          (Tommy, 2026-11-12: nothing is drawn down from the start; the particles are always one stream)
//   .84    the stream is at its own light: the sea takes its first breath
//   .88    the circles surface
//   1      the steady water
//
// A tap anywhere cuts it short (rule 31). Later visits in the same unlock find it already there; under Reduce Motion
// and in Still there is none (Still has a slow fade). The flag is cleared when the journal locks (lock/pin.ts gate).
import { effect } from '@preact/signals';
import { gate } from '../../lock/pin';

export const HEAD_FROM = 0.5;
export const HEAD_TO = 0.84;
export const SEA_AT = 0.82;
export const CIRCLES_AT = 0.88;
export const SNOW_AT = 0.4;

let seen = false;
/** Whether the mountain has come together since the journal was last unlocked. */
export const arrived = () => seen;
export const markArrived = () => { seen = true; };

// locking forgets it, so the next unlock draws the mountain again
let last = gate.peek();
effect(() => {
  const g = gate.value;
  if (g === 'locked' && last !== 'locked') seen = false;
  last = g;
});

/** For tests: as if the journal had just been unlocked. */
export const forgetArrival = () => { seen = false; };

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

/** The sea's breath and the circles, 0 to 1, as the arrival lets them in. */
export const seaIn = (f: number) => ease((f - SEA_AT) / 0.12);
export const circlesIn = (f: number) => ease((f - CIRCLES_AT) / 0.1);
export const snowIn = (f: number) => ease((f - SNOW_AT) / 0.1);
