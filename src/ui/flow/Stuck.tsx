// What stuck (PLAN-ENERGIZE.md section 3 step 7, X4) at #/flow/energize/stuck, from the word under Energize's deck:
// every fixation that has been on, longest held first (model/fixations.ts ribbons). A row is two rules: the name with
// its print line at the right ("on since 8 / 20", "last on 10 / 22", "finished 10 / 22"), then its ribbons, one
// rounded line a stint along the months, in its hue while that stint is on and in print grey once closed. A print row
// on top names the months at their true places and "now" at the right edge, where a hairline runs down every row
// (model/stuck.ts). A drawing, never a count (DESIGN.md rule 15): no number near the ribbons but the print lines' dates,
// no total, no rank.
//
// Behind the PIN always: the names are sealed, and the door passes no route but a step's (model/door.ts doorPasses),
// so through the door this hash shows the keypad. A row read locked shows nothing. Still (rule 13): a state, so it
// leaves; the names only, in order, with no ribbon, no date and no axis.
import { useEffect, useState } from 'preact/hooks';
import { FIXATION_FLOW, lastOn, openStint, ribbons as readRibbons, type Ribbon } from '../../model/fixations';
import { axisOf, labelsOf, runOf } from '../../model/stuck';
import { flowById } from '../../model/flows';
import { Page } from '../parts/Page';
import { dataVersion } from '../sheets';
import { shortDate } from '../date';
import { light } from '../light';
import { voiceColour } from '../voice';
import { useNow } from './breath';

/** The print line at the right of a name: on since, finished, or last on. */
export function printOf(r: Ribbon): string {
  const on = openStint(r.fixation);
  if (on) return `on since ${shortDate(new Date(on.from))}`;
  const f = r.fixation.finishedAt;
  if (f !== undefined) return `finished ${shortDate(new Date(f))}`;
  const last = lastOn(r.fixation);
  return last === undefined ? '' : `last on ${shortDate(new Date(last))}`;
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

export function Stuck() {
  const now = useNow();
  const [rows, setRows] = useState<Ribbon[] | null>(null);
  const [back, setBack] = useState('Energize');
  useEffect(() => {
    let on = true;
    void readRibbons().then(rs => { if (on) setRows(rs.filter(r => !r.fixation.locked)); });
    // the way back says the flow's own name, as its page's header does
    void flowById(FIXATION_FLOW).then(f => { if (on && f && !f.locked && f.name) setBack(f.name); });
    return () => { on = false; };
  }, [dataVersion.value]);
  const still = light.value === 'still';
  const axis = rows?.length ? axisOf(rows.flatMap(r => r.stints), now) : null;

  return (
    <Page label="What stuck" back={{ word: back, href: `#/flow/${FIXATION_FLOW}` }} keepSettings drawn={rows !== null}>
      <div class="fs-sheetof fs-rules">
        <section class="fl-step-page fx-stuck" aria-label="What stuck">
          {rows && !rows.length && <p class="fx-stuck-none">Nothing has been on yet.</p>}
          {axis && !still && (
            <div class="fx-axis" aria-hidden="true">
              {labelsOf(axis).map(l => <span key={l.text + l.at} style={{ left: pct(l.at) }}>{l.text}</span>)}
              <span class="fx-axis-now">now</span>
            </div>
          )}
          {axis && rows!.map(r => (
            <div key={r.fixation.id} class="fx-rib" style={{ '--vc': voiceColour({ hue: r.fixation.hue }, 'light') }}>
              <p class="fx-rib-name"><span>{r.fixation.name}</span>{!still && <small class="fx-meta">{printOf(r)}</small>}</p>
              {!still && (
                <div class="fx-track" aria-hidden="true">
                  {r.stints.map(s => {
                    const run = runOf(axis, s);
                    return <i key={s.from} class={run.open ? 'on' : undefined} style={{ '--x': pct(run.at), '--w': pct(run.length) }} />;
                  })}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </Page>
  );
}
