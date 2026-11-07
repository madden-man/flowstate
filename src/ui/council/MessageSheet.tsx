// Long press a council message: Keep close, Speak as (another voice, or plain ink), move it up or down,
// or link this council to a page (search by title or first line, the same pattern as the Journal's Link
// a page). Reply is a tap on the message itself (V3), so it is not here.
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Sheet } from '../parts/Sheet';
import { Chip } from '../parts/Chip';
import { openSheet } from '../sheets';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';
import type { Read } from '../../db/fields';
import type { Message } from '../../db/schema';
import { keepClose, reorderMessage, linkCandidates, linkPages, firstLine, revoice, chipVoices, type Linked } from '../../model/council';
import { voiceList } from './state';
import { light } from '../light';
import { voiceColour } from '../voice';
import { messagesOf } from '../../model/pages';

type Props = { pageId: string; message: Read<Message> | null; onChanged: () => Promise<unknown> | void };

export function MessageSheet({ pageId, message, onChanged }: Props) {
  const open = openSheet.value === 'council-message';
  const [linking, setLinking] = useState(false);
  const [voicing, setVoicing] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Linked[]>([]);
  const [place, setPlace] = useState<{ i: number; n: number }>({ i: 0, n: 0 });
  const close = () => { openSheet.value = null; };

  useEffect(() => { if (open) { setLinking(false); setVoicing(false); setQ(''); } }, [open, message?.id]);
  useEffect(() => {
    if (!open || !message) return;
    messagesOf(pageId).then(ms => setPlace({ i: ms.findIndex(m => m.id === message.id), n: ms.length }));
  }, [open, message?.id, message?.at]);
  useEffect(() => {
    if (!linking) return;
    let live = true;
    linkCandidates(q, pageId).then(r => { if (live) setFound(r.slice(0, 12)); });
    return () => { live = false; };
  }, [linking, q]);

  const move = async (by: number) => {
    if (!message) return;
    await reorderMessage(pageId, message.id, place.i + by);
    await onChanged();
  };

  const speakAs = async (voiceId: string | undefined) => {
    if (!message) return;
    await revoice(message.id, voiceId);
    await onChanged();
    close();
  };

  return (
    <Sheet open={open && !!message} onClose={close} title={linking ? 'Link a page' : 'Message'}>
      {message && !linking && (
        <div class="fs-rows">
          <p class="fs-note fs-said">{firstLine(message.text)}</p>
          <button type="button" class="fs-row" onClick={async () => {
            const next = !message.kept;
            await keepClose(message.id, next);
            if (next) { tick('keep'); bell('keep'); }
            await onChanged();
            close();
          }}><span>{message.kept ? 'Kept close' : 'Keep close'}</span>{message.kept && <small>Let go</small>}</button>
          <button type="button" class="fs-row" aria-expanded={voicing} onClick={() => setVoicing(!voicing)}>
            <span>Speak as…</span><small>{voiceList.value.find(v => v.id === message.voiceId)?.name ?? 'Plain ink'}</small>
          </button>
          {voicing && (
            <div class="fs-chips" role="group" aria-label="Speak as">
              <Chip label="Ink" ariaLabel="Plain ink" pressed={!message.voiceId} onPress={() => void speakAs(undefined)} />
              {chipVoices(voiceList.value, light.value === 'still').map(v => (
                <Chip key={v.id} label={v.name} colour={voiceColour(v.colour, v.shade)} deep={v.shade === 'deep'}
                  pressed={message.voiceId === v.id} onPress={() => void speakAs(v.id)} />
              ))}
            </div>
          )}
          <button type="button" class="fs-row" disabled={place.i <= 0} onClick={() => void move(-1)}><span>Move up</span></button>
          <button type="button" class="fs-row" disabled={place.i < 0 || place.i >= place.n - 1} onClick={() => void move(1)}><span>Move down</span></button>
          <button type="button" class="fs-row" onClick={() => setLinking(true)}><span>Link a page</span><small>A question or an entry</small></button>
        </div>
      )}
      {linking && (
        <div class="fs-rows">
          <label class="fs-row stack">
            <span>Find</span>
            <input class="fs-input" value={q} placeholder="a title or a first line" autocomplete="off" enterKeyHint="search"
              onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setQ(e.currentTarget.value)} />
          </label>
          {found.map(f => (
            <button key={f.id} type="button" class="fs-row" onClick={async () => { await linkPages(pageId, f.id); await onChanged(); close(); }}>
              <span class={f.kind === 'question' ? 'fs-q' : undefined}>{f.label}</span><small>{f.kind === 'question' ? 'Question' : 'Entry'}</small>
            </button>
          ))}
          <button type="button" class="fs-word" onClick={() => setLinking(false)}>Back</button>
        </div>
      )}
    </Sheet>
  );
}
