// A journal page (PLAN.md section 5, item 1; v2): the page column is the editor. Under the notebook header
// the page is a column of paragraphs (blocks), each one `messages` row. Tap any paragraph to write in it;
// the next rule at the bottom is always ready. Return makes the next paragraph, Shift+Return breaks a
// line inside one. Every keystroke autosaves, debounced per block; the first keystroke of a day makes the
// page. A margin dot marks the block you are on: tap it and the chips step out for that block only (Ink,
// the starred voices, more), then step back; the next Return is ink again. Long press any other paragraph
// for its sheet (five things). An earlier page is written on the same way, and a block written on a later
// day carries the date it was written.
// A question page (#/questions/:id, V2) is this same editor under the question's title: writing is plain
// ink, the long-press sheet offers "This answers it" in Ask this's place, the header says where it sits
// among the open questions, and Previous and Next (or a horizontal swipe on the page) walk them.
// PLAN-VALUES.md C4: the current line, when a voice speaks it, has "Spoke for" step out under it (parts/SpokeFor), as
// the dot's chips do; a tap confirms the line for a value after it was written, and never takes the caret.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Chip } from '../parts/Chip';
import { Echo } from '../parts/Echo';
import { useHold } from '../parts/Hold';
import { useKeyboardFit } from '../parts/Keyboard';
import { Speaker } from '../parts/Speaker';
import { SpokeFor, SpokeForSheet, valueList, reloadValues, spokeLabel } from '../parts/SpokeFor';
import { voiceLabel } from '../../model/council';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';
import { Redirect } from '../route';
import { openSheet } from '../sheets';
import { settings, saveSettings } from '../settings';
import { light } from '../light';
import { notebookDate } from '../date';
import { voiceColour } from '../voice';
import { LineSheet, SpeakSheet } from './LineSheet';
import { hrefOf } from './href';
import { JournalLink } from '../flow/JournalLink';
import { PaperLine, ResearchFrom } from '../flow/PaperLine';
import { pageCarry, type PageCarry } from '../flow/chakra/carry';
import {
  today, entryCount, pageById, messagesOf, linksOf, writeLine, setKept, speakAs, askThis, answerWith, linkPages, takeToCouncil,
  setTitle, keptLines, pickEcho, dayKey, chipVoices, voicesById, parseTags, walkOf,
  type Draft, type PageLink, type Kept, type LinkKind, type LinkLabel, type Walk,
} from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Message, Page as PageRow, Voice } from '../../db/schema';

const SAVE_AFTER_MS = 300;
const uuid = (): string => crypto.randomUUID();

type Data = { page?: Read<PageRow>; messages: Read<Message>[]; no?: number; links: PageLink[]; walk?: Walk };
/** The section a page was opened in: the Journal, or Questions (#/questions/:id, V2). */
type Section = 'journal' | 'questions';
type Voices = { chips: Read<Voice>[]; byId: Map<string, Read<Voice>> };

async function load(id: string | undefined, section: Section, fresh = false): Promise<Data | { to: string }> {
  // V12: a fresh page today (the header's +) is nobody's yet; its first word makes the next entry
  if (fresh) return { page: undefined, messages: [], no: (await entryCount()) + 1, links: [] };
  const t = await today();
  if (!id || t.page?.id === id) {
    if (id) return { to: '/journal' };
    return { page: t.page, messages: t.page ? await messagesOf(t.page.id) : [], no: t.no, links: t.page ? await linksOf(t.page) : [] };
  }
  const r = await pageById(id);
  if (!r) return { to: section === 'questions' ? '/questions' : '/journal' };
  // every page opens in its own section: a council on its tab, a question under the ? (V2)
  const home = hrefOf(r.page).slice(1);
  if ((r.page.kind === 'question') !== (section === 'questions') || r.page.kind === 'council') return { to: home };
  const walk = r.page.kind === 'question' ? await walkOf(id) : undefined;
  return { page: r.page, messages: r.messages, no: r.no, links: await linksOf(r.page), walk };
}

const SWIPE_SLOP_PX = 12;
const SWIPE_PX = 60;

/** A horizontal swipe on a question page walks the open questions (V2). Touch and pen only, so a mouse
 *  selecting text never turns the page; once a drag reads as vertical it is left to the scroll (the column
 *  is touch-action: pan-y). Nothing moves under the finger, so there is no motion to reduce. */
function useSwipe(walk: Walk | undefined, go: (id: string) => void) {
  const s = useRef<{ x: number; y: number; id: number; dir?: 'x' | 'y' } | null>(null);
  if (!walk) return {};
  return {
    onPointerDown: (e: PointerEvent) => {
      s.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerMove: (e: PointerEvent) => {
      const d = s.current;
      if (!d || d.id !== e.pointerId || d.dir) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) > SWIPE_SLOP_PX) d.dir = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'x' : 'y';
    },
    onPointerUp: (e: PointerEvent) => {
      const d = s.current;
      s.current = null;
      if (!d || d.id !== e.pointerId || d.dir !== 'x') return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? walk.next : walk.prev);
    },
    onPointerCancel: () => { s.current = null; },
  };
}

/** The block being written stays in sight: scrolled to within the column, above the keyboard. */
function keepInView() {
  const a = document.activeElement;
  if (a instanceof HTMLElement && a.closest('.fs-col') && !a.classList.contains('fs-proxy')) a.scrollIntoView({ block: 'nearest' });
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

type CaretDoc = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/** Where a tap landed in a paragraph's text, so the caret goes there and not to the end. */
function offsetAt(el: Element | null, x: number, y: number): number | undefined {
  if (!el) return undefined;
  const d = document as CaretDoc;
  let node: Node | undefined, off = 0;
  const pos = d.caretPositionFromPoint?.(x, y);
  if (pos) { node = pos.offsetNode; off = pos.offset; }
  else {
    const r = d.caretRangeFromPoint?.(x, y);
    if (r) { node = r.startContainer; off = r.startOffset; }
  }
  if (!node || !el.contains(node)) return undefined;
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n = 0;
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    if (t === node) return n + off;
    n += t.textContent?.length ?? 0;
  }
  return undefined;
}

/** How a link reads at the bottom of the page. A question asked from here says where it lives. */
const linkWords = (l: LinkLabel) => (l === 'Asked' ? 'Asked · Questions' : l);

/** One block on the column, in render order: a saved message, or a block not written yet (the next rule,
 *  or one opened by Return between two others) with the place it will take. */
type Block = { id: string; m?: Read<Message>; at: number };

type BlockProps = {
  b: Block; text: string; voice?: Read<Voice>; quoted?: Read<Message>; dated?: Date; cur: boolean; edit: boolean; label: string;
  held: boolean; wise?: boolean; chips?: JSX.Element; forRow?: JSX.Element; dotOpen: boolean; saved: boolean;
  area: (el: HTMLTextAreaElement | null) => void;
  onHold: () => void; onTap: (offset: number | undefined) => void; onDot: () => void;
  onInput: (text: string) => void; onKeyDown: (e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void; onBlur: (to: EventTarget | null) => void;
};

function BlockView({ b, text, voice, quoted, dated, cur, edit, label, held, wise, chips, forRow, dotOpen, saved, area, onHold, onTap, onDot, onInput, onKeyDown, onFocus, onBlur }: BlockProps) {
  const hold = useHold(onHold, e => onTap(offsetAt((e.currentTarget as HTMLElement).querySelector('p'), e.clientX, e.clientY)));
  const own = useRef<HTMLTextAreaElement | null>(null);
  // the line height changes with the light (Still has more air), so the height is measured again
  useLayoutEffect(() => grow(own.current), [edit, light.value]);
  const m = b.m;
  const deep = voice?.shade === 'deep';
  const cls = `fs-msg${voice ? ` fs-v${deep ? ' deep' : ''}` : ''}${m?.wise || wise ? ' fs-wise' : ''}${held ? ' held' : ''}${cur ? ' cur' : ''}`;
  const style = voice ? ({ '--vc': voiceColour(voice.colour, voice.shade) } as JSX.CSSProperties) : undefined;
  return (
    <div class="fs-block">
      {dated && <small class="fs-dated">{notebookDate(dated)}</small>}
      {chips}
      <div class={cls} style={style} data-line={b.id} {...(edit ? {} : hold)}>
        {cur && (
          <button type="button" class="fs-dot" aria-label="Who speaks this line" aria-expanded={dotOpen}
            onMouseDown={e => e.preventDefault()} onPointerDown={e => e.preventDefault()} onClick={onDot} />
        )}
        {voice && <Speaker v={voice} spoke={m ? spokeLabel(m, valueList.value) : undefined} />}
        {quoted && <span class="fs-quote">{quoted.text}</span>}
        {m?.kept && <small class="fs-kept">kept</small>}
        {edit ? (
          <textarea ref={el => { own.current = el; area(el); }} class="fs-edit" aria-label={label} defaultValue={text} spellcheck rows={1}
            data-saved={saved ? 'true' : 'false'}
            onInput={e => { grow(e.currentTarget); onInput(e.currentTarget.value); }}
            onKeyDown={onKeyDown} onFocus={onFocus} onBlur={e => onBlur(e.relatedTarget)} />
        ) : (
          <p><Inked text={text} /></p>
        )}
      </div>
      {forRow}
    </div>
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

export function PageView({ id, section = 'journal', fresh = false }: { id?: string; section?: Section; fresh?: boolean }) {
  const isToday = !id;
  const { route } = useLocation();
  const still = light.value === 'still';
  const [data, setData] = useState<Data | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [vs, setVs] = useState<Voices>({ chips: [], byId: new Map() });
  const [tailId, setTailId] = useState(uuid);
  const [cur, setCurState] = useState<string | null>(null);
  const [inserts, setInserts] = useState<{ id: string; at: number }[]>([]);
  const [voiceOf, setVoiceOf] = useState<Record<string, string | undefined>>({});
  const [dotFor, setDotFor] = useState<string | null>(null);
  // C4: the line a tap made current (not one reached by Return or the next rule), which offers "Spoke for"
  const [tapped, setTapped] = useState<string | null>(null);
  const [held, setHeld] = useState<Read<Message> | null>(null);
  const [echo, setEcho] = useState<Kept | null>(null);
  const [saved, setSaved] = useState(true);
  // PLAN-TASKS.md T3: what a sign's touch carried to today's page, taken once (flow/chakra/carry.ts): Letter's "Dear" on
  // the next rule (unsaved until he writes), or Ask's answer rule, open in italic as the wiser second person (rule 17)
  const [carry] = useState<PageCarry | null>(() => {
    const c = isToday && !fresh ? pageCarry.peek() : null;
    if (c) pageCarry.value = null;
    return c;
  });
  const [wiseId, setWiseId] = useState<string | null>(null);
  const pageRef = useRef<Read<PageRow> | undefined>();
  const echoRef = useRef<Kept | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const jobs = useRef(new Map<string, () => Promise<void>>());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const texts = useRef(new Map<string, string>());
  const voiceRef = useRef<Record<string, string | undefined>>({});
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const proxy = useRef<HTMLTextAreaElement>(null);
  const want = useRef<{ id: string; at: number | 'end' } | null>(null);
  const curRef = useRef<string | null>(null);
  const column = useRef<HTMLDivElement>(null);
  useKeyboardFit(keepInView);

  const page = data?.page;
  const kind = page?.kind ?? 'entry';

  // ---- reading ----
  const refresh = async () => {
    // a fresh page stays fresh only until its first word: then it is today's entry like any other
    const r = await load(id, section, fresh && !pageRef.current);
    if ('to' in r) { setTo(r.to); return; }
    pageRef.current = r.page;
    setData(r);
    if (isToday && !r.messages.some(m => m.text.trim())) await loadEcho(r.page?.id);
    else setEcho(null);
  };

  const loadEcho = async (pageId?: string) => {
    const kept = await keptLines(pageId);
    const day = dayKey(Date.now());
    const pick = pickEcho(kept.map(k => ({ id: k.message.id, at: k.message.at })), settings.peek().echo, day);
    const prev = settings.peek().echo;
    // the journal may lock while the page is still picking (a light change re-reads it): the next open picks again
    if (JSON.stringify(prev) !== JSON.stringify(pick.state)) await saveSettings({ echo: pick.state }).catch(() => undefined);
    const k = kept.find(x => x.message.id === pick.state.id) ?? null;
    echoRef.current = k;
    setEcho(pick.id && !pick.state.linked ? k : null);
  };

  useEffect(() => {
    let live = true;
    Promise.all([chipVoices(), voicesById()]).then(([chips, byId]) => live && setVs({ chips, byId }));
    void reloadValues();
    if (carry?.tail) texts.current.set(tailId, carry.tail);
    if (carry?.wise) setWiseId(tailId);
    // the page opens with the caret on its next rule: the first rule of a new day, or under the last block
    void refresh().then(() => { if (live) focusOn(tailId, 'end'); });
    return () => { live = false; };
  }, [id]);

  // ---- writing: every keystroke queues the newest text for its block; one write at a time ----
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
  const lineJob = (mid: string, d: Draft, at?: number) => async () => {
    const e = settings.peek().echo;
    const linkTo = !pageRef.current && e?.linked && e.day === dayKey(Date.now()) ? echoRef.current?.page.id : undefined;
    const r = await writeLine(pageRef.current, mid, d, Date.now(), { linkTo, at });
    if (!r) return;
    const made = !pageRef.current;
    pageRef.current = r.page;
    // the fresh page is now today's entry: the address says so (no hashchange, so nothing re-renders)
    if (made && fresh) history.replaceState(null, '', '#/journal');
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

  // ---- the blocks, in order ----
  const all = (data?.messages ?? []);
  const savedIds = new Set(all.map(m => m.id));
  const messages = all.filter(m => m.text.trim() || m.id === cur);
  // a question turned from an entry before v2 still carries its title as a line; it shows once, as the title
  const shown = kind === 'question' ? messages.filter(m => m.wise || m.text.trim() !== page?.title?.trim()) : messages;
  const blocks: Block[] = [
    ...shown.map(m => ({ id: m.id, m, at: m.at })),
    ...inserts.filter(x => !savedIds.has(x.id)).map(x => ({ id: x.id, at: x.at })),
  ].sort((a, b) => a.at - b.at);
  if (!savedIds.has(tailId)) blocks.push({ id: tailId, at: Infinity });
  const blockRef = useRef(blocks);
  blockRef.current = blocks;
  const atOf = (bid: string) => inserts.find(x => x.id === bid)?.at;
  const msgOf = (bid: string) => (data?.messages ?? []).find(m => m.id === bid);
  const voiceFor = (bid: string) => (bid in voiceRef.current ? voiceRef.current[bid] : msgOf(bid)?.voiceId);
  const textOf = (bid: string) => areas.current.get(bid)?.value ?? texts.current.get(bid) ?? msgOf(bid)?.text ?? '';
  const draftFor = (bid: string, text: string): Draft => {
    const m = msgOf(bid);
    return { text, voiceId: voiceFor(bid), replyTo: m?.replyTo, wise: m?.wise ?? (bid === wiseId || undefined) };
  };

  // once the next rule has been written on and you have moved on from it, a fresh one waits beneath
  useEffect(() => { if (savedIds.has(tailId) && cur !== tailId) setTailId(uuid()); });

  // ---- focus: the caret goes where it was asked for once that block is on the page ----
  const focusOn = (bid: string, at: number | 'end') => {
    want.current = { id: bid, at };
    curRef.current = bid;
    setCurState(bid);
    setDotFor(null);
    setTapped(null);
  };
  useLayoutEffect(() => {
    const w = want.current;
    if (!w) return;
    const el = areas.current.get(w.id);
    if (!el) return;
    want.current = null;
    el.focus({ preventScroll: true });
    const n = w.at === 'end' ? el.value.length : Math.min(w.at, el.value.length);
    el.setSelectionRange(n, n);
    requestAnimationFrame(keepInView);
  });
  /** Holds the iOS keyboard up while the block that will take the caret is drawn (focus must move inside the tap). */
  const holdKeyboard = () => proxy.current?.focus({ preventScroll: true });

  /** Leaving a block: an emptied one is removed, one opened by Return and never written on goes. */
  const leave = (bid: string | null) => {
    if (!bid) return;
    const text = textOf(bid);
    if (text.trim()) { void flush(); return; }
    jobs.current.delete(bid);
    texts.current.delete(bid);
    if (savedIds.has(bid)) queue(bid, lineJob(bid, { text: '' }));
    setInserts(xs => (xs.some(x => x.id === bid) ? xs.filter(x => x.id !== bid) : xs));
    void flush();
  };
  const moveTo = (bid: string, at: number | 'end') => {
    if (curRef.current !== bid) leave(curRef.current);
    focusOn(bid, at);
  };

  const onInput = (bid: string, text: string) => {
    texts.current.set(bid, text);
    // an emptied block keeps its last words until you leave it, so clearing a line to rewrite it does not move it
    if (!text.trim()) { jobs.current.delete(bid); if (!jobs.current.size) setSaved(true); return; }
    queue(bid, lineJob(bid, draftFor(bid, text), atOf(bid)));
  };

  const onKeyDown = (bid: string, e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.isComposing) return;
    const el = e.currentTarget;
    const list = blockRef.current;
    const i = list.findIndex(x => x.id === bid);
    // a paper's line (Q4) is never written on, so Backspace goes past it to his own line above
    const above = list.slice(0, Math.max(0, i)).reverse().find(x => !x.m?.paper);
    if (e.key === 'Backspace' && !el.value && el.selectionStart === 0 && i > 0) {
      e.preventDefault();
      if (!above) return;
      holdKeyboard();
      moveTo(above.id, 'end');
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const v = el.value, pos = el.selectionStart ?? v.length;
    const before = v.slice(0, pos).replace(/\s+$/, ''), after = v.slice(pos).replace(/^\s+/, '');
    if (!before.trim()) return;
    if (before !== v) {
      el.value = before;
      grow(el);
      onInput(bid, before);
    }
    // a block still waiting for its first save keeps its place at the end while the next one opens
    if (bid === tailId && !savedIds.has(bid)) setInserts(xs => [...xs, { id: bid, at: Date.now() }]);
    const next = list[i + 1];
    const last = !next || next.at === Infinity;
    let nid: string, at: number | undefined;
    if (last) {
      nid = next && next.id !== bid ? next.id : uuid();
      if (nid !== tailId) setTailId(nid);
    } else {
      nid = uuid();
      at = list[i].at + (next.at - list[i].at) / 2;
      setInserts(xs => [...xs, { id: nid, at: at! }]);
    }
    if (after) {
      texts.current.set(nid, after);
      queue(nid, lineJob(nid, { text: after }, at));
    }
    holdKeyboard();
    curRef.current = null; // the block just left was written on; nothing to clean up
    void flush();
    focusOn(nid, 0);
  };

  const pick = (bid: string, voiceId: string | undefined) => {
    voiceRef.current = { ...voiceRef.current, [bid]: voiceId };
    setVoiceOf(voiceRef.current);
    const text = textOf(bid);
    if (text.trim()) queue(bid, lineJob(bid, draftFor(bid, text), atOf(bid)));
    setDotFor(null);
    if (openSheet.value === 'speak') openSheet.value = null;
    want.current = { id: bid, at: areas.current.get(bid)?.selectionStart ?? 'end' };
  };

  // ---- spoke for (C4): the label shows inside the tap; the write waits behind the line's queued saves, and the label
  // is put back after it, since a save that was already running reads the line as it was ----
  const forOf = useRef(new Map<string, Message['for']>());
  const showFor = (mid: string) => {
    if (!forOf.current.has(mid)) return;
    const f = forOf.current.get(mid);
    setData(d => (d ? { ...d, messages: d.messages.map(x => (x.id === mid ? (f ? { ...x, for: f } : (({ for: _, ...rest }) => rest)(x)) : x)) } : d));
  };
  const forWrite = (mid: string) => (run: () => Promise<void>) => {
    void flush();
    chain.current = chain.current.then(run).then(() => showFor(mid)).catch(() => setSaved(false));
    return chain.current;
  };

  // ---- the long-press sheet ----
  const closeSheet = () => { if (openSheet.value === 'line') openSheet.value = null; };
  const withHeld = async (fn: (m: Read<Message>, p: Read<PageRow>) => Promise<void>) => {
    const m = held, p = pageRef.current;
    if (!m || !p) return;
    await flush();
    await fn(m, p);
  };
  const putMessage = (next: Read<Message>) => setData(d => (d ? { ...d, messages: d.messages.map(x => (x.id === next.id ? next : x)) } : d));
  const acts = {
    keep: () => withHeld(async m => {
      const next = await setKept(m, !m.kept);
      if (next.kept) { tick('keep'); bell('keep'); }
      putMessage(next);
      closeSheet();
    }),
    speak: (voiceId: string | undefined) => withHeld(async m => {
      voiceRef.current = { ...voiceRef.current, [m.id]: voiceId };
      setVoiceOf(voiceRef.current);
      putMessage(await speakAs(m, voiceId));
      closeSheet();
    }),
    ask: () => withHeld(async (m, p) => {
      const r = await askThis(p, m);
      pageRef.current = r.page;
      const links = await linksOf(r.page);
      setData(d => (d ? { ...d, page: r.page, links } : d));
      closeSheet();
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
    // "This answers it" on a question page, or "Not the answer" on a line already wise
    answer: () => withHeld(async (m, p) => {
      const r = await answerWith(p, m, !m.wise);
      pageRef.current = r.page;
      putMessage(r.message);
      setData(d => (d ? { ...d, page: r.page } : d));
      closeSheet();
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
    areas.current.get(tailId)?.focus({ preventScroll: true });
  };
  const echoDismiss = async () => {
    const e = settings.peek().echo;
    if (e) await saveSettings({ echo: { ...e, dismissed: true } });
    setTimeout(() => setEcho(null), 300);
  };

  const walk = data?.walk;
  const walkTo = (qid: string) => route(`/questions/${qid}`);
  const swipe = useSwipe(walk, walkTo);

  if (to) return <Redirect to={to} />;

  const byId = new Map(all.map(m => [m.id, m]));
  const date = page ? new Date(page.createdAt) : new Date();
  const pageLabel = isToday ? "Today's page" : 'This page';
  const written = shown.some(m => m.text.trim());
  const onPage = new Set(shown.map(m => m.text.trim()));
  const starred = vs.chips.filter(v => v.starred);
  const lastArea = [...blocks].reverse().find(b => b.id === cur || b.id === tailId)?.id;
  let prevAt = page?.createdAt;
  const isQuestion = kind === 'question';
  // the walk's counter is for an open question; answered here, it goes (the walk stays to move on)
  const count = isQuestion && walk && page?.state === 'open' ? `${walk.at} of ${walk.of} open` : undefined;

  return (
    <Page no={kind === 'entry' ? data?.no : undefined} date={date} count={count} pageId={page?.id} drawn={data !== null}
      pages={isQuestion ? undefined : 'link'} back={isQuestion ? { word: 'Questions', href: '#/questions' } : undefined}
      sign={page?.sign?.chakra}
      music={page ? {
        id: page.id, music: page.music,
        onMusic: music => { if (pageRef.current) pageRef.current = { ...pageRef.current, music }; setData(d => (d?.page ? { ...d, page: { ...d.page, music } } : d)); },
      } : undefined}>
      {echo && !written && !still && (
        <Echo text={echo.message.text} date={new Date(echo.page.createdAt)} still={still} onLink={echoLink} onDismiss={echoDismiss} />
      )}
      <div ref={column} class={`fs-sheetof fs-rules fs-col${walk ? ' fs-swipe' : ''}`} {...swipe}
        onClick={e => {
          if (e.target !== e.currentTarget || !data) return;
          // a tap under the last block writes on the next rule
          const bid = savedIds.has(tailId) ? (cur ?? tailId) : tailId;
          const el = areas.current.get(bid);
          if (el && bid === cur) { el.focus({ preventScroll: true }); return; }
          holdKeyboard();
          moveTo(bid, 'end');
        }}>
        <textarea ref={proxy} class="fs-proxy" aria-hidden="true" tabIndex={-1} />
        {isQuestion && page && (
          <TitleEdit page={page} onSave={title => queue(`title:${page.id}`, async () => {
            const np = await setTitle(pageRef.current ?? page, title);
            pageRef.current = np;
          })} />
        )}
        {/* F2: a page written about a flow episode links back to it (page.flow, like page.music) */}
        {page?.flow && <JournalLink episodeId={page.flow.episodeId} />}
        {/* S2: a page written after a sit links back to it the same way (page.sit) */}
        {page?.sit && <JournalLink sitId={page.sit.sitId} />}
        {/* Q4: a page a paper was carried to prints the question it came from, and a tap goes back (page.research) */}
        {page?.research && <ResearchFrom inquiryId={page.research.inquiryId} />}
        {data && blocks.map(b => {
          const m = b.m;
          // a paper's title carried from Research (PLAN-RESEARCH.md Q4): the paper's line, not his, so not written on
          if (m?.paper) return <div key={b.id} class="fs-block"><PaperLine m={m} /></div>;
          const dated = m && prevAt !== undefined && dayKey(m.at) !== dayKey(prevAt) ? new Date(m.at) : undefined;
          if (m) prevAt = m.at;
          const vid = b.id in voiceOf ? voiceOf[b.id] : m?.voiceId;
          const voice = vid ? vs.byId.get(vid) : undefined;
          return (
            <BlockView key={b.id} b={b} text={texts.current.get(b.id) ?? m?.text ?? ''} voice={voice}
              quoted={m?.replyTo ? byId.get(m.replyTo) : undefined} dated={dated} cur={b.id === cur} edit={b.id === cur || !m}
              label={b.id === lastArea ? pageLabel : 'This line'}
              held={!!m && openSheet.value === 'line' && held?.id === m.id} wise={!m && b.id === wiseId} dotOpen={dotFor === b.id} saved={saved && !!data}
              chips={dotFor === b.id && b.id === cur ? (
                <div class="fs-inline" onMouseDown={e => e.preventDefault()}>
                  <div class="fs-chips" role="group" aria-label="Who speaks this line">
                    <Chip label="Ink" ariaLabel="Plain ink" pressed={!vid} onPress={() => pick(b.id, undefined)} />
                    {starred.map(v => (
                      <Chip key={v.id} label={voiceLabel(v)} colour={voiceColour(v.colour, v.shade)} deep={v.shade === 'deep'}
                        pressed={vid === v.id} onPress={() => pick(b.id, v.id)} />
                    ))}
                    <Chip label="more" add onPress={() => { setDotFor(null); openSheet.value = 'speak'; tick('sheet'); }} />
                  </div>
                </div>
              ) : undefined}
              forRow={b.id === cur && b.id === tapped && m && voice ? (
                <div class="fs-inline fs-inline-for">
                  <SpokeFor message={m} voice={voice} write={forWrite(m.id)}
                    onChange={f => { forOf.current.set(m.id, f); showFor(m.id); }} />
                </div>
              ) : undefined}
              area={el => { if (el) areas.current.set(b.id, el); else areas.current.delete(b.id); }}
              onHold={() => { if (m) { setDotFor(null); setHeld(m); openSheet.value = 'line'; tick('sheet'); } }}
              onTap={off => { holdKeyboard(); moveTo(b.id, off ?? 'end'); setTapped(b.id); }}
              onDot={() => setDotFor(dotFor === b.id ? null : b.id)}
              onInput={text => onInput(b.id, text)}
              onKeyDown={e => onKeyDown(b.id, e)}
              onFocus={() => { if (curRef.current !== b.id) moveTo(b.id, 'end'); }}
              onBlur={next => { if (curRef.current === b.id && next !== proxy.current) leave(b.id); }} />
          );
        })}
        {!!data?.links.length && (
          <nav class="fs-links" aria-label="Linked pages">
            {data.links.map(l => {
              // a question asked from a line still on this page is not printed a second time under it: the line is
              // right there, so the link is its print words alone (reworded on its own page, it shows again)
              const here = l.label === 'Asked' && !!l.line && onPage.has(l.line.trim());
              return (
                <a key={l.page.id} class="fs-link" href={hrefOf(l.page)} aria-label={here ? `${linkWords(l.label)}: ${l.line}` : undefined}>
                  <small>{linkWords(l.label)}</small>
                  {!here && <span>{l.line || notebookDate(new Date(l.page.createdAt))}</span>}
                </a>
              );
            })}
          </nav>
        )}
      </div>
      {walk && (
        <nav class="fs-ask fs-walk" aria-label="The open questions">
          <button type="button" class="fs-word" onClick={() => walkTo(walk.prev)}>‹ Previous</button>
          <button type="button" class="fs-word" onClick={() => walkTo(walk.next)}>Next ›</button>
        </nav>
      )}
      <LineSheet held={held} page={page} question={isQuestion} voices={vs.chips} byId={vs.byId} acts={acts}
        onClose={() => { openSheet.value = null; }} />
      <SpokeForSheet />
      <SpeakSheet voices={vs.chips} current={cur ? voiceFor(cur) : undefined}
        onPick={v => { if (cur) pick(cur, v); }} onClose={() => { openSheet.value = null; }} />
    </Page>
  );
}
