// A new version waits for a tap; a line above the tab bar, never a modal.
import { needRefresh, applyUpdate } from '../pwa/install';

export function UpdateToast() {
  if (!needRefresh.value) return null;
  return (
    <div class="fs-toast" role="status">
      <span>A new version is ready</span>
      <button type="button" class="fs-opt" onClick={() => void applyUpdate()}>Reload</button>
      <button type="button" class="fs-word" onClick={() => { needRefresh.value = false; }}>Later</button>
    </div>
  );
}
