// parts/Sign (PLAN-MOUNTAIN.md pass 6, R0): one of the mountain's seven drawn signs, a crown, an eye, a speech bubble, a
// heart, a sun, a drop, a sprout. Drawn paths in the app's own code (DESIGN.md rule 7), never an icon or an emoji; the
// paths are the mock's (design/mountain/mountain.js SIGNS, the proposal mock; in git history since R5), in a box of 28 centred on 0.
//
// A sign is a lantern. Open (closed 0) its body is full of its hue by the voice formula (rule 3); as closed goes to 1 it
// empties to a cold outline and draws in to 70 percent. The component sets only --sh (the hue) and --gate inline; the CSS
// (parts.css, the R0 section) derives --closed from --gate, so in Still (the light, or the still prop) the Still rules
// pin it to 0 and nothing of the gate shows, whatever the element carries. data-closed is the gate as given (0 with the
// still prop); read it in tests, never to decide a colour.
//
// Where it sits. On paper (a sign's page under its plate, the cream Day page) nothing is needed. On the mountain's plate,
// put class "on-plate" on the plate's element (R1's mountain, R3's close view at the top of a sign's page): every sign
// inside takes the plate's lantern lightness (--plate-voice-l / --plate-voice-c), its cold colour becomes --plate-line
// and its cut-out marks --plate. A sign standing on the plate with no such ancestor takes the plate prop instead
// (data-plate); both do the same.
//
// What a parent styles. .fs-sign-body (the filled shape) and .fs-sign-line (the marks over it) both carry pathLength 1 and
// a stroke in the box's own units (no non-scaling-stroke), so a pen-order draw is stroke-dasharray 1 and
// stroke-dashoffset from 1 to 0. There is no glow and no filter here: on the plate the glow is the parent's canvas
// (pass 6), and a filter per sign would repaint on every frame of a gate drag. Nothing here moves on its own.
import type { SignKind } from '../../model/mountain';

/** Each sign's filled body and, for some, the marks drawn over it. */
export const SIGN_PATHS: Readonly<Record<SignKind, { body: string; line?: string }>> = {
  crown: { body: 'M-8 6 L-9.5 -4 L-4.5 1 L0 -8 L4.5 1 L9.5 -4 L8 6 Z' },
  eye: { body: 'M-10 0 Q0 -9 10 0 Q0 9 -10 0 Z', line: 'M-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M-6 -6.5 l-1.5 -2.5 M0 -8 v-3 M6 -6.5 l1.5 -2.5' },
  voice: { body: 'M-7 -7 H7 Q10 -7 10 -4 V1 Q10 4 7 4 H-1 L-6 9 L-5 4 H-7 Q-10 4 -10 1 V-4 Q-10 -7 -7 -7 Z', line: 'M-5 -3 H5 M-5 0 H2' },
  heart: { body: 'M0 8.5 C-13 0 -9.5 -9 -4.5 -8.5 C-1.5 -8.3 0 -5.5 0 -4 C0 -5.5 1.5 -8.3 4.5 -8.5 C9.5 -9 13 0 0 8.5 Z' },
  sun: { body: 'M-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z', line: 'M0 -7.5 V-10.5 M0 7.5 V10.5 M-7.5 0 H-10.5 M7.5 0 H10.5 M-5.3 -5.3 L-7.4 -7.4 M5.3 -5.3 L7.4 -7.4 M-5.3 5.3 L-7.4 7.4 M5.3 5.3 L7.4 7.4' },
  drop: { body: 'M0 -10 C4 -4 8 0 8 3.5 A8 8 0 0 1 -8 3.5 C-8 0 -4 -4 0 -10 Z', line: 'M-4 4 a4.5 4.5 0 0 0 3 3.5' },
  sprout: { body: 'M0 1 C-8 0 -10 -8 -10 -8 C-3 -9 0 -4 0 1 Z M0 1 C8 0 10 -8 10 -8 C3 -9 0 -4 0 1 Z', line: 'M0 1 V6 M0 6 L-5 10.5 M0 6 L5 10.5 M0 6 V11' },
};

/** How far a shut sign draws in: to 70 percent (the CSS scale of .fs-sign-g, for a parent that needs the size). */
export const signScale = (closed: number) => 1 - 0.3 * clamp(closed);
const clamp = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

type Props = {
  kind: SignKind;
  /** The voice formula's hue angle (model/mountain.ts CHAKRAS). */
  hue: number;
  /** 0 open, full of its light; 1 shut, a cold outline drawn in to 70 percent. */
  closed: number;
  size: 'small' | 'large';
  /** Still: open, no hue, whatever closed says. The Still light does the same by CSS. */
  still?: boolean;
  /** On the mountain's plate with no .on-plate ancestor: the lantern lit for the dark ground. */
  plate?: boolean;
};

export function Sign({ kind, hue, closed, size, still, plate }: Props) {
  const c = still ? 0 : clamp(closed);
  const p = SIGN_PATHS[kind];
  return (
    <svg
      class="fs-sign" viewBox="-14 -14 28 28" aria-hidden="true" focusable="false"
      data-sign={kind} data-closed={c.toFixed(2)} data-size={size} data-still={still ? '' : undefined} data-plate={plate ? '' : undefined}
      style={{ '--sh': String(hue), '--gate': String(c) }}
    >
      <g class="fs-sign-g">
        <path class="fs-sign-body" d={p.body} pathLength={1} />
        {p.line && <path class="fs-sign-line" d={p.line} pathLength={1} />}
      </g>
    </svg>
  );
}
