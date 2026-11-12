// Out of the app (PLAN-TASKS.md T4; section 2's last column, section 3, section 5): Send and Call on the Throat, Reach
// on the Heart and the Root, I will on the Solar plexus, Move on the Sacral. Each leaves the app for Messages, the phone,
// Calendar or Spotify; the links are built in ./out-links.ts.
//
// A touch that carries his own sentence (Send, I will) draws one rule on the plate first and he writes on it; the app
// writes no words of its own: the way out is the person's name (Messages, the phone) or the word the plate already
// prints after the touch (Calendar). A touch to a person with none chosen yet opens the person sheet (Person.tsx) as a
// rising sheet, then goes on with the person he wrote; Call with no number opens it on the number.
//
// Done (section 5): a touch that leaves says so when he comes back to this sign (the page visible again on it), never
// when he goes, and once; then the word goes back to rest. Move plays the shelf's first cover through the music path
// (ui/music/state play): done at once when it plays from here, or on coming back when Spotify had to be opened.
//
// None of these is a door touch (acts.ts door: false), so through the door none is printed or reached (touch.ts onTouch).
// Still: they work the same; the plate's print has no hue there. Nothing here fetches.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { PersonSheet } from '../../Person';
import { registerTouch, type TouchAct } from '../touch';
import type { Person } from '../../../../model/carried';
import { smsHref } from '../../../../model/carried';
import { shelf } from '../../../../model/acts';
import { albumUriOf } from '../../../../db/seed/picks';
import { keptAlbums } from '../../../../music/covers';
import { play, playing, playNote } from '../../../music/state';
import { calshowHref, choosePerson, chosenPerson, doneOnReturn, nextAt, reachHref, telHref } from './out-links';
import './out.css';

/** Arms the return for this touch while its View is up: a tap on the way out arms it (again replaces), the View
 *  going disarms it. On the return: done, then the word back at rest. */
function useReturn(a: TouchAct) {
  const off = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => off.current?.(), []);
  return () => {
    off.current?.();
    off.current = doneOnReturn(a.chakra, () => { off.current = undefined; a.done(); a.close(); });
  };
}

/** A sheet raised from the plate rises over the page, not inside the plate's box: it is drawn into the page the plate
 *  sits on (.fs-page, where every sheet is anchored), found from a mark left where the View is. */
function Rising({ children }: { children: ComponentChildren }) {
  const mark = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { setHost(mark.current?.closest('.fs-page') ?? null); }, []);
  return <><span ref={mark} hidden />{host && createPortal(<>{children}</>, host)}</>;
}

/** The person he chose once, read; with none (or none with a number when need is 'tel') the person sheet rises. Closing
 *  it with no name, or still no number for a call, puts the word back at rest. onChosen runs inside the tap that closes
 *  the sheet (Send puts the caret back on its rule there, while the gesture still counts). */
function usePerson(a: TouchAct, need: 'name' | 'tel', onChosen?: () => void) {
  const [person, setPerson] = useState<Person | undefined>();
  const [asking, setAsking] = useState(false);
  const ok = (p?: Person) => !!p?.name.trim() && (need === 'name' || !!telHref(p.tel));
  useEffect(() => {
    let on = true;
    void chosenPerson().then(p => {
      if (!on) return;
      setPerson(p);
      if (!ok(p)) setAsking(true);
    });
    return () => { on = false; };
  }, []);
  const sheet = (
    <Rising><PersonSheet open={asking} person={person} onClose={p => {
      setAsking(false);
      if (p.name.trim()) onChosen?.();
      void choosePerson(p).then(kept => {
        const next = kept ?? (p.name.trim() ? p : undefined);
        setPerson(next);
        if (!ok(next)) a.close();
      });
    }} /></Rising>
  );
  return { person: ok(person) ? person : undefined, sheet };
}

/** The way out: a real link, so the phone opens the other app from the tap itself. */
const Out = ({ href, onGo, children, label }: { href: string; onGo: () => void; label: string; children: string }) => (
  <a class="out-go" href={href} aria-label={label} onClick={onGo}>{children}</a>
);

/** One rule on the plate he writes on. The caret is put on it by the tap that drew it (data-caret, ../Touches.tsx),
 *  inside the gesture, as the iPhone's keyboard asks; never by autofocus, which comes after the tap is over. */
const Rule = ({ value, onInput, label, inputRef }: { value: string; onInput: (v: string) => void; label: string; inputRef?: { current: HTMLInputElement | null } }) => (
  <input ref={inputRef} class="out-rule" value={value} aria-label={label} autocomplete="off" enterkeyhint="done" data-caret=""
    onInput={e => onInput(e.currentTarget.value)} />
);

/** Throat, Send: his sentence on the rule, then the person's name opens Messages with it in the body. */
function SendView(a: TouchAct) {
  const rule = useRef<HTMLInputElement>(null);
  const { person, sheet } = usePerson(a, 'name', () => rule.current?.focus({ preventScroll: true }));
  const [line, setLine] = useState('');
  const go = useReturn(a);
  return (
    <div class="out-stage" data-out="send">
      <Rule value={line} onInput={setLine} label="Your sentence" inputRef={rule} />
      {person && line.trim() && (
        <Out href={smsHref(person.tel, line.trim())} onGo={go} label={`${person.name}: opens Messages, nothing goes until you send it`}>
          {person.name}
        </Out>
      )}
      {sheet}
    </div>
  );
}

/** Throat, Call: the person's name opens the phone on their number. */
function CallView(a: TouchAct) {
  const { person, sheet } = usePerson(a, 'tel');
  const go = useReturn(a);
  const href = person && telHref(person.tel);
  return (
    <div class="out-stage" data-out="call">
      {person && href && <Out href={href} onGo={go} label={`${person.name}: opens the phone`}>{person.name}</Out>}
      {sheet}
    </div>
  );
}

/** Heart and Root, Reach: the person's name opens Messages to them, with the words he wrote for them when calm. */
function ReachView(a: TouchAct) {
  const { person, sheet } = usePerson(a, 'name');
  const go = useReturn(a);
  return (
    <div class="out-stage" data-out="reach">
      {person && <Out href={reachHref(person)} onGo={go} label={`${person.name}: opens Messages, nothing goes until you send it`}>{person.name}</Out>}
      {sheet}
    </div>
  );
}

/** Solar plexus, I will: one thing on the rule and a time beside it, then Calendar opens on that time. The line goes
 *  on the clipboard with the tap, to paste as the event's name (calshow: carries a time, never words). */
function WillView(a: TouchAct) {
  const [line, setLine] = useState('');
  const [time, setTime] = useState('');
  const go = useReturn(a);
  const at = nextAt(time);
  return (
    <div class="out-stage" data-out="i-will">
      <Rule value={line} onInput={setLine} label="One thing you will do" />
      <div class="out-row">
        <input class="out-time" type="time" value={time} aria-label="When" onInput={e => setTime(e.currentTarget.value)} />
        {line.trim() && at !== undefined && (
          <Out href={calshowHref(at)} label="Calendar: opens on that time" onGo={() => {
            void navigator.clipboard?.writeText(line.trim()).catch(() => undefined);
            go();
          }}>Calendar</Out>
        )}
      </div>
    </div>
  );
}

/** Sacral, Move: the shelf's first album plays on the phone's Spotify, as a ♪ cover does. */
function moveAct(a: TouchAct): () => void {
  let over = false;
  let off: (() => void) | undefined;
  playNote.value = null;
  void (async () => {
    const first = (await shelf(a.chakra)).find(p => p.kind === 'album' && !p.struck && albumUriOf(p));
    const uri = first && albumUriOf(first);
    if (over || !first || !uri) return;
    const k = (await keptAlbums([uri])).get(uri);
    const playlist = k?.shelf ? { id: k.shelf.playlistId, uri: `spotify:playlist:${k.shelf.playlistId}` } : { id: '', uri };
    const row = k?.shelf ? { ...k.row, ...k.shelf }
      : { albumUri: uri, album: first.title, artist: first.by ?? '', cover: k?.row.cover, firstTrackUri: '' };
    if (over) return;
    // Spotify woken (it was not running): it plays on coming back here, and that is the touch done
    off = doneOnReturn(a.chakra, () => { off = undefined; if (!over) a.done(); });
    await play(playlist, row);
    if (over) return;
    if (playing.peek()?.albumUri === uri) { off?.(); off = undefined; a.done(); }
  })();
  return () => { over = true; off?.(); };
}

/** Move's word on the plate while Spotify answers: its own one plain line, when it has one. */
function MoveView() {
  const note = playNote.value;
  return note ? <div class="out-stage" data-out="move"><p class="out-note" role="status">{note}</p></div> : null;
}

// Reach is the same on the Heart and the Root, so it is registered by its id; a sign that wants its own registers by
// sign and id over it. The rest by where they land, each the only touch landing there.
registerTouch({ id: 'send' }, { View: SendView });
registerTouch({ id: 'reach' }, { View: ReachView });
registerTouch({ lands: 'phone' }, { View: CallView });
registerTouch({ lands: 'calendar' }, { View: WillView });
registerTouch({ lands: 'spotify' }, { act: moveAct, View: MoveView });
