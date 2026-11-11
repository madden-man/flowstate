// Solar plexus, Reword (PLAN-TASKS.md section 2): two rules on the shadow flank above the fire (scenes.ts
// solarPlexus). On the first he writes the verdict he has on himself, on the second the deed itself. The second kept,
// the verdict is struck with a drawn stroke (DESIGN.md rule 10: struck, never hidden) and the deed stays lit over a
// rule in the fire's hue. It is one mark: the deed, with the verdict as what it struck (writeMark with struck).
// Reduce Motion: the stroke is there at once. Still: no hue, the line colour.
import { useRef, useState } from 'preact/hooks';
import { writeMark } from '../../../../model/acts';
import { registerTouch, type TouchAct } from '../touch';
import { Box, Rule, at } from './placeKit';

/** The two rules, in box units: the verdict, then the deed under it. */
export const VERDICT_RULE = { x: 150, y: 52, w: 156 } as const;
export const DEED_RULE = { x: 150, y: 82, w: 156 } as const;

function Reword({ chakra, touch, door, done }: TouchAct) {
  const [verdict, setVerdict] = useState('');
  const [deed, setDeed] = useState('');
  const [step, setStep] = useState<'verdict' | 'deed'>('verdict');
  const [kept, setKept] = useState<{ verdict: string; deed: string } | null>(null);
  const deedRef = useRef<HTMLInputElement | null>(null);
  if (door) return null;
  if (kept) {
    return (
      <Box class="pl-solar">
        <div class="pl-struck" style={at(VERDICT_RULE.x, VERDICT_RULE.y, VERDICT_RULE.w)} data-verdict="">
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <span class="pl-said">{kept.verdict}</span>
            <svg class="pl-strike" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
              <path d="M1 6.2 C 24 4.9, 44 6.5, 66 5.3 S 92 4.7, 99 4.5" pathLength={1} />
            </svg>
          </span>
        </div>
        <div class="pl-struck pl-kept" style={at(DEED_RULE.x, DEED_RULE.y, DEED_RULE.w)} data-deed="">
          <span class="pl-said">{kept.deed}</span>
          <i class="pl-kept-rule" aria-hidden="true" />
        </div>
      </Box>
    );
  }
  return (
    <Box class="pl-solar">
      <Rule x={VERDICT_RULE.x} y={VERDICT_RULE.y} w={VERDICT_RULE.w} value={verdict} onInput={setVerdict} class="pl-verdict"
        label={`${touch.word}, the verdict`}
        onEnter={() => { setStep('deed'); deedRef.current?.focus(); }} />
      {(step === 'deed' || verdict.trim()) && (
        <Rule x={DEED_RULE.x} y={DEED_RULE.y} w={DEED_RULE.w} value={deed} onInput={setDeed} inputRef={deedRef} focus={step === 'deed'}
          label={`${touch.word}, the deed`}
          onEnter={v => {
            const was = verdict.trim();
            if (!was) return;
            void writeMark(chakra, touch.id, v, { struck: was }).then(() => { setKept({ verdict: was, deed: v }); done(); }, () => undefined);
          }} />
      )}
    </Box>
  );
}

registerTouch({ chakra: 'solar-plexus', id: 'reword' }, { View: Reword });
