// Songs (PLAN-WORLDS.md section 6, W6): three pages, reached only in a world (his own notebook has no Songs row).
//
//   #/flow/songs      the world's songs: "Hum" first, for a melody with no song yet, then "New song", then the songs,
//                     newest first (in Songbook, the songs Music Companion keeps that the phone does not, after them);
//   #/flow/songs/:id  the song page: ruled paper, the title at the title size, the lyric one line a rule; a blank rule
//                     starts a section, whose name (Verse, Chorus, Bridge) is print above it, chosen from chips; the
//                     takes under the line each is pinned to, the loose ones at the foot; under the thumb Hold to hum,
//                     and the chips: the section, the Character chip in a novel, Tap tempo; at the foot Move to...
//   #/flow/hum        the loose hums, each with a line for its title: given one, it becomes a song.
//
// No counts of any kind (rule 15): no syllables, no number of songs or takes. Still (rule 13): the chips, the key and the
// length leave; the lines and the pitch lines stay. Nothing here writes a word for him.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Fragment, type JSX } from 'preact';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Chip } from '../parts/Chip';
import { Sheet } from '../parts/Sheet';
import { StoryChips } from '../world/Chips';
import { openSheet, dataVersion } from '../sheets';
import { settings } from '../settings';
import { wornWorld } from '../notebook';
import { tick } from '../parts/Haptic';
import { notebookDate } from '../date';
import { voiceColour } from '../voice';
import { hueOf } from '../../bridge/colour';
import { pocketFor } from '../../model/story';
import { SECTION_NAMES, blankSong, linesOf, looseHums, nameSection, newId, saveSong, saveTake, sectionStarts, songFromHum, songFromPocket, songList, songOf, takesOf, withLyric, type SongRow } from '../../model/songs';
import { moveSong, settleMoves } from '../../model/move';
import { bpmOf } from '../../model/tempo';
import { carryNow } from '../../model/carry';
import type { Song, Take } from '../../db/schema';
import type { NovelPocket } from '../../bridge/protocol';
import { HumButton } from './HumButton';
import { PitchSvg, TakeLine } from './Take';
import type { Hummed } from './hum';
import './songs.css';

const SAVE_MS = 300;

const takeFrom = (h: Hummed, songId?: string, line?: { index: number; text: string }, bpm?: number): Take => ({
  id: newId(), at: Date.now(), seconds: h.seconds, audio: h.audio, audioType: h.audioType, pitch: h.pitch,
  ...(songId ? { songId } : {}), ...(h.key ? { key: h.key } : {}), ...(bpm ? { bpm } : {}),
  ...(line ? { lineId: String(line.index), lineText: line.text } : {}),
});

/** What the microphone said, in print: refused, or the cap reached. */
function MicLine({ said }: { said: 'refused' | 'cap' | null }) {
  if (!said) return null;
  return <p class="fs-quiet sg-said">{said === 'refused' ? 'The microphone is off for FlowState.' : 'Three minutes is the most a hum keeps.'}</p>;
}

// ---------------------------------------------------------------- the list

export function SongsList() {
  const [rows, setRows] = useState<SongRow[] | undefined>(undefined);
  const world = wornWorld.value;
  useEffect(() => {
    let on = true;
    // a move into this world that stopped halfway is finished first (model/move.ts)
    void (world ? settleMoves(world).catch(() => 0) : Promise.resolve(0))
      .then(() => songList(settings.value))
      .then(r => { if (on) setRows(r); })
      .catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [dataVersion.value, world, settings.value.bridge?.pocket?.stamp]);
  return (
    <Page label="Songs" back={{ word: 'Flow', href: '#/flow' }} drawn={rows !== undefined}>
      <div class="fs-sheetof fs-rules fs-flows sg-list">
        <a class="fs-row fs-list-row" href="#/flow/hum">
          <span class="fs-list-line">Hum</span>
          <small class="fs-list-meta">A melody with no song yet</small>
        </a>
        <a class="fs-row fs-list-row" href="#/flow/songs/new">
          <span class="fs-list-line">New song</span>
          <small class="fs-list-meta">A title, then the lines</small>
        </a>
        {(rows ?? []).map(r => (
          <a key={r.id} class="fs-row fs-list-row" href={`#/flow/songs/${encodeURIComponent(r.id)}`} data-song={r.id}>
            <span class="fs-list-line">{r.title || <span class="fs-quiet">No title yet</span>}</span>
            <small class="fs-list-meta fs-notstill">{r.fromMac ? 'Kept on the Mac' : r.updatedAt ? notebookDate(new Date(r.updatedAt)) : ''}</small>
          </a>
        ))}
      </div>
    </Page>
  );
}

/** #/flow/songs/new: a fresh id, and the page for it; nothing is written until he writes. */
export function NewSong() {
  const { route } = useLocation();
  useEffect(() => { route(`/flow/songs/${newId()}`, true); }, []);
  return null;
}

// ---------------------------------------------------------------- the song page

/** Grows a one-rule field to its text, so a long line wraps onto the rules below it. */
const grow = (el: HTMLTextAreaElement | null) => { if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };

export function SongPage({ id }: { id: string }) {
  const { route } = useLocation();
  const [song, setSong] = useState<Song | undefined>(undefined);
  const [takes, setTakes] = useState<Take[]>([]);
  const [caret, setCaret] = useState<number | null>(null);
  const [live, setLive] = useState<{ pitch: readonly number[] } | null>(null);
  const [said, setSaid] = useState<'refused' | 'cap' | null>(null);
  const taps = useRef<number[]>([]);
  const saved = useRef<Pick<Song, 'lyric' | 'sections'> | undefined>(undefined);
  const exists = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<Song | undefined>(undefined);
  const lineEls = useRef<(HTMLTextAreaElement | null)[]>([]);
  const focusNext = useRef<{ line: number; at: number } | null>(null);
  const pocket = pocketFor(settings.value, wornWorld.value);

  const read = async () => {
    const s = await songOf(id);
    exists.current = !!s;
    // a song Songbook's pocket names that the phone does not hold yet: its title and the Mac's lyric, and nothing
    // written until he writes
    const fromMac = settings.value.bridge?.pocket?.pocket.kind === 'songs' ? settings.value.bridge.pocket.pocket.songs.find(x => x?.id === id) : undefined;
    const next = s ?? (fromMac ? songFromPocket(fromMac) : blankSong(id));
    saved.current = { lyric: next.lyric, sections: next.sections };
    latest.current = next;
    setSong(next);
    setTakes(await takesOf(id));
  };
  useEffect(() => { void read().catch(() => setSong(blankSong(id))); }, [id, dataVersion.value]);

  // moved to another world (Move to): nothing more is written here
  const gone = useRef(false);
  const flush = async () => {
    clearTimeout(timer.current);
    const s = latest.current;
    if (!s || gone.current) return;
    if (!exists.current && !s.title.trim() && !s.lyric.trim()) return;
    const next = await saveSong(s, saved.current);
    exists.current = true;
    saved.current = { lyric: next.lyric, sections: next.sections };
    // only the time written comes back: anything changed while it was writing (a chip, a line) stays as it is now
    latest.current = { ...latest.current!, updatedAt: next.updatedAt };
    setTakes(await takesOf(id));
  };
  useEffect(() => () => { void flush(); }, [id]);

  const change = (patch: Partial<Song>) => {
    const { lyric, ...rest } = patch;
    let next = { ...latest.current!, ...rest };
    // the sections follow the lines as they come and go
    if (lyric !== undefined && lyric !== next.lyric) next = withLyric(next, lyric);
    latest.current = next;
    setSong(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_MS);
  };

  const lines = useMemo(() => (song ? linesOf(song.lyric) : ['']), [song?.lyric]);
  const starts = useMemo(() => sectionStarts(lines), [lines]);
  const nameAt = (i: number) => song?.sections.find(s => s.line === i)?.name;
  const setLine = (i: number, text: string) => { const ls = [...lines]; ls[i] = text; change({ lyric: ls.join('\n') }); };

  // after a split or a join, the caret goes where the pen would be, before the next paint
  useLayoutEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    const el = lineEls.current[f.line];
    if (el) { el.focus(); el.setSelectionRange(f.at, f.at); }
  }, [lines.length]);

  const onKey = (i: number) => (e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      const at = el.selectionStart ?? el.value.length;
      const ls = [...lines];
      ls.splice(i, 1, el.value.slice(0, at), el.value.slice(at));
      focusNext.current = { line: i + 1, at: 0 };
      change({ lyric: ls.join('\n') });
      setCaret(i + 1);
    } else if (e.key === 'Backspace' && i > 0 && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      const ls = [...lines];
      const at = ls[i - 1].length;
      ls.splice(i - 1, 2, ls[i - 1] + ls[i]);
      focusNext.current = { line: i - 1, at };
      change({ lyric: ls.join('\n') });
      setCaret(i - 1);
    }
  };

  const onTake = async (h: Hummed) => {
    await flush();
    const line = caret !== null && lines[caret] !== undefined ? { index: caret, text: lines[caret] } : undefined;
    const s = latest.current!;
    // a take on a song never written yet writes the song first, so the take always has its song
    if (!exists.current) { await saveSong(s); exists.current = true; }
    await saveTake(takeFrom(h, id, line, s.bpm));
    setLive(null);
    setTakes(await takesOf(id));
  };

  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current, now].slice(-16);
    const bpm = bpmOf(taps.current);
    if (bpm) change({ bpm });
  };

  const sectionLine = caret ?? (lines.length ? 0 : null);
  const sectionHere = sectionLine === null ? undefined : [...starts].reverse().find(s => s <= sectionLine);
  const pinned = (i: number) => takes.filter(t => t.lineId === String(i));
  const loose = takes.filter(t => t.lineId === undefined || Number(t.lineId) >= lines.length);
  const others = (settings.value.worlds ?? []).filter(w => w.id !== wornWorld.value);

  if (!song) return <Page back={{ word: 'Songs', href: '#/flow/songs' }} drawn={false} />;
  return (
    <Page back={{ word: 'Songs', href: '#/flow/songs' }} drawn>
      <div class="fs-sheetof fs-rules fs-col sg-page">
        <textarea class="fs-edit fs-q sg-title" rows={1} spellcheck={false} aria-label="Title" placeholder="Title"
          value={song.title} ref={grow}
          onInput={e => { grow(e.currentTarget); change({ title: e.currentTarget.value.replace(/\n/g, ' ') }); }}
          onFocus={() => setCaret(null)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lineEls.current[0]?.focus(); setCaret(0); } }} />
        {lines.map((l, i) => (
          <Fragment key={i}>
            {starts.includes(i) && nameAt(i) && <p class="wd-sec" data-sec={i}>{nameAt(i)}</p>}
            <div class={`fs-msg sg-line${caret === i ? ' cur' : ''}`} data-line={i}>
              <textarea class="fs-edit" rows={1} spellcheck={false} aria-label={`Line ${i + 1}`} value={l}
                ref={el => { lineEls.current[i] = el; grow(el); }}
                onInput={e => { grow(e.currentTarget); setLine(i, e.currentTarget.value.replace(/\n/g, '')); }}
                onFocus={() => setCaret(i)} onKeyDown={onKey(i)} onBlur={() => void flush()} />
            </div>
            {pinned(i).map(t => <TakeLine key={t.id} take={t} />)}
            {live && caret === i && <div class="wd-take sg-live" aria-hidden="true"><PitchSvg pitch={live.pitch} live /></div>}
          </Fragment>
        ))}
        {loose.map(t => <TakeLine key={t.id} take={t} />)}
        {live && caret === null && <div class="wd-take sg-live" aria-hidden="true"><PitchSvg pitch={live.pitch} live /></div>}
        <MicLine said={said} />
        {others.length > 0 && (
          <nav class="fs-ask fs-walk" aria-label="This song">
            <button type="button" class="fs-word" onClick={() => { void flush(); openSheet.value = 'move'; tick('sheet'); }}>Move to…</button>
          </nav>
        )}
      </div>
      <div class="fs-composer-wrap">
        <div class="fs-chips fs-notstill" role="group" aria-label="This song">
          {sectionHere !== undefined && SECTION_NAMES.map(n => (
            <Chip key={n} label={n} pressed={nameAt(sectionHere) === n}
              onPress={() => change({ sections: nameSection(song, sectionHere, n) })} />
          ))}
          {pocket && <CharacterChips pocket={pocket} song={song} />}
          <Chip label={song.bpm ? `${song.bpm} BPM` : 'Tap tempo'} ariaLabel="Tap tempo" add={!song.bpm} pressed={!!song.bpm} onPress={tap} />
        </div>
        <HumButton onFrame={p => setLive({ pitch: p })} onTake={t => void onTake(t)}
          onRefused={() => setSaid('refused')} onCap={() => setSaid('cap')} />
      </div>
      {pocket && <SongAboutSheet pocket={pocket} song={song} onToggle={cid => {
        const ids = song.characterIds ?? [];
        change({ characterIds: ids.includes(cid) ? ids.filter(x => x !== cid) : [...ids, cid] });
      }} />}
      <MoveSheet song={song} onMoved={() => route('/flow/songs')}
        beforeMove={async () => { await flush(); gone.current = true; clearTimeout(timer.current); }}
        onFailed={() => { gone.current = false; }} />
    </Page>
  );
}

const colourOf = (p: NovelPocket, id: string) => {
  const c = p.characters.find(x => x.id === id);
  return c ? voiceColour({ hue: hueOf(c.familyColour) }, 'light') : undefined;
};

/** In a novel world, the Character chip: the characters the song belongs to, in their colours, or "+ character". */
function CharacterChips({ pocket, song }: { pocket: NovelPocket; song: Song }) {
  const raise = () => { openSheet.value = 'song-about'; tick('sheet'); };
  const chars = (song.characterIds ?? []).map(id => pocket.characters.find(c => c.id === id)).filter(c => !!c);
  if (!chars.length) return <Chip label="+ character" add onPress={raise} />;
  return <>{chars.map(c => <Chip key={c!.id} label={c!.fullName} colour={colourOf(pocket, c!.id)} pressed onPress={raise} />)}</>;
}

function SongAboutSheet({ pocket, song, onToggle }: { pocket: NovelPocket; song: Song; onToggle: (id: string) => void }) {
  return (
    <Sheet open={openSheet.value === 'song-about'} onClose={() => { openSheet.value = null; }} title="Whose song">
      <StoryChips pocket={{ ...pocket, places: [] }} chips={{ characterIds: song.characterIds ?? [], placeIds: [] }}
        onToggle={(_k, cid) => onToggle(cid)} />
    </Sheet>
  );
}

/** "Move to": the other worlds on the shelf, novels and Songbook; never his own pages, which have no Songs. */
function MoveSheet({ song, onMoved, beforeMove, onFailed }: { song: Song; onMoved: () => void; beforeMove: () => Promise<void>; onFailed: () => void }) {
  const from = wornWorld.value;
  const others = (settings.value.worlds ?? []).filter(w => w.id !== from);
  const [busy, setBusy] = useState(false);
  const go = async (to: string) => {
    if (!from || busy) return;
    setBusy(true);
    try {
      await beforeMove();
      await moveSong(song.id, from, to);
      openSheet.value = null;
      void carryNow().catch(() => undefined);
      onMoved();
    } catch {
      // the song stays here (a stop halfway is finished by settleMoves on the next Songs list)
      onFailed();
    } finally { setBusy(false); }
  };
  return (
    <Sheet open={openSheet.value === 'move'} onClose={() => { openSheet.value = null; }} title="Move to">
      <div class="fs-rows" role="group" aria-label="Worlds">
        {others.map(w => (
          <button key={w.id} type="button" class="fs-row" data-world={w.id} disabled={busy} onClick={() => void go(w.id)}>
            <span>{w.name}</span><small>{w.kind === 'novel' ? 'A novel' : 'Songs of no book'}</small>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- the loose hums

export function Hums() {
  const { route } = useLocation();
  const [hums, setHums] = useState<Take[] | undefined>(undefined);
  const [live, setLive] = useState<readonly number[] | null>(null);
  const [said, setSaid] = useState<'refused' | 'cap' | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const read = async () => setHums(await looseHums());
  useEffect(() => { void read().catch(() => setHums([])); }, [dataVersion.value]);
  const named = useRef(new Set<string>());
  const name = async (t: Take) => {
    const title = (titles[t.id] ?? '').trim();
    // once only: Enter names it and the page turns, and the blur that follows must not name it again
    if (!title || named.current.has(t.id)) return;
    named.current.add(t.id);
    const s = await songFromHum(t, title);
    route(`/flow/songs/${s.id}`);
  };
  return (
    <Page label="Hum" back={{ word: 'Songs', href: '#/flow/songs' }} drawn={hums !== undefined}>
      <div class="fs-sheetof fs-rules fs-col sg-page sg-hums">
        {live && <div class="wd-take sg-live" aria-hidden="true"><PitchSvg pitch={live} live /></div>}
        {(hums ?? []).map(t => (
          <div class="sg-hum-row" key={t.id} data-hum={t.id}>
            <TakeLine take={t} />
            <textarea class="fs-edit sg-name" rows={1} spellcheck={false} aria-label="Give it a title" placeholder="Give it a title"
              value={titles[t.id] ?? ''}
              onInput={e => setTitles(x => ({ ...x, [t.id]: e.currentTarget.value.replace(/\n/g, ' ') }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void name(t); } }}
              onBlur={() => void name(t)} />
          </div>
        ))}
        <MicLine said={said} />
      </div>
      <div class="fs-composer-wrap">
        <HumButton onFrame={p => setLive(p)} onTake={h => { setLive(null); void saveTake(takeFrom(h)).then(read); }}
          onRefused={() => setSaid('refused')} onCap={() => setSaid('cap')} />
      </div>
    </Page>
  );
}
