// Questions, a section of their own (v2, V2; PLAN-V2.md section 3 steps 6 and 7), reached by the ? mark in
// the bar. #/questions is the list: open questions first as serif titles with the date asked, then a small
// Answered label and the answered ones in print grey, the date asked and the date answered on the meta
// line; New question at the bottom. No state words. In Still the list keeps the open questions only (the
// Answered label and rows step out, as counts and states do). #/questions/:id is a question page: the
// journal's own editor (PageView) under the title, with Previous and Next walking the open questions.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Page, Ruled } from '../parts/Page';
import { notebookDate } from '../date';
import { PageView } from '../journal/PageView';
import { questions, askQuestion } from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Page as PageRow } from '../../db/schema';

const day = (t: number) => notebookDate(new Date(t));

export function Questions() {
  const [list, setList] = useState<Read<PageRow>[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [q, setQ] = useState('');
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    questions().then(l => live && setList(l));
    return () => { live = false; };
  }, []);
  useEffect(() => { if (asking) field.current?.focus(); }, [asking]);
  const ask = async () => {
    if (!q.trim()) { setAsking(false); return; }
    await askQuestion(q);
    setQ('');
    setList(await questions());
  };
  const open = (list ?? []).filter(p => p.state === 'open');
  const answered = (list ?? []).filter(p => p.state !== 'open');
  return (
    <Page label="Questions">
      <Ruled>
        <div class="fs-qlist">
          {open.map(p => (
            <a key={p.id} href={`#/questions/${p.id}`} class="fs-list-row fs-qrow">
              <span class="fs-list-meta">{day(p.createdAt)}</span>
              <span class="fs-list-line">{p.title}</span>
            </a>
          ))}
          {answered.length > 0 && (
            <div class="fs-notstill" aria-label="Answered" role="group">
              <p class="fs-month fs-answered">Answered</p>
              {answered.map(p => (
                <a key={p.id} href={`#/questions/${p.id}`} class="fs-list-row fs-qrow done">
                  <span class="fs-list-meta">{day(p.createdAt)}{p.answeredAt !== undefined && <> · {day(p.answeredAt)}</>}</span>
                  <span class="fs-list-line">{p.title}</span>
                </a>
              ))}
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
