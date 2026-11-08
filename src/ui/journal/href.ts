import type { Page } from '../../db/schema';

/** Where a page opens: council pages on the Council tab, questions in their own section (the ? tab, V2),
 *  the rest in the Journal. */
export const hrefOf = (p: Pick<Page, 'id' | 'kind'>) =>
  p.kind === 'council' ? `#/council/${p.id}` : p.kind === 'question' ? `#/questions/${p.id}` : `#/journal/${p.id}`;

/** A fresh page today (V12; V15 moved its + into the Pages list, under the newest entry): each + is its own
 *  address, so a second + opens a second fresh page. Nothing is made until its first word. */
export const startAnother = () => { location.hash = `/journal/new/${Date.now().toString(36)}`; };
