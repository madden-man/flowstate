// Sacral (PLAN-TASKS.md section 2), the low pool under a short drop between two stones (scenes.ts sacral).
//   Feel  one word, on a short rule over the pool: dropped, it falls to the water, rings go out from where it lands,
//         and it floats there. Kept as a mark (writeMark); the last word he felt floats on the pool when Feel is open.
//   Hold  a thumb in the pool: a ring goes out on each out-breath from under it. Writes nothing; works through the door.
// The rings are in the sign's hue (the line colour in Still). Reduce Motion: the word is afloat at once, and a ring is
// drawn where it would go, still.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { marksOf, writeMark } from '../../../../model/acts';
import { registerTouch, type TouchAct } from '../touch';
import { Box, H, Rule, at, calm, useOnce, useThumb } from './placeKit';

/** The pool's surface where the drop lands, and its reach, in box units. */
export const POOL: { cx: number; cy: number; rx: number; ry: number } = { cx: 196, cy: 162, rx: 150, ry: 26 };
/** The short rule over the pool, for one word. */
export const FEEL_RULE = { x: 164, y: 132, w: 66 } as const;
const RING_MS = 6500;

/** A ring going out on the pool. */
function Ripple({ x, y, scale = 1, delay = 0, long }: { x: number; y: number; scale?: number; delay?: number; long?: boolean }) {
  const still = calm();
  return (
    <ellipse class="pl-ripple" cx={x} cy={y} rx={POOL.rx * 0.7 * scale} ry={POOL.ry * 0.7 * scale}
      data-go={still ? undefined : ''} data-calm={still ? '' : undefined}
      style={{ '--pl-delay': `calc(var(--t-ui) * ${delay})`, ...(long ? { '--pl-ring': 'calc(var(--t-breath) * .6)' } : {}) }} />
  );
}

function Feel({ chakra, touch, door, done }: TouchAct) {
  const [text, setText] = useState('');
  const [afloat, setAfloat] = useState<{ text: string; k: number } | null>(null);
  const [drop, setDrop] = useState<{ text: string; k: number } | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const word = useRef<HTMLParagraphElement | null>(null);
  useEffect(() => {
    let on = true;
    void marksOf(chakra, touch.id).then(ms => { if (on && ms.length) setAfloat(was => was ?? { text: ms[ms.length - 1].text, k: 0 }); });
    return () => { on = false; };
  }, []);
  // how far the word falls to the water, in the plate's pixels
  useLayoutEffect(() => {
    if (!drop || !box.current || !word.current) return;
    const h = box.current.getBoundingClientRect().height;
    word.current.style.setProperty('--drop', `${(((POOL.cy - FEEL_RULE.y) / H) * h).toFixed(1)}px`);
    const t = setTimeout(() => setDrop(null), RING_MS);
    return () => clearTimeout(t);
  }, [drop?.k]);
  const mid = FEEL_RULE.x + FEEL_RULE.w / 2;
  return (
    <Box class="pl-sacral" boxRef={box} svg={
      drop && <g key={drop.k}>{[0, 1, 2].map(k => <Ripple key={k} x={POOL.cx} y={POOL.cy} scale={0.55 + k * 0.3} delay={2 + k * 2.4} />)}</g>
    }>
      {!door && (
        <Rule x={FEEL_RULE.x} y={FEEL_RULE.y} w={FEEL_RULE.w} value={text} onInput={setText} label={touch.word} word maxLength={32}
          onEnter={v => {
            setText('');
            void writeMark(chakra, touch.id, v).then(() => {
              const k = Date.now();
              // afloat once it has landed (place.css .pl-afloat waits for the drop)
              setAfloat({ text: v, k });
              if (!calm()) setDrop({ text: v, k });
              done();
            }, () => undefined);
          }} />
      )}
      {drop && (
        <p key={drop.k} ref={word} class="pl-said pl-drop" style={{ ...at(mid, FEEL_RULE.y), transform: 'translate(-50%, -100%)' }}>{drop.text}</p>
      )}
      {afloat && <p key={afloat.k} class="pl-said pl-afloat" style={at(POOL.cx, POOL.cy + 6)} data-afloat="">{afloat.text}</p>}
    </Box>
  );
}

function Hold({ touch, done }: TouchAct) {
  const once = useOnce(done);
  const [rings, setRings] = useState<{ x: number; y: number; k: number }[]>([]);
  const sent = useRef(0);
  const thumb = useThumb(touch.word, (phase, p) => {
    if (phase !== 'out') return;
    sent.current += 1;
    // from under the thumb, kept on the water
    const x = Math.max(POOL.cx - POOL.rx * 0.7, Math.min(POOL.cx + POOL.rx * 0.7, p[0]));
    const y = Math.max(POOL.cy - 6, Math.min(POOL.cy + POOL.ry * 0.6, p[1]));
    const k = Date.now();
    setRings(rs => [...rs.slice(-3), { x, y, k }]);
  }, () => { if (sent.current) once(); });
  useEffect(() => {
    if (!rings.length || calm()) return;
    const t = setTimeout(() => setRings(rs => rs.slice(1)), RING_MS);
    return () => clearTimeout(t);
  }, [rings[0]?.k]);
  return (
    <Box class="pl-sacral-hold" svg={
      <>
        {rings.map(r => <Ripple key={r.k} x={r.x} y={r.y} long />)}
        <circle class="pl-ring" cx={thumb.at?.[0] ?? POOL.cx} cy={thumb.at?.[1] ?? POOL.cy} r={8}
          data-held={thumb.at ? '' : undefined} data-phase={thumb.at ? thumb.breath.phase : undefined} />
      </>
    }>
      <div {...thumb.surface} data-rings={rings.length ? '' : undefined} />
    </Box>
  );
}

registerTouch({ chakra: 'sacral', id: 'feel' }, { View: Feel });
registerTouch({ chakra: 'sacral', id: 'hold' }, { View: Hold });
