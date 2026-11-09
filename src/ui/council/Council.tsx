// Council (PLAN.md section 5 item 2; PLAN-V2.md steps 10 and 11): council pages only. #/council is the
// list, newest first, with New council always at the bottom; #/council/:id is one council. A council
// with nothing said yet opens on its seats ("Who sits?"), and Begin goes to the conversation: a chat
// column tinted by voice, the seated voices' chips and the composer under the thumb, the lamp in the
// corner taking the last speaker's colour. Turns go round the seats; a chip tap speaks for one line.
// Tap a message to reply to it; long press it to keep it close, speak it as another voice or link a
// page; long press a chip for the Voices screen.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Chip } from '../parts/Chip';
import { Redirect } from '../route';
import { openSheet } from '../sheets';
import { light } from '../light';
import { notebookDate } from '../date';
import { tick } from '../parts/Haptic';
import { voiceColour } from '../voice';
import type { Read } from '../../db/fields';
import type { Message, Voice } from '../../db/schema';
import {
  councilPages, councilById, newCouncil, speak, chipVoices, nextSpeaker, lastSpeaker, startsRun, firstLine,
  seatedVoices, isSeated, toggleSeat, seat, voiceLabel, editMessage,
  type CouncilRow, type CouncilPage as CouncilData,
} from '../../model/council';
import { Speaker } from '../parts/Speaker';
import { voiceList, reloadVoices, speaker, editing, useLongPress } from './state';
import { useKeyboardFit } from '../parts/Keyboard';
import { VoiceSheet } from './VoiceSheet';
import { hrefOf } from '../journal/href';
import { MessageSheet } from './MessageSheet';

const vcOf = (v: Voice): JSX.CSSProperties => ({ '--vc': voiceColour(v.colour, v.shade) } as JSX.CSSProperties);
const isStill = () => light.value === 'still';
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

export function Council({ id }: { id?: string }) {
  useEffect(() => { void reloadVoices(); }, []);
  return id ? <CouncilPage id={id} /> : <CouncilList />;
}

/** "Councils | Voices": where you are, and the way back. */
export function CouncilSeg({ here }: { here?: 'councils' | 'voices' }) {
  return (
    <nav class="fs-seg" aria-label="Council">
      <a href="#/council" aria-current={here === 'councils' ? 'page' : undefined}>Councils</a>
      <a href="#/voices" aria-current={here === 'voices' ? 'page' : undefined}>Voices</a>
    </nav>
  );
}

// ---------------------------------------------------------------- seats, chips and composer

type Turns = { seats?: string[]; messages: Pick<Message, 'voiceId'>[] };

/** Who sits: every voice in the chip row's order (starred first, deep twins doubled and gone in Still),
 *  toggled on and off, "+ voice" last. */
function SeatChips({ seats, onToggle }: { seats?: string[]; onToggle: (id: string) => void }) {
  const row = chipVoices(voiceList.value, isStill());
  return (
    <div class="fs-seats" role="group" aria-label="Who sits">
      {row.map(v => (
        <Chip key={v.id} label={voiceLabel(v)} colour={voiceColour(v.colour, v.shade)} deep={v.shade === 'deep'}
          pressed={!!seats?.includes(v.id)} onPress={() => onToggle(v.id)} />
      ))}
      <Chip label="+ voice" add onPress={() => { editing.value = null; openSheet.value = 'voice'; tick('sheet'); }} />
    </div>
  );
}

/** Who speaks next. Seated: Ink, the seats in order, "+ seat". Nobody seated (an older council, or one
 *  begun with an empty table): Ink, starred voices, the rest, "+ voice", as before. */
export function ChipRow({ turns, onSeat }: { turns: Turns; onSeat?: () => void }) {
  const { route } = useLocation();
  const still = isStill();
  const vs = voiceList.value;
  const seated = isSeated(turns.seats, vs, still);
  const row = seated ? seatedVoices(turns.seats, vs, still) : chipVoices(vs, still);
  const current = nextSpeaker(speaker.value, vs, still, turns);
  const press = useLongPress(() => route('/voices'), '.fs-chip');
  return (
    <div class="fs-chips" role="group" aria-label="Who speaks next" {...press}>
      <Chip label="Ink" ariaLabel="Plain ink" pressed={!current} onPress={() => { speaker.value = null; }} />
      {row.map(v => (
        <Chip key={v.id} label={voiceLabel(v)} colour={voiceColour(v.colour, v.shade)} deep={v.shade === 'deep'}
          pressed={current === v.id} onPress={() => { speaker.value = v.id; }} />
      ))}
      {seated && onSeat
        ? <Chip label="+ seat" add onPress={onSeat} />
        : <Chip label="+ voice" add onPress={() => { editing.value = null; openSheet.value = 'voice'; tick('sheet'); }} />}
    </div>
  );
}

type Quote = { who: string; text: string; vc?: string };
type ComposerProps = {
  next: string | undefined; chips: JSX.Element; onSend: (text: string) => Promise<void> | void;
  replying?: Quote | null; onCancelReply?: () => void; focus?: number;
};

export function Composer({ next, chips, onSend, replying, onCancelReply, focus }: ComposerProps) {
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const who = voiceList.value.find(v => v.id === next);
  useEffect(() => { if (focus) area.current?.focus({ preventScroll: true }); }, [focus]);
  // the field grows with the line, up to four rules
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = '';
    a.style.height = `${a.scrollHeight}px`;
  }, [text]);
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await onSend(t);
  };
  return (
    <div class="fs-composer-wrap">
      {replying && (
        <div class="fs-replying">
          <span class="fs-quote" style={replying.vc ? ({ '--qc': replying.vc } as JSX.CSSProperties) : undefined}>
            <b>{replying.who}</b> {replying.text}
          </span>
          <button type="button" class="fs-word" onClick={onCancelReply}>Cancel</button>
        </div>
      )}
      {chips}
      <div class="fs-composer">
        <textarea ref={area} rows={1} aria-label="Message" value={text} enterkeyhint="send"
          placeholder={who ? `${voiceLabel(who)} speaks…` : 'A line in ink…'}
          style={who ? vcOf(who) : undefined}
          onInput={(e: JSX.TargetedEvent<HTMLTextAreaElement>) => setText(e.currentTarget.value)}
          onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void send(); } }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the list

function SpokeRules({ ids }: { ids: string[] }) {
  const vs = ids.map(id => voiceList.value.find(v => v.id === id)).filter((v): v is Read<Voice> => !!v);
  if (!vs.length) return null;
  return <span class="fs-spoke" aria-label={vs.map(voiceLabel).join(', ')}>{vs.map(v => <i key={v.id} class={v.shade === 'deep' ? 'deep' : undefined} style={vcOf(v)} />)}</span>;
}

function CouncilList() {
  const { route } = useLocation();
  const [rows, setRows] = useState<CouncilRow[] | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    councilPages().then(async rs => {
      if (!live) return;
      setRows(rs);
      // a council opened from a question is known by its question
      const ls: Record<string, string> = {};
      for (const r of rs) {
        const d = await councilById(r.page.id);
        const q = d?.linked.find(l => l.kind === 'question');
        if (q) ls[r.page.id] = q.label;
      }
      if (live) setLabels(ls);
    });
    return () => { live = false; };
  }, []);
  const now = Date.now();
  const shown = (rows ?? []).filter(r => !isStill() || sameDay(r.page.createdAt, now));
  const begin = async () => { const p = await newCouncil(); route(`/council/${p.id}`); };
  return (
    <Page label="Council">
      <CouncilSeg here="councils" />
      <div class="fs-council">
        <div class="fs-chat fs-rules">
          {shown.map(r => (
            <a key={r.page.id} class="fs-crow" href={`#/council/${r.page.id}`}>
              <small>{notebookDate(new Date(r.page.createdAt))}</small>
              <span>{r.page.title || labels[r.page.id] || r.firstLine || ' '}</span>
              <SpokeRules ids={r.spoke} />
            </a>
          ))}
        </div>
        {rows && <div class="fs-composer-wrap"><button type="button" class="fs-new" onClick={() => void begin()}>New council</button></div>}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------- one council page

/** A line being edited where it stands (V11): Return or leaving it keeps the words, Escape puts them back,
 *  an emptied line goes. */
function EditLine({ m, onDone }: { m: Read<Message>; onDone: (text: string | null) => void }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const finish = (text: string | null) => { if (done.current) return; done.current = true; onDone(text); };
  const grow = () => { const a = area.current; if (a) { a.style.height = ''; a.style.height = `${a.scrollHeight}px`; } };
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    grow();
    a.focus({ preventScroll: true });
    a.setSelectionRange(a.value.length, a.value.length);
    a.scrollIntoView({ block: 'nearest' });
  }, []);
  return (
    <textarea ref={area} class="fs-edit" rows={1} aria-label="Edit the line" defaultValue={m.text} enterkeyhint="done"
      onInput={grow}
      onBlur={e => finish(e.currentTarget.value)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); finish(null); }
        else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); finish((e.currentTarget as HTMLTextAreaElement).value); }
      }} />
  );
}

function Line({ m, voice, run, quoted, press, onTap, editing, onEdited }: {
  m: Read<Message>; voice?: Read<Voice>; run: boolean; quoted?: Quote; press: JSX.HTMLAttributes<HTMLDivElement>; onTap: () => void;
  editing?: boolean; onEdited?: (text: string | null) => void;
}) {
  const quote = quoted && (
    <span class="fs-quote" style={quoted.vc ? ({ '--qc': quoted.vc } as JSX.CSSProperties) : undefined}><b>{quoted.who}</b> {quoted.text}</span>
  );
  const body = <>{quote}{editing ? <EditLine m={m} onDone={t => onEdited?.(t)} /> : m.text.split('\n').map((l, i) => <p key={i}>{l || ' '}</p>)}</>;
  if (editing) {
    press = {};
    onTap = () => undefined;
  }
  // a tap replies, so the line answers the touch as a row does (parts/Press); not while it is being edited
  const pressable = editing ? undefined : '';
  if (!voice) return <div class={`fs-msg${m.kept ? ' kept' : ''}`} data-id={m.id} data-press={pressable} {...press} onClick={onTap}>{body}</div>;
  return (
    <div class={`fs-msg fs-v${voice.shade === 'deep' ? ' deep' : ''}${m.kept ? ' kept' : ''}`} style={vcOf(voice)} data-id={m.id} data-voice={voice.name} data-press={pressable} {...press} onClick={onTap}>
      {run && <Speaker v={voice} />}
      {body}
    </div>
  );
}

/** "About": the line (or question) the council was opened from, linking back to its page; then any
 *  other linked page. An older council with no About keeps "From" on its first link. */
function Links({ data }: { data: CouncilData }) {
  const about = data.page.title;
  const [src, ...rest] = data.linked;
  return (
    <>
      {about && (
        <p class="fs-from"><small>About</small> {src ? <a href={hrefOf(src)}>{about}</a> : <a>{about}</a>}</p>
      )}
      {(about ? rest : data.linked).map((l, i) => (
        <p key={l.id} class="fs-from"><small>{!about && i === 0 ? 'From' : 'Linked'}</small> <a href={hrefOf(l)}>{l.label}</a></p>
      ))}
    </>
  );
}

function CouncilPage({ id }: { id: string }) {
  const [data, setData] = useState<CouncilData | null | 'missing'>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  // the line being edited where it stands (V11)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  // Begin was tapped here: the seats screen shows only while nothing has been said and Begin is not yet tapped
  const [begun, setBegun] = useState(false);
  // "+ seat": the seat row stands in for the chips until Done
  const [seating, setSeating] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const chat = useRef<HTMLDivElement>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const load = () => councilById(id).then(d => setData(d ?? 'missing'));
  useEffect(() => { void load(); setBegun(false); setSeating(false); setReplyTo(null); setEditingId(null); speaker.value = undefined; }, [id]);

  const msgs = data && data !== 'missing' ? data.messages : [];
  const vs = voiceList.value;
  const still = isStill();
  const byId = (vid?: string) => (vid ? vs.find(v => v.id === vid) : undefined);
  const seats = data && data !== 'missing' ? data.page.seats : undefined;
  const turns = { seats, messages: msgs };
  const seatsScreen = !!data && data !== 'missing' && !msgs.length && !begun;

  // the lamp takes the last speaker's colour (a formula on the light's tokens; nothing by day)
  const lamp = lastSpeaker(msgs, vs);
  const lampColour = lamp ? voiceColour(lamp.colour, lamp.shade) : null;
  useEffect(() => {
    const app = root.current?.closest('.fs-app') as HTMLElement | null;
    if (!app) return;
    if (lampColour) { app.dataset.lamp = ''; app.style.setProperty('--lamp-voice', lampColour); }
    else { delete app.dataset.lamp; app.style.removeProperty('--lamp-voice'); }
    return () => { delete app.dataset.lamp; app.style.removeProperty('--lamp-voice'); };
  }, [lampColour]);

  // the newest line stays in view
  useLayoutEffect(() => { const c = chat.current; if (c) c.scrollTop = c.scrollHeight; }, [msgs.length, seatsScreen]);
  // The column keeps its newest lines in view whenever it shrinks under them, if they were in view: the
  // keyboard rising (the app takes the visible height, as on the Journal), a quote or the seat row rising,
  // the field growing. Scrolled back to read, it stays where it was.
  const pinned = useRef(true);
  const toEnd = () => { const c = chat.current; if (c && pinned.current) c.scrollTop = c.scrollHeight; };
  useKeyboardFit(toEnd);
  useLayoutEffect(toEnd, [replyTo, seating]);
  useEffect(() => {
    const c = chat.current;
    if (!c) return;
    const note = () => { pinned.current = c.scrollHeight - c.scrollTop - c.clientHeight < 4; };
    c.addEventListener('scroll', note, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(toEnd) : null;
    ro?.observe(c);
    return () => { c.removeEventListener('scroll', note); ro?.disconnect(); };
  }, [seatsScreen, !!data]);
  const notePlace = () => { const c = chat.current; pinned.current = !c || c.scrollHeight - c.scrollTop - c.clientHeight < 4; };

  const press = useLongPress<HTMLDivElement>(el => {
    setPressed(el.dataset.id ?? null);
    openSheet.value = 'council-message';
    tick('sheet');
  }, '.fs-msg');

  if (data === 'missing') return <Redirect to="/council" />;
  const quoteOf = (mid?: string): Quote | undefined => {
    const q = mid ? msgs.find(x => x.id === mid) : undefined;
    if (!q) return undefined;
    const v = byId(q.voiceId);
    return { who: v ? voiceLabel(v) : 'Ink', text: firstLine(q.text), vc: v ? voiceColour(v.colour, v.shade) : undefined };
  };
  const next = nextSpeaker(speaker.value, vs, still, turns);
  // Lines go down one at a time, each reading the page fresh, so two quick Returns still take two turns.
  const send = async (text: string): Promise<void> => {
    const to = replyTo ?? undefined;
    setReplyTo(null);
    queue.current = queue.current.then(async () => {
      const d = await councilById(id);
      if (!d) return;
      const at = { seats: d.page.seats, messages: d.messages };
      await speak(id, text, { voiceId: nextSpeaker(speaker.peek(), vs, still, at), replyTo: to });
      // at a seated council a tap speaks for one line; then the turn goes on round the seats
      if (isSeated(d.page.seats, vs, still)) speaker.value = undefined;
      await load();
    }).catch(() => undefined);
    await queue.current;
  };
  const toggle = async (vid: string) => { await toggleSeat(id, vid); await load(); };
  // a voice made from "+ voice" here takes a seat at once
  const made = async (vid: string) => { await seat(id, vid); await load(); };

  return (
    <Page label="Council" date={data ? new Date(data.page.createdAt) : undefined} pageId={id}
      music={data ? { id: data.page.id, music: data.page.music, onMusic: music => setData(d => (d && d !== 'missing' ? { ...d, page: { ...d.page, music } } : d)) } : undefined}>
      <CouncilSeg />
      <div ref={root} class="fs-council" data-council={id}>
        {seatsScreen && data ? (
          <>
            <div class="fs-sheetof fs-rules">
              <p class="fs-quiet">Who sits?</p>
              <SeatChips seats={seats} onToggle={vid => void toggle(vid)} />
              <Links data={data} />
            </div>
            <div class="fs-composer-wrap">
              <button type="button" class="fs-new" onClick={() => { setBegun(true); setFocus(f => f + 1); }}>Begin</button>
            </div>
          </>
        ) : (
          <>
            <div ref={chat} class="fs-chat fs-rules">
              {data && <Links data={data} />}
              {msgs.map((m, i) => (
                <Line key={m.id} m={m} voice={byId(m.voiceId)} run={startsRun(msgs, i)} quoted={quoteOf(m.replyTo)} press={press}
                  onTap={() => { notePlace(); setReplyTo(m.id); setFocus(f => f + 1); }}
                  editing={editingId === m.id}
                  onEdited={async text => {
                    setEditingId(null);
                    if (text !== null) await editMessage(m.id, text);
                    await load();
                  }} />
              ))}
            </div>
            {data && (
              <Composer next={next} onSend={send} focus={focus}
                replying={quoteOf(replyTo ?? undefined) ?? null} onCancelReply={() => setReplyTo(null)}
                chips={seating
                  ? (
                    <div class="fs-seatrow">
                      <SeatChips seats={seats} onToggle={vid => void toggle(vid)} />
                      <button type="button" class="fs-word" onClick={() => setSeating(false)}>Done</button>
                    </div>
                  )
                  : <ChipRow turns={turns} onSeat={() => { notePlace(); setSeating(true); }} />} />
            )}
          </>
        )}
      </div>
      <VoiceSheet onMade={vid => void made(vid)} />
      {data && (
        <MessageSheet pageId={id} message={msgs.find(m => m.id === pressed) ?? null} onChanged={load}
          onEdit={mid => { if (replyTo === mid) setReplyTo(null); setEditingId(mid); }} />
      )}
    </Page>
  );
}
