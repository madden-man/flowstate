// Journal (PLAN.md section 5, item 1). Today's dated page opens with the caret ready; Questions and the
// Earlier list sit beside it in the segment row; #/journal/:id reads any page back.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Page, Ruled } from '../parts/Page';
import { notebookDate } from '../date';
import { Seg } from './Seg';
import { PageView } from './PageView';
import { hrefOf } from './href';
import { questions, entries, askQuestion, entryState, type Listed } from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Page as PageRow } from '../../db/schema';

export function JournalToday() {
  return <PageView />;
}

/** #/journal/:id, a page read back. Today's entry redirects to #/journal; a council page to its tab. */
export function JournalPage({ id }: { id: string }) {
  return <PageView key={id} id={id} />;
}

export function Questions() {
  const [list, setList] = useState<Read<PageRow>[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [q, setQ] = useState('');
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { questions().then(setList); }, []);
  useEffect(() => { if (asking) field.current?.focus(); }, [asking]);
  const ask = async () => {
    if (!q.trim()) { setAsking(false); return; }
    await askQuestion(q);
    setQ('');
    setList(await questions());
  };
  return (
    <Page>
      <Seg on="questions" />
      <Ruled>
        <div class="fs-pagelist">
          {list?.map(p => (
            <a key={p.id} href={`#/journal/${p.id}`} class="fs-qrow">
              <span class="fs-qtitle">{p.title}</span>
              {p.state === 'open'
                ? <span class="fs-quiet">[space to answer left]</span>
                : <small class="fs-list-meta"><span class="fs-state">{p.state}</span></small>}
            </a>
          ))}
        </div>
      </Ruled>
      <div class="fs-ask">
        {asking ? (
          <input ref={field} class="fs-input" aria-label="A question" value={q} enterKeyHint="done"
            onInput={e => setQ(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void ask(); } if (e.key === 'Escape') setAsking(false); }}
            onBlur={() => { if (!q.trim()) setAsking(false); }} />
        ) : (
          <button type="button" class="fs-word" onClick={() => setAsking(true)}>Ask a question</button>
        )}
      </div>
    </Page>
  );
}

/** #/journal/earlier: the entries, newest first, with date, mood and tags. Hidden in Still. */
export function Earlier() {
  const [list, setList] = useState<Listed[] | null>(null);
  useEffect(() => { entries().then(setList); }, []);
  return (
    <Page>
      <Seg on="earlier" />
      <Ruled>
        <div class="fs-pagelist">
          {list?.map(x => (
            <a key={x.page.id} href={hrefOf(x.page)} class="fs-list-row">
              <span class="fs-list-meta">
                {notebookDate(new Date(x.page.createdAt))}
                {x.page.mood?.length ? ` · ${x.page.mood.join(' · ')}` : ''}
                {x.page.tags.map(t => <span key={t} class="fs-tagword"> #{t}</span>)}
                <span class="fs-state"> · {entryState(x.page.state)}</span>
              </span>
              <span class="fs-list-line">{x.line}</span>
            </a>
          ))}
        </div>
      </Ruled>
    </Page>
  );
}
