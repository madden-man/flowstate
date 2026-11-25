// Flow is the shelf (PLAN-WORLDS.md section 4, WF): the mountain, its signs and everything under them left (section
// 4.1), and the tab became a shelf of notebooks across the top with, under it, what the notebook in front has to offer.
// Today the shelf holds one cover, My own pages (./Shelf.tsx); W1 slides the worlds in beside it. Under the cover, on
// the page's rules: the last line written in the notebook, in the quiet italic with its date; Meditate, Energize and
// Research as three drawn circles in a row, each opening its own page as it always has; and Right now, his own lines
// across every flow, the door's page (PLAN-FLOWS.md 3.7), from which every flow is reached. The morning after a worry
// the What if ask (StampAsk, F6) stands at the foot.
//
// Nothing here moves on its own (DESIGN.md rule 31): the cover gives under the thumb (rule 26) and a circle travels to
// its page (rule 28, ui/turns.ts, by its data-travel name), and that is all. No counts anywhere (rule 15).
import { useEffect, useState } from 'preact/hooks';
import { Page } from '../parts/Page';
import { StampAsk } from './Stamps';
import { Shelf } from './Shelf';
import { dataVersion } from '../sheets';
import { gate } from '../lock/pin';
import { notebookDate } from '../date';
import { lastLine } from '../../model/pages';
import { notebooks, OWN } from '../../model/notebooks';
import { FIXATION_FLOW } from '../../model/fixations';
import './shelf.css';

/** The three circles under his own cover, in order. Each carries what travels to its page (rule 28): Meditate's circle
 *  to the Meditate page's circle, Energize's to the drawing on its flow page, Research's name to the same word on its
 *  page's header (PLAN-RESEARCH.md Q4). */
export const CIRCLES: readonly { name: string; href: string; travel: string; mark?: 'arc' | 'split'; named?: boolean }[] = [
  { name: 'Meditate', href: '#/flow/meditate', travel: 'md-circle' },
  { name: 'Energize', href: `#/flow/${FIXATION_FLOW}`, travel: 'fs-drawing', mark: 'arc' },
  { name: 'Research', href: '#/flow/research', travel: 'rs-name', mark: 'split', named: true },
];

const R = 13;

/** Meditate, Energize and Research, drawn in ink: a circle each, Energize's with a rise through it, Research's split
 *  down the middle into its two sides. */
function Circles() {
  return (
    <nav class="fl-circles" aria-label="Meditate, Energize and Research">
      {CIRCLES.map(c => (
        <a key={c.name} class="fl-circle" href={c.href}>
          <svg viewBox="-20 -20 40 40" aria-hidden="true" focusable="false" data-travel={c.named ? undefined : c.travel}>
            <circle r={R} />
            {c.mark === 'arc' && <path d="M-9 4 C-4.5 3.5 -3.5 -6 0 -6 C3.5 -6 4.5 3.5 9 4" />}
            {c.mark === 'split' && <path d={`M0 ${-R} V${R}`} />}
          </svg>
          <span class="fl-circle-name" data-travel={c.named ? c.travel : undefined}>{c.name}</span>
        </a>
      ))}
    </nav>
  );
}

export function Flow() {
  // undefined while reading, null when nothing is written yet
  const [last, setLast] = useState<{ text: string; at: number } | null | undefined>(undefined);
  // read again when the notebook opens or locks, as every page is
  const locked = gate.value;
  useEffect(() => {
    let on = true;
    lastLine().then(l => { if (on) setLast(l ?? null); }, () => { if (on) setLast(null); });
    return () => { on = false; };
  }, [dataVersion.value, locked]);
  const worn = OWN.id;

  return (
    <Page label="Flow" drawn={last !== undefined}>
      <Shelf books={notebooks()} worn={worn} front={worn} />
      <div class="fs-sheetof fs-rules fs-flows fl-under" data-for={worn}>
        {/* the last line written, holding its rule from first paint so nothing under it moves */}
        <p class="fs-quiet fl-lastline" data-read={last === undefined ? undefined : ''}>
          {last && <><small>{notebookDate(new Date(last.at))}</small> {last.text}</>}
        </p>
        <Circles />
        {/* Right now (F5): his own step lines across every flow, the door's page */}
        <a class="fs-row fs-list-row fl-flow" href="#/flow/now">
          <span class="fs-list-line">Right now</span>
          <small class="fs-list-meta">Your lines; tap the one that fits</small>
        </a>
        <StampAsk />
      </div>
    </Page>
  );
}
