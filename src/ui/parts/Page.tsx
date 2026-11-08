// Every writing surface is a page (DESIGN.md rule 5): the notebook header with "No." and "DATE:" in
// grey sans at the top right, the moon, Settings and the ♪ line at the top left, and ruled paper under the ink.
// The Journal's pages also carry the word Pages after the moon (v2): the list of entries and councils,
// not offered in Still. A question page carries the word Questions there instead (V2): the way back to
// its list, in place of Pages and Settings; its header right says where it sits among the open ones.
// Every page carries the pull (pull it down for the rail of earlier pages, V6) and, in Still, the kept line at its top.
import type { ComponentChildren, JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { usePull } from './Pull';
import { EarlierRail, readEarlier } from './Earlier';
import { StillTop } from './StillTop';
import { noteKeystroke } from '../still';
import { Moon } from './Moon';
import { openSheet } from '../sheets';
import { notebookDate } from '../date';
import { tick } from './Haptic';
import { MusicLine, type MusicPage } from '../music/MusicLine';

type Props = {
  /** The page's place in the sequence; hidden in Still (no counts). */
  no?: number;
  /** A printed label in place of the number ("Council", "Today"). */
  label?: string;
  date?: Date;
  /** The page being written, when there is one: the ♪ line keeps its album (package 7). Optional. */
  music?: MusicPage;
  /** The Journal's header word Pages (v2): shown on journal pages, marked current on the Pages screen. */
  pages?: 'link' | 'here';
  /** The way back from a section's page, in the place of Pages and Settings (V2: Questions on a question page). */
  back?: { word: string; href: string };
  /** A count in place of No. ("2 of 3 open" on a question page, V2); hidden in Still like No. */
  count?: string;
  /** The page open here, if it is one: the rail of earlier pages leaves it out (V6). */
  pageId?: string;
  children?: ComponentChildren;
};

export function PageHeader({ no, label, date = new Date(), music, pages, back, count }: Omit<Props, 'children'>) {
  return (
    <header class="fs-hdr">
      <div class="fs-hdr-l">
        <Moon />
        {pages && (
          <a class="fs-word fs-notstill" href="#/journal/pages" aria-current={pages === 'here' ? 'page' : undefined}>Pages</a>
        )}
        {back && <a class="fs-word" href={back.href}>{back.word}</a>}
        {/* the way back takes Settings' place as well (V2, as the proposal draws it), so "2 of 3 open" and the
            date keep one line on a 375pt phone; Settings is one tap away on every other page */}
        {!back && <button type="button" class="fs-word" onClick={() => { openSheet.value = 'settings'; tick('sheet'); }}>Settings</button>}
        <MusicLine page={music} />
      </div>
      <div class="fs-hdr-r">
        {no !== undefined && <span class="fs-count">No. <b>{no}</b></span>}
        {count && <span class="fs-count">{count}</span>}
        {label && <span>{label}</span>}
        <span>Date: <b>{notebookDate(date)}</b></span>
      </div>
    </header>
  );
}

/** A keystroke in a composer or on a journal page's column counts toward Still's twelve minutes (and nothing else does). */
const onInput = (e: JSX.TargetedEvent<HTMLElement>) => {
  const t = e.target as HTMLElement;
  if (t.tagName === 'TEXTAREA' && t.closest('.fs-composer, .fs-col')) noteKeystroke();
};

export function Page({ children, pageId, ...header }: Props) {
  const page = useRef<HTMLElement>(null);
  const rail = useRef<HTMLElement>(null);
  usePull(page, rail, () => { readEarlier(pageId).catch(() => undefined); });
  return (
    <section ref={page} class="fs-page" onInput={onInput}>
      <EarlierRail rail={rail} except={pageId} />
      <PageHeader {...header} />
      <StillTop />
      {children}
    </section>
  );
}

/** Ruled paper that scrolls, for pages that are read rather than typed on. */
export function Ruled({ children }: { children?: ComponentChildren }) {
  return <div class="fs-sheetof fs-rules">{children}</div>;
}
