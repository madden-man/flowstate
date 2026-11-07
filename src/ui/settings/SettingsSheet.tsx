// The Settings sheet, reached from "Settings" in every page header (PLAN.md section 5, item 5).
// Package 0: the install hint, the light, the place for sunrise, sounds, haptics, export, import and
// storage health. Later packages add their rows (Still after midnight, kept lines, music, voices, PIN).
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Sheet } from '../parts/Sheet';
import { openSheet, dataVersion } from '../sheets';
import { settings, saveSettings, loadSettings } from '../settings';
import { parsePlace, sunTimes, clock, TOWNS, leaveStill, now } from '../light';
import { notebookDate } from '../date';
import { backupNow, parseBackup, importData, BackupError, type BackupFile, type ImportMode } from '../../db/backup';
import { isStandalone, storageHealth, askPersist, bytes, type StorageHealth } from '../../pwa/install';
import type { LightPin } from '../../db/schema';
import { MusicRows } from '../music/MusicRows';

const PINS: [LightPin, string][] = [['sky', 'Follow the sky'], ['day', 'Day'], ['night', 'Night']];

export function SettingsSheet() {
  return (
    <Sheet open={openSheet.value === 'settings'} onClose={() => { openSheet.value = null; }} title="Settings">
      <SettingsBody />
    </Sheet>
  );
}

function LightRow() {
  const pin = settings.value.light;
  return (
    <div class="fs-row stack">
      <span>Light</span>
      <div class="fs-opts" role="group" aria-label="Light">
        {PINS.map(([v, label]) => (
          <button key={v} type="button" class="fs-opt" aria-pressed={pin === v}
            onClick={() => { leaveStill(); void saveSettings({ light: v }); }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

function PlaceRow() {
  const place = settings.value.place;
  const [draft, setDraft] = useState(place?.name ?? '');
  const [miss, setMiss] = useState(false);
  const sun = sunTimes(new Date(now.value), place);
  const commit = () => {
    if (draft.trim() === (place?.name ?? '')) return;
    if (!draft.trim()) { setMiss(false); void saveSettings({ place: undefined }); return; }
    const p = parsePlace(draft);
    setMiss(!p);
    if (p) { setDraft(p.name); void saveSettings({ place: p }); }
  };
  return (
    <label class="fs-row stack">
      <span>Place for sunrise</span>
      <input class="fs-input" list="fs-towns" value={draft} placeholder="Evergreen, or 39.63, -105.32" autocomplete="off" enterKeyHint="done"
        onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setDraft(e.currentTarget.value)}
        onChange={commit}
        onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }} />
      <datalist id="fs-towns">{TOWNS.map(t => <option key={t.name} value={t.name} />)}</datalist>
      <span class="fs-note">{miss ? 'Not in the list: a town, or lat, lon' : sun.fromPlace ? `Sunrise ${clock(sun.rise)} · Sunset ${clock(sun.set)}` : 'Day 07:00 to 19:00'}</span>
    </label>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" class="fs-row" role="switch" aria-checked={on} onClick={() => set(!on)}>
      <span>{label}</span><small>{on ? 'On' : 'Off'}</small>
    </button>
  );
}

function ExportRow() {
  const last = settings.value.lastBackupAt;
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const outcome = await backupNow();
      if (outcome !== 'cancelled') await loadSettings();
    } finally { setBusy(false); }
  };
  return (
    <button type="button" class="fs-row" onClick={() => void run()} disabled={busy}>
      <span>Export</span><small>{last ? `Last ${notebookDate(new Date(last))}` : 'Never'}</small>
    </button>
  );
}

function ImportRow() {
  const [file, setFile] = useState<BackupFile | null>(null);
  const [note, setNote] = useState('');
  const pick = async (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    try { setFile(parseBackup(await f.text())); setNote(''); }
    catch (err) { setFile(null); setNote(err instanceof BackupError ? err.message : 'Could not read that file'); }
  };
  const run = async (mode: ImportMode) => {
    if (!file) return;
    try {
      const r = await importData(file, mode);
      setNote(mode === 'replace' ? `Replaced: ${r.added} rows` : `Merged: ${r.added} new, ${r.updated} newer`);
      await loadSettings();
      dataVersion.value++;
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Import failed');
    }
    setFile(null);
  };
  return (
    <div>
      <label class="fs-row">
        <span>Import</span><small>{file ? `From ${notebookDate(new Date(file.exportedAt))}` : 'A FlowState file'}</small>
        <input class="fs-hidden" type="file" accept="application/json,.json" onChange={pick} />
      </label>
      {file && (
        <div class="fs-opts" role="group" aria-label="How to import" style={{ paddingBottom: 'var(--s1)' }}>
          <button type="button" class="fs-opt" onClick={() => void run('merge')}>Merge, newest wins</button>
          <button type="button" class="fs-opt" onClick={() => void run('replace')}>Replace this journal</button>
          <button type="button" class="fs-word" onClick={() => setFile(null)}>Cancel</button>
        </div>
      )}
      {note && <span class="fs-note" role="status">{note}</span>}
    </div>
  );
}

function StorageRow() {
  const [h, setH] = useState<StorageHealth | null>(null);
  useEffect(() => { storageHealth().then(setH); }, []);
  const label = !h ? '' : h.persisted === null ? 'Unknown' : `${h.persisted ? 'Kept' : 'Not kept yet'}${h.usage !== undefined ? ` · ${bytes(h.usage)}` : ''}`;
  return (
    <button type="button" class="fs-row" onClick={async () => { await askPersist(); setH(await storageHealth()); }}>
      <span>Storage</span><small>{label}</small>
    </button>
  );
}

function SettingsBody() {
  const s = settings.value;
  return (
    <div class="fs-rows">
      {!isStandalone() && (
        <div class="fs-row stack" data-install-hint>
          <span>Add to Home Screen</span>
          <span class="fs-note">Share, then Add to Home Screen</span>
        </div>
      )}
      <LightRow />
      <PlaceRow />
      <Toggle label="Sounds" on={s.sounds} set={v => void saveSettings({ sounds: v })} />
      <Toggle label="Haptics" on={s.haptics} set={v => void saveSettings({ haptics: v })} />
      <MusicRows />
      <a class="fs-row" href="#/voices"><span>Voices</span><small>Rename, recolour, twin</small></a>
      <ExportRow />
      <ImportRow />
      <StorageRow />
    </div>
  );
}
