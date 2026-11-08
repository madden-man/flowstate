// "Your playlists" (PLAN-V3.md section 5.4), from Settings: every playlist the account owns, in Spotify's
// order, a drawn check per row. Ticking one puts it under the music line and reads it at once, the quiet
// line naming it ("reading master (ii)"); unticking keeps its covers. Read again, at the bottom, reads the
// list and the ticked ones again, skipping any whose snapshot has not moved. A refused read is one plain
// line, never an alert. No counts. Done goes back to Settings.
import { useEffect } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { Check } from '../parts/Check';
import { openSheet } from '../sheets';
import { allPlaylists, choose, openPlaylistsList, readNote, readPlaylists, reading } from './state';

export function PlaylistsSheet() {
  const open = openSheet.value === 'playlists';
  useEffect(() => { if (open) void openPlaylistsList(); }, [open]);
  const rows = allPlaylists.value;
  return (
    <Sheet open={open} onClose={() => { openSheet.value = 'settings'; }} title="Your playlists">
      {reading.value && <p class="fs-note">{reading.value}</p>}
      {readNote.value && <p class="fs-note" role="status">{readNote.value}</p>}
      <div class="fs-music-screen fs-mylists" role="group" aria-label="Your playlists">
        {rows?.map(p => (
          <Check key={p.id} checked={p.chosen} onChange={on => void choose(p.id, on)}>{p.name}</Check>
        ))}
        {rows && !rows.length && !reading.value && <p class="fs-note">No playlists of your own yet</p>}
      </div>
      <div class="fs-readagain">
        <button type="button" class="fs-word" disabled={!!reading.value} onClick={() => void readPlaylists()}>Read again</button>
      </div>
    </Sheet>
  );
}
