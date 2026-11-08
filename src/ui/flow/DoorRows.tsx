// The door's rows in Settings (PLAN-FLOWS.md 3.7, F5), under the PIN's: the switch for the ring without the PIN
// (only while a PIN is on, like Relock after; off by default), and the two-tap route, an iOS Shortcut that opens
// Right now, bound to Back Tap or the Action button. No setting behind the second: it only says how.
import { settings, saveSettings } from '../settings';
import './door.css';

/** Right now's address where this copy is served (on his phone, https://flowstate-journal.netlify.app/#/flow/now).
 *  Built from the origin, not written out, so the built app carries no external URL (script/check-dist.mjs). */
const shortcutUrl = () => `${location.origin}/#/flow/now`;

export function DoorRows() {
  const s = settings.value;
  const on = !!s.flowDoor;
  return (
    <>
      {s.lock.enabled && (
        <div data-door-row>
          <button type="button" class="fs-row" role="switch" aria-checked={on} onClick={() => void saveSettings({ flowDoor: !on })}>
            <span>The ring without the PIN</span><small>{on ? 'On' : 'Off'}</small>
          </button>
          <span class="fs-note">Opens Right now and your flows to read, as first written; pages, notes and last time stay locked.</span>
        </div>
      )}
      <div class="fs-row stack" data-shortcut-row>
        <span>Two taps to Right now</span>
        <span class="fs-note fl-shortcut">A Shortcut that opens <span class="fl-url">{shortcutUrl()}</span>, set on Back Tap (Settings, Accessibility, Touch) or the Action button.</span>
      </div>
    </>
  );
}
