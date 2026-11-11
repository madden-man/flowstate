// One drawing under a sign (PLAN-MOUNTAIN.md section 6, R3): how this part of him gets blocked, as one of the old flows'
// drawings, with no flow name anywhere. Wired as FlowPage wires its drawing today: the wash under the last step, the
// ghost rings (past episodes), the stream (parts/Stream, ink on the paper), his stamps, parts/Cycle with the dot,
// episodes and step words, the halo and hold the ring, and the clock in the middle, without the words under it (they
// leave the page with the copy). The page owns the episode writes; this owns only what one drawing does on its own:
// the breath a held thumb runs, the stream's landing ring, and whether his stamps have replaced the seeded ones.
// Folded (Root holds two drawings): the second is drawn small, its dot only drawn, until a tap opens it; the safety lines
// and the rows are the page's, so folding hides none of them.
import { useState } from 'preact/hooks';
import { Cycle } from '../../parts/Cycle';
import { midStyle } from '../../parts/cycle/index';
import { Stream } from '../../parts/Stream';
import { Clock, Wash } from '../Clock';
import { Ghosts } from '../Ghosts';
import { StampMarks } from '../Stamps';
import { useBreath } from '../breath';
import type { Episode, Flow } from '../../../db/schema';
import type { Read } from '../../../db/fields';
import { spanOf, stepAt } from '../../../model/flows';
import { clockFrom, washLeft } from '../../../model/tips';
import { pacesOf } from '../../../model/pace';

type Props = {
  flow: Read<Flow>;
  live?: Read<Episode>;
  /** Where the dot is (0 rest), as the page holds it: a move is drawn before its write lands. */
  at: number;
  /** The step this drawing shows (a tap reads one), or 0. */
  showing: number;
  /** The dot is on the step shown, in a live episode, with no move waiting: the clock, the halo, the wash. */
  onStep: boolean;
  /** A move has been drawn and its write has not landed. */
  moving: boolean;
  version: number;
  now: number;
  /** The drawing the route named (#/flow/:id), or the one with the live episode. */
  focused: boolean;
  onRead: (k: number) => void;
  onMove: (visits: number[], to: number) => void;
  /** Folded (a second drawing under the sign, not yet opened): drawn small, the dot only drawn; a tap opens it. */
  folded?: boolean;
  onOpen?: () => void;
};

export function Drawing(props: Props) {
  if (props.folded) {
    const { flow, at, onOpen } = props;
    return (
      <section class="ck-drawing" data-flow={flow.id} data-folded="" aria-label="How it gets blocked">
        <button type="button" class="ck-fold" aria-label="Open this drawing" onClick={onOpen}>
          <span class="fl-drawing ck-fold-art" style={midStyle(flow.diagram)}>
            <Cycle diagram={flow.diagram} steps={flow.steps} at={at} small />
          </span>
        </button>
      </section>
    );
  }
  return <Open {...props} />;
}

function Open({ flow, live, at, showing, onStep, moving, version, now, focused, onRead, onMove }: Props) {
  const breath = useBreath();
  const [marks, setMarks] = useState<('didnt' | 'happened')[]>([]);
  const [landing, setLanding] = useState<{ k: number; seq: number } | null>(null);
  const n = flow.steps.length;
  const shown = stepAt(flow, showing);
  const mark = onStep && live ? live.marks.filter(m => m.stepId === shown?.id).at(-1) : undefined;
  const ringy = !!shown?.tips.some(t => t.helper === 'ring' && !t.struck) && !flow.locked;
  const wash = onStep && showing === n && mark ? washLeft(mark.at, spanOf(shown), now) : 0;
  return (
    <section class="ck-drawing" data-flow={flow.id} data-focused={focused ? '' : undefined} data-showing={showing} aria-label="How it gets blocked">
      <div class="fl-drawing" style={midStyle(flow.diagram)} data-own={marks.length ? '' : undefined}>
        {wash > 0 && <Wash left={wash} />}
        {!flow.locked && <Ghosts flowId={flow.id} diagram={flow.diagram} n={n} version={version} />}
        <Stream diagram={flow.diagram} paces={pacesOf(flow)} at={at} landing={landing} since={breath.held ? breath.since : null} />
        {!flow.locked && <StampMarks flowId={flow.id} diagram={flow.diagram} n={n} version={version} onMarks={setMarks} />}
        <Cycle diagram={flow.diagram} stamps={marks} steps={flow.steps} at={at} showing={showing} live={!!live && !(moving && at === 0)}
          disabled={!!flow.locked} onRead={onRead} onMove={(v, to) => { setLanding(l => ({ k: to, seq: (l?.seq ?? 0) + 1 })); onMove(v, to); }}
          halo={ringy && (onStep || breath.held) ? breath.since ?? 0 : false} held={breath.held} />
        <Clock from={onStep && live ? clockFrom(flow, live) : undefined} now={now} holdable={ringy} breath={breath}
          awake={onStep && !!shown?.peak && !flow.quietClock} quiet={!!flow.quietClock} />
      </div>
    </section>
  );
}
