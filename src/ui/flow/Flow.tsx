// Flow is the shelf (PLAN-WORLDS.md section 4, rule 40): a shelf of notebooks across the top (./Shelf.tsx), his own
// pages first and then each world in the registry, and under the cover in front what that notebook offers, on the
// page's rules: the last line written in it, in the quiet italic with its date; then its rows. His own pages: Meditate,
// Energize and Research as three drawn circles in a row, each opening its own page as it always has, and Right now,
// the door's page (PLAN-FLOWS.md 3.7), from which every flow is reached; the morning after a worry the What if ask
// (StampAsk, F6) stands at the foot. A novel: Research. Songbook: nothing yet (Songs is W6).
//
// When a cover settles in front, the lamp takes its hue by the council's own mix (--lamp-voice; none by day, none in
// Still) and one check tick sounds. A tap on the cover in front, or on one of its rows, puts that notebook on (wear):
// the soft bell, and its Journal (or the row tapped) is there, the cover's name travelling to the header's (rule 28)
// as the page turns (rule 29). Sliding only looks. A hold on a cover raises what it wears (./WearsSheet.tsx).
//
// Nothing here moves on its own (DESIGN.md rule 31). No counts anywhere (rule 15).
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import { Page } from '../parts/Page';
import { StampAsk } from './Stamps';
import { Shelf } from './Shelf';
import { dataVersion, openSheet } from '../sheets';
import { pocketVersion } from '../../model/carry';
import { gate } from '../lock/pin';
import { notebookDate } from '../date';
import { settings } from '../settings';
import { light } from '../light';
import { voiceColour } from '../voice';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';
import { wear, wornWorld } from '../notebook';
import { notebooks, coverId, OWN, type Notebook } from '../../model/notebooks';
import { FIXATION_FLOW } from '../../model/fixations';
import { shownOf, type Shown } from './looks';
import { shelfVersion, wearsFor } from './WearsSheet';
import { Dial } from '../world/Dial';
import { loadSettings } from '../settings';
import { aliveIn, pocketFor, setWorldYear, waitingIn } from '../../model/story';
import type { NovelPocket } from '../../bridge/protocol';
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
const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

/** Puts a notebook on and goes to one of its pages: the soft bell, the notebook worn, and the page; the cover's name
 *  travels to the header (ui/turns.ts, fl-world). Already worn, it only goes. */
async function openInto(book: Notebook, href: string) {
  bell('keep');
  if (wornWorld.peek() !== book.world) {
    await wear(book.world);
    // the shelf is drawn again for the notebook now worn before the page turns from it
    await nextFrame();
  }
  document.querySelector(`.fl-cover[data-book="${CSS.escape(book.id)}"]`)?.setAttribute('data-opening', '');
  location.hash = href;
}

/** A row under a cover: a link to its page that, for a notebook not worn, puts it on first. */
function Into({ book, href, class: cls, children, ...rest }: { book: Notebook; href: string; class: string; children: ComponentChildren } & JSX.HTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...rest} class={cls} href={href} onClick={e => {
      if (wornWorld.peek() === book.world) return;
      e.preventDefault();
      void openInto(book, href);
    }}>{children}</a>
  );
}

/** Meditate, Energize and Research, drawn in ink: a circle each, Energize's with a rise through it, Research's split
 *  down the middle into its two sides. */
function Circles() {
  return (
    <nav class="fl-circles" aria-label="Meditate, Energize and Research">
      {CIRCLES.map(c => (
        <Into key={c.name} book={OWN} class="fl-circle" href={c.href}>
          <svg viewBox="-20 -20 40 40" aria-hidden="true" focusable="false" data-travel={c.named ? undefined : c.travel}>
            <circle r={R} />
            {c.mark === 'arc' && <path d="M-9 4 C-4.5 3.5 -3.5 -6 0 -6 C3.5 -6 4.5 3.5 9 4" />}
            {c.mark === 'split' && <path d={`M0 ${-R} V${R}`} />}
          </svg>
          <span class="fl-circle-name" data-travel={c.named ? c.travel : undefined}>{c.name}</span>
        </Into>
      ))}
    </nav>
  );
}

/** What stands under a cover: its rows, by what kind of notebook it is. */
function Rows({ book, worn }: { book: Notebook; worn: boolean }) {
  if (book.kind === 'own') return (
    <>
      <Circles />
      {/* Right now (F5): his own step lines across every flow, the door's page */}
      <Into book={book} class="fs-row fs-list-row fl-flow" href="#/flow/now">
        <span class="fs-list-line">Right now</span>
        <small class="fs-list-meta">Your lines; tap the one that fits</small>
      </Into>
      {worn && <StampAsk />}
    </>
  );
  if (book.kind === 'novel') return (
    <Into book={book} class="fs-row fs-list-row fl-flow" href="#/flow/research">
      <span class="fs-list-line">Research</span>
      <small class="fs-list-meta">A question, and the papers on both sides</small>
    </Into>
  );
  return null;
}

/** Under a novel's cover (W4): who is alive in the year on its dial and how old, in print, on one rule; then the one
 *  open question from the bible, "Waiting", a tap on which puts the world on and opens it. */
function Story({ book, pocket, year, waiting }: { book: Notebook; pocket: NovelPocket; year?: number; waiting?: { id: string; question: string } }) {
  const ages = year === undefined ? [] : aliveIn(pocket, year);
  return (
    <>
      <p class="wd-ages" data-year={year}>{ages.map(a => `${a.name} ${a.age}`).join(' · ')}</p>
      {waiting && (
        <p class="fs-from wd-waiting"><small>Waiting</small> <Into book={book} class="wd-wait" href={`#/questions/${waiting.id}`}>{waiting.question}</Into></p>
      )}
    </>
  );
}

export function Flow() {
  const books = notebooks(settings.value.worlds ?? []);
  const worn = coverId(wornWorld.value);
  const [front, setFront] = useState(worn);
  const book = books.find(b => b.id === front) ?? OWN;
  // what each notebook shows (its cover, its last line), read again when the notebook opens or locks, as every page
  // is, and when a cover is dressed; undefined while reading
  const [shown, setShown] = useState<Record<string, Shown> | undefined>(undefined);
  const locked = gate.value;
  const ids = books.map(b => b.id).join(' ');
  useEffect(() => {
    let on = true;
    void Promise.all(books.map(async b => [b.id, await shownOf(b).catch((): Shown => ({ looks: null, last: null }))] as const))
      .then(rows => { if (on) setShown(Object.fromEntries(rows)); });
    return () => { on = false; };
  }, [dataVersion.value, locked, shelfVersion.value, ids, pocketVersion.value]);

  // the lamp takes the cover in front's hue, by the council's own mix (nothing by day: --lamp-mix is 0%); none in Still
  const lampColour = light.value === 'still' ? null : voiceColour(book.colour, 'light');
  useEffect(() => {
    const app = document.querySelector<HTMLElement>('.fs-app');
    if (!app) return;
    if (lampColour) { app.dataset.lamp = ''; app.style.setProperty('--lamp-voice', lampColour); }
    else { delete app.dataset.lamp; app.style.removeProperty('--lamp-voice'); }
    return () => { delete app.dataset.lamp; app.style.removeProperty('--lamp-voice'); };
  }, [lampColour]);

  // a novel's pocket (the bible's lives, chapters and questions), kept on home's row for the world it was fetched for
  const pocketOf = (b: Notebook) => (b.kind === 'novel' ? pocketFor(settings.value, b.world) : undefined);
  // the year on each novel's dial while a finger moves it, before it is written
  const [moving, setMoving] = useState<Record<string, number>>({});
  const yearOf = (b: Notebook) => moving[b.id] ?? shown?.[b.id]?.year;
  const dials = Object.fromEntries(books.map(b => {
    // the dial stands on the year written; the finger's year (moving) is the ages' alone
    const p = pocketOf(b), y = shown?.[b.id]?.year;
    if (!p || y === undefined || !b.world) return [b.id, undefined];
    const world = b.world;
    return [b.id, <Dial pocket={p} year={y} onMove={v => setMoving(m => ({ ...m, [b.id]: v }))}
      onYear={v => void setWorldYear(world, v)
        .then(async () => { if (wornWorld.peek() === world) await loadSettings(); shelfVersion.value++; })
        .catch(() => undefined)} />];
  }));
  // the waiting question under the cover in front, read from that world's notebook
  const pocket = pocketOf(book);
  const [waiting, setWaiting] = useState<{ id: string; question: string } | undefined>(undefined);
  useEffect(() => {
    let on = true;
    setWaiting(undefined);
    if (pocket && book.world) void waitingIn(book.world, pocket).then(w => { if (on) setWaiting(w); }).catch(() => undefined);
    return () => { on = false; };
  }, [book.id, pocket, dataVersion.value, locked]);
  // once written, the year read back stands, and the finger's is let go
  useEffect(() => { setMoving({}); }, [shown]);

  const here = shown?.[book.id];
  const last = here?.last;
  const looks = Object.fromEntries(books.map(b => [b.id, shown?.[b.id]?.looks ?? undefined]));

  return (
    <Page label="Flow" drawn={shown !== undefined}>
      <Shelf books={books} worn={worn} front={front} looks={looks} dials={dials}
        onSettle={id => { setFront(id); tick('check'); }}
        onOpen={b => void openInto(b, '#/journal')}
        onHold={b => { wearsFor.value = b; openSheet.value = 'wears'; tick('sheet'); }} />
      <div class="fs-sheetof fs-rules fs-flows fl-under" data-for={book.id} key={book.id}>
        {/* the last line written in this notebook, holding its rule from first paint so nothing under it moves */}
        {pocket && <Story book={book} pocket={pocket} year={yearOf(book)} waiting={waiting} />}
        <p class="fs-quiet fl-lastline" data-read={shown === undefined ? undefined : ''}>
          {last && <><small>{notebookDate(new Date(last.at))}</small> {last.text}</>}
        </p>
        <Rows book={book} worn={book.id === worn} />
      </div>
    </Page>
  );
}
