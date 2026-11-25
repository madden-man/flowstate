// The shelf of notebooks (PLAN-WORLDS.md section 4): a cover for each notebook, across the top of the Flow tab. A cover
// is the notebook's name in the serif, one hue on its spine and plain paper in its hue (decision 16); the app never
// draws one. The one worn says "Open" in print; any other says what it is. In Still (rule 13) a cover is paper and seam,
// no hue (rule 40). A tap on the cover in front opens its Journal.
//
// WF builds the one cover, his own. The shelf takes a list so W1's worlds drop in beside it: W1 adds the sliding and
// settling, the lamp, the tick and the lean, and the sheet that dresses a cover. Nothing here moves by itself.
import type { JSX } from 'preact';
import { voiceColour } from '../voice';
import type { Notebook } from '../../model/notebooks';

/** One notebook's cover. */
export function Cover({ book, worn, front }: { book: Notebook; worn: boolean; front: boolean }) {
  const style = { '--wc': voiceColour(book.colour, 'light') } as JSX.CSSProperties;
  return (
    <a class="fl-cover" href="#/journal" data-book={book.id} data-front={front ? '' : undefined}
      aria-current={worn ? 'true' : undefined} style={style}>
      <span class="fl-cover-name">{book.name}</span>
      <small class="fl-cover-foot">{worn ? 'Open' : book.sub}</small>
    </a>
  );
}

/** The covers in a row, the one in front in the middle. */
export function Shelf({ books, worn, front }: { books: readonly Notebook[]; worn: string; front: string }) {
  return (
    <div class="fl-shelf" role="group" aria-label="Notebooks">
      {books.map(b => <Cover key={b.id} book={b} worn={b.id === worn} front={b.id === front} />)}
    </div>
  );
}
