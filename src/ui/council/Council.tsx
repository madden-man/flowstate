// Council (PLAN.md section 5 item 2): council pages only. #/council is the list, newest first, with a
// blank council already open beneath it when none was started today; #/council/:id is one conversation:
// a chat column tinted by voice, the chip row and the composer under the thumb, the lamp in the corner
// taking the last speaker's colour. Long press a message to reply, keep it close or link a page;
// long press a chip for the Voices screen.
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
  type CouncilRow, type CouncilPage as CouncilData,
} from '../../model/council';
import { voiceList, reloadVoices, speaker, editing, useLongPress, useKeyboardInset } from './state';
import { VoiceSheet } from './VoiceSheet';
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

// ---------------------------------------------------------------- chips and composer

/** Plain ink first ("Ink", no voice of its own), starred voices, the rest, "+ voice" last. Deep twins leave in Still. */
export function ChipRow() {
  const { route } = useLocation();
  const still = isStill();
  const row = chipVoices(voiceList.value, still);
  const current = nextSpeaker(speaker.value, voiceList.value, still);
  const press = useLongPress(() => route('/voices'), '.fs-chip');
  return (
    <div class="fs-chips" role="group" aria-label="Who speaks next" {...press}>
      <Chip label="Ink" ariaLabel="Plain ink" pressed={!current} onPress={() => { speaker.value = undefined; }} />
      {row.map(v => (
        <Chip key={v.id} label={v.name} colour={voiceColour(v.colour, v.shade)} deep={v.shade === 'deep'}
          pressed={current === v.id} onPress={() => { speaker.value = v.id; }} />
      ))}
      <Chip label="+ voice" add onPress={() => { editing.value = null; openSheet.value = 'voice'; tick('sheet'); }} />
    </div>
  );
}

type ComposerProps = { onSend: (text: string) => Promise<void> | void; replying?: { who: string; text: string; vc?: string } | null; onCancelReply?: () => void; focus?: number };

export function Composer({ onSend, replying, onCancelReply, focus }: ComposerProps) {
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const who = voiceList.value.find(v => v.id === nextSpeaker(speaker.value, voiceList.value, isStill()));
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
      <ChipRow />
      <div class="fs-composer">
        <textarea ref={area} rows={1} aria-label="Message" value={text} enterkeyhint="send"
          placeholder={who ? `${who.name} speaks…` : 'A line in ink…'}
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
  return <span class="fs-spoke" aria-label={vs.map(v => v.name).join(', ')}>{vs.map(v => <i key={v.id} class={v.shade === 'deep' ? 'deep' : undefined} style={vcOf(v)} />)}</span>;
}

function CouncilList() {
  const { route } = useLocation();
  const [rows, setRows] = useState<CouncilRow[] | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const wrap = useRef<HTMLDivElement>(null);
  useKeyboardInset(wrap);
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
  const hasToday = !!rows?.some(r => sameDay(r.page.createdAt, now));
  const shown = (rows ?? []).filter(r => !isStill() || sameDay(r.page.createdAt, now));
  const start = async (text: string) => {
    const p = await newCouncil();
    await speak(p.id, text, { voiceId: nextSpeaker(speaker.value, voiceList.value, isStill()) });
    route(`/council/${p.id}`, true);
  };
  return (
    <Page label="Council">
      <CouncilSeg here="councils" />
      <div ref={wrap} class="fs-council">
        <div class="fs-chat fs-rules">
          {shown.map(r => (
            <a key={r.page.id} class="fs-crow" href={`#/council/${r.page.id}`}>
              <small>{notebookDate(new Date(r.page.createdAt))}</small>
              <span>{labels[r.page.id] ?? (r.firstLine || ' ')}</span>
              <SpokeRules ids={r.spoke} />
            </a>
          ))}
          {rows && !hasToday && <p class="fs-quiet fs-blank">write conversations between them that lead to deeper understanding and reconciliation</p>}
        </div>
        {rows && (hasToday
          ? <div class="fs-composer-wrap"><button type="button" class="fs-new" onClick={async () => { const p = await newCouncil(); route(`/council/${p.id}`); }}>New council</button></div>
          : <Composer onSend={start} />)}
      </div>
      <VoiceSheet />
    </Page>
  );
}

// ---------------------------------------------------------------- one council page

function Line({ m, voice, run, quoted, press }: { m: Read<Message>; voice?: Read<Voice>; run: boolean; quoted?: { who: string; text: string; vc?: string }; press: JSX.HTMLAttributes<HTMLDivElement> }) {
  const quote = quoted && (
    <span class="fs-quote" style={quoted.vc ? ({ '--qc': quoted.vc } as JSX.CSSProperties) : undefined}><b>{quoted.who}</b> {quoted.text}</span>
  );
  const body = <>{quote}{m.text.split('\n').map((l, i) => <p key={i}>{l || ' '}</p>)}</>;
  if (!voice) return <div class={`fs-msg${m.kept ? ' kept' : ''}`} data-id={m.id} {...press}>{body}</div>;
  return (
    <div class={`fs-msg fs-v${voice.shade === 'deep' ? ' deep' : ''}${m.kept ? ' kept' : ''}`} style={vcOf(voice)} data-id={m.id} data-voice={voice.name} {...press}>
      {run && <span class="fs-sp">{voice.name}</span>}
      {body}
    </div>
  );
}

function CouncilPage({ id }: { id: string }) {
  const [data, setData] = useState<CouncilData | null | 'missing'>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const chat = useRef<HTMLDivElement>(null);
  useKeyboardInset(root);

  const load = () => councilById(id).then(d => setData(d ?? 'missing'));
  useEffect(() => { void load(); }, [id]);

  const msgs = data && data !== 'missing' ? data.messages : [];
  const vs = voiceList.value;
  const byId = (vid?: string) => (vid ? vs.find(v => v.id === vid) : undefined);

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
  useLayoutEffect(() => { const c = chat.current; if (c) c.scrollTop = c.scrollHeight; }, [msgs.length]);

  const press = useLongPress<HTMLDivElement>(el => {
    setPressed(el.dataset.id ?? null);
    openSheet.value = 'council-message';
    tick('sheet');
  }, '.fs-msg');

  if (data === 'missing') return <Redirect to="/council" />;
  const quoteOf = (mid?: string) => {
    const q = mid ? msgs.find(x => x.id === mid) : undefined;
    if (!q) return undefined;
    const v = byId(q.voiceId);
    return { who: v?.name ?? 'Ink', text: firstLine(q.text), vc: v ? voiceColour(v.colour, v.shade) : undefined };
  };
  const send = async (text: string) => {
    await speak(id, text, { voiceId: nextSpeaker(speaker.value, vs, isStill()), replyTo: replyTo ?? undefined });
    setReplyTo(null);
    await load();
  };

  return (
    <Page label="Council" date={data ? new Date(data.page.createdAt) : undefined}>
      <CouncilSeg />
      <div ref={root} class="fs-council" data-council={id}>
        <div ref={chat} class="fs-chat fs-rules">
          {data?.linked.map((l, i) => (
            <p key={l.id} class="fs-from"><small>{i === 0 ? 'From' : 'Linked'}</small> <a href={`#/journal/${l.id}`}>{l.label}</a></p>
          ))}
          {msgs.map((m, i) => (
            <Line key={m.id} m={m} voice={byId(m.voiceId)} run={startsRun(msgs, i)} quoted={quoteOf(m.replyTo)} press={press} />
          ))}
        </div>
        {data && <Composer onSend={send} focus={focus} replying={quoteOf(replyTo ?? undefined) ?? null} onCancelReply={() => setReplyTo(null)} />}
      </div>
      <VoiceSheet />
      {data && (
        <MessageSheet pageId={id} message={msgs.find(m => m.id === pressed) ?? null}
          onReply={mid => { setReplyTo(mid); setFocus(f => f + 1); }}
          onChanged={load} />
      )}
    </Page>
  );
}
