// Research (PLAN-RESEARCH.md section 2, Q4): a question, and the papers on both sides. The sea's third circle, a page
// of its own (not a flow with steps), built as a council between two voices: + speaks in the light blue, − in its deep
// twin, and every line either speaks is a paper's own title.
//
//   #/flow/research               the blank page: the question at the title size, the caret ready, Ask under the thumb
//                                 and, once, in print, "This question leaves the phone." With no key saved it says
//                                 where the key goes, and the act under the thumb is Settings: nothing is sent.
//   #/flow/research/asked         Asked: every earlier question, date over line, newest first (no count, rule 15)
//   #/flow/research/:id           a question: its lines in found order, written in as they are filed (rule 27); the
//                                 chips + and − under the page, their dots breathing while their side looks (rule 31);
//                                 after the run the chips filter by side, and Ask again keeps the old lines struck
//   #/flow/research/:id/:paper    a paper's page: the abstract word for word as a journal page, and its three words
//
// Every word here is his question, a paper's own title, abstract, journal, year and kind, or the fixed print below
// (rule 36): no summary, verdict, score or count; a side with nothing says so and is not padded; a lower source is
// marked by its kind in the print line. The run itself lives in src/research/run.ts, so it goes on through a turn to a
// paper's page. Still (rule 13): the question and the titles, no wash and no hue, the dots still, nothing begun or
// stopped. The door never lets Research through (model/door.ts).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Strike } from '../parts/Strike';
import { Redirect } from '../route';
import { tick } from '../parts/Haptic';
import { bell, wakeBells } from '../parts/Sound';
import { light } from '../light';
import { notebookDate } from '../date';
import { openSheet } from '../sheets';
import { settings } from '../settings';
import { tokenMs } from '../turns';
import { useWakeLock } from './breath';
import { PaperPrint, SIGN, TitleLink, sideColour, sideStyle } from './PaperLine';
import { getInquiry, getPapers, listInquiries, researchKey, researchVersion } from '../../research/store';
import { ask, askAgain, liftEarlier, linesOfPicks, live, startRun, stopRun, type Line } from '../../research/run';
import type { Inquiry, Paper, RunResult, Side } from '../../research/types';
import type { ResearchKey } from '../../db/schema';
import { paperToCouncil, writeAboutPaper } from '../../model/into';
import './research.css';

/** The app's fixed print on Research (rule 36): the only words here that are not his or a paper's. */
export const PRINT = {
  leaves: 'This question leaves the phone.',
  key: 'The key goes in',
  offlineAsk: 'No connection. Nothing was sent.',
  noSides: 'Ask it so yes and no are the sides.',
  refused: 'This one could not be looked up.',
  looking: 'Looking',
  none: (s: Side) => `Nothing found for ${SIGN[s]}.`,
  why: {
    offline: 'The connection went. What was found is kept, and it goes on from there.',
    key: 'The key in Settings was not taken.',
    limit: 'The key is at its limit for now. What was found is kept.',
    ended: 'Stopped. What was found is kept.',
    error: 'Something went wrong. What was found is kept.',
  } satisfies Record<NonNullable<RunResult['why']>, string>,
  trouble: {
    offline: 'The paper indexes could not be reached.',
    limit: 'The paper indexes asked to wait.',
    http: 'The paper indexes did not answer.',
  },
} as const;

const SIDES: Side[] = ['for', 'against'];
const isStill = () => light.value === 'still';
const keyOf = (l: Pick<Line, 'paperId' | 'seq'>) => `${l.paperId}:${l.seq}`;
/** Where a line's paper opens. A paper's id holds ":" and "/", so it rides as one part. */
export const paperHref = (id: string, paperId: string) => `#/flow/research/${id}/${encodeURIComponent(paperId)}`;
const openSettings = () => { openSheet.value = 'settings'; tick('sheet'); };

/** The key Research asks with, read again when Settings saves (undefined: none saved, or locked; null: still reading). */
function useKey(): ResearchKey | undefined | null {
  const [k, setK] = useState<ResearchKey | undefined | null>(null);
  useEffect(() => {
    let on = true;
    researchKey().then(x => { if (on) setK(x); }).catch(() => { if (on) setK(undefined); });
    return () => { on = false; };
  }, [settings.value, researchVersion.value]);
  return k;
}

function header(extra: { here?: 'asked' } = {}) {
  return {
    label: 'Research', travel: 'rs-name', back: { word: 'Flow', href: '#/flow' },
    also: { word: 'Asked', href: '#/flow/research/asked', here: extra.here === 'asked' },
  };
}

// ---------------------------------------------------------------- the blank page

export function ResearchAsk() {
  const { route } = useLocation();
  const key = useKey();
  const [text, setText] = useState('');
  const [offline, setOffline] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const still = isStill();
  useEffect(() => { area.current?.focus({ preventScroll: true }); }, []);
  // the field grows with the question, a rule at a time
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = 'auto';
    a.style.height = `${a.scrollHeight}px`;
  }, [text, light.value]);
  const go = async () => {
    const q = text.trim();
    if (!q || !key || still) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setOffline(true); return; }
    // the soft bell at the run's end rings outside a tap: its context is woken inside this one
    wakeBells();
    const inquiry = await ask(q);
    route(`/flow/research/${inquiry.id}`);
  };
  const noKey = key === undefined;
  return (
    <Page {...header()} drawn={key !== null}>
      <div class="fs-council rs-page" data-research="ask">
        <div class="fs-chat fs-rules">
          <textarea ref={area} class="rs-q" rows={1} aria-label="Question" value={text} enterkeyhint="go" spellcheck
            onInput={e => { setText(e.currentTarget.value); setOffline(false); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void go(); } }} />
          {noKey
            ? <span class="rs-print" data-print="key">{PRINT.key} <button type="button" class="fs-word" onClick={openSettings}>Settings</button>.</span>
            : offline ? <span class="rs-print" data-print="offline">{PRINT.offlineAsk}</span>
            : key && <span class="rs-print" data-print="leaves">{PRINT.leaves}</span>}
        </div>
        {key !== null && !still && (
          <div class="fs-composer-wrap">
            {noKey
              ? <button type="button" class="fs-new" onClick={openSettings}>Settings</button>
              : <button type="button" class="fs-new" disabled={!text.trim()} onClick={() => void go()}>Ask</button>}
          </div>
        )}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------- Asked

export function ResearchAsked() {
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  useEffect(() => {
    let on = true;
    listInquiries().then(r => { if (on) setRows(r); }).catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [researchVersion.value]);
  return (
    <Page label="Asked" back={{ word: 'Research', href: '#/flow/research' }} drawn={rows !== null}>
      <div class="fs-sheetof fs-rules rs-asked">
        {rows?.map(q => (
          <a key={q.id} class="fs-row fs-list-row" href={`#/flow/research/${q.id}`}>
            <small class="fs-list-meta">{notebookDate(new Date(q.askedAt))}</small>
            <span class="fs-list-line">{q.question}</span>
          </a>
        ))}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------- a question

type Shown = { inquiry: Inquiry; lines: Line[]; earlier: { askedAt: number; lines: Line[] }[] };

async function readQuestion(id: string): Promise<Shown | 'missing'> {
  const inquiry = await getInquiry(id);
  if (!inquiry) return 'missing';
  const [lines, earlier] = await Promise.all([
    linesOfPicks(inquiry.picks),
    Promise.all((inquiry.earlier ?? []).map(async e => ({ askedAt: e.askedAt, lines: await linesOfPicks(e.picks) }))),
  ]);
  return { inquiry, lines, earlier };
}

/** One paper as a council line: its print, its title (a link out), and Abstract; a tap anywhere but the title opens
 *  the paper's page. */
function PaperRow({ id, line, fresh, lifting, hush, struck }: { id: string; line: Line; fresh?: boolean; lifting?: boolean; hush?: boolean; struck?: boolean }) {
  const { route } = useLocation();
  const href = paperHref(id, line.paperId);
  const title = <TitleLink paper={line.paper} title={line.paper.title} />;
  return (
    <div class={`fs-msg fs-v rs-line${line.side === 'against' ? ' deep' : ''}${hush ? ' rs-hush' : ''}${fresh ? ' rs-in' : ''}${lifting ? ' rs-lifting' : ''}`}
      style={sideStyle(line.side)} data-paper-id={line.paperId} data-side={line.side} data-tier={line.tier}
      onClick={e => { if (!(e.target as HTMLElement).closest('a')) route(href.slice(1)); }}>
      <PaperPrint side={line.side} paper={line.paper} />
      <p>{struck ? <Strike>{title}</Strike> : title}</p>
      {!struck && <a class="rs-print rs-abs" href={href}>Abstract</a>}
    </div>
  );
}

export function ResearchInquiry({ id }: { id: string }) {
  const [shown, setShown] = useState<Shown | 'missing' | null>(null);
  const [filter, setFilter] = useState<Side | null>(null);
  const key = useKey();
  const still = isStill();
  const run = live.value[id];
  const root = useRef<HTMLDivElement>(null);
  const chat = useRef<HTMLDivElement>(null);

  const load = () => readQuestion(id).then(setShown).catch(() => setShown('missing'));
  useEffect(() => { void load(); }, [id, researchVersion.value]);

  const inquiry = shown && shown !== 'missing' ? shown.inquiry : undefined;
  const state = run?.state ?? inquiry?.state;
  const on = !!run?.on;
  const lines = run ? run.lines : shown && shown !== 'missing' ? shown.lines : [];
  const why = run ? run.why : inquiry?.why;

  // begin the run, or pick it up where it stopped (resume), once per opening, when it can go: a key, a connection
  const tried = useRef(false);
  useEffect(() => {
    if (!inquiry || tried.current || inquiry.state !== 'running' || still) return;
    if (run && (run.on || run.state !== 'running')) return;
    if (!key || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    tried.current = true;
    void getInquiry(id).then(q => { if (q) void startRun(q); });
  }, [inquiry, key, run?.on, still]);
  // the page seen again (the phone unlocked): a run cut short goes on
  useEffect(() => {
    const seen = () => { if (document.visibilityState === 'visible' && !live.peek()[id]?.on) { tried.current = false; void load(); } };
    document.addEventListener('visibilitychange', seen);
    addEventListener('online', seen);
    return () => { document.removeEventListener('visibilitychange', seen); removeEventListener('online', seen); };
  }, [id]);
  // the screen stays lit while the run is on, as a sit does
  useWakeLock(on);

  // what was there when the page opened is drawn as it is; what lands after is written in (rule 27)
  const first = useRef<Set<string> | null>(null);
  if (first.current === null && shown) first.current = new Set(lines.map(keyOf));
  const firstLifted = useRef<Set<string> | null>(null);
  if (firstLifted.current === null && shown) firstLifted.current = new Set(lines.filter(l => l.lifted).map(keyOf));
  // a line the check lifts goes over --t-ui, then is drawn no more
  const [gone, setGone] = useState<Set<string>>(new Set());
  const lifted = lines.filter(l => l.lifted).map(keyOf).filter(k => !gone.has(k) && !firstLifted.current?.has(k)).join(',');
  useEffect(() => {
    if (!lifted) return;
    const t = setTimeout(() => setGone(g => new Set([...g, ...lifted.split(',')])), tokenMs('--t-ui'));
    return () => clearTimeout(t);
  }, [lifted]);

  // one tick as a title lands (rule 19, the check site), and the soft bell when the run ends (rule 21)
  const standing = lines.filter(l => !l.lifted);
  const count = useRef<number | null>(null);
  useEffect(() => {
    if (on && count.current !== null && standing.length > count.current) tick('check');
    count.current = standing.length;
  }, [standing.length]);
  const wasOn = useRef(false);
  useEffect(() => {
    if (wasOn.current && run && !run.on && run.state === 'done') bell('found');
    wasOn.current = on;
  }, [on]);

  // the newest line stays in view while they land
  useLayoutEffect(() => { const c = chat.current; if (c && on) c.scrollTop = c.scrollHeight; }, [standing.length, on]);

  // the lamp takes the last speaker's colour, as a council's does (nothing by day)
  const last = standing[standing.length - 1];
  const lamp = last ? sideColour(last.side) : null;
  useEffect(() => {
    const app = root.current?.closest('.fs-app') as HTMLElement | null;
    if (!app) return;
    if (lamp) { app.dataset.lamp = ''; app.style.setProperty('--lamp-voice', lamp); }
    else { delete app.dataset.lamp; app.style.removeProperty('--lamp-voice'); }
    return () => { delete app.dataset.lamp; app.style.removeProperty('--lamp-voice'); };
  }, [lamp]);

  if (shown === 'missing') return <Redirect to="/flow/research" />;
  const done = state === 'done';
  const ended = !!state && state !== 'running';
  const noKey = state === 'running' && !on && key === undefined;
  const cut = state === 'running' && !on && why === 'offline';
  const hushed = (s: Side) => !!filter && filter !== s;
  const fixed = state === 'no-sides' ? PRINT.noSides
    : state === 'refused' ? PRINT.refused
    : state === 'stopped' && why ? PRINT.why[why]
    : cut ? PRINT.why.offline
    : ended && !standing.length && run?.trouble ? PRINT.trouble[run.trouble]
    : null;
  const goOn = () => { tried.current = true; void getInquiry(id).then(q => { if (q) void startRun(q); }); };
  const again = async () => { wakeBells(); setFilter(null); tried.current = false; await askAgain(id); await load(); };

  return (
    <Page {...header()} date={inquiry ? new Date(inquiry.askedAt) : undefined} drawn={shown !== null}>
      <div ref={root} class="fs-council rs-page" data-research="question" data-state={state} data-on={on ? '' : undefined}
        data-checking={run?.checking ? '' : undefined}>
        <div ref={chat} class="fs-chat fs-rules">
          {inquiry && <p class="rs-q">{inquiry.question}</p>}
          {shown && shown.earlier.map((e, i) => (
            <div key={`e${i}`} class="rs-earlier fs-notstill" data-earlier={i}>
              {e.lines.map(l => <PaperRow key={keyOf(l)} id={id} line={l} struck />)}
              <span class="rs-print">{notebookDate(new Date(e.askedAt))} <button type="button" class="fs-word" onClick={() => void liftEarlier(id, i)}>Lift</button></span>
            </div>
          ))}
          {lines.map(l => {
            const k = keyOf(l);
            if (l.lifted && (gone.has(k) || firstLifted.current?.has(k))) return null;
            return <PaperRow key={k} id={id} line={l} fresh={!first.current?.has(k)} lifting={l.lifted} hush={hushed(l.side)} />;
          })}
          {done && SIDES.filter(s => !standing.some(l => l.side === s)).map(s => (
            <p key={s} class={`fs-quiet${hushed(s) ? ' rs-hush' : ''}`} data-none={s}>{PRINT.none(s)}</p>
          ))}
          {on && !still && <p class="fs-quiet" data-print="looking">{PRINT.looking}</p>}
          {noKey && <span class="rs-print" data-print="key">{PRINT.key} <button type="button" class="fs-word" onClick={openSettings}>Settings</button>.</span>}
          {fixed && <span class="rs-print" data-print="why">{fixed}</span>}
        </div>
        {inquiry && (
          <div class="fs-composer-wrap">
            <div class="fs-chips" role="group" aria-label="Sides">
              {SIDES.map(s => (
                <button key={s} type="button" class="fs-chip rs-side" data-side={s} style={sideStyle(s)}
                  aria-label={s === 'for' ? 'For' : 'Against'} aria-pressed={filter === s}
                  data-looking={run?.looking[s] && !still ? '' : undefined}
                  onClick={() => { if (!on) setFilter(f => (f === s ? null : s)); }}><i />{SIGN[s]}</button>
              ))}
              {!still && on && <button type="button" class="fs-word" onClick={() => stopRun(id)}>Stop</button>}
              {!still && cut && <button type="button" class="fs-word" onClick={goOn}>Go on</button>}
              {!still && ended && <button type="button" class="fs-word" onClick={() => void again()}>Ask again</button>}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------- a paper's page

type PaperShown = { inquiry: Inquiry; paper: Paper; side: Side };

export function ResearchPaper({ id, paper: paperId }: { id: string; paper: string }) {
  const { route } = useLocation();
  const [shown, setShown] = useState<PaperShown | 'missing' | null>(null);
  const run = live.value[id];
  useEffect(() => {
    let on = true;
    void (async () => {
      const [inquiry, [paper]] = await Promise.all([getInquiry(id), getPapers([paperId])]);
      if (!inquiry || !paper) { if (on) setShown('missing'); return; }
      // the side it stands on in this question: as the run has it now, else as kept, else as it was asked before
      const picks = [...(live.peek()[id]?.lines.filter(l => !l.lifted) ?? []), ...inquiry.picks, ...(inquiry.earlier ?? []).flatMap(e => e.picks)];
      const side = picks.find(p => p.paperId === paperId)?.side ?? 'for';
      if (on) setShown({ inquiry, paper, side });
    })().catch(() => { if (on) setShown('missing'); });
    return () => { on = false; };
  }, [id, paperId, run?.lines.length]);
  if (shown === 'missing') return <Redirect to={`/flow/research/${id}`} />;
  const p = shown?.paper;
  const write = async () => {
    if (!shown) return;
    await writeAboutPaper(id, shown.paper, shown.side);
    route('/journal');
  };
  const council = async () => {
    if (!shown) return;
    const r = await paperToCouncil(id, shown.inquiry.question, shown.paper, shown.side);
    route(`/council/${r.page.id}`);
  };
  return (
    <Page label="Paper" back={{ word: 'Research', href: `#/flow/research/${id}` }} drawn={shown !== null}>
      {shown && p && (
        <>
          <div class="fs-sheetof fs-rules rs-paper" style={sideStyle(shown.side)} data-research="paper" data-paper-id={p.id} data-side={shown.side}>
            <p class="rs-q"><TitleLink paper={p} title={p.title} /></p>
            <PaperPrint side={shown.side} paper={p} />
            <p class="fs-line" />
            {p.abstract.map((s, i) => (
              <div key={i} class="rs-section">
                {s.head && <span class="rs-print">{s.head}</span>}
                <p>{s.text}</p>
              </div>
            ))}
          </div>
          <div class="fs-composer-wrap rs-words">
            <a class="fs-word" href={p.url} target="_blank" rel="noopener noreferrer">Open the paper</a>
            <button type="button" class="fs-word" onClick={() => void write()}>Write about it</button>
            <button type="button" class="fs-word" onClick={() => void council()}>To Council</button>
          </div>
        </>
      )}
    </Page>
  );
}
