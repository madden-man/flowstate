// Journal (package 0 placeholder): today's dated page is already open, the caret on the rules.
// Typing autosaves to today's entry; there is no save button (DESIGN.md rule 6). Package 1 adds
// speakers, states, Turn to answer and the rest.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Page, Ruled } from '../parts/Page';
import { Redirect } from '../route';
import { today, writeToday, pageById, questions, voices, type Today as TodayState } from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Message, Page as PageRow, Voice } from '../../db/schema';
import { voiceColour } from '../voice';
import type { JSX } from 'preact';

const SAVE_AFTER_MS = 300;

function Seg() {
  const { path } = useLocation();
  const q = path === '/journal/questions';
  return (
    <nav class="fs-seg" aria-label="Journal">
      <a href="#/journal" aria-current={!q ? 'page' : undefined}>Entries</a>
      <a href="#/journal/questions" aria-current={q ? 'page' : undefined}>Questions</a>
    </nav>
  );
}

export function JournalToday() {
  const [state, setState] = useState<TodayState | null>(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(true);
  const current = useRef<TodayState | null>(null);
  const pending = useRef<string | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    today().then(t => {
      if (!live) return;
      current.current = t;
      setState(t);
      setText(t.message?.text ?? '');
      // the caret is ready on the page (DESIGN.md rule 6); iOS shows the keyboard on the first tap
      requestAnimationFrame(() => area.current?.focus({ preventScroll: true }));
    });
    return () => { live = false; };
  }, []);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current === null || !current.current) return chain.current;
    const value = pending.current;
    pending.current = null;
    chain.current = chain.current
      .then(async () => {
        current.current = await writeToday(current.current!, value);
      })
      .then(() => { if (pending.current === null) setSaved(true); })
      .catch(() => { pending.current = pending.current ?? value; });
    return chain.current;
  };

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('pagehide', flush);
      void flush();
    };
  }, []);

  const onInput = (e: JSX.TargetedEvent<HTMLTextAreaElement>) => {
    const v = e.currentTarget.value;
    setText(v);
    setSaved(false);
    pending.current = v;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_AFTER_MS);
  };

  return (
    <Page no={state?.no}>
      <Seg />
      <textarea
        ref={area}
        class="fs-write fs-rules"
        aria-label="Today's page"
        value={text}
        onInput={onInput}
        onBlur={() => void flush()}
        spellcheck
        data-saved={saved && state ? 'true' : 'false'}
        disabled={!state}
      />
    </Page>
  );
}

function Line({ m, voice }: { m: Read<Message>; voice?: Read<Voice> }) {
  if (!voice) return <p>{m.text}</p>;
  const style = { '--vc': voiceColour(voice.colour, voice.shade) } as JSX.CSSProperties;
  return (
    <div class={`fs-v${voice.shade === 'deep' ? ' deep' : ''}`} style={style}>
      <span class="fs-sp">{voice.name}</span>
      <p>{m.text}</p>
    </div>
  );
}

/** #/journal/:id, a page read back. Today's page opens as the writing surface instead. */
export function JournalPage({ id }: { id: string }) {
  const [data, setData] = useState<{ page: Read<PageRow>; messages: Read<Message>[]; no: number; voices: Read<Voice>[]; isToday: boolean } | null | 'missing'>(null);
  useEffect(() => {
    let live = true;
    Promise.all([pageById(id), voices(), today()]).then(([p, vs, t]) => {
      if (!live) return;
      setData(p ? { ...p, voices: vs, isToday: t.page?.id === id } : 'missing');
    });
    return () => { live = false; };
  }, [id]);
  if (data === 'missing') return <Redirect to="/journal" />;
  if (data?.isToday) return <Redirect to="/journal" />;
  return (
    <Page no={data?.no} date={data ? new Date(data.page.createdAt) : undefined}>
      <Seg />
      <Ruled>
        {data?.page.title && <p class="fs-q">{data.page.title}</p>}
        {data?.messages.map(m => <Line key={m.id} m={m} voice={data.voices.find(v => v.id === m.voiceId)} />)}
      </Ruled>
    </Page>
  );
}

export function Questions() {
  const [list, setList] = useState<Read<PageRow>[] | null>(null);
  useEffect(() => { questions().then(setList); }, []);
  return (
    <Page>
      <Seg />
      <Ruled>
        {list && !list.length && <p class="fs-quiet">[space to answer left]</p>}
        {list?.map(q => (
          <p key={q.id}><a href={`#/journal/${q.id}`} class="fs-q">{q.title}</a></p>
        ))}
      </Ruled>
    </Page>
  );
}
