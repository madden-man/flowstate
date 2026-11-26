// What a page or a kept line is about, in a novel world (PLAN-WORLDS.md section 4, W4): the bible's characters and
// places as chips, and the page's year. Under a journal page, where the council keeps its voice chips, three kinds:
// Character, Place and Year, filled from the bible's lists. They are optional (names in the text are found anyway), so
// the row shows what is chosen and one "+" for each kind still empty; a tap on any of them raises the sheet that changes
// them. A kept line carries chips of its own, shown and changed on its sheet (LineSheet.tsx).
import { Chip } from '../parts/Chip';
import { Sheet } from '../parts/Sheet';
import { Dial } from './Dial';
import { openSheet } from '../sheets';
import { tick } from '../parts/Haptic';
import { voiceColour } from '../voice';
import { hueOf } from '../../bridge/colour';
import type { NovelPocket, PocketCharacter } from '../../bridge/protocol';
import type { Chips } from '../../model/story';
import type { Page } from '../../db/schema';

const colourOf = (c: PocketCharacter) => voiceColour({ hue: hueOf(c.familyColour) }, 'light');
const none: Chips = { characterIds: [], placeIds: [] };

/** Every character and place in the bible's lists, each a chip pressed when chosen. */
export function StoryChips({ pocket, chips, onToggle }: { pocket: NovelPocket; chips?: Chips; onToggle: (kind: 'character' | 'place', id: string) => void }) {
  const c = chips ?? none;
  return (
    <div class="wd-picker">
      {!!pocket.characters.length && (
        <>
          <p class="fs-month">Characters</p>
          <div class="fs-chips" role="group" aria-label="Characters">
            {pocket.characters.map(ch => (
              <Chip key={ch.id} label={ch.fullName} colour={colourOf(ch)} pressed={c.characterIds.includes(ch.id)} onPress={() => onToggle('character', ch.id)} />
            ))}
          </div>
        </>
      )}
      {!!pocket.places.length && (
        <>
          <p class="fs-month">Places</p>
          <div class="fs-chips" role="group" aria-label="Places">
            {pocket.places.map(pl => (
              <Chip key={pl.id} label={pl.name} pressed={c.placeIds.includes(pl.id)} onPress={() => onToggle('place', pl.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const raise = () => { openSheet.value = 'about'; tick('sheet'); };

/** The row under a journal page in a novel: the chosen characters in their colours, the chosen places, the page's year,
 *  and "+ character" or "+ place" for a kind still empty. Any tap raises the sheet. Gone in Still. */
export function PageChips({ pocket, page }: { pocket: NovelPocket; page: Pick<Page, 'chips' | 'year'> }) {
  const c = page.chips ?? none;
  const chars = c.characterIds.map(id => pocket.characters.find(x => x.id === id)).filter((x): x is PocketCharacter => !!x);
  const places = c.placeIds.map(id => pocket.places.find(x => x.id === id)).filter(x => !!x);
  return (
    <div class="fs-composer-wrap wd-pagechips fs-notstill">
      <div class="fs-chips" role="group" aria-label="What this page is about">
        {chars.map(ch => <Chip key={ch.id} label={ch.fullName} colour={colourOf(ch)} pressed onPress={raise} />)}
        {places.map(pl => <Chip key={pl!.id} label={pl!.name} pressed onPress={raise} />)}
        {typeof page.year === 'number'
          ? <Chip label={String(page.year)} ariaLabel={`Year ${page.year}`} pressed onPress={raise} />
          : <Chip label="+ year" add onPress={raise} />}
        {!chars.length && <Chip label="+ character" add onPress={raise} />}
        {!places.length && <Chip label="+ place" add onPress={raise} />}
      </div>
    </div>
  );
}

/** The sheet the row raises: every character and place to tick, and this page's own year on the dial (the Year chip
 *  changes this page alone, never the year worn). */
export function AboutSheet({ pocket, page, worn, onToggle, onYear }: {
  pocket: NovelPocket | undefined; page: Pick<Page, 'chips' | 'year'> | undefined;
  /** the year worn, where the dial stands for a page that has none yet */
  worn?: number | null;
  onToggle: (kind: 'character' | 'place', id: string) => void; onYear: (year: number) => void;
}) {
  const open = openSheet.value === 'about' && !!pocket && !!page;
  const year = typeof page?.year === 'number' ? page.year : worn ?? undefined;
  return (
    <Sheet open={open} onClose={() => { openSheet.value = null; }} title="This page is about">
      {pocket && page && (
        <>
          <StoryChips pocket={pocket} chips={page.chips} onToggle={onToggle} />
          {year !== undefined && (
            <div class="wd-sheet">
              <p class="fs-month">Year</p>
              <Dial pocket={pocket} year={year} onYear={onYear} />
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
