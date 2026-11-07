// The Journal's segment row: Entries (today's page), Questions, Earlier (the entries list), and Search at
// the right. In Still only today's page is left: the lists and search step out (DESIGN.md rule 13).
import { openSheet } from '../sheets';
import { tick } from '../parts/Haptic';
import { SearchSheet } from './SearchSheet';

export type SegOn = 'entries' | 'questions' | 'earlier' | null;

export function Seg({ on }: { on: SegOn }) {
  const cur = (k: SegOn) => (on === k ? 'page' : undefined);
  return (
    <>
      <nav class="fs-seg" aria-label="Journal">
        <a href="#/journal" aria-current={cur('entries')}>Entries</a>
        <a href="#/journal/questions" class="fs-notstill" aria-current={cur('questions')}>Questions</a>
        <a href="#/journal/earlier" class="fs-notstill" aria-current={cur('earlier')}>Earlier</a>
        <button type="button" class="fs-seg-end fs-notstill" onClick={() => { openSheet.value = 'search'; tick('sheet'); }}>Search</button>
      </nav>
      <SearchSheet />
    </>
  );
}
