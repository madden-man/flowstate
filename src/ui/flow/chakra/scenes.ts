// The seven places (PLAN-MOUNTAIN.md pass 6, "A stop's page opens on its place", R3): a close view of each stop's
// place on the mountain, for the plate at the top of its page. Pure data in a box of W by H (the plate's own viewBox),
// drawn by ./Plate.tsx in chalk line on --plate, with the stream of light running along `course` through the large
// sign at `sign`. Each place is the stream's light doing something there (`fx`, ./water.ts), never decoration that
// stands for nothing:
//   Crown         the snow under the summit; spindrift torn off the top, the water let go from the snow
//   Third eye     a ledge out on the lit side; the long view, far water glinting in the valley
//   Throat        the narrows against the arete; the fall, its spray at the foot
//   Heart         the tarn in its cirque; the sign held in a still reflection
//   Solar plexus  the shadow flank; a fire kept there, embers going up
//   Sacral        a short drop to a low pool; slow rings going out
//   Root          the firs at the foot; fireflies of the stream's own light among them
// Painter's order in Plate.tsx: stars, far lines, masses (which cover the stars behind them), shadow (deep, hatched),
// chalk lines, the channel, then the canvas of light, then the sign.
import type { ChakraId } from '../../../model/mountain';

export const W = 390;
export const H = 220;

/** What the place's light does (./water.ts). */
export type Fx = 'spindrift' | 'view' | 'fall' | 'tarn' | 'embers' | 'rings' | 'fireflies';

/** A chalk line: its path, its weight (1 normal, up to 2.4 heavy), how strong (0 to 1). */
export type Line = { d: string; w?: number; o?: number };

export type Scene = {
  /** The large sign's centre and its width, in the box. */
  sign: [number, number];
  size: number;
  /** The stream, start to end, through the sign's centre. */
  course: string;
  /** Far ranges, filled with the plate so the stars behind them go, and drawn faint. */
  far: Line[];
  /** The near rock, filled with the plate, outlined heavy. */
  mass: string[];
  /** The faces in shadow: the deepest colour on the screen, hatched. */
  deep: string[];
  /** Snow lying on the lit rock, faintly holding the water's light. */
  snow?: string[];
  /** Chalk lines over all of it: aretes, cracks, snow, strata. */
  lines: Line[];
  /** Still water: an ellipse holding the sign's reflection (the tarn) or the rings (the pool). */
  water?: { cx: number; cy: number; rx: number; ry: number; shore: number };
  fx: Fx;
  /** Where the fx starts (the summit, the foot of the fall, the fire, where the water enters the pool). */
  at?: [number, number];
  /** The firs, drawn after the masses and before the lines: [x, ground y, height]. */
  firs?: [number, number, number][];
};

/** A fir in four drooping tiers, from its tip to its skirt: each tier's boughs sag to a point and tuck back in. */
export function fir(x: number, y: number, h: number): string {
  const w = h * 0.3;
  const p = (dx: number, dy: number) => `${(x + dx).toFixed(1)} ${(y - dy).toFixed(1)}`;
  // [height of the bough's tip, how far it spreads, how far in it tucks], top tier first
  const tiers = [[0.74, 0.34, 0.2], [0.5, 0.58, 0.36], [0.26, 0.82, 0.3], [0.04, 1, 0.12]] as const;
  const tuckAt = (k: number): [number, number] => (k < 0 ? [0, h] : [w * tiers[k][1] * tiers[k][2], tiers[k][0] * h + h * 0.05]);
  let d = `M${p(0, h)}`;
  tiers.forEach(([dy, sp], k) => {
    d += ` Q${p(w * sp * 0.45, dy * h + h * 0.1)} ${p(w * sp, dy * h)}`;
    if (k < tiers.length - 1) { const [tx, ty] = tuckAt(k); d += ` L${p(tx, ty)}`; }
  });
  for (let k = tiers.length - 1; k >= 0; k--) {
    const [dy, sp] = tiers[k];
    if (k < tiers.length - 1) { const [tx, ty] = tuckAt(k); d += ` L${p(-tx, ty)}`; }
    d += ` L${p(-w * sp, dy * h)}`;
    const [px, py] = tuckAt(k - 1);
    d += ` Q${p(-w * sp * 0.45, dy * h + h * 0.1)} ${p(-px, py)}`;
  }
  return `${d} Z`;
}

export const SCENES: Readonly<Record<ChakraId, Scene>> = {
  crown: {
    sign: [176, 116], size: 58,
    course: 'M200 52 C196 72 186 92 176 116 C166 140 146 150 136 170 C126 190 122 204 116 220',
    far: [
      { d: 'M0 128 L28 108 L52 116 L84 78 L104 92 L126 70 L150 96 L150 220 L0 220 Z', o: 0.3 },
      { d: 'M262 220 L262 80 L296 58 L318 70 L346 44 L366 60 L390 52 L390 220 Z', o: 0.3 },
    ],
    mass: ['M0 220 L44 196 L86 170 L118 146 L142 116 L160 84 L178 52 L192 26 L202 12 L212 28 L230 54 L254 86 L284 120 L322 152 L362 180 L390 196 L390 220 Z'],
    deep: ['M202 12 L212 28 L230 54 L254 86 L284 120 L322 152 L362 180 L390 196 L390 220 L268 220 L258 186 L246 150 L232 112 L218 74 L208 40 Z'],
    snow: [
      'M202 12 L192 26 L178 52 L160 84 L142 116 L126 136 Q140 128 152 136 Q166 126 180 136 Q194 126 208 138 Q222 130 238 140 L232 112 L218 74 L208 40 Z',
      'M212 28 L230 54 L242 72 Q232 70 226 62 Z',
    ],
    lines: [
      { d: 'M0 220 L44 196 L86 170 L118 146 L142 116 L160 84 L178 52 L192 26 L202 12 L212 28 L230 54 L254 86 L284 120 L322 152 L362 180 L390 196', w: 2.2, o: 0.95 },
      { d: 'M202 12 L208 40 L218 74 L232 112 L246 150 L258 186 L268 220', w: 2.4, o: 0.9 },
      // the cornice and the snow's long folds on the lit face
      { d: 'M182 48 Q192 44 200 50 Q206 54 214 50', w: 1.2, o: 0.8 },
      { d: 'M162 86 Q176 80 188 88 Q198 82 212 90', w: 1, o: 0.6 },
      { d: 'M130 132 Q150 124 164 134', w: 1, o: 0.5 },
      { d: 'M196 140 Q210 132 226 142', w: 1, o: 0.5 },
      { d: 'M90 172 Q112 162 128 172 Q138 166 148 172', w: 1, o: 0.45 },
      { d: 'M150 196 Q168 186 186 196 Q206 188 224 198', w: 1, o: 0.4 },
      // the snowline breaking up into rock low on the face
      { d: 'M56 200 l10 -4 M78 206 l8 -6 M204 206 l9 -5 M232 200 l6 -8', w: 1, o: 0.5 },
    ],
    fx: 'spindrift', at: [204, 14],
  },
  'third-eye': {
    sign: [150, 104], size: 52,
    course: 'M58 0 C62 40 72 70 98 92 C116 106 132 108 150 104 C172 100 190 112 206 130 C214 150 208 180 204 220',
    far: [
      { d: 'M150 220 L150 112 L176 102 L204 110 L232 92 L258 102 L288 84 L318 98 L348 88 L390 96 L390 220 Z', o: 0.36 },
      { d: 'M176 220 L176 138 L214 128 L248 134 L284 120 L330 130 L390 122 L390 220 Z', o: 0.24 },
      { d: 'M190 220 L190 166 Q286 156 390 164 L390 220 Z', o: 0.16 },
    ],
    mass: ['M0 0 L54 0 L60 34 L70 70 L84 104 L96 124 L212 128 L216 136 L190 148 L164 160 L144 184 L132 220 L0 220 Z'],
    deep: ['M96 124 L212 128 L216 136 L190 148 L164 160 L144 184 L132 220 L64 220 L72 176 Z', 'M0 0 L22 0 L28 60 L40 120 L36 220 L0 220 Z'],
    lines: [
      { d: 'M54 0 L60 34 L70 70 L84 104 L96 124 L212 128 L216 136 L190 148 L164 160 L144 184 L132 220', w: 2.2, o: 0.95 },
      { d: 'M22 0 L28 60 L40 120 L36 220', w: 1.6, o: 0.7 },
      // the ledge's own edge and the cracks in the lit wall above it
      { d: 'M100 130 L206 133', w: 1, o: 0.55 },
      { d: 'M70 20 l6 18 l-4 14 M86 60 l8 16 M104 88 l10 8', w: 1, o: 0.5 },
      { d: 'M120 140 l-6 16 M170 150 l-8 14', w: 1, o: 0.4 },
    ],
    fx: 'view', at: [190, 166],
  },
  throat: {
    sign: [200, 82], size: 48,
    course: 'M206 0 C200 26 208 52 200 82 C199 120 201 160 200 204',
    far: [],
    mass: ['M390 0 L242 0 L234 40 L228 76 L226 110 L232 150 L228 190 L224 220 L390 220 Z'],
    deep: ['M0 0 L152 0 L164 40 L172 80 L178 110 L174 150 L180 190 L184 220 L0 220 Z'],
    lines: [
      { d: 'M152 0 L164 40 L172 80 L178 110 L174 150 L180 190 L184 220', w: 2.4, o: 0.95 },
      { d: 'M242 0 L234 40 L228 76 L226 110 L232 150 L228 190 L224 220', w: 2, o: 0.9 },
      // the lip the water leaves, the plunge pool, the strata of the lit wall
      { d: 'M180 86 Q200 80 222 86', w: 1.4, o: 0.8 },
      { d: 'M176 206 Q200 198 224 206', w: 1.2, o: 0.7 },
      { d: 'M244 30 l40 4 M238 64 l56 -2 M234 100 l48 6 M240 136 l60 -4 M236 172 l52 4', w: 1, o: 0.4 },
      { d: 'M120 20 l18 30 M96 70 l26 36 M110 130 l30 30', w: 1, o: 0.25 },
    ],
    fx: 'fall', at: [200, 204],
  },
  heart: {
    sign: [190, 104], size: 54,
    course: 'M342 46 C310 76 262 66 228 86 C210 96 200 100 190 104 C186 120 188 134 190 148',
    far: [{ d: 'M0 70 L30 56 L58 62 L92 40 L118 50 L150 30 L176 38 L196 20 L222 34 L256 24 L290 40 L322 32 L356 48 L390 42 L390 220 L0 220 Z', o: 0.35 }],
    mass: ['M0 96 L40 80 L80 86 L120 64 L160 72 L196 52 L236 66 L280 58 L320 74 L360 70 L390 80 L390 220 L0 220 Z'],
    deep: ['M196 52 L236 66 L280 58 L320 74 L360 70 L390 80 L390 150 L320 146 L262 140 L230 126 L214 96 Z'],
    lines: [
      { d: 'M0 96 L40 80 L80 86 L120 64 L160 72 L196 52 L236 66 L280 58 L320 74 L360 70 L390 80', w: 2.2, o: 0.95 },
      { d: 'M196 52 L214 96 L230 126 L262 140', w: 1.8, o: 0.8 },
      // the slopes coming down into the cirque, and the scree at the shore
      { d: 'M80 86 Q96 110 84 140 M120 64 Q140 100 128 140 M300 72 Q300 110 312 146', w: 1, o: 0.45 },
      { d: 'M40 150 l6 -3 M70 144 l5 -4 M330 148 l6 -3 M350 152 l5 -2', w: 1, o: 0.5 },
    ],
    water: { cx: 190, cy: 168, rx: 150, ry: 24, shore: 148 },
    fx: 'tarn', at: [190, 150],
  },
  'solar-plexus': {
    sign: [236, 116], size: 52,
    course: 'M118 44 C140 78 180 98 210 108 C222 112 230 114 236 116 C262 126 290 150 300 180 C306 198 310 210 312 220',
    far: [],
    mass: [],
    deep: ['M0 42 L60 32 L118 44 L170 26 L230 40 L300 20 L346 32 L390 26 L390 220 L0 220 Z'],
    lines: [
      { d: 'M0 42 L60 32 L118 44 L170 26 L230 40 L300 20 L346 32 L390 26', w: 2.2, o: 0.9 },
      // buttresses falling across the flank, barely lit
      { d: 'M60 32 L84 96 L70 160 L82 220', w: 1.4, o: 0.38 },
      { d: 'M170 26 L192 86 L178 150 L192 220', w: 1.4, o: 0.32 },
      { d: 'M300 20 L280 100 L298 160', w: 1.4, o: 0.32 },
      { d: 'M346 32 L366 110 L356 220', w: 1.2, o: 0.28 },
      // the shelf the fire is kept on
      { d: 'M206 132 Q236 126 268 134', w: 1.4, o: 0.6 },
    ],
    fx: 'embers', at: [236, 128],
  },
  sacral: {
    sign: [194, 88], size: 50,
    course: 'M70 34 C110 52 154 70 194 88 C198 104 198 126 196 150',
    far: [{ d: 'M0 70 Q90 46 190 60 Q290 72 390 50 L390 220 L0 220 Z', o: 0.3 }],
    mass: ['M0 96 Q90 80 160 96 Q200 104 240 98 Q320 86 390 94 L390 220 L0 220 Z'],
    deep: ['M0 96 Q60 88 120 96 L132 120 Q90 150 0 162 Z', 'M390 94 Q340 92 286 100 L270 124 Q320 150 390 156 Z'],
    lines: [
      { d: 'M0 96 Q90 80 160 96 Q200 104 240 98 Q320 86 390 94', w: 2, o: 0.9 },
      // the short drop: its lip and the two stones either side of it
      { d: 'M158 110 Q196 100 234 110', w: 1.6, o: 0.85 },
      { d: 'M166 118 L172 136 M226 118 L218 136', w: 1.2, o: 0.6 },
      { d: 'M40 120 l10 6 M330 122 l-8 6 M80 140 l12 4', w: 1, o: 0.4 },
    ],
    water: { cx: 196, cy: 172, rx: 124, ry: 24, shore: 150 },
    fx: 'rings', at: [196, 156],
  },
  root: {
    sign: [194, 122], size: 52,
    course: 'M226 34 C216 66 200 92 194 122 C190 150 218 168 248 186 C272 200 302 212 334 220',
    far: [{ d: 'M0 74 L70 44 L130 62 L206 30 L280 56 L344 36 L390 46 L390 220 L0 220 Z', o: 0.34 }],
    mass: ['M0 168 Q120 156 200 164 Q300 172 390 160 L390 220 L0 220 Z'],
    deep: [],
    lines: [
      { d: 'M0 168 Q120 156 200 164 Q300 172 390 160', w: 1.6, o: 0.6 },
      { d: 'M206 30 L214 52 L208 80 M130 62 L140 96', w: 1.2, o: 0.4 },
    ],
    firs: [
      // the back rank, small, along the foot
      [22, 132, 40], [48, 128, 48], [76, 134, 38], [104, 128, 46], [130, 134, 36], [262, 132, 42], [288, 126, 50], [316, 134, 40], [344, 128, 48], [372, 134, 38],
      // the front rank, tall, leaving the stream its way through the middle
      [14, 214, 96], [54, 222, 118], [96, 212, 84], [136, 220, 70], [272, 220, 74], [312, 214, 92], [352, 222, 116], [388, 216, 88],
    ],
    fx: 'fireflies', at: [194, 150],
  },
};
