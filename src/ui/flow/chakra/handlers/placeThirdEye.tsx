// Third eye, Look far (PLAN-TASKS.md section 2): a held thumb; the ranges clear one by one on the breath. Tapped, the
// view below the ledge fills with mist, range after range, as the place's own far ranges lie (scenes.ts thirdEye).
// While his thumb is held, each out-breath lifts the mist off one range, the nearest first, until the far sea at the
// horizon glints. Lifted, the view stays as far as it cleared. Done when he lifts after a whole breath, or once the
// view is clear. Writes nothing; works through the door. Reduce Motion: each range clears at once on its breath.
import { useEffect, useState } from 'preact/hooks';
import { registerTouch, type TouchAct } from '../touch';
import { sceneOf } from '../scenes';
import { Box, useOnce, useThumb } from './placeKit';

/** The far ranges as the scene lays them, far to near: base line and height in box units (scenes.ts thirdEye). */
export const RANGES: readonly (readonly [number, number])[] = [[110, 8], [124, 14], [144, 20], [172, 28], [208, 34]];
/** The horizon, where the far sea glints once the view is clear. */
const HZ = 100;
/** The near wall and the shadow under the ledge, which stand in front of the view (scenes.ts clips). */
const WALL = ['te-wall', 'te-under'].map(id => sceneOf('third-eye').clips[id]).filter(Boolean);
/** The far sea glinting at the horizon: short broken strokes of light, as the scene's own glints lie. */
const GLINTS = [[164, 1, 18], [190, 1, 34], [236, 1, 12], [176, 2.6, 22], [214, 2.6, 16], [200, 4, 10]]
  .map(([x, dy, w]) => `M${x} ${HZ + dy} h${w}`).join(' ');
/** Where the thumb's ring rests before it is held, on the view. */
const REST: [number, number] = [262, 150];

/** How many ranges are clear after this many out-breaths: one a breath, the nearest first. */
export const clearedAfter = (outs: number): number => Math.max(0, Math.min(RANGES.length, Math.floor(outs)));

function LookFar({ touch, done }: TouchAct) {
  const once = useOnce(done);
  const [outs, setOuts] = useState(0);
  const thumb = useThumb(touch.word, phase => {
    if (phase !== 'out') return;
    setOuts(n => Math.min(RANGES.length, n + 1));
  }, breaths => { if (breaths >= 1) once(); });
  const clear = clearedAfter(outs);
  const open = clear >= RANGES.length;
  useEffect(() => { if (open) once(); }, [open]);
  const [rx, ry] = thumb.at ?? REST;
  return (
    <Box class="pl-third-eye" svg={
      <>
        <defs>
          <filter id="pl-mist-soft" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="5" /></filter>
          {/* the mist lies in the view, behind the near wall and the ledge: the wall's own shapes are cut out of it */}
          <mask id="pl-view" maskUnits="userSpaceOnUse" x="0" y="0" width="390" height="220">
            <rect class="pl-mask-on" width="390" height="220" />
            {WALL.map((d, k) => <path key={k} class="pl-mask-off" d={d} />)}
          </mask>
        </defs>
        <g mask="url(#pl-view)">
        {RANGES.map(([y, amp], k) => {
          // the nearest range is k = 4: it clears first
          const order = RANGES.length - 1 - k;
          return (
            <rect key={k} class="pl-mist" x={40} y={y - 2 * amp - 6} width={380} height={2 * amp + 18} filter="url(#pl-mist-soft)"
              data-range={k} data-clear={order < clear ? '' : undefined} style={{ '--mist': (0.1 + 0.025 * k).toFixed(2) }} />
          );
        })}
        </g>
        <path class="pl-far" d={GLINTS} stroke-width=".6" data-on={open ? '' : undefined} />
        <circle class="pl-ring" cx={rx} cy={ry} r={9} data-held={thumb.at ? '' : undefined} data-phase={thumb.at ? thumb.breath.phase : undefined} />
      </>
    }>
      <div {...thumb.surface} data-cleared={String(clear)} />
    </Box>
  );
}

registerTouch({ chakra: 'third-eye', id: 'look-far' }, { View: LookFar });
