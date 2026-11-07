// The two Settings rows for music (PLAN.md section 5 item 5): Music (connect or disconnect) and, once
// connected, Refresh playlist. One plain line under them when something needs saying; never an alert.
import { accountName, connectSpotify, connected, disconnectSpotify, outcome, outcomeLine, readNote, reading, refreshPlaylist } from './state';

export function MusicRows() {
  const line = outcomeLine(outcome.value);
  if (!connected.value) {
    return (
      <div>
        <button type="button" class="fs-row" onClick={() => void connectSpotify()}>
          <span>Music</span><small>Connect Spotify</small>
        </button>
        {line && <span class="fs-note" role="status">{line}</span>}
      </div>
    );
  }
  return (
    <div>
      <div class="fs-row fs-musicrow">
        <span>Music</span>
        <span class="fs-musicacct">
          <small>Connected as {accountName.value || 'you'}</small>
          <button type="button" class="fs-word" onClick={() => void disconnectSpotify()}>Disconnect</button>
        </span>
      </div>
      <button type="button" class="fs-row" onClick={() => void refreshPlaylist()} disabled={reading.value}>
        <span>Refresh playlist</span><small>{reading.value ? 'reading the playlist' : ''}</small>
      </button>
      {readNote.value && <span class="fs-note" role="status">{readNote.value}</span>}
    </div>
  );
}
