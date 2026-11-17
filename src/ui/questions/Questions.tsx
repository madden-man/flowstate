// Questions, a section of their own (v2, V2; PLAN-V2.md section 3 steps 6 and 7), reached by the ? mark in
// the bar. #/questions is the list: open questions first as serif titles with the date asked, then a small
// Resolved label and the resolved ones in print grey, the date asked and the date resolved on the meta
// line (one date when both fall on the same day); New question at the bottom. No state words, nothing counted.
// Every row carries parts/Resolve at the right of its date (PLAN-BLOCKERS.md K1, section 3 step 12): the word on an
// open one, the check on a resolved one, a tap either way. A row stays where it stood when the list came up until
// the list is left, so a check is drawn where the thumb was and nothing jumps away under it. In Still the list
// keeps the open questions only (the Resolved label and rows, and Resolve, step out, as counts and states do).
// #/questions/:id is a question page: the journal's own editor (PageView) under the title, with Previous and Next
// walking the open questions.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Page, Ruled } from '../parts/Page';
import { Resolve } from '../parts/Resolve';
import { notebookDate } from '../date';
import { PageView } from '../journal/PageView';
import { questions, askQuestion, resolveQuestion } from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Page as PageRow } from '../../db/schema';

const day = (t: number) => notebookDate(new Date(t));

/** The meta line: the day asked, and for a resolved one the day resolved, printed once when it is the same day. */
export function askedAndResolved(p: Pick<PageRow, 'createdAt' | 'state' | 'answeredAt'>): string {
  const asked = day(p.createdAt);
  if (p.state === 'open' || p.answeredAt === undefined) return asked;
  const resolved = day(p.answeredAt);
  return resolved === asked ? asked : `${asked} · ${resolved}`;
}

export function Questions() {
  const [list, setList] = useState<Read<PageRow>[] | null>(null);
  // the ids that were open when the list was read: where each row stands until the list is read again
  const [openAt, setOpenAt] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState(false);
  const [q, setQ] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const read = (l: Read<PageRow>[]) => { setList(l); setOpenAt(new Set(l.filter(p => p.state === 'open').map(p => p.id))); };
  useEffect(() => {
    let live = true;
    questions().then(l => live && read(l));
    return () => { live = false; };
  }, []);
  useEffect(() => { if (asking) field.current?.focus(); }, [asking]);
  const ask = async () => {
    if (!q.trim()) { setAsking(false); return; }
    await askQuestion(q);
    setQ('');
    read(await questions());
  };
  const resolve = async (p: Read<PageRow>, on: boolean) => {
    const np = await resolveQuestion(p.id, on);
    if (np) setList(l => (l ? l.map(x => (x.id === np.id ? np : x)) : l));
  };
  const row = (p: Read<PageRow>) => {
    const done = p.state !== 'open';
    return (
      <div key={p.id} class={`fs-qitem${done ? ' fs-notstill' : ''}`}>
        <a href={`#/questions/${p.id}`} class={`fs-list-row fs-qrow${done ? ' done' : ''}`}>
          <span class="fs-list-meta">{askedAndResolved(p)}</span>
          <span class="fs-list-line">{p.title}</span>
        </a>
        <Resolve on={done} onChange={on => void resolve(p, on)} />
      </div>
    );
  };
  const open = (list ?? []).filter(p => openAt.has(p.id));
  const resolved = (list ?? []).filter(p => !openAt.has(p.id));
  return (
    <Page label="Questions" drawn={list !== null}>
      <Ruled>
        <div class="fs-qlist">
          {open.map(row)}
          {resolved.length > 0 && (
            <div class="fs-notstill" aria-label="Resolved" role="group">
              <p class="fs-month fs-answered">Resolved</p>
              {resolved.map(row)}
            </div>
          )}
        </div>
      </Ruled>
      <div class="fs-ask">
        {asking ? (
          <input ref={field} class="fs-input" aria-label="A question" value={q} enterKeyHint="done"
            onInput={e => setQ(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void ask(); } if (e.key === 'Escape') setAsking(false); }}
            onBlur={() => { if (!q.trim()) setAsking(false); }} />
        ) : (
          <button type="button" class="fs-word" onClick={() => setAsking(true)}>New question</button>
        )}
      </div>
    </Page>
  );
}

/** #/questions/:id: the question page. A page that is not a question goes where it lives. */
export function QuestionPage({ id }: { id: string }) {
  return <PageView key={id} id={id} section="questions" />;
}
