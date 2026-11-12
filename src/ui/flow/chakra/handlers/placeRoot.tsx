// Root (PLAN-TASKS.md section 2), the firs at the mountain's foot with the stream running out between them (scenes.ts
// root).
//   Five     five things he can see, drawn as stepping stones across the stream: the next stone waits dashed with a
//            rule over it; a thing named lights it and the next one waits. All five lit, it is done. Writes nothing
//            (the words are gone when the touch closes); works through the door.
//   Breathe  a thumb on the water: a light under it swells on the in-breath and settles on the out-breath, and a ring
//            goes out on the water as it turns. Writes nothing; works through the door.
//   Basics   four lanterns hung in the firs: ate, slept, water, outside. A tap lights one for today or puts it out
//            (model/acts.ts setBasic); they go out at sunrise. The first lit in a showing is the touch done.
// Reduce Motion: a stone or a lantern lights at once; nothing travels. Still: no hue, the line colour.
import { useEffect, useState } from 'preact/hooks';
import type { BasicId } from '../../../../db/schema';
import { BASICS, basicsToday, setBasic } from '../../../../model/acts';
import { registerTouch, type TouchAct } from '../touch';
import { Box, Rule, at, calm, seeded, stonePath, useOnce, useThumb } from './placeKit';

/** The stepping stones across the stream below the sign, in box units, in the order he names them. */
export const STONES: readonly [number, number][] = [[134, 178], [168, 185], [203, 188], [238, 185], [272, 179]];
const STONE_RX = 11, STONE_RY = 4.2;
/** Each stepping stone's own shape, the same every time. */
const SHAPES = STONES.map(([x, y], k) => stonePath(x, y, STONE_RX, STONE_RY, seeded(25 + k * 7)));
/** The rule over the stone that waits, its width in box units. */
const FIVE_W = 72;

/** Where each word sits by its stone: above for the first, third and fifth, below for the others. */
export const namedAt = (k: number): [number, number] => [STONES[k][0], STONES[k][1] + (k % 2 ? 13 : -11)];

function Five({ touch, done }: TouchAct) {
  const once = useOnce(done);
  const [named, setNamed] = useState<string[]>([]);
  const [text, setText] = useState('');
  const n = named.length;
  useEffect(() => { if (n >= STONES.length) once(); }, [n]);
  const wait = n < STONES.length ? STONES[n] : null;
  return (
    <Box class="pl-root-five" svg={
      <>
        <defs><filter id="pl-step-soft" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="3" /></filter></defs>
        {STONES.map(([x, y], k) => (
          <g key={k}>
            {k < n && <ellipse class="pl-step-glow" cx={x} cy={y} rx={STONE_RX * 1.8} ry={STONE_RY * 2.4} filter="url(#pl-step-soft)" />}
            <path class="pl-step" d={SHAPES[k]} data-stepping=""
              data-lit={k < n ? '' : undefined} data-now={k === n ? '' : undefined} />
          </g>
        ))}
      </>
    }>
      {named.map((w, k) => {
        const [x, y] = namedAt(k);
        return <p key={k} class="pl-said pl-named" style={at(x, y)} data-named="">{w}</p>;
      })}
      {wait && (
        <Rule key={n} x={Math.max(84, Math.min(306 - FIVE_W, wait[0] - FIVE_W / 2))} y={wait[1] + (n % 2 ? 22 : -9)} w={FIVE_W}
          value={text} onInput={setText} label={touch.word} maxLength={40}
          onEnter={v => { setText(''); setNamed(was => [...was, v]); }} />
      )}
    </Box>
  );
}

function Breathe({ touch, done }: TouchAct) {
  const once = useOnce(done);
  const [rings, setRings] = useState<{ x: number; y: number; k: number }[]>([]);
  const thumb = useThumb(touch.word, (phase, p) => {
    if (phase === 'out') setRings(rs => [...rs.slice(-2), { x: p[0], y: p[1], k: Date.now() }]);
  }, breaths => { if (breaths >= 1) once(); });
  useEffect(() => {
    if (!rings.length || calm()) return;
    const t = setTimeout(() => setRings(rs => rs.slice(1)), 6500);
    return () => clearTimeout(t);
  }, [rings[0]?.k]);
  const [x, y] = thumb.at ?? [200, 150];
  return (
    <Box class="pl-root-breathe" svg={
      <>
        <defs><filter id="pl-under-soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6" /></filter></defs>
        {rings.map(r => (
          <ellipse key={r.k} class="pl-ripple" cx={r.x} cy={r.y} rx={70} ry={16} data-go={calm() ? undefined : ''} data-calm={calm() ? '' : undefined}
            style={{ '--pl-ring': 'calc(var(--t-breath) * .6)' }} />
        ))}
        {thumb.at && <circle class="pl-under" cx={x} cy={y} r={16} filter="url(#pl-under-soft)" data-phase={thumb.breath.phase} />}
        <circle class="pl-ring" cx={x} cy={y} r={9} data-held={thumb.at ? '' : undefined} data-phase={thumb.at ? thumb.breath.phase : undefined} />
      </>
    }>
      <div {...thumb.surface} />
    </Box>
  );
}

/** The four lanterns, hung in the back rank of firs either side of the stream, in BASICS order, in box units. Each
 *  pair stands more than a thumb apart and on two heights, the outer one higher, so no word runs into the next word or
 *  the next lantern, and all four stay inside a 375pt screen (the box shows from about 75 to 315 there). */
export const LANTERNS: Readonly<Record<BasicId, [number, number]>> = { ate: [100, 122], slept: [146, 138], water: [246, 138], outside: [292, 122] };

function Lantern({ id, word, lit, onTap }: { id: BasicId; word: string; lit: boolean; onTap: () => void }) {
  const [x, y] = LANTERNS[id];
  return (
    <button type="button" class="pl-lantern" style={at(x, y)} aria-pressed={lit ? 'true' : 'false'} data-basic={id} onClick={onTap}>
      <svg viewBox="0 0 26 36" aria-hidden="true" focusable="false">
        <circle class="pl-halo" cx="13" cy="19" r="12" />
        <path class="pl-thread" d="M13 0 V9" />
        <path class="pl-body" d="M10 9 H16 L17.5 12 C20 15 20 23 17.5 26 L16 28 H10 L8.5 26 C6 23 6 15 8.5 12 Z" />
      </svg>
      <span class="pl-lantern-word">{word}</span>
    </button>
  );
}

function Basics({ done }: TouchAct) {
  const once = useOnce(done);
  const [lit, setLit] = useState<readonly BasicId[]>([]);
  useEffect(() => { let on = true; void basicsToday().then(b => { if (on) setLit(b); }); return () => { on = false; }; }, []);
  const tap = (id: BasicId) => {
    const on = !lit.includes(id);
    // answers under the thumb at once; what is kept comes back from the write
    setLit(was => (on ? [...was, id] : was.filter(b => b !== id)));
    void setBasic(id, on).then(b => { setLit(b); if (on) once(); }, () => setLit(was => (on ? was.filter(b => b !== id) : [...was, id])));
  };
  return (
    <Box class="pl-root-basics">
      {BASICS.map(b => <Lantern key={b.id} id={b.id} word={b.word} lit={lit.includes(b.id)} onTap={() => tap(b.id)} />)}
    </Box>
  );
}

registerTouch({ chakra: 'root', id: 'five' }, { View: Five });
registerTouch({ chakra: 'root', id: 'breathe' }, { View: Breathe });
registerTouch({ chakra: 'root', id: 'basics' }, { View: Basics });
