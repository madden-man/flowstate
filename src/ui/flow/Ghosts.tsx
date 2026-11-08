// Ghost rings (PLAN-FLOWS.md 3.7 and 4 step 4, F6; open question 9: a drawing, with no number). Each ended episode
// is a faint closed copy of the flow's shape outside the live drawing, one further out per episode, the newest
// innermost and the oldest outermost, at 30% of --print, behind parts/Cycle in .fl-drawing. The copy is the shape's
// own lines (./cycle's paths, the dotted way back drawn solid, so the ring closes), scaled about the drawing's centre.
// At most GHOSTS_MAX are drawn; older ones are simply not drawn (model/carried.ts). No number is printed near them
// (rule 15: a drawing of past episodes is not a count). Still hides them (fs-notstill), and so does the door: they
// are past episodes, which stay behind the PIN (F5).
import { useEffect, useState } from 'preact/hooks';
import { shapeOf } from '../parts/cycle/index';
import { dataVersion } from '../sheets';
import type { DiagramName } from '../../db/schema';
import { ghostEpisodes, ghostScale } from '../../model/carried';

type Props = { flowId: string; diagram: DiagramName; n: number; version: number };

export function Ghosts({ flowId, diagram, n, version }: Props) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let on = true;
    void ghostEpisodes(flowId).then(r => { if (on) setIds(r); });
    return () => { on = false; };
  }, [flowId, version, dataVersion.value]);
  if (!ids.length) return null;
  const shape = shapeOf(diagram);
  const lines = shape.paths(n).filter(d => d.kind === 'path' && /\barc\b/.test(d.cls) && !/\bfaint\b/.test(d.cls));
  const cx = shape.w / 2, cy = shape.h / 2;
  return (
    <div class="fl-ghosts fs-notstill" aria-hidden="true">
      <svg viewBox={`0 0 ${shape.w} ${shape.h}`} preserveAspectRatio="xMidYMid meet">
        {ids.map((id, k) => {
          const s = ghostScale(k, shape.closed);
          return (
            <g key={id} class="ghost" data-ghost="" transform={`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`}>
              {lines.map((d, i) => d.kind === 'path' && <path key={i} d={d.d} />)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
