// The quiet line above the tab bar (package 8): never a modal, nothing counted, never in Still.
// One line at a time, in this order: a new version waiting for Reload (any page); on the Journal, the
// export that is due (once a day, tap to export) or, in Safari, the Add to Home Screen hint (first three
// launches, tap to put it away). It sits in the page's flow, so it never covers the composer.
import { signal } from '@preact/signals';
import { useLocation } from 'preact-iso';
import { needRefresh, applyUpdate, installHintWanted, dismissInstallHint, backupDue, backupDueLine, takeNagDay } from '../pwa/install';
import { backupNow } from '../db/backup';
import { settings, loadSettings } from './settings';
import { light } from './light';
import { openSheet } from './sheets';

/** Decided once per launch, the first time the Journal shows: null until then. */
const nagUp = signal<boolean | null>(null);
const hintUp = signal<boolean | null>(null);

export function UpdateToast() {
  return (
    <div class="fs-quietline" role="status" data-update>
      <span>A new version is ready</span>
      <button type="button" class="fs-word fs-go" onClick={() => void applyUpdate()}>Reload</button>
      <button type="button" class="fs-word" onClick={() => { needRefresh.value = false; }}>Later</button>
    </div>
  );
}

function BackupLine() {
  const run = async () => {
    nagUp.value = false;
    const outcome = await backupNow();
    if (outcome !== 'cancelled') await loadSettings();
  };
  return (
    <div class="fs-quietline" data-backup-nag>
      <button type="button" class="fs-quietline-tap" onClick={() => void run()}>{backupDueLine(settings.value)}<b>Export</b></button>
      <button type="button" class="fs-word" onClick={() => { nagUp.value = false; }}>Later</button>
    </div>
  );
}

function InstallLine() {
  return (
    <div class="fs-quietline" data-install-line>
      <button type="button" class="fs-quietline-tap" onClick={() => { dismissInstallHint(); hintUp.value = false; }}>
        Share, then Add to Home Screen
      </button>
    </div>
  );
}

export function QuietLine() {
  const { path } = useLocation();
  if (light.value === 'still') return null;
  if (needRefresh.value) return <UpdateToast />;
  if (!path.startsWith('/journal') || openSheet.value) return null;
  if (nagUp.value === null) nagUp.value = backupDue(settings.value) && takeNagDay();
  if (hintUp.value === null) hintUp.value = installHintWanted();
  // the export is due only while it still is (an export from Settings puts the line away too)
  if (nagUp.value && backupDue(settings.value)) return <BackupLine />;
  if (hintUp.value) return <InstallLine />;
  return null;
}
