// The rail of earlier pages (V6, PLAN-V3.md section 4): what hangs above a page as it is pulled down. The
// last six entries and councils, newest first, the open page left out, in the rows of the Pages screen
// (date in print grey, who spoke on a council, the first line in serif), and All pages as the last row.
// Drawn in the current light: pulling a page never changes the light. Never shown in Still.
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import { earlierPages, voicesById, type Paged } from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Voice } from '../../db/schema';
import { dataVersion } from '../sheets';
import { notebookDate } from '../date';
import { hrefOf } from '../journal/href';
import { SpokeRules } from './SpokeRules';

/** The rail is open: let go past the line, it stays until a row tap, a tap on the page, a pull up or a tab change. */
export const earlierOpen = signal(false);

type Rows = { except?: string; list: Paged[]; byId: Map<string, Read<Voice>> };
const rows = signal<Rows>({ list: [], byId: new Map() });
let reading = 0;

/** Reads the rail's rows (as a pull arms, and again when the data changes underneath). */
export async function readEarlier(except?: string): Promise<void> {
  const n = ++reading;
  const [list, byId] = await Promise.all([earlierPages(except), voicesById()]);
  if (n === reading) rows.value = { except, list, byId };
}

export function EarlierRail({ rail, except }: { rail: RefObject<HTMLElement>; except?: string }) {
  // an import bumps dataVersion: the rows are read again (the first run reads them for this page)
  const v = dataVersion.value;
  useEffect(() => { readEarlier(except).catch(() => undefined); }, [v, except]);
  const open = earlierOpen.value;
  const { list, byId } = rows.value.except === except ? rows.value : { list: [], byId: new Map() };
  return (
    <nav ref={rail} class="fs-earlier fs-rules" aria-label="Earlier pages" aria-hidden={open ? undefined : 'true'} inert={!open}>
      {list.map(x => (
        <a key={x.page.id} href={hrefOf(x.page)} class="fs-list-row">
          <span class="fs-list-meta">
            {notebookDate(new Date(x.page.createdAt))}
            {x.page.kind === 'council' && <> · council <SpokeRules ids={x.spoke} byId={byId} /></>}
          </span>
          <span class="fs-list-line">{x.line}</span>
        </a>
      ))}
      <a href="#/journal/pages" class="fs-list-row fs-earlier-all">All pages</a>
    </nav>
  );
}
