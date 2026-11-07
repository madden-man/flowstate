// A journal page (PLAN.md section 5, item 1): the notebook header, a column of messages in order, and at
// the bottom the plain-ink composer with the chip row above it. The chip you tap speaks the next line.
// Autosave on every keystroke (debounced); the first keystroke of a day makes the page. Long press any
// line for its sheet. Today's page is the writing surface; an earlier entry is read back, with Revisit to
// add a later reading beneath it; a question page opens its answer frame, set in italic as the wiser
// second person.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { signal } from '@preact/signals';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Chip } from '../parts/Chip';
import { Echo } from '../parts/Echo';
import { useHold } from '../parts/Hold';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';
import { Redirect } from '../route';
import { openSheet } from '../sheets';
import { settings, saveSettings } from '../settings';
import { light } from '../light';
import { notebookDate } from '../date';
import { voiceColour } from '../voice';
import { Seg } from './Seg';
import { LineSheet } from './LineSheet';
import { hrefOf } from './href';
import {
  today, pageById, messagesOf, linksOf, writeLine, setKept, speakAs, turnToAnswer, linkPages, takeToCouncil,
  setMood, setEntryState, setTitle, keptLines, pickEcho, dayKey, chipVoices, voicesById, parseTags,
  MOODS, ENTRY_STATES, entryState, type Draft, type PageLink, type Kept, type LinkKind,
} from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Message, Page as PageRow, Voice } from '../../db/schema';

const SAVE_AFTER_MS = 300;
const uuid = () => crypto.randomUUID();

/** Set by Turn to answer: the question page opens with its answer frame ready. */
export const answerNext = signal<string | null>(null);


type Data = { page?: Read<PageRow>; messages: Read<Message>[]; no: number; links: PageLink[] };
type Voices = { chips: Read<Voice>[]; byId: Map<string, Read<Voice>> };

async function load(id?: string): Promise<Data | { to: string }> {
  const t = await today();
  if (!id || t.page?.id === id) {
    if (id) return { to: '/journal' };
    return { page: t.page, messages: t.page ? await messagesOf(t.page.id) : [], no: t.no, links: t.page ? await linksOf(t.page) : [] };
  }
  const r = await pageById(id);
  if (!r) return { to: '/journal' };
  if (r.page.kind === 'council') return { to: `/council/${id}` };
  return { page: r.page, messages: r.messages, no: r.no, links: await linksOf(r.page) };
}

/** Keeps the composer above the iOS keyboard: the app takes the visual viewport's height while it is up. */
function useKeyboardFit() {
  useEffect(() => {
    const vv = window.visualViewport;
    const app = document.querySelector<HTMLElement>('.fs-app');
    if (!vv || !app) return;
    const fit = () => {
      const up = window.innerHeight - vv.height > 120;
      app.style.height = up ? `${vv.height}px` : '';
      app.style.transform = up && vv.offsetTop ? `translateY(${vv.offsetTop}px)` : '';
      if (up) app.style.setProperty('--safe-bottom', '0px');
      else app.style.removeProperty('--safe-bottom');
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
      app.style.height = '';
      app.style.transform = '';
      app.style.removeProperty('--safe-bottom');
    };
  }, []);
}

function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/** Text with its #tags in print grey. */
function Inked({ text }: { text: string }) {
  if (!parseTags(text).length) return <>{text}</>;
  const parts = text.split(/(#[\p{L}\p{N}][\p{L}\p{N}_-]*)/u);
  return <>{parts.map((s, i) => (i % 2 ? <span key={i} class="fs-tagword">{s}</span> : s))}</>;
}

type LineProps = {
  m: Read<Message>; voice?: Read<Voice>; quoted?: Read<Message>; dated?: Date; held: boolean; editing: boolean;
  onHold: () => void; onTap?: () => void; onEdit: (text: string) => void; onEditEnd: () => void;
};

function LineView({ m, voice, quoted, dated, held, editing, onHold, onTap, onEdit, onEditEnd }: LineProps) {
  const hold = useHold(onHold, onTap);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing || !area.current) return;
    grow(area.current);
    area.current.focus({ preventScroll: true });
    const n = area.current.value.length;
    area.current.setSelectionRange(n, n);
  }, [editing]);
  const deep = voice?.shade === 'deep';
  const cls = `fs-msg${voice ? ` fs-v${deep ? ' deep' : ''}` : ''}${m.wise ? ' fs-wise' : ''}${held ? ' held' : ''}`;
  const style = voice ? ({ '--vc': voiceColour(voice.colour, voice.shade) } as JSX.CSSProperties) : undefined;
  return (
    <>
      {dated && <small class="fs-dated">{notebookDate(dated)}</small>}
      <div class={cls} style={style} data-line={m.id} {...(editing ? {} : hold)}>
        {voice && <span class="fs-sp">{voice.name}</span>}
        {quoted && <span class="fs-quote">{quoted.text}</span>}
        {m.kept && <small class="fs-kept">kept</small>}
        {editing ? (
          <textarea ref={area} class="fs-edit" aria-label="This line" defaultValue={m.text} spellcheck
            onInput={e => { grow(e.currentTarget); onEdit(e.currentTarget.value); }}
            onBlur={onEditEnd}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.currentTarget.blur(); } }} />
        ) : (
          <p><Inked text={m.text} /></p>
        )}
      </div>
    </>
  );
}

function TitleEdit({ page, onSave }: { page: Read<PageRow>; onSave: (title: string) => void }) {
  const area = useRef<HTMLTextAreaElement>(null);
  // the line height changes with the light (Still has more air), so the height is measured again
  useEffect(() => grow(area.current), [page.id, light.value]);
  return (
    <textarea ref={area} class="fs-edit fs-q" aria-label="Question" value={page.title ?? ''} spellcheck rows={1}
      onInput={e => { grow(e.currentTarget); onSave(e.currentTarget.value); }}
      onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.currentTarget.blur(); } }} />
  );
}

export function PageView({ id }: { id?: string }) {
  const isToday = !id;
  const { route } = useLocation();
  const still = light.value === 'still';
  const [data, setData] = useState<Data | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [vs, setVs] = useState<Voices>({ chips: [], byId: new Map() });
  const [draft, setDraft] = useState('');
  const [speaker, setSpeaker] = useState<string | undefined>();
  const [reply, setReply] = useState<Read<Message> | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [revisit, setRevisit] = useState(false);
  const [held, setHeld] = useState<Read<Message> | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const [saved, setSaved] = useState(true);
  const [echo, setEcho] = useState<Kept | null>(null);
  const draftId = useRef(uuid());
  const pageRef = useRef<Read<PageRow> | undefined>();
  const echoRef = useRef<Kept | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const jobs = useRef(new Map<string, () => Promise<void>>());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const composer = useRef<HTMLTextAreaElement>(null);
  const column = useRef<HTMLDivElement>(null);
  useKeyboardFit();
  useEffect(() => grow(composer.current), [light.value]);

  const page = data?.page;
  const kind = page?.kind ?? 'entry';
  const wise = kind === 'question' || (!isToday && revisit);
  const showComposer = isToday || kind === 'question' || revisit;
  const speakerVoice = speaker ? vs.byId.get(speaker) : undefined;
  const speaks = still && speakerVoice?.shade === 'deep' ? undefined : speakerVoice;

  // ---- reading ----
  const refresh = async (focus = false) => {
    const r = await load(id);
    if ('to' in r) { setTo(r.to); return; }
    pageRef.current = r.page;
    setData(r);
    if (isToday && !r.messages.some(m => m.text.trim())) await loadEcho(r.page?.id);
    else setEcho(null);
    if (focus || answerNext.peek() === r.page?.id) {
      answerNext.value = null;
      requestAnimationFrame(() => composer.current?.focus({ preventScroll: true }));
    }
  };

  const loadEcho = async (pageId?: string) => {
    const kept = await keptLines(pageId);
    const day = dayKey(Date.now());
    const pick = pickEcho(kept.map(k => ({ id: k.message.id, at: k.message.at })), settings.peek().echo, day);
    const prev = settings.peek().echo;
    if (JSON.stringify(prev) !== JSON.stringify(pick.state)) await saveSettings({ echo: pick.state });
    const k = kept.find(x => x.message.id === pick.state.id) ?? null;
    echoRef.current = k;
    setEcho(pick.id && !pick.state.linked ? k : null);
  };

  useEffect(() => {
    let live = true;
    Promise.all([chipVoices(), voicesById()]).then(([chips, byId]) => live && setVs({ chips, byId }));
    void refresh(isToday).then(() => {
      if (live && isToday) requestAnimationFrame(() => composer.current?.focus({ preventScroll: true }));
    });
    return () => { live = false; };
  }, [id]);

  // ---- writing: every keystroke queues the newest text for its line; one write at a time ----
  const flush = () => {
    clearTimeout(timer.current);
    const run = [...jobs.current.values()];
    jobs.current.clear();
    if (!run.length) return chain.current;
    chain.current = chain.current
      .then(async () => { for (const j of run) await j(); })
      .then(() => { if (!jobs.current.size) setSaved(true); })
      .catch(() => setSaved(false));
    return chain.current;
  };
  const queue = (key: string, job: () => Promise<void>) => {
    jobs.current.set(key, job);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_AFTER_MS);
  };
  const lineJob = (mid: string, d: Draft) => async () => {
    const e = settings.peek().echo;
    const linkTo = !pageRef.current && e?.linked && e.day === dayKey(Date.now()) ? echoRef.current?.page.id : undefined;
    const r = await writeLine(pageRef.current, mid, d, Date.now(), { linkTo });
    if (!r) return;
    const made = !pageRef.current;
    pageRef.current = r.page;
    const links = made && linkTo ? await linksOf(r.page) : undefined;
    setData(prev => (prev ? { ...prev, page: r.page, messages: r.messages, links: links ?? prev.links } : prev));
  };

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    document.addEventListener('visibilitychange', onHide);
    addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('pagehide', flush);
      void flush();
    };
  }, []);

  const draftOf = (text: string, voiceId = speaks?.id): Draft => ({ text, voiceId, replyTo: reply?.id, wise });
  const onCompose = (e: JSX.TargetedEvent<HTMLTextAreaElement>) => {
    const v = e.currentTarget.value;
    grow(e.currentTarget);
    setDraft(v);
    queue(draftId.current, lineJob(draftId.current, draftOf(v)));
  };
  const commit = () => {
    if (!draft.trim()) return;
    void flush();
    draftId.current = uuid();
    setDraft('');
    setReply(null);
    requestAnimationFrame(() => {
      grow(composer.current);
      column.current?.scrollTo({ top: column.current.scrollHeight });
    });
  };
  const pick = (voiceId: string | undefined) => {
    setSpeaker(voiceId);
    if (draft) queue(draftId.current, lineJob(draftId.current, draftOf(draft, voiceId)));
    composer.current?.focus({ preventScroll: true });
  };

  // ---- the long-press sheet ----
  const closeSheet = () => { if (openSheet.value === 'line') openSheet.value = null; };
  const withHeld = async (fn: (m: Read<Message>, p: Read<PageRow>) => Promise<void>) => {
    const m = held, p = pageRef.current;
    if (!m || !p) return;
    await flush();
    await fn(m, p);
  };
  const acts = {
    keep: () => withHeld(async m => {
      const next = await setKept(m, !m.kept);
      if (next.kept) { tick('keep'); bell('keep'); }
      setData(d => (d ? { ...d, messages: d.messages.map(x => (x.id === next.id ? next : x)) } : d));
      closeSheet();
    }),
    reply: () => withHeld(async m => {
      setReply(m);
      if (!showComposer) setRevisit(true);
      closeSheet();
      requestAnimationFrame(() => composer.current?.focus({ preventScroll: true }));
    }),
    speak: (voiceId: string | undefined) => withHeld(async m => {
      const next = await speakAs(m, voiceId);
      setData(d => (d ? { ...d, messages: d.messages.map(x => (x.id === next.id ? next : x)) } : d));
      closeSheet();
    }),
    turn: () => withHeld(async (m, p) => {
      const q = await turnToAnswer(p, m);
      closeSheet();
      if (isToday) { answerNext.value = q.id; route(`/journal/${q.id}`); }
      else await refresh(true);
    }),
    link: (other: Read<PageRow>, how: LinkKind) => withHeld(async (_m, p) => {
      const [np] = await linkPages(p, other, how);
      pageRef.current = np;
      const links = await linksOf(np);
      setData(d => (d ? { ...d, page: np, links } : d));
      closeSheet();
    }),
    council: () => withHeld(async (m, p) => {
      const c = await takeToCouncil(p, m);
      closeSheet();
      route(`/council/${c.id}`);
    }),
  };

  // ---- the echo ----
  const echoLink = async () => {
    const k = echoRef.current, e = settings.peek().echo;
    if (!k || !e) return;
    setEcho(null);
    await saveSettings({ echo: { ...e, linked: true } });
    const p = pageRef.current;
    if (p) {
      const [np] = await linkPages(p, k.page);
      pageRef.current = np;
      const links = await linksOf(np);
      setData(d => (d ? { ...d, page: np, links } : d));
    } else {
      // no page yet: the link waits for the first keystroke, and shows now
      setData(d => (d ? { ...d, links: [...d.links, { page: k.page, label: 'Related', line: k.message.text }] } : d));
    }
    composer.current?.focus({ preventScroll: true });
  };
  const echoDismiss = async () => {
    const e = settings.peek().echo;
    if (e) await saveSettings({ echo: { ...e, dismissed: true } });
    setTimeout(() => setEcho(null), 300);
  };

  if (to) return <Redirect to={to} />;

  const messages = (data?.messages ?? []).filter(m => m.id !== draftId.current && (m.text.trim() || m.id === editing));
  const shown = kind === 'question' ? messages.filter(m => m.wise || m.text.trim() !== page?.title?.trim()) : messages;
  const answered = messages.some(m => m.wise);
  const todayKey = dayKey(Date.now());
  const byId = new Map(messages.map(m => [m.id, m]));
  const date = page ? new Date(page.createdAt) : new Date();

  return (
    <Page no={data?.no} date={date} music={page ? {
      id: page.id, music: page.music,
      onMusic: music => { if (pageRef.current) pageRef.current = { ...pageRef.current, music }; setData(d => (d?.page ? { ...d, page: { ...d.page, music } } : d)); },
    } : undefined}>
      <Seg on={kind === 'question' ? 'questions' : isToday ? 'entries' : 'earlier'} />
      {page && (
        <div class="fs-meta">
          <button type="button" class="fs-word" aria-expanded={moodOpen} onClick={() => setMoodOpen(!moodOpen)}>
            {page.mood?.length ? page.mood.join(' · ') : 'Mood'}
          </button>
          {page.tags.map(t => <span key={t} class="fs-tagword">#{t}</span>)}
          <span class="fs-state">
            {kind === 'question'
              ? <span>{page.state}</span>
              : ENTRY_STATES.map(([name]) => (
                <button key={name} type="button" class="fs-word" aria-pressed={entryState(page.state) === name}
                  onClick={async () => { const np = await setEntryState(page, name); pageRef.current = np; setData(d => (d ? { ...d, page: np } : d)); }}>{name}</button>
              ))}
          </span>
        </div>
      )}
      {page && moodOpen && (
        <div class="fs-opts fs-moods" role="group" aria-label="Mood">
          {MOODS.map(w => {
            const on = !!page.mood?.includes(w);
            return (
              <button key={w} type="button" class="fs-opt" aria-pressed={on} onClick={async () => {
                const np = await setMood(page, on ? (page.mood ?? []).filter(x => x !== w) : [...(page.mood ?? []), w]);
                pageRef.current = np;
                setData(d => (d ? { ...d, page: np } : d));
              }}>{w}</button>
            );
          })}
        </div>
      )}
      {echo && !messages.length && (
        <Echo text={echo.message.text} date={new Date(echo.page.createdAt)} still={still} onLink={echoLink} onDismiss={echoDismiss} />
      )}
      <div ref={column} class="fs-sheetof fs-rules fs-col"
        onClick={e => { if (e.target === e.currentTarget && showComposer) composer.current?.focus({ preventScroll: true }); }}>
        {kind === 'question' && page && (
          <TitleEdit page={page} onSave={title => queue(`title:${page.id}`, async () => {
            const np = await setTitle(pageRef.current ?? page, title);
            pageRef.current = np;
          })} />
        )}
        {shown.map((m, i) => {
          const prevAt = i ? shown[i - 1].at : page?.createdAt ?? m.at;
          const dated = dayKey(m.at) !== dayKey(prevAt) ? new Date(m.at) : undefined;
          return (
            <LineView key={m.id} m={m} voice={m.voiceId ? vs.byId.get(m.voiceId) : undefined}
              quoted={m.replyTo ? byId.get(m.replyTo) : undefined} dated={dated}
              held={openSheet.value === 'line' && held?.id === m.id} editing={editing === m.id}
              onHold={() => { setHeld(m); openSheet.value = 'line'; tick('sheet'); }}
              onTap={dayKey(m.at) === todayKey ? () => setEditing(m.id) : undefined}
              onEdit={text => queue(m.id, lineJob(m.id, { text, voiceId: m.voiceId, replyTo: m.replyTo, wise: m.wise }))}
              onEditEnd={() => { void flush(); setEditing(null); }} />
          );
        })}
        {kind === 'question' && !answered && !draft && <p class="fs-quiet">[space to answer left]</p>}
        {!!data?.links.length && (
          <nav class="fs-links" aria-label="Linked pages">
            {data.links.map(l => (
              <a key={l.page.id} class="fs-link" href={hrefOf(l.page)}>
                <small>{l.label}</small>
                <span>{l.line || notebookDate(new Date(l.page.createdAt))}</span>
              </a>
            ))}
          </nav>
        )}
        {!isToday && kind === 'entry' && !revisit && page && (
          <button type="button" class="fs-word fs-col-act" onClick={() => {
            setRevisit(true);
            requestAnimationFrame(() => composer.current?.focus({ preventScroll: true }));
          }}>Revisit</button>
        )}
      </div>
      {showComposer && (
        <>
          <div class="fs-chips" role="group" aria-label="Who speaks next" onMouseDown={e => e.preventDefault()}>
            <Chip label="Ink" ariaLabel="Plain ink" pressed={!speaks} onPress={() => pick(undefined)} />
            {vs.chips.map(v => (
              <Chip key={v.id} label={v.name} colour={voiceColour(v.colour, v.shade)} deep={v.shade === 'deep'}
                pressed={speaks?.id === v.id} onPress={() => pick(v.id)} />
            ))}
          </div>
          <div class="fs-composer">
            {reply && (
              <button type="button" class="fs-replying" aria-label="Not a reply" onClick={() => setReply(null)}>
                <span class="fs-quote">{reply.text}</span>
              </button>
            )}
            <div class={speaks ? `fs-v${speaks.shade === 'deep' ? ' deep' : ''}` : undefined}
              style={speaks ? ({ '--vc': voiceColour(speaks.colour, speaks.shade) } as JSX.CSSProperties) : undefined}>
              {speaks && <span class="fs-sp">{speaks.name}</span>}
              <textarea ref={composer} class={`fs-compose${wise ? ' fs-wise' : ''}`} rows={1} spellcheck
                aria-label={isToday ? "Today's page" : kind === 'question' ? 'Answer' : 'A later reading'}
                value={draft} onInput={onCompose} onBlur={() => void flush()}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); commit(); } }}
                data-saved={saved && data ? 'true' : 'false'} disabled={!data} />
            </div>
          </div>
        </>
      )}
      <LineSheet held={held} page={page} voices={vs.chips} byId={vs.byId} acts={acts}
        onClose={() => { openSheet.value = null; }} />
    </Page>
  );
}
