import type { Page } from '../../db/schema';

/** Where a page opens: council pages on the Council tab, the rest in the Journal. */
export const hrefOf = (p: Pick<Page, 'id' | 'kind'>) => (p.kind === 'council' ? `#/council/${p.id}` : `#/journal/${p.id}`);
