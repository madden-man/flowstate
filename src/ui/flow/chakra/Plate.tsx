// The top of a stop's page (PLAN-MOUNTAIN.md pass 6, "A stop's page opens on its place", R3): a piece of the mountain's
// night plate, a close view of this stop's place (./scenes.ts) in chalk line on --plate, with the stream of light
// running through the large sign. The land is SVG, drawn once, its lines in the order a pen would draw them as the page
// opens (rule 27); the light is one canvas over it (./water.ts); the sign sits over both.
//
// The sign is drawn in pen order and then fills with its hue's light; it empties to a cold outline as the gate shuts
// (parts/Sign under .on-plate, R0's plate lantern tokens). It carries view-transition-name mt-sign-<id>, the same name R1
// gives the small sign on the mountain, so a tap there travels into this one through parts/Turn (rule 28).
// In Still (rule 13): open, no hue, the line colour only, slow water (--stream .4), and the drawing still draws.
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { effect } from '@preact/signals';
import { Sign } from '../../parts/Sign';
import { light } from '../../light';
import { chakraOf, type ChakraId } from '../../../model/mountain';
import { fir, H, SCENES, W } from './scenes';
import { PlateLight } from './water';

type Props = {
  chakra: ChakraId;
  /** The gate as it is now, live under the finger: 0 open to 1 shut. */
  gate: number;
  /** What reaches the sign from above it (model/mountain.ts reach), 0 to 1. */
  above: number;
};

/** A few faint stars, the same each time: the cloud of a heavy day is the mountain's (R2), not this plate's. */
function stars(seed: number, n: number): [number, number, number][] {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: n }, () => [r() * W, r() * H * 0.62, 0.3 + r() * 0.7] as [number, number, number]);
}

export function Plate({ chakra, gate, above }: Props) {
  const c = chakraOf(chakra);
  const scene = SCENES[chakra];
  const canvas = useRef<HTMLCanvasElement>(null);
  const course = useRef<SVGPathElement>(null);
  const engine = useRef<PlateLight | null>(null);
  const sky = useMemo(() => stars(chakra.length * 97 + c.hue, chakra === 'third-eye' ? 34 : 22), [chakra]);
  const id = `ck-${chakra}`;

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
  const q = above * (1 - 0.85 * gate);
  const w = scene.water;
  return (
    <div class="ck-plate on-plate" data-chakra={chakra} data-fx={scene.fx} aria-hidden="true">
      <div class="ck-box">
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
          <pattern id={`${id}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
            <line x1="0" y1="0" x2="0" y2="5" class="ck-hatch-line" />
          </pattern>
          {scene.water && (
            <clipPath id={`${id}-water`}>
              <ellipse cx={scene.water.cx} cy={scene.water.cy} rx={scene.water.rx} ry={scene.water.ry} />
            </clipPath>
          )}
        </defs>
        <rect class="ck-sky" width={W} height={H} fill={`url(#${id}-sky)`} />
        <g class="ck-stars">{sky.map(([x, y, a], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(0.4 + a * 0.5).toFixed(2)} style={{ opacity: (a * 0.55).toFixed(2) }} />)}</g>
        {scene.far.map((l, i) => <path key={`f${i}`} class="ck-far ck-pen" d={l.d} pathLength={1} style={{ '--o': String(l.o ?? 0.3), '--i': String(i) }} />)}
        {scene.mass.map((d, i) => <path key={`m${i}`} class="ck-mass" d={d} />)}
        {scene.deep.map((d, i) => (
          <g key={`d${i}`}>
            <path class="ck-deep" d={d} />
            <path class="ck-hatch" d={d} fill={`url(#${id}-hatch)`} />
          </g>
        ))}
        {scene.snow?.map((d, i) => <path key={`s${i}`} class="ck-snow" d={d} fill={`url(#${id}-snow)`} />)}
        {scene.water && (
          <g class="ck-water">
            <ellipse class="ck-water-face" cx={scene.water.cx} cy={scene.water.cy} rx={scene.water.rx} ry={scene.water.ry} />
            <ellipse class="ck-water-shore ck-pen" cx={scene.water.cx} cy={scene.water.cy} rx={scene.water.rx} ry={scene.water.ry} pathLength={1} />
          </g>
        )}
        {scene.firs?.map(([x, y, h], i) => <path key={`t${i}`} class="ck-fir ck-pen" d={fir(x, y, h)} pathLength={1} style={{ '--i': String(i % 6) }} />)}
        {scene.lines.map((l, i) => (
          <path key={`l${i}`} class="ck-line ck-pen" d={l.d} pathLength={1}
            style={{ '--w': String(l.w ?? 1), '--o': String(l.o ?? 0.8), '--i': String(i) }} />
        ))}
        {/* the channel: wider and brighter as more water runs it (section 4, so it still says it with Reduce Motion on) */}
        <path ref={course} class="ck-channel" d={scene.course} style={{ '--q': q.toFixed(3) }} />
      </svg>
      <canvas ref={canvas} class="ck-light" />
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
      <div class="ck-sign" style={{ ...signBox, viewTransitionName: `mt-sign-${chakra}` }}>
        <Sign kind={c.sign} hue={c.hue} closed={gate} size="large" />
      </div>
      </div>
    </div>
  );
}
