// Crown, Let go (PLAN-TASKS.md section 2): one rule on the snow, under the cornice the spindrift tears off. What he
// writes there lifts off letter by letter as spindrift, downwind, and is gone: it is not kept, so this never calls
// writeMark (section 10, question 5). The touch is done as the words go, so the water answers while they lift.
// Reduce Motion: the words are simply gone. Still: the same, in the line colour.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { registerTouch, type TouchAct } from '../touch';
import { Box, Letters, Rule, at, calm, seeded, seedOf } from './placeKit';

/** The rule on the snow, in box units (scenes.ts crown: across the snow above the sign, under the summit). */
export const LET_GO_RULE = { x: 150, y: 64, w: 160 } as const;
/** How long the spindrift takes to clear, at most. */
const LIFT_MS = 4200;

function LetGo({ touch, done }: TouchAct) {
  const [text, setText] = useState('');
  const [gone, setGone] = useState<{ text: string; k: number } | null>(null);
  useEffect(() => {
    if (!gone) return;
    const t = setTimeout(() => setGone(null), LIFT_MS);
    return () => clearTimeout(t);
  }, [gone?.k]);
  // each letter its own way off the snow: up and downwind, turning, some caught higher than others
  const drift = useMemo(() => {
    if (!gone) return [];
    const r = seeded(seedOf(gone.text) + gone.k);
    return [...gone.text].map(() => ({ '--dx': `${((r() - 0.3) * 60).toFixed(1)}px`, '--dy': `${((r() - 0.6) * 44).toFixed(1)}px`, '--rot': `${((r() - 0.3) * 90).toFixed(0)}deg` }));
  }, [gone?.k]);
  const { x, y, w } = LET_GO_RULE;
  return (
    <Box class="pl-crown">
      <Rule x={x} y={y} w={w} value={text} onInput={setText} label={touch.word}
        onEnter={v => {
          setText('');
          if (!calm()) setGone({ text: v, k: Date.now() });
          done();
        }} />
      {gone && <p key={gone.k} class="pl-said pl-letgo" style={at(x, y)} data-lifting=""><Letters text={gone.text} vars={i => drift[i]} /></p>}
    </Box>
  );
}

registerTouch({ chakra: 'crown', id: 'let-go' }, { View: LetGo });
