// The year sheet (PLAN-WORLDS.md section 4, "The year worn", W4): a tap on the header's year raises the same dial a
// novel's cover carries, with the bible's chapters and world events marked on it, and the ones in the year shown named
// under it in print (their titles are the bible's). The year let go on is the one worn from then on: a new page or
// council takes it. A page already written keeps its own (the Year chip changes one page alone).
import { useEffect, useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { openSheet } from '../sheets';
import { settings, loadSettings } from '../settings';
import { wornWorld, wornYear } from '../notebook';
import { Dial } from './Dial';
import { pocketFor, setWorldYear } from '../../model/story';

export function YearSheet() {
  const open = openSheet.value === 'year';
  const world = wornWorld.value;
  const pocket = pocketFor(settings.value, world);
  const year = wornYear.value;
  const [seen, setSeen] = useState(year);
  useEffect(() => { setSeen(year); }, [year, open]);
  const at = seen ?? year;
  const inYear = pocket && at !== null
    ? [...pocket.chapters.filter(c => c.year === at).map(c => ({ id: `c:${c.id}`, kind: 'Chapter', title: c.title })), ...pocket.events.filter(e => e.year === at).map(e => ({ id: `e:${e.id}`, kind: 'Event', title: e.title }))]
    : [];
  return (
    <Sheet open={open && !!pocket && year !== null && !!world} onClose={() => { openSheet.value = null; }} title="The year">
      {pocket && year !== null && world && (
        <div class="wd-sheet">
          <Dial pocket={pocket} year={year} marks onMove={setSeen}
            onYear={y => void setWorldYear(world, y).then(loadSettings).catch(() => undefined)} />
          {inYear.map(m => <p key={m.id} class="fs-from wd-inyear"><small>{m.kind}</small> <span>{m.title}</span></p>)}
        </div>
      )}
    </Sheet>
  );
}
