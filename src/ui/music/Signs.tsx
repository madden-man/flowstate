// The ♪ sheet's Signs segment (PLAN-TASKS.md section 4, T5): seven rows, summit to foot, each the sign's name on its
// hue (a voice's 3px rule, rule 9) and that sign's shelf (flow/chakra/SignShelf.tsx) beside it, small. A tap on a cover
// plays it; a tap on the name opens that sign's page and the sheet goes down. Still: the names in print's grey, no hue.
import { CHAKRAS } from '../../model/mountain';
import { Shelf } from '../flow/chakra/SignShelf';
import { openSheet } from '../sheets';

export function Signs() {
  return (
    <nav class="fs-music-screen ck-signs" aria-label="Signs">
      {CHAKRAS.map(c => (
        <div key={c.id} class="ck-sign-row" style={{ '--h': c.hue }} data-sign={c.id}>
          <a class="ck-sign-name" href={`#/flow/c/${c.id}`} onClick={() => { openSheet.value = null; }}>{c.name}</a>
          <Shelf chakra={c.id} small />
        </div>
      ))}
    </nav>
  );
}
