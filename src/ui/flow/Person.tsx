// One person, written when calm (PLAN-FLOWS.md 3.7 and 4 step 14, F6; open question 8, answered yes). A tip with the
// person helper carries { name, tel?, text }, written in a sheet of its own when calm: who, their number (optional),
// what the text says. The row reads "Text Ali", the helper word PERSON at its end; a tap draws the check (and marks
// it done on a live episode) and opens Messages through an sms: link with the body filled in. The app sends nothing:
// the link is a navigation he completes (rule 22). In flooding or panic the composing is the step that fails, not the
// sending. A text holding {time} ("I'm going. Back at {time}.") is filled from the episode's return time.
//
// A person tip with no name yet (the seed's) reads "Someone, written when calm" and opens the sheet instead, so the
// row never sends to nobody. Still hides the number (only the sheet shows one), never the row. Through the door the
// row is not drawn: the text is his own (F5).
// On the walk (DESIGN.md rule 33) the card shows the text as it will read, set as a drawn bubble under the row with
// {time} filled in: the same link, so a tap on either opens Messages.
import { useRef, useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { tick } from '../parts/Haptic';
import { HELPER_WORD } from './Tips';
import type { Episode, Tip } from '../../db/schema';
import type { Read } from '../../db/fields';
import { setDone } from '../../model/tips';
import { fillTime, hasPerson, personRowText, PERSON_EXAMPLE, smsHref, cleanPerson, type Person } from '../../model/carried';

export const mark = (
  <svg class="fs-check-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
    <path class="fs-check-box" d="M3.2 3.6 C7 3.1 13 3.3 16.6 3.4 C16.9 7.5 16.8 12.6 16.5 16.5 C12.4 16.9 7.6 16.8 3.4 16.6 C3.1 12.4 3 8 3.2 3.6 Z" />
    <path class="fs-check-ink" pathLength="1" d="M5.2 10.6 L8.6 14 L17.6 2.6" />
  </svg>
);

type RowProps = {
  t: Tip; live?: Read<Episode>; done: boolean; now: number;
  /** Drawn at once (at rest it only draws, walk it once). */
  onDrawn: () => void;
  onChanged: () => void;
  /** The row has no name yet: open the person sheet. */
  onFill: () => void;
};

export function PersonRow({ t, live, done, now, onDrawn, onChanged, onFill }: RowProps) {
  if (!hasPerson(t)) {
    return (
      <button type="button" class="fs-check fl-person fl-person-empty" onClick={() => { tick('sheet'); onFill(); }}>
        {mark}<span class="fs-check-text">{personRowText(t)}</span><small>{HELPER_WORD.person}</small>
      </button>
    );
  }
  const p = t.person!;
  const body = fillTime(p.text, live?.returnAt, now);
  const href = smsHref(p.tel, body);
  const tap = () => {
    if (!done) tick('check');
    onDrawn();
    if (live) void setDone(live.id, t.id, true).then(onChanged);
  };
  return (
    <>
    <a class={`fs-check fl-person${done ? ' done' : ''}`} href={href} aria-label={`${personRowText(t)}: opens Messages, nothing goes until you send it`}
      onClick={tap}>
      {mark}<span class="fs-check-text">{personRowText(t)}</span><small>{HELPER_WORD.person}</small>
    </a>
    {body.trim() && <a class="fl-bubble" href={href} tabIndex={-1} aria-hidden="true" onClick={tap}>{body}</a>}
    </>
  );
}

/** A row in the check's own look that is a link out of the app (the walk's Calendar card): a tap draws its check,
 *  felt like any check, and the phone opens the other app. The app writes nothing there. */
export function LinkRow({ href, text, word, opens, done, onDrawn }: { href: string; text: string; word: string; opens: string; done: boolean; onDrawn: () => void }) {
  return (
    <a class={`fs-check fl-link${done ? ' done' : ''}`} href={href} aria-label={`${text}: opens ${opens}`}
      onClick={() => { if (!done) tick('check'); onDrawn(); }}>
      {mark}<span class="fs-check-text">{text}</span><small>{word}</small>
    </a>
  );
}

type SheetProps = { open: boolean; person?: Person; onClose: (p: Person) => void };

/** The person sheet: who, the number, what the text says. Closing keeps the work (rule 6). The example text is a
 *  placeholder, never saved as his words. */
export function PersonSheet({ open, person, onClose }: SheetProps) {
  const [p, setP] = useState<Person>(() => person ?? { name: '', text: '' });
  // opened again: start from the person as saved (during render, so nothing typed straight after opening is lost)
  const was = useRef(open);
  if (open && !was.current) setP(person ?? { name: '', text: '' });
  was.current = open;
  const done = () => onClose(cleanPerson(p));
  return (
    <Sheet open={open} onClose={done} title="One person">
      <div class="fs-rows fl-personsheet">
        <label class="fs-row stack">
          <span class="fs-print">Who</span>
          <input class="fs-input" value={p.name} aria-label="Who" placeholder="A name" autocomplete="off"
            onInput={e => { const name = e.currentTarget.value; setP(x => ({ ...x, name })); }} />
        </label>
        <label class="fs-row stack fs-notstill">
          <span class="fs-print">Their number</span>
          <input class="fs-input" type="tel" value={p.tel ?? ''} aria-label="Their number" autocomplete="off"
            onInput={e => { const tel = e.currentTarget.value; setP(x => ({ ...x, tel })); }} />
        </label>
        <label class="fs-row stack">
          <span class="fs-print">What the text says</span>
          <textarea class="fs-input fs-area" rows={3} value={p.text} aria-label="What the text says" placeholder={PERSON_EXAMPLE}
            onInput={e => { const text = e.currentTarget.value; setP(x => ({ ...x, text })); }} />
        </label>
        <p class="fl-said fl-person-then">One tap opens Messages with this filled in. Nothing goes until you send it.</p>
      </div>
    </Sheet>
  );
}
