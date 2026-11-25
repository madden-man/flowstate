// The Sunday question's push, inside its Settings row (PLAN-PUSH.md section 4, N3), passed to CheckinRow as children:
// the switch, "Send one now", and when the last one arrived, in print. Nothing leaves the phone until the switch is
// tapped on (push/push.ts). In Safari the switch is held with one line; denied, one line and no button that cannot
// work; where Web Push does not exist, nothing at all. A failure leaves the switch off with one quiet line. No dialogs.
// PushRowsView is the row drawn from plain values, so the walkthrough (N4) can draw any state with no service worker.
import { useEffect, useState } from 'preact/hooks';
import { settings } from '../settings';
import { checkinOf } from '../../push/due';
import { pushArrived, pushState, sendNow, turnOff, turnOn, type PushState, type PushWhy } from '../../push/push';
import { readLastArrived } from '../../push/store';
import { clockTime, notebookDate } from '../date';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 86_400_000;

/** "Last arrived Sunday 10:00"; older than six days, by its date. */
export function arrivedLine(at: number, now = Date.now()): string {
  const d = new Date(at);
  const when = now - at < 6 * DAY_MS ? WEEKDAYS[d.getDay()] : notebookDate(d);
  return `Last arrived ${when} ${clockTime(d)}`;
}

/** The one quiet line after a tap that came to nothing, or after Send one now. */
export const PUSH_NOTES: Record<PushWhy | 'sent', string> = {
  sent: 'Sent',
  offline: 'No connection',
  not_configured: 'Not set up yet',
  failed: 'Did not work',
};

export type PushRowsProps = {
  state: PushState;
  /** After a tap: what came of it, one line. */
  note?: PushWhy | 'sent';
  /** When the last push landed (ms), from fs-push; absent until one has. */
  lastArrivedAt?: number | null;
  busy?: boolean;
  now?: number;
  onToggle?: () => void;
  onSend?: () => void;
};

export function PushRowsView({ state, note, lastArrivedAt, busy, now, onToggle, onSend }: PushRowsProps) {
  if (state === 'unsupported') return null;
  if (state === 'denied') {
    return <span class="fs-note" data-push="denied">Notifications are off for FlowState in iOS Settings</span>;
  }
  const on = state === 'on';
  const held = state === 'needsHomeScreen';
  return (
    <div data-push={state}>
      <button type="button" class={`fs-row${held ? ' fs-row-off' : ''}`} role="switch" aria-checked={on} disabled={held || busy}
        onClick={() => onToggle?.()} data-push-switch>
        <span>Notify me</span><small class="fs-state">{on ? 'On' : 'Off'}</small>
      </button>
      {held && <span class="fs-note">Add to Home Screen first</span>}
      {on && <button type="button" class="fs-word fs-push-send" disabled={busy} onClick={() => onSend?.()} data-push-send>Send one now</button>}
      {note && <span class="fs-note fs-notstill" role="status" data-push-note>{PUSH_NOTES[note]}</span>}
      {on && lastArrivedAt != null && <span class="fs-note fs-notstill" data-push-arrived>{arrivedLine(lastArrivedAt, now)}</span>}
    </div>
  );
}

export function PushRows() {
  const [state, setState] = useState<PushState | null>(null);
  const [note, setNote] = useState<PushWhy | 'sent' | undefined>();
  const [busy, setBusy] = useState(false);
  const [arrived, setArrived] = useState<number | null>(null);
  const wish = !!checkinOf(settings.value).push;
  const knock = pushArrived.value;
  useEffect(() => { void pushState().then(setState); }, [wish]);
  useEffect(() => { void readLastArrived().then(setArrived); }, [knock, state]);
  if (!state) return null;
  const toggle = async () => {
    setBusy(true);
    setNote(undefined);
    try {
      if (state === 'on') setState(await turnOff());
      else {
        const r = await turnOn();
        setState(r.state);
        setNote(r.why);
      }
    } finally { setBusy(false); }
  };
  const send = async () => {
    setBusy(true);
    setNote(undefined);
    try { setNote(await sendNow()); } finally { setBusy(false); }
  };
  return <PushRowsView state={state} note={note} lastArrivedAt={arrived} busy={busy}
    onToggle={() => void toggle()} onSend={() => void send()} />;
}
