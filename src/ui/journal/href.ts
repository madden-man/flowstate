import type { Page } from '../../db/schema';

/** Where a page opens: council pages on the Council tab, questions in their own section (the ? tab, V2),
 *  the rest in the Journal. */
export const hrefOf = (p: Pick<Page, 'id' | 'kind'>) =>
  p.kind === 'council' ? `#/council/${p.id}` : p.kind === 'question' ? `#/questions/${p.id}` : `#/journal/${p.id}`;
