// Who (PLAN-SELF.md section 3.3): the creed, the first thing on Be. One line per held paradox, in the order of
// the list, in ink on the page's rules (DESIGN.md rule 5: line height is the rule spacing; a line may wrap, and
// the block ends on a blank rule). His own line ("Both", written in the paradox sheet) is plain ink; a paradox
// with none yet shows its three words in print grey, so written and unwritten read apart with no label. A tap on
// a line opens that paradox's spread below. The app writes none of it. Still shows it: these are his words, not
// states. A locked row shows nothing rather than an empty line.
import { useEffect, useState } from 'preact/hooks';
import { dataVersion } from '../sheets';
import { who } from '../../model/paradox';
import { beVersion } from './state';

type Line = Awaited<ReturnType<typeof who>>[number];

export function Who({ onLine }: { onLine: (paradoxId: string) => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  useEffect(() => {
    let live = true;
    who().then(ls => { if (live) setLines(ls.filter(l => !l.paradox.locked && l.line.trim())); });
    return () => { live = false; };
  }, [beVersion.value, dataVersion.value]);

  if (!lines.length) return null;
  return (
    <section class="fs-who fs-rules" aria-label="Who">
      {lines.map(l => (
        <button key={l.paradox.id} type="button" class={`fs-who-line${l.own ? ' own' : ''}`} data-who={l.paradox.id}
          onClick={() => onLine(l.paradox.id)}>{l.line}</button>
      ))}
    </section>
  );
}
