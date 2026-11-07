// Search (PLAN.md section 4: in memory over the opened rows): one field; pages whose title or any line
// contains the text, newest first. Tap one to open it.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { openSheet } from '../sheets';
import { notebookDate } from '../date';
import { searchPages, type Listed } from '../../model/pages';
import { hrefOf } from './href';

export function SearchSheet() {
  const open = openSheet.value === 'search';
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Listed[]>([]);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
  }, [open]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => searchPages(q).then(r => live && setFound(r)), 120);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  return (
    <Sheet open={open} onClose={() => { openSheet.value = null; }} title="Search">
      <input ref={field} class="fs-input" type="text" aria-label="Search the pages" value={q} enterKeyHint="search"
        onInput={e => setQ(e.currentTarget.value)} />
      <div class="fs-rows fs-found">
        {found.map(x => (
          <a key={x.page.id} class="fs-row stack fs-list-row" href={hrefOf(x.page)}>
            <span class="fs-list-meta">{notebookDate(new Date(x.page.createdAt))}{x.page.kind === 'question' ? ' · question' : x.page.kind === 'council' ? ' · council' : ''}</span>
            <span class="fs-list-line">{x.line}</span>
            {x.match && <span class="fs-list-line fs-quiet">{x.match}</span>}
          </a>
        ))}
      </div>
    </Sheet>
  );
}
