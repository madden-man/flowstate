// The lock's rows in Settings: PIN (Set a PIN, or Change PIN and Turn off), the honest limit under it,
// and Relock after (only while a PIN is on).
import { settings, saveSettings } from '../settings';
import { openSheet } from '../sheets';
import { tick } from '../parts/Haptic';
import { pinMode, type PinMode } from './PinSheet';
import { RELOCK_CHOICES } from './relock';

const openPin = (mode: PinMode) => { pinMode.value = mode; openSheet.value = 'pin'; tick('sheet'); };

export function PinRows() {
  const lock = settings.value.lock;
  return (
    <>
      {lock.enabled ? (
        <div class="fs-row stack" data-pin-row>
          <span>PIN</span>
          <div class="fs-opts" role="group" aria-label="PIN">
            <button type="button" class="fs-opt" onClick={() => openPin('change')}>Change PIN</button>
            <button type="button" class="fs-opt" onClick={() => openPin('off')}>Turn off</button>
          </div>
          <span class="fs-note">A short PIN is a curtain, not a vault.</span>
        </div>
      ) : (
        <div data-pin-row>
          <button type="button" class="fs-row" onClick={() => openPin('set')}><span>PIN</span><small>Set a PIN</small></button>
          <span class="fs-note">A short PIN is a curtain, not a vault.</span>
        </div>
      )}
      {lock.enabled && (
        <div class="fs-row stack">
          <span>Relock after</span>
          <div class="fs-opts" role="group" aria-label="Relock after">
            {RELOCK_CHOICES.map(([min, label]) => (
              <button key={min} type="button" class="fs-opt" aria-pressed={lock.relockAfterMin === min}
                onClick={() => { tick('check'); void saveSettings({ lock: { ...settings.value.lock, relockAfterMin: min } }); }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
