// The long-press sheet on any line (PLAN.md section 5, item 1; v2): five things, no more. Keep close,
// Speak as…, Ask this, Take to the council, Link a page. It rises from the bottom; the tabs stay in reach.
// SpeakSheet is the margin dot's "more": the whole pantheon for the current line.
import { useEffect, useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { Chip } from '../parts/Chip';
import { openSheet } from '../sheets';
import { notebookDate } from '../date';
import { voiceColour } from '../voice';
import { findPages, type Listed, type LinkKind } from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Message, Page as PageRow, Voice } from '../../db/schema';

type Acts = {
  keep: () => void; speak: (voiceId: string | undefined) => void; ask: () => void;
  link: (other: Read<PageRow>, how: LinkKind) => void; council: () => void;
};
type Props = {
  held: Read<Message> | null; page?: Read<PageRow>; voices: Read<Voice>[]; byId: Map<string, Read<Voice>>;
  acts: Acts; onClose: () => void;
};

function LinkPicker({ page, onPick }: { page: Read<PageRow>; onPick: (p: Read<PageRow>, how: LinkKind) => void }) {
  const [q, setQ] = useState('');
  const [how, setHow] = useState<LinkKind>('related');
  const [found, setFound] = useState<Listed[]>([]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => findPages(q, page.id).then(r => live && setFound(r.filter(x => !page.linkedPageIds.includes(x.page.id)))), 100);
    return () => { live = false; clearTimeout(t); };
  }, [q, page.id]);
  return (
    <div class="fs-row stack fs-picker">
      <input class="fs-input" type="text" enterKeyHint="search" aria-label="Find a page by its title or first line" value={q}
        onInput={e => setQ(e.currentTarget.value)} />
      <div class="fs-opts" role="group" aria-label="How they are linked">
        <button type="button" class="fs-opt" aria-pressed={how === 'related'} onClick={() => setHow('related')}>Related</button>
        <button type="button" class="fs-opt" aria-pressed={how === 'smaller'} onClick={() => setHow('smaller')}>Smaller version of…</button>
      </div>
      {found.map(x => (
        <button key={x.page.id} type="button" class="fs-row stack fs-list-row" onClick={() => onPick(x.page, how)}>
          <span class="fs-list-meta">{notebookDate(new Date(x.page.createdAt))}</span>
          <span class="fs-list-line">{x.line}</span>
        </button>
      ))}
    </div>
  );
}

export function LineSheet({ held, page, voices, byId, acts, onClose }: Props) {
  const open = openSheet.value === 'line' && !!held && !!page;
  const [more, setMore] = useState<'speak' | 'link' | null>(null);
  useEffect(() => { if (open) setMore(null); }, [open, held?.id]);
  const voice = held?.voiceId ? byId.get(held.voiceId) : undefined;
  return (
    <Sheet open={open} onClose={onClose} title="This line">
      {held && page && (
        <>
          <p class="fs-held">{held.text}</p>
          <div class="fs-rows">
            <button type="button" class="fs-row" role="switch" aria-checked={held.kept} onClick={acts.keep}>
              <span>Keep close</span><small>{held.kept ? 'Kept' : 'Echo · Still'}</small>
            </button>
            <button type="button" class="fs-row" aria-expanded={more === 'speak'} onClick={() => setMore(more === 'speak' ? null : 'speak')}>
              <span>Speak as…</span><small>{voice?.name ?? 'Ink'}</small>
            </button>
            {more === 'speak' && (
              <div class="fs-chips" role="group" aria-label="Speak as">
                <Chip label="Ink" ariaLabel="Plain ink" pressed={!held.voiceId} onPress={() => acts.speak(undefined)} />
                {voices.map(v => (
                  <Chip key={v.id} label={v.name} colour={voiceColour(v.colour, v.shade)} deep={v.shade === 'deep'}
                    pressed={held.voiceId === v.id} onPress={() => acts.speak(v.id)} />
                ))}
              </div>
            )}
            <button type="button" class="fs-row" onClick={acts.ask}><span>Ask this</span><small>A question page</small></button>
            <button type="button" class="fs-row" onClick={acts.council}><span>Take to the council</span></button>
            <button type="button" class="fs-row" aria-expanded={more === 'link'} onClick={() => setMore(more === 'link' ? null : 'link')}>
              <span>Link a page</span><small>Related</small>
            </button>
            {more === 'link' && <LinkPicker page={page} onPick={acts.link} />}
          </div>
        </>
      )}
    </Sheet>
  );
}

/** The margin dot's "more": every voice, Ink first, for the current line only. Deep twins leave in Still (CSS). */
export function SpeakSheet({ voices, current, onPick, onClose }: {
  voices: Read<Voice>[]; current?: string; onPick: (voiceId: string | undefined) => void; onClose: () => void;
}) {
  return (
    <Sheet open={openSheet.value === 'speak'} onClose={onClose} title="Who speaks this line">
      <div class="fs-chips fs-chips-wrap" role="group" aria-label="Every voice">
        <Chip label="Ink" ariaLabel="Plain ink" pressed={!current} onPress={() => onPick(undefined)} />
        {voices.map(v => (
          <Chip key={v.id} label={v.name} colour={voiceColour(v.colour, v.shade)} deep={v.shade === 'deep'}
            pressed={current === v.id} onPress={() => onPick(v.id)} />
        ))}
      </div>
    </Sheet>
  );
}
