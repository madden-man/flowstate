// The mountain (PLAN-MOUNTAIN.md, pass 6 over pass 5; R1): the Flow tab as one drawing, a night plate lit by its own
// water. The land is SVG drawn once (./mountain/land.ts), dim, the shadow face the darkest thing on the screen; one
// canvas over it (./mountain/plate.ts) holds every light there is: the rock lit where the water runs, the lanterns,
// the motes, the places' weather, the sea and the rings the circles send out. Over both, the things a finger finds:
// the seven signs with their names (each a link to its page, #/flow/c/<chakra>, R3) and the sea's circles (Meditate,
// Energize). Under the plate, on the page's rules, Flow keeps Right now and + flow.
//
// The land SVG never changes after the arrival, so it is its own layer and is painted once; what the water changes in
// the SVG (each stretch's channel width, the dark coming down below a closed gate) is a second, small SVG over it, so a
// gate dragged repaints only that.
//
// The water is the meter d and the seven gates, read from the newest readings (model/mountain.ts latestReadings).
// R2 drives them live by setting waterLive (below) while a finger is down, and clears it once the reading is written;
// the plate eases to whatever it is given. data-d and data-gates on the plate say what it is drawing, for tests.
//
// Travel (rule 28, through ui/turns.ts): every thing that goes somewhere carries data-travel, the view-transition
// name it travels under, and its link says where. A sign is mt-sign-<chakra> (R3 names its large sign the same), the
// Meditate circle md-circle (the Meditate page's circle), Energize's circle fs-drawing (the drawing on its page).
//
// Still (rule 13): the plate, the line, open signs without hue, names, slow water in the line colour, and nothing
// that shows a state; the plate reads that from --plate-state, never from the light (rule 2).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { CHAKRAS, CHAKRA_IDS, latestReadings, type ChakraId } from '../../model/mountain';
import { flowStates } from '../../model/flows';
import { FIXATION_FLOW } from '../../model/fixations';
import { dataVersion } from '../sheets';
import { Sign } from '../parts/Sign';
import { STOPS, SEA_Y, CIRCLE_R, H, W, channelPaths, seaSlots } from '../parts/cycle/river';
import { land, snowCap, SNOW_Y, type Land } from './mountain/land';
import { Plate } from './mountain/plate';
import { arrived, markArrived } from './mountain/arrival';
import type { CapWeather } from './mountain/weather';
import './mountain/mountain.css';

/** The water as R2's controls have it under the finger, or null for the newest readings. */
export const waterLive = signal<{ d: number; gates: number[] } | null>(null);
/** The cap's weather, for R2 to drive from the meter (snowline in box units, flakes and cloud 0 to 1). */
export const capLive = signal<Partial<CapWeather> | null>(null);

/** The sea's circles, in order (PLAN-MOUNTAIN.md section 8: kept here until there is a third). */
export const SEA_CIRCLES: readonly { name: string; href: string; travel: string; arc?: boolean; flow?: string }[] = [
  { name: 'Meditate', href: '#/flow/meditate', travel: 'md-circle' },
  { name: 'Energize', href: `#/flow/${FIXATION_FLOW}`, travel: 'fs-drawing', arc: true, flow: FIXATION_FLOW },
];

/** The view-transition name a sign travels under (R3's large sign takes the same). */
export const signTravel = (id: ChakraId) => `mt-sign-${id}`;

/** How long the arrival must have played before leaving the tab counts as having seen it. */
const SEEN_AFTER_MS = 1000;

let LAND: Land | null = null;
const theLand = () => (LAND ??= land());
const CHANNELS = channelPaths();
const f1 = (n: number) => n.toFixed(1);

const unit = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

type Props = {
  /** The meter, 0 to 1. */
  d: number;
  /** The seven gates in CHAKRA_IDS order, 0 open to 1 shut. */
  gates: readonly number[];
  /** The chakras with an episode open on one of their flows: the dot and its halo on their sign. */
  live?: ReadonlySet<ChakraId>;
  /** The cap's weather (R2). */
  cap?: Partial<CapWeather> | null;
  /** The sea's flows with an episode open (Energize's ride): the dot and its halo on their circle. */
  liveFlows?: ReadonlySet<string>;
};

/** The plate itself, given the water. */
export function MountainPlate({ d, gates, live, cap, liveFlows }: Props) {
  const host = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const plate = useRef<Plate | null>(null);
  const L = theLand();
  const slots = useMemo(() => seaSlots(SEA_CIRCLES.length), []);
  const snowline = cap?.snowline ?? SNOW_Y;
  const snow = useMemo(() => snowCap(snowline), [snowline]);
  const gateKey = gates.map(g => unit(g).toFixed(3)).join(',');

  useEffect(() => {
    const el = host.current!;
    // no canvas to draw on (a test's DOM, a browser without 2D canvas): the land and the signs are the whole of it
    if (typeof ResizeObserver === 'undefined' || !canvas.current?.getContext('2d')) { el.dataset.arrive = 'done'; return; }
    const stops = [...el.querySelectorAll<HTMLElement>('.mt-stop')];
    const p = new Plate({
      host: el, canvas: canvas.current!, land: L,
      channels: [...el.querySelectorAll<SVGPathElement>('.mt-chan')],
      shade: [...el.querySelectorAll<SVGStopElement>('.mt-shade-stop')],
      circles: [...el.querySelectorAll<HTMLElement>('.mt-circle')],
      slots,
      kindle: i => { if (stops[i]) stops[i].dataset.lit = ''; },
      arrived: markArrived,
    }, snowline);
    p.setWater(unit(d), gates.map(unit), true);
    if (cap) p.setWeather(cap);
    plate.current = p;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    p.start(!arrived() && !calm);
    // a touch anywhere on the plate cuts the arrival short; the touch itself still goes where it was going
    const cut = () => { if (p.arriving) p.finish(); };
    el.addEventListener('pointerdown', cut, true);
    // the tests' handle (navigator.webdriver is only set under automation)
    const w = window as unknown as { __mountain?: unknown };
    if (typeof navigator !== 'undefined' && navigator.webdriver) {
      w.__mountain = {
        // as R2's controls would: through waterLive, so the signs, the attributes and the water all answer
        set: (dd: number, gg: number[]) => { waterLive.value = { d: dd, gates: gg }; },
        clear: () => { waterLive.value = null; },
        arrive: () => { stops.forEach(s => delete s.dataset.lit); p.arrive(); },
        finish: () => p.finish(),
        plate: p,
      };
    }
    return () => {
      el.removeEventListener('pointerdown', cut, true);
      // left mid-arrival (the tab bar is outside the plate, so no touch cut it): once it has played a while it has been
      // seen, once per unlock. A remount in its first moments (the page's data landing) is not a leaving.
      if (p.arriving && p.arrivingFor > SEEN_AFTER_MS) markArrived();
      p.stop(); plate.current = null; if (w.__mountain) delete w.__mountain;
    };
  }, []);

  useEffect(() => { plate.current?.setWater(unit(d), gates.map(unit)); }, [d, gateKey]);
  useEffect(() => { if (cap) plate.current?.setWeather(cap); }, [cap?.snowline, cap?.flakes, cap?.cloud]);

  // the darkness below each sign: a stop just above it and one a little below, set by the plate as the water eases
  const shadeStops = CHAKRA_IDS.flatMap(id => [STOPS[id].y - 2, STOPS[id].y + 12]);

  return (
    <div class="mt-wrap">
    <section ref={host} class="mt-plate on-plate" aria-label="The mountain" data-d={unit(d).toFixed(3)} data-gates={gateKey}
      data-arrive={arrived() ? 'done' : 'run'}>
      <svg class="mt-land" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="mt-sea" gradientUnits="userSpaceOnUse" x1="0" y1="396" x2="0" y2={H}>
            <stop offset="0" class="mt-sea-top" />
            <stop offset="1" class="mt-sea-foot" />
          </linearGradient>
          <linearGradient id="mt-skyg" gradientUnits="userSpaceOnUse" x1="0" y1="-120" x2="0" y2="300">
            <stop offset="0" class="mt-sky-top" />
            <stop offset="1" class="mt-sky-foot" />
          </linearGradient>
          <radialGradient id="mt-vignette" cx="50%" cy="40%" r="75%">
            <stop offset=".55" class="mt-vig-in" />
            <stop offset="1" class="mt-vig-out" />
          </radialGradient>
        </defs>
        <rect class="mt-sky" x="-40" y="-200" width={W + 80} height={H + 200} fill="url(#mt-skyg)" />
        <g class="mt-stars">
          {L.stars.map((s, i) => <circle key={i} class="mt-star" cx={f1(s.x)} cy={f1(s.y)} r={s.r.toFixed(2)} style={{ '--at': s.at.toFixed(3) }} />)}
        </g>
        <rect class="mt-sea" x="-40" y="396" width={W + 80} height={H - 396 + 40} />
        {L.marks.map((m, i) => (m.kind === 'fill'
          ? (m.cls === 'snow-slot'
            ? (
              <g key={i} class="mt-snow" style={{ '--at': m.at, '--len': m.len }}>
                <path class="mt-snow-lit" d={snow.lit} />
                <path class="mt-snow-shade" d={snow.shade} />
                <path class="mt-snow-rim" d={snow.rim} />
              </g>
            )
            : <path key={i} class={`mt-fill mt-f-${m.cls}`} d={m.d} style={{ '--at': m.at, '--len': m.len }} />)
          : <path key={i} class={`mt-pen mt-p-${m.cls}`} d={m.d} pathLength={1} style={{ '--at': m.at, '--len': m.len, '--w': m.w.toFixed(2) }} />))}
        <rect class="mt-vignette" x="-40" y="-200" width={W + 80} height={H + 240} fill="url(#mt-vignette)" />
      </svg>
      <svg class="mt-live" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="mt-shade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
            {shadeStops.map((y, i) => <stop key={i} class="mt-shade-stop" offset={(y / H).toFixed(4)} stop-opacity="0" />)}
          </linearGradient>
          <clipPath id="mt-horn">
            {L.marks.filter(m => m.kind === 'fill' && (m.cls === 'face' || m.cls === 'horn')).map((m, i) => <path key={i} d={m.d} />)}
          </clipPath>
        </defs>
        {/* below a closed gate the mountain goes dark, stop by stop */}
        <rect class="mt-dark" x="0" y="0" width={W} height={H} clip-path="url(#mt-horn)" fill="url(#mt-shade)" />
        <g class="mt-chans">
          {CHANNELS.map((c, i) => <path key={i} class="mt-chan" d={c} pathLength={1} />)}
        </g>
      </svg>
      <canvas ref={canvas} class="mt-light" aria-hidden="true" />
      <div class="mt-over">
        {CHAKRAS.map(c => {
          const st = STOPS[c.id], i = CHAKRA_IDS.indexOf(c.id);
          return (
            <a key={c.id} class="mt-stop" href={`#/flow/c/${c.id}`} data-chakra={c.id} data-side={st.side > 0 ? 'right' : 'left'}
              data-live={live?.has(c.id) ? 'true' : undefined}
              style={{ '--x': st.x, '--y': st.y }}>
              <span class="mt-sign" data-travel={signTravel(c.id)}>
                <Sign kind={c.sign} hue={c.hue} closed={unit(gates[i] ?? 0)} size="small" />
                {live?.has(c.id) && <i class="mt-dot" aria-hidden="true"><i class="mt-halo" /></i>}
              </span>
              <span class="mt-name">{c.name}</span>
            </a>
          );
        })}
        {SEA_CIRCLES.map((c, i) => (
          <a key={c.name} class="mt-circle" href={c.href} style={{ '--x': slots[i], '--y': SEA_Y }}
            data-live={c.flow && liveFlows?.has(c.flow) ? 'true' : undefined}>
            <svg class="mt-ring" data-travel={c.travel} viewBox="-20 -20 40 40" aria-hidden="true" focusable="false">
              <circle r={CIRCLE_R} />
              {c.arc && <path d="M-10 5 C-5 4 -4 -7 0 -7 C4 -7 5 4 10 5" />}
            </svg>
            {c.flow && liveFlows?.has(c.flow) && <i class="mt-dot" aria-hidden="true"><i class="mt-halo" /></i>}
            <span class="mt-name">{c.name}</span>
          </a>
        ))}
      </div>
    </section>
    </div>
  );
}

/** The Flow tab's mountain: the newest readings (or R2's under the finger) and the live episodes. */
export function Mountain() {
  const [read, setRead] = useState<{ d: number; gates: number[] }>({ d: 0, gates: [0, 0, 0, 0, 0, 0, 0] });
  const [live, setLive] = useState<Set<ChakraId>>(new Set());
  const [liveFlows, setLiveFlows] = useState<Set<string>>(new Set());
  useEffect(() => {
    let on = true;
    latestReadings().then(r => {
      if (!on) return;
      setRead({ d: r.mountain?.value ?? 0, gates: CHAKRA_IDS.map(id => r.gates[id]?.value ?? 0) });
    }).catch(() => undefined);
    flowStates().then(rows => {
      if (!on) return;
      setLive(new Set(rows.filter(r => r.live && r.flow.chakra).map(r => r.flow.chakra!)));
      // a ride open on a flow of the sea's (Energize): its circle carries the dot
      setLiveFlows(new Set(rows.filter(r => r.live && SEA_CIRCLES.some(c => c.flow === r.flow.id)).map(r => r.flow.id)));
    }).catch(() => undefined);
    return () => { on = false; };
  }, [dataVersion.value]);
  const w = waterLive.value ?? read;
  return <MountainPlate d={w.d} gates={w.gates} live={live} cap={capLive.value} liveFlows={liveFlows} />;
}
