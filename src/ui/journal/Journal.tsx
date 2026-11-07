// Journal (PLAN.md section 5, item 1; v2). Today's dated page opens with the caret on its first rule; the
// header word Pages lists the entries and councils by month, with search on the first rule; #/journal/:id
// opens any page to read and write on. The Questions list stays at #/journal/questions (the ? tab, V2).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Page, Ruled } from '../parts/Page';
import { SpokeRules } from '../parts/SpokeRules';
import { notebookDate } from '../date';
import { PageView } from './PageView';
import { hrefOf } from './href';
import { questions, askQuestion, pagesList, searchPages, voicesById, type Paged } from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Page as PageRow, Voice } from '../../db/schema';

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
    <Page label="Questions" pages="link">
      <Ruled>
        <div class="fs-pagelist">
          {list?.map(p => (
            <a key={p.id} href={`#/journal/${p.id}`} class="fs-qrow">
              <span class="fs-qtitle">{p.title}</span>
              {p.state !== 'open' && <small class="fs-list-meta"><span class="fs-state">{p.state}</span></small>}
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

const monthOf = (t: number, now: Date) => {
  const d = new Date(t);
  const name = d.toLocaleDateString('en-US', { month: 'long' });
  return d.getFullYear() === now.getFullYear() ? name : `${name} ${d.getFullYear()}`;
};

/** #/journal/pages: entries and councils by month, newest first; search on the first rule, in memory.
 *  Not offered in Still (the header word and the list step out). */
export function JournalPages() {
  const [list, setList] = useState<Paged[] | null>(null);
  const [byId, setById] = useState<Map<string, Read<Voice>>>(new Map());
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Map<string, string | undefined> | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([pagesList(), voicesById()]).then(([l, v]) => { if (live) { setList(l); setById(v); } });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!q.trim()) { setFound(null); return; }
    let live = true;
    const t = setTimeout(() => searchPages(q).then(r => live && setFound(new Map(r.map(x => [x.page.id, x.match])))), 120);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  const now = new Date();
  const rows = (list ?? []).filter(x => !found || found.has(x.page.id));
  let month = '';
  return (
    <Page label="Pages" pages="here">
      <Ruled>
        <div class="fs-pagelist">
          <input class="fs-search" type="search" aria-label="Search the pages" placeholder="Search…" value={q} enterKeyHint="search"
            onInput={e => setQ(e.currentTarget.value)} />
          {rows.flatMap(x => {
            const m = monthOf(x.page.createdAt, now);
            const head = m !== month ? (month = m) : null;
            const match = found?.get(x.page.id);
            return [
              head && <p key={`m-${m}`} class="fs-month">{head}</p>,
              <a key={x.page.id} href={hrefOf(x.page)} class="fs-list-row">
                <span class="fs-list-meta">
                  {notebookDate(new Date(x.page.createdAt))}
                  {x.page.kind === 'council' && <> · council <SpokeRules ids={x.spoke} byId={byId} /></>}
                  {x.page.tags.map(t => <span key={t} class="fs-tagword"> #{t}</span>)}
                </span>
                <span class="fs-list-line">{x.line}</span>
                {match && <span class="fs-list-line fs-quiet">{match}</span>}
              </a>,
            ];
          })}
        </div>
      </Ruled>
    </Page>
  );
}
