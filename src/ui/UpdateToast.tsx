// The quiet line above the tab bar (package 8): never a modal, nothing counted, never in Still.
// One line at a time, in this order: a new version waiting for Reload (any page); on the Journal, the
// export that is due (once a day, tap to export) or, in Safari, the Add to Home Screen hint (first three
// launches, tap to put it away). The Sunday question (PLAN-PUSH.md N1, journal/checkin.tsx) comes before both: on the
// first Journal open on or after its time that week, his line, a tap to land on today's page, Later to put it away
// until next week; on a day the export is also due, the question wins. It sits in the page's flow, so it never
// covers the composer.
import { signal } from '@preact/signals';
import { useLocation } from 'preact-iso';
import { needRefresh, applyUpdate, installHintWanted, dismissInstallHint, backupDue, backupDueLine, takeNagDay } from '../pwa/install';
import { backupNow } from '../db/backup';
import { settings, loadSettings } from './settings';
import { light } from './light';
import { openSheet } from './sheets';
import { ASK_CHECKIN, checkinUp, landCheckin, takeCheckin } from './journal/checkin';
import { checkinOf } from '../push/due';

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

function CheckinLine() {
  const { route } = useLocation();
  return (
    <div class="fs-quietline" data-checkin-line>
      <button type="button" class="fs-quietline-tap fs-quietline-ink" onClick={() => void landCheckin(route).catch(() => undefined)}>
        {checkinOf(settings.value).line}
      </button>
      <button type="button" class="fs-word" onClick={() => { checkinUp.value = false; }}>Later</button>
    </div>
  );
}

export function QuietLine() {
  const { path, query } = useLocation();
  if (light.value === 'still') return null;
  if (needRefresh.value) return <UpdateToast />;
  if (!path.startsWith('/journal') || openSheet.value) return null;
  // the address is landing on the question already (journal/checkin.tsx CheckinAsk): no line for it
  if (query.ask === ASK_CHECKIN) return null;
  if (checkinUp.value === null) checkinUp.value = takeCheckin();
  if (checkinUp.value) {
    // the question wins the day: the export's line, if due, takes its once-a-day today and shows tomorrow
    if (nagUp.value === null) { if (backupDue(settings.value)) takeNagDay(); nagUp.value = false; }
    return <CheckinLine />;
  }
  if (nagUp.value === null) nagUp.value = backupDue(settings.value) && takeNagDay();
  if (hintUp.value === null) hintUp.value = installHintWanted();
  // the export is due only while it still is (an export from Settings puts the line away too)
  if (nagUp.value && backupDue(settings.value)) return <BackupLine />;
  if (hintUp.value) return <InstallLine />;
  return null;
}
