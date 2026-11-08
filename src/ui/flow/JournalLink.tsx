// The link row on a journal page written about a flow episode (F2, the Journal helper; PLAN-FLOWS.md 4 step 10):
// "Flow · Panic · 21:40" (and "to 22:50" once it ended) in print, the step in italic under it ("under the skin, now"
// while the episode is live). A tap goes back to the flow, on its step while live. Like page.music: the page keeps an
// id (page.flow), and this row reads the rest. Times are digits, so in Still the row keeps only the step.
import { useEffect, useState } from 'preact/hooks';
import { clockTime } from '../date';
import { dataVersion } from '../sheets';
import { flowLinkOf, type FlowLinkRow } from '../../model/tips';

export function JournalLink({ episodeId }: { episodeId: string }) {
  const [row, setRow] = useState<FlowLinkRow | null>(null);
  useEffect(() => {
    let on = true;
    void flowLinkOf({ flow: { episodeId } }).then(r => { if (on) setRow(r ?? null); });
    return () => { on = false; };
  }, [episodeId, dataVersion.value]);
  if (!row) return null;
  const when = `${clockTime(new Date(row.startedAt))}${row.endedAt !== undefined ? ` to ${clockTime(new Date(row.endedAt))}` : ''}`;
  const step = row.step.toLowerCase();
  return (
    <nav class="fs-links fl-journal-link" aria-label="Written about">
      <a class="fs-link" href={row.href}>
        <small>Flow · {row.flow}<b> · {when}</b></small>
        <span>{row.live ? `${step}, now` : step}</span>
      </a>
    </nav>
  );
}
