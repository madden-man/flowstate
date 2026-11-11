// Throat, Say it here (PLAN-TASKS.md section 2): one rule at the lip of the fall (scenes.ts throat: the water leaves a
// lip under the sign and falls to the gorge's foot). The sentence he writes there runs to the lip, letter by letter,
// and goes over the fall. It is kept as a mark (writeMark), and the touch is done as it goes over.
// Reduce Motion: the sentence is gone at once. Still: the same, in the line colour.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { writeMark } from '../../../../model/acts';
import { registerTouch, type TouchAct } from '../touch';
import { Box, Letters, Rule, H, W, at, calm, seeded, seedOf } from './placeKit';

/** The lip the water leaves, and the fall's foot, in box units. */
export const LIP: [number, number] = [205, 99];
export const FOOT = 196;
/** The rule, running to the lip. */
export const SAY_RULE = { x: 86, y: 98, w: 98 } as const;
const FALL_MS = 5200;
/** How fast the line runs to the lip: pixels in one --t-ui. */
const RUN_PX_PER_UI = 18;

function SayItHere({ chakra, touch, door, done }: TouchAct) {
  const [text, setText] = useState('');
  const [over, setOver] = useState<{ text: string; k: number } | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const line = useRef<HTMLSpanElement | null>(null);

  // each letter runs to the lip and then falls: how far it runs, how far it falls, and its own sway
  useLayoutEffect(() => {
    if (!over || !box.current || !line.current) return;
    const b = box.current.getBoundingClientRect();
    const lip = b.left + (LIP[0] / W) * b.width, fall = ((FOOT - LIP[1]) / H) * b.height;
    const r = seeded(seedOf(over.text) + over.k);
    line.current.querySelectorAll<HTMLElement>('.pl-ch').forEach(el => {
      const c = el.getBoundingClientRect();
      const dx = Math.max(0, lip - c.right);
      el.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      el.style.setProperty('--run', (dx / RUN_PX_PER_UI).toFixed(2));
      el.style.setProperty('--fall', `${(fall * (0.85 + r() * 0.2)).toFixed(1)}px`);
      el.style.setProperty('--sway', `${((r() - 0.5) * 14).toFixed(1)}px`);
      el.style.setProperty('--rot', `${((r() - 0.5) * 40).toFixed(0)}deg`);
    });
    const t = setTimeout(() => setOver(null), FALL_MS);
    return () => clearTimeout(t);
  }, [over?.k]);

  const { x, y, w } = SAY_RULE;
  return (
    <Box class="pl-throat" boxRef={box}>
      {!door && (
        <Rule x={x} y={y} w={w} value={text} onInput={setText} label={touch.word}
          onEnter={v => {
            setText('');
            if (!calm()) setOver({ text: v, k: Date.now() });
            void writeMark(chakra, touch.id, v).then(() => done(), () => undefined);
          }} />
      )}
      {over && <p key={over.k} class="pl-said pl-fall" style={at(x, y)}><Letters text={over.text} spanRef={line} /></p>}
    </Box>
  );
}

registerTouch({ chakra: 'throat', id: 'say-it-here' }, { View: SayItHere });
