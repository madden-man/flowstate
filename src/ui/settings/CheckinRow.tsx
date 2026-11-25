// The Sunday question's row in Settings (PLAN-PUSH.md section 4, N1): under Sounds, above Storage. A switch for the
// question itself; on, the question as a line on the page's rules (his words, saved when he leaves the field) and the
// time it asks (a wheel on the iPhone, default 10:00). In Still the switch's state is hidden, like every state.
// N3 adds the push half (the push switch, "Send one now", "Last arrived", the denied line) as children: whatever is
// passed in is drawn under the time, inside the open row, so this file needs no other change for it.
import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { settings, saveSettings } from '../settings';
import { CHECKIN_LINE, checkinOf, type Checkin } from '../../push/due';

/** Writes a change to the question over what is stored now (or the defaults, if nothing is yet). */
export const saveCheckin = (patch: Partial<Checkin>) => saveSettings({ checkin: { ...checkinOf(settings.peek()), ...patch } });

const pad = (n: number) => String(n).padStart(2, '0');

/** The question as a line on the rules: Return or leaving the field keeps it; emptied, it is his first line again. */
export function CheckinLineField() {
  const line = checkinOf(settings.value).line;
  const [draft, setDraft] = useState(line);
  // a line saved elsewhere (or put back to his first) shows at once: synced in the render, not an effect after paint,
  // so a later effect can never undo what he has typed since
  const [seen, setSeen] = useState(line);
  if (seen !== line) { setSeen(line); setDraft(line); }
  const commit = () => {
    const next = draft.replace(/\s+/g, ' ').trim() || CHECKIN_LINE;
    setDraft(next);
    if (next !== line) void saveCheckin({ line: next });
  };
  return (
    <input class="fs-input" type="text" value={draft} aria-label="What it asks" placeholder={CHECKIN_LINE} autocomplete="off" spellcheck enterKeyHint="done"
      data-checkin-question
      onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); } }} />
  );
}

/** The time it asks, on the phone's clock. */
export function CheckinTime() {
  const c = checkinOf(settings.value);
  return (
    <input class="fs-input" type="time" value={`${pad(c.hour)}:${pad(c.minute)}`} aria-label="Time" data-checkin-time
      onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
        const m = /^(\d{1,2}):(\d{2})/.exec(e.currentTarget.value);
        if (m) void saveCheckin({ hour: Number(m[1]), minute: Number(m[2]) });
      }} />
  );
}

export function CheckinRow({ children }: { children?: ComponentChildren }) {
  const c = checkinOf(settings.value);
  return (
    <div data-checkin>
      <button type="button" class="fs-row" role="switch" aria-checked={c.on} onClick={() => void saveCheckin({ on: !c.on })}>
        <span>Sunday question</span><small class="fs-state">{c.on ? 'On' : 'Off'}</small>
      </button>
      {c.on && (
        <div class="fs-checkin">
          <CheckinLineField />
          <CheckinTime />
          {children}
        </div>
      )}
    </div>
  );
}
