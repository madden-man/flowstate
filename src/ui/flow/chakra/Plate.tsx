// The top of a stop's page (PLAN-MOUNTAIN.md pass 6, "A stop's page opens on its place", R3): a piece of the mountain's
// night plate, a close view of this stop's place (./scenes.ts) in chalk ink on --plate, with the stream of light
// running through the large sign. The land is SVG, drawn once, its marks laid down in the order a pen would as the page
// opens (rule 27); the light is one canvas over it (./water.ts).
//
// The water is the light (pass 6). Every near layer's chalk is drawn twice more over itself: once in --glow, masked to
// a soft band along the course, as strong as the water running there (--qa above the sign, --qb below it), and once in
// the sign's hue, masked round the sign, as far as its gate is open (--open). So a shut gate darkens the rock below it
// and cools the rock round the sign; a good day lights the place along the whole course. The strengths are CSS
// variables on the plate, eased over --t-light; the land itself is never redrawn.
//
// The sign is a lantern: drawn in pen order, then filling from a bright core out to its hue (a gradient here, the
// body's fill), emptying to a cold outline as the gate shuts (parts/Sign under .on-plate, R0's plate lantern tokens);
// its bloom breathes on the canvas. It carries data-travel mt-sign-<id>, the name R1 gives the small sign on the
// mountain; ui/turns.ts names both only for the turn, so a tap there travels into this one (rule 28) and back.
// In Still (rule 13): open, no hue (--ck-tint 0), the line colour only, slow water (--stream .4).
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { effect } from '@preact/signals';
import { Sign } from '../../parts/Sign';
import { light } from '../../light';
import { chakraOf, type ChakraId } from '../../../model/mountain';
import { courseOf, H, sceneOf, W, type Layer, type Mark } from './scenes';
import { rng } from './ink';
import { PlateLight } from './water';

type Props = {
  chakra: ChakraId;
  /** The gate as it is now, live under the finger: 0 open to 1 shut. */
  gate: number;
  /** What reaches the sign from above it (model/mountain.ts reach), 0 to 1. */
  above: number;
  /** Laid over the plate, outside its drawing (PLAN-TASKS.md T1): the touch words, which are buttons, so the drawing
   *  alone is aria-hidden. */
  children?: ComponentChildren;
};

/** Stars, the same each time, fewer and fainter toward the horizon. */
function stars(seed: number, n: number): [number, number, number][] {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const y = Math.pow(r(), 1.6) * H * 0.7;
    return [r() * W, y, (0.25 + r() * 0.75) * (1 - y / (H * 0.9))] as [number, number, number];
  });
}

/** The pen's order, as a delay: the first forty marks follow one another, the rest fall in behind. */
const order = (i: number) => String(Math.min(i, 40));

function Chalk({ m, snow }: { m: Mark; snow: string }) {
  if (m.k === 'ink') return <path class="ck-ink" d={m.d} fill="currentColor" opacity={m.o} style={{ '--i': order(m.i) }} />;
  if (m.k === 'line') {
    return (
      <path class={m.clip ? 'ck-hatch' : 'ck-line'} d={m.d} fill="none" stroke="currentColor" stroke-width={m.w} stroke-linecap="round"
        opacity={m.o} clip-path={m.clip ? `url(#${m.clip})` : undefined} style={{ '--i': order(m.i) }} />
    );
  }
  if (m.k === 'snow') return <path class="ck-snow" d={m.d} fill={`url(#${snow})`} style={{ '--i': order(m.i) }} />;
  return null;
}

export function Plate({ chakra, gate, above, children }: Props) {
  const c = chakraOf(chakra);
  const scene = sceneOf(chakra);
  const canvas = useRef<HTMLCanvasElement>(null);
  const course = useRef<SVGPathElement>(null);
  const engine = useRef<PlateLight | null>(null);
  const sky = useMemo(() => stars(c.hue * 31 + 7, chakra === 'third-eye' || chakra === 'crown' ? 60 : 36), [chakra]);
  const id = `ck-${chakra}`;
  const whole = useMemo(() => courseOf(scene), [chakra]);
  // opened by a turn (the sign travelling from the mountain, rule 28): the sign is already lit when it lands, so it is
  // not drawn again under the travelling one; the place still draws itself round it
  const arrived = useMemo(() => typeof document !== 'undefined' && document.documentElement.dataset.turn === 'open', [chakra]);

  useEffect(() => {
    if (!canvas.current || !course.current) return;
    const e = new PlateLight(canvas.current, course.current, scene, c.hue);
    engine.current = e;
    e.set({ above, gate });
    e.start();
    // a light change, or Reduce Motion turning on or off, reads the tokens again
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    const again = () => e.read();
    mq?.addEventListener?.('change', again);
    let first = true;
    const off = effect(() => { void light.value; if (first) { first = false; return; } requestAnimationFrame(again); });
    return () => { e.stop(); off(); mq?.removeEventListener?.('change', again); engine.current = null; };
  }, [chakra]);

  useEffect(() => { engine.current?.set({ above, gate }); }, [above, gate]);

  const [sx, sy] = scene.sign;
  const signBox = {
    left: `${((sx - scene.size / 2) / W) * 100}%`, top: `${((sy - scene.size / 2) / H) * 100}%`,
    width: `${(scene.size / W) * 100}%`, height: `${(scene.size / H) * 100}%`,
  };
  const below = above * (1 - 0.85 * gate);
  const w = scene.water;
  const inkId = (k: number) => `${id}-ink${k}`;
  const litR = scene.size * scene.glow;
  const layer = (l: Layer, k: number) => (
    <g key={k}>
      {l.fills.map((m, j) => {
        if (m.k === 'mass' || m.k === 'deep') return <path key={j} class={`ck-${m.k}`} d={m.d} opacity={m.o} />;
        if (m.k === 'reflect') {
          // the water holds the layer upside down, broken by the faintest stir
          return (
            <g key={j} clip-path={`url(#${m.clip})`} class="ck-reflect-land">
              <use href={`#${inkId(m.layer)}`} transform={`translate(0 ${2 * m.axis}) scale(1 -1)`} />
            </g>
          );
        }
        return null;
      })}
      <g id={inkId(k)} class="ck-chalk">{l.chalk.map((m, j) => <Chalk key={j} m={m} snow={`${id}-snow`} />)}</g>
      {l.lit && (
        <>
          {/* the chalk as the light shows it: the same marks, and the grain that only the light brings up */}
          <defs><g id={`${inkId(k)}-lit`}><use href={`#${inkId(k)}`} />{l.glow.map((m, j) => <Chalk key={j} m={m} snow={`${id}-snow`} />)}</g></defs>
          <use href={`#${inkId(k)}-lit`} class="ck-lit ck-lit-a" mask={`url(#${id}-lit-a)`} />
          <use href={`#${inkId(k)}-lit`} class="ck-lit ck-lit-b" mask={`url(#${id}-lit-b)`} />
          <use href={`#${inkId(k)}-lit`} class="ck-lit ck-lit-s" mask={`url(#${id}-lit-s)`} />
        </>
      )}
    </g>
  );

  return (
    <div class="ck-plate on-plate" data-chakra={chakra} data-fx={scene.fx} data-arrived={arrived ? '' : undefined}
      style={{ '--qa': above.toFixed(3), '--qb': below.toFixed(3), '--open': (1 - gate).toFixed(3), '--sh': String(c.hue) }}>
      <div class="ck-box" aria-hidden="true">
        <svg class="ck-land" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" class="ck-sky-top" />
              <stop offset="1" class="ck-sky-low" />
            </linearGradient>
            <linearGradient id={`${id}-snow`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" class="ck-snow-top" />
              <stop offset="1" class="ck-snow-low" />
            </linearGradient>
            {Object.entries(scene.clips).map(([k, d]) => <clipPath key={k} id={k}><path d={d} /></clipPath>)}
            <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" /></filter>
            <filter id={`${id}-near`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
            <radialGradient id={`${id}-round`}>
              <stop offset="0" class="ck-mask-on" />
              <stop offset=".45" class="ck-mask-half" />
              <stop offset="1" class="ck-mask-off" />
            </radialGradient>
            {scene.course.map((d, k) => (
              <mask key={k} id={`${id}-lit-${k ? 'b' : 'a'}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                <path d={d} class="ck-mask-band" stroke-width="54" filter={`url(#${id}-soft)`} />
                <path d={d} class="ck-mask-band" stroke-width="12" filter={`url(#${id}-near)`} />
              </mask>
            ))}
            <mask id={`${id}-lit-s`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <circle cx={sx} cy={sy} r={litR} fill={`url(#${id}-round)`} />
            </mask>
          </defs>
          <rect class="ck-sky" width={W} height={H} fill={`url(#${id}-sky)`} />
          <g class="ck-stars">{sky.map(([x, y, a], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(0.35 + a * 0.6).toFixed(2)} opacity={(a * 0.7).toFixed(2)} />)}</g>
          {scene.layers.map(layer)}
          {/* the channel: a faint bed under the light, wider as more water runs it (section 4, so it still says it with
              Reduce Motion on) */}
          <path ref={course} class="ck-channel" d={whole} />
        </svg>
        <div class="ck-sign" style={signBox} data-travel={`mt-sign-${chakra}`}>
          <svg class="ck-core-defs" aria-hidden="true" focusable="false">
            <radialGradient id="ck-core-fill" cx=".5" cy=".55" r=".6">
              <stop offset="0" class="ck-core-in" />
              <stop offset=".55" class="ck-core-mid" />
              <stop offset="1" class="ck-core-out" />
            </radialGradient>
          </svg>
          <Sign kind={c.sign} hue={c.hue} closed={gate} size="large" />
        </div>
        {w && scene.fx === 'tarn' && (
          // the tarn holds the sign upside down, faint, and only inside its shore
          <div class="ck-tarn" style={{
            left: `${((w.cx - w.rx) / W) * 100}%`, top: `${((w.cy - w.ry) / H) * 100}%`,
            width: `${((2 * w.rx) / W) * 100}%`, height: `${((2 * w.ry) / H) * 100}%`,
          }}>
            <div class="ck-reflect" style={{
              left: `${((sx - scene.size / 2 - (w.cx - w.rx)) / (2 * w.rx)) * 100}%`,
              top: `${((2 * w.shore - sy - scene.size / 2 - (w.cy - w.ry)) / (2 * w.ry)) * 100}%`,
              width: `${(scene.size / (2 * w.rx)) * 100}%`, height: `${(scene.size / (2 * w.ry)) * 100}%`,
            }}>
              <Sign kind={c.sign} hue={c.hue} closed={gate} size="large" />
            </div>
          </div>
        )}
        <canvas ref={canvas} class="ck-light" />
      </div>
      {children}
    </div>
  );
}
