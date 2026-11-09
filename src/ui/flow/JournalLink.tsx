// The link row on a journal page written about something (F2, the Journal helper; PLAN-FLOWS.md 4 step 10): for a
// flow episode "Flow · Panic · 21:40" (and "to 22:50" once it ended) in print, the step in italic under it ("under the
// skin, now" while the episode is live), and a tap goes back to the flow, on its step while live. For the page after a
// sit (PLAN-MEDITATE.md S2, page.sit) the same row: "Sat · 07:39 to 07:51", the sound under it, and a tap goes to
// Meditate. Like page.music: the page keeps an id (page.flow, page.sit), and this row reads the rest. Times are digits,
// so in Still the row keeps only the step or the sound.
import { useEffect, useState } from 'preact/hooks';
import { clockTime } from '../date';
import { dataVersion } from '../sheets';
import { flowLinkOf } from '../../model/tips';
import { sitLinkOf } from '../../model/sits';

/** What the row says, whichever it links: the head in print, the times, the line in italic under them. */
type Shown = { href: string; head: string; startedAt: number; endedAt?: number; line: string };

async function shownOf(link: { episodeId: string } | { sitId: string }): Promise<Shown | undefined> {
  if ('sitId' in link) {
    const s = await sitLinkOf({ sit: link });
    return s && { href: s.href, head: 'Sat', startedAt: s.startedAt, endedAt: s.endedAt, line: s.sound };
  }
  const f = await flowLinkOf({ flow: link });
  if (!f) return undefined;
  const step = f.step.toLowerCase();
  return { href: f.href, head: `Flow · ${f.flow}`, startedAt: f.startedAt, endedAt: f.endedAt, line: f.live ? `${step}, now` : step };
}

export function JournalLink(link: { episodeId: string } | { sitId: string }) {
  const [row, setRow] = useState<Shown | null>(null);
  const key = 'sitId' in link ? `sit:${link.sitId}` : `flow:${link.episodeId}`;
  useEffect(() => {
    let on = true;
    void shownOf(link).then(r => { if (on) setRow(r ?? null); });
    return () => { on = false; };
  }, [key, dataVersion.value]);
  if (!row) return null;
  const when = `${clockTime(new Date(row.startedAt))}${row.endedAt !== undefined ? ` to ${clockTime(new Date(row.endedAt))}` : ''}`;
  return (
    <nav class="fs-links fl-journal-link" aria-label="Written about">
      <a class="fs-link" href={row.href}>
        <small>{row.head}<b> · {when}</b></small>
        <span>{row.line}</span>
      </a>
    </nav>
  );
}
