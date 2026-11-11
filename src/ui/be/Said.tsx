// "Said for it" under an open value (PLAN-VALUES.md section 3 step 10, C5): the lines confirmed for the value or its
// shadow, newest first, five of them, each a way back to the page it lives on. A line spoken for the shadow carries the
// shadow's word in italic print after its day; nothing else tells the sides apart. No lines, nothing at all; more than
// five, a quiet "Earlier" shows the rest in place (rule 15: a list of lines, never a count). Read again on every
// mount and on the data and Be signals, so a line confirmed or taken back elsewhere is right on the way back. Still:
// Be is words alone, so none of this draws.
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Value } from '../../db/schema';
import type { Read } from '../../db/fields';
import { saidFor } from '../../model/values';
import { allVoices } from '../../model/council';
import { dataVersion } from '../sheets';
import { light } from '../light';
import { beVersion } from './state';
import { SAID_SHOWN, saidRow, type SaidRow } from './saidRows';

export function Said({ value }: { value: Read<Value> }) {
  const [rows, setRows] = useState<SaidRow[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let live = true;
    // one past the shown five is enough to know there are earlier ones
    Promise.all([saidFor(value.id, all ? Infinity : SAID_SHOWN + 1), allVoices()]).then(([said, vs]) => {
      if (!live) return;
      const byId = new Map(vs.map(v => [v.id, v]));
      setRows(said.filter(s => !s.message.locked).map(s => saidRow(s, value, byId)));
    });
    return () => { live = false; };
  }, [value.id, value.shadow, all, beVersion.value, dataVersion.value]);

  if (light.value === 'still' || !rows.length) return null;
  const shown = all ? rows : rows.slice(0, SAID_SHOWN);
  return (
    <div class="fs-said-for">
      <p class="fs-print fs-said-label">Said for it</p>
      {shown.map(r => (
        <a key={r.id} href={r.href} class={`fs-saidline${r.deep ? ' deep' : ''}`}
          style={r.colour ? ({ '--vc': r.colour } as JSX.CSSProperties) : undefined}>
          <small>{r.date}{r.shadow && <i> {r.shadow}</i>}</small>
          <span>{r.text}</span>
        </a>
      ))}
      {!all && rows.length > SAID_SHOWN && (
        <p class="fs-said-earlier"><button type="button" class="fs-word" onClick={() => setAll(true)}>Earlier</button></p>
      )}
    </div>
  );
}
