// Heart (PLAN-TASKS.md section 2), the tarn in its cirque (scenes.ts heart), holding the headwall and the sign upside
// down.
//   Grieve  a name written on the tarn sinks and stays as a stone. Each is a mark (writeMark), and the stones are read
//           back from them (model/acts.ts stones()): every name he grieved lies on the tarn's bed under the sign's
//           reflection, the newest settling as it sinks. A drawing, not a count: no number anywhere, and only the
//           newest STONES_SHOWN are laid, so the bed never fills.
//   Hold    a thumb on the water: tapped, the reflection is stirred; while the thumb is held, each out-breath steadies
//           it, until it lies still. Writes nothing; works through the door.
// Reduce Motion: the name is a stone at once; the reflection steadies a step a breath, with nothing moving between.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Mark } from '../../../../db/schema';
import { stones, writeMark } from '../../../../model/acts';
import { registerTouch, type TouchAct } from '../touch';
import { Box, Rule, at, calm, seeded, seedOf, stonePath, useOnce, useThumb } from './placeKit';

/** The rule on the tarn, in box units: on the water, left of the reflection, clear of the words beside it. */
export const GRIEVE_RULE = { x: 112, y: 160, w: 100 } as const;
/** The most stones laid on the bed at once, newest first. */
export const STONES_SHOWN = 24;
const SINK_MS = 2400;

/** Where a stone lies on the tarn's bed, and its size, from its mark alone: the same every visit. Under the rule, in
 *  the shallows below the sign's reflection. */
export function stoneOf(id: string): { x: number; y: number; rx: number; ry: number; d: string } {
  const r = seeded(seedOf(id));
  const x = 124 + r() * 92, y = 180 + Math.pow(r(), 0.8) * 20;
  // nearer the shore they lie larger
  const near = (y - 178) / 22, rx = 4.4 + r() * 3 + near * 2.4, ry = rx * (0.36 + r() * 0.12);
  return { x, y, rx, ry, d: stonePath(x, y, rx, ry, r) };
}

function Grieve({ chakra, touch, door, done }: TouchAct) {
  const [text, setText] = useState('');
  const [laid, setLaid] = useState<Mark[]>([]);
  const [sinking, setSinking] = useState<{ text: string; k: number; id: string } | null>(null);
  useEffect(() => { let on = true; void stones().then(s => { if (on) setLaid(s); }); return () => { on = false; }; }, []);
  useEffect(() => {
    if (!sinking) return;
    const t = setTimeout(() => setSinking(null), SINK_MS);
    return () => clearTimeout(t);
  }, [sinking?.k]);
  const shown = laid.slice(-STONES_SHOWN);
  const { x, y, w } = GRIEVE_RULE;
  const fresh = sinking?.id;
  return (
    <Box class="pl-heart" svg={
      <g class="pl-stones">
        {shown.map(m => {
          const s = stoneOf(m.id);
          return (
            <g key={m.id} data-stone="">
              <ellipse class="pl-stone-lit" cx={s.x} cy={s.y - s.ry * 0.3} rx={s.rx * 1.6} ry={s.ry * 1.5} data-new={m.id === fresh ? '' : undefined} />
              <path class="pl-stone" d={s.d} data-new={m.id === fresh ? '' : undefined} />
            </g>
          );
        })}
        {sinking && !calm() && <ellipse key={sinking.k} class="pl-wave" data-go="" cx={x + w / 2} cy={y + 2} rx={48} ry={7} />}
      </g>
    }>
      {!door && (
        <Rule x={x} y={y} w={w} value={text} onInput={setText} label={touch.word}
          onEnter={v => {
            setText('');
            void writeMark(chakra, touch.id, v).then(m => {
              setLaid(was => [...was, m]);
              if (!calm()) setSinking({ text: v, k: Date.now(), id: m.id });
              done();
            }, () => undefined);
          }} />
      )}
      {sinking && !calm() && <p key={sinking.k} class="pl-said pl-sink" style={at(x, y)}>{sinking.text}</p>}
    </Box>
  );
}

/** How stirred the reflection is after this many out-breaths under the thumb: 1 stirred, 0 still, in three breaths. */
export const stirAfter = (outs: number): number => Math.max(0, 1 - Math.max(0, outs) / 3);
/** The displacement at full stir, in the filter's units. */
const STIR = 16;
/** How long the stir moves after the tap with no thumb on the water. */
const STIRRED_MS = 2200;

function Hold({ touch, done }: TouchAct) {
  const once = useOnce(done);
  const [outs, setOuts] = useState(0);
  const thumb = useThumb(touch.word, phase => { if (phase === 'out') setOuts(n => n + 1); });
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<SVGFEDisplacementMapElement | null>(null);
  const shift = useRef<SVGFEOffsetElement | null>(null);
  const target = stirAfter(outs);
  const now = useRef(1);
  const held = useRef(false);
  held.current = !!thumb.at;
  const tapped = useRef(performance.now());

  // the plate's reflection is filtered while this word is active
  useEffect(() => {
    const plate = box.current?.closest<HTMLElement>('.ck-plate');
    if (!plate) return;
    plate.dataset.plWaver = '';
    return () => { delete plate.dataset.plWaver; };
  }, []);

  // the water moves while the thumb is on it (and a moment after the tap), easing toward how stirred it is now
  useEffect(() => {
    if (calm()) { now.current = target; map.current?.setAttribute('scale', (STIR * target).toFixed(2)); if (target === 0) once(); return; }
    let raf = 0, prev = 0, dy = 0;
    const frame = (ms: number) => {
      const dt = prev ? Math.min(0.05, (ms - prev) / 1000) : 0;
      prev = ms;
      now.current += (target - now.current) * Math.min(1, dt * 0.6);
      if (target === 0 && now.current < 0.02) now.current = 0;
      dy += dt * (4 + 10 * now.current);
      map.current?.setAttribute('scale', (STIR * now.current).toFixed(2));
      shift.current?.setAttribute('dy', dy.toFixed(2));
      if (now.current === 0) { once(); return; }
      if (held.current || performance.now() - tapped.current < STIRRED_MS) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, !!thumb.at]);

  return (
    <Box class="pl-heart-hold" boxRef={box} svg={
      <>
        <defs>
          <filter id="pl-waver" x="-10%" y="-20%" width="120%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.004 0.13" numOctaves={2} seed={4} result="n" />
            <feOffset ref={shift} in="n" dy="0" result="m" />
            <feDisplacementMap ref={map} in="SourceGraphic" in2="m" scale={String(STIR)} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <circle class="pl-ring" cx={thumb.at?.[0] ?? 195} cy={thumb.at?.[1] ?? 172} r={9}
          data-held={thumb.at ? '' : undefined} data-phase={thumb.at ? thumb.breath.phase : undefined} />
      </>
    }>
      <div {...thumb.surface} data-still={target === 0 ? '' : undefined} />
    </Box>
  );
}

registerTouch({ chakra: 'heart', id: 'grieve' }, { View: Grieve });
registerTouch({ chakra: 'heart', id: 'hold' }, { View: Hold });
