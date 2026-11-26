// Songs (PLAN-WORLDS.md section 6, W6): a world's songs and its takes, read and written through the fields layer on the
// notebook worn. A song is a title and a lyric, one line a rule; a blank line starts a section, and a section's name
// (Verse, Chorus, Bridge) is his choice from chips, kept by the line it starts on. A take is a hum: its audio (sealed),
// its pitch line and key guess (./pitch.ts), a tempo if he tapped one, and the lyric line it is pinned to, or none. A
// take with no song is a loose hum; giving it a title makes it a song.
//
// Songs live only in a world: his own notebook has no Songs row (section 4), and nothing here is offered there. Nothing
// here writes a word for him: every title and line is his; the key is the key finder's print, never a sentence.
import { store, worn, type Read } from '../db/fields';
import type { Settings, Song, Take } from '../db/schema';
import type { PocketSong } from '../bridge/protocol';

/** The names a section may take, in the order the chips show them. */
export const SECTION_NAMES = ['Verse', 'Chorus', 'Bridge'] as const;

export const newId = () => crypto.randomUUID();

// ---------------------------------------------------------------- the lyric, its lines and sections

export const linesOf = (lyric: string): string[] => lyric.split('\n');
const blank = (l: string | undefined) => !l || !l.trim();

/** The lines a section starts on: the first written line, and every written line after a blank one. */
export function sectionStarts(lines: readonly string[]): number[] {
  const out: number[] = [];
  lines.forEach((l, i) => { if (!blank(l) && (i === 0 || blank(lines[i - 1]) || !out.length)) out.push(i); });
  return out;
}

/**
 * The sections of a new lyric, named from the old. A section that starts after a blank rule keeps its name when the
 * line it starts on is still there (by its text), else it takes the name the section in its place had (by order). A
 * name standing on a line that is no section start (a Mac lyric can put a [Name] line anywhere: fromMacLyric) follows
 * that line by its text, and goes with it. A section with no name is left out.
 */
export function reSection(old: Pick<Song, 'lyric' | 'sections'>, lyric: string): Song['sections'] {
  const was = linesOf(old.lyric), now = linesOf(lyric);
  const oldStarts = sectionStarts(was);
  const isStart = new Set(oldStarts);
  const named = new Map<number, string>();
  for (const s of old.sections) if (isStart.has(s.line) && !named.has(s.line)) named.set(s.line, s.name);
  const byText = new Map<string, string>();
  for (const st of oldStarts) { const n = named.get(st); if (n && !byText.has(was[st])) byText.set(was[st], n); }
  const used = new Set<number>();
  const out: Song['sections'] = [];
  sectionStarts(now).forEach((st, k) => {
    let name = byText.get(now[st]);
    if (name) byText.delete(now[st]);
    else if (k < oldStarts.length && !used.has(k)) name = named.get(oldStarts[k]);
    used.add(k);
    if (name) out.push({ line: st, name });
  });
  // names in the middle of a section (from the Mac), by their line's text, the nearest match
  const taken = new Set(out.map(s => s.line));
  for (const s of old.sections) {
    if (isStart.has(s.line)) continue;
    const text = was[s.line];
    if (text === undefined) { if (s.line >= was.length) out.push({ line: now.length, name: s.name }); continue; }
    let best = -1;
    now.forEach((l, i) => { if (l === text && !taken.has(i) && (best < 0 || Math.abs(i - s.line) < Math.abs(best - s.line))) best = i; });
    if (best >= 0) { out.push({ line: best, name: s.name }); taken.add(best); }
  }
  return out.sort((a, b) => a.line - b.line);
}

// ---------------------------------------------------------------- the Mac's lyric (Music Companion, W7)

/** A Mac section line: `[Verse]`, `[Pre-chorus]`, `[From the phone]`, a name in brackets alone on its line. */
const MAC_HEAD = /^\s*\[([^\[\]\n]+)\]\s*$/;

/**
 * Music Companion's lyric as the phone keeps it: each `[Name]` line taken out of the text and kept as the section name
 * of the line under it (several on one line are all kept, in order; one at the very end stands past the last line).
 * Any name survives, not only Verse, Chorus and Bridge. With toMacLyric this round-trips: Mac text in, no edit, the
 * Mac rebuilds the identical text from what goes up.
 */
export function fromMacLyric(text: string): Pick<Song, 'lyric' | 'sections'> {
  const lines: string[] = [];
  const sections: Song['sections'] = [];
  for (const l of linesOf(text)) {
    const m = MAC_HEAD.exec(l);
    // only a line the Mac would write back the same ([Name], nothing round it, the name trimmed) is a section line
    if (m && l === `[${m[1]}]` && m[1] === m[1].trim()) sections.push({ line: lines.length, name: m[1] });
    else lines.push(l);
  }
  return { lyric: lines.join('\n'), sections };
}

/** The Mac's rebuilding of a phone lyric (Music Companion sketches.ts lyricsFromPhone, SK-5): each section a `[Name]`
 *  line above the line it starts on. Here for the round-trip test and nothing else. */
export function toMacLyric(song: Pick<Song, 'lyric' | 'sections'>): string {
  const lines = linesOf(song.lyric);
  const heads = new Map<number, string[]>();
  for (const s of song.sections) {
    const name = s.name.replace(/[[\]\n]/g, ' ').trim();
    if (!name) continue;
    const at = Math.min(s.line, lines.length);
    heads.set(at, [...(heads.get(at) ?? []), `[${name}]`]);
  }
  const out: string[] = [];
  for (let i = 0; i <= lines.length; i++) {
    out.push(...(heads.get(i) ?? []));
    if (i < lines.length) out.push(lines[i]);
  }
  return out.join('\n');
}

/** Names (or unnames, with the name it already has) the section the line is in. */
export function nameSection(song: Pick<Song, 'lyric' | 'sections'>, line: number, name: string): Song['sections'] {
  const starts = sectionStarts(linesOf(song.lyric));
  const st = [...starts].reverse().find(s => s <= line) ?? starts[0];
  if (st === undefined) return song.sections;
  const rest = song.sections.filter(s => s.line !== st);
  const had = song.sections.find(s => s.line === st)?.name;
  return had === name ? rest : [...rest, { line: st, name }].sort((a, b) => a.line - b.line);
}

/**
 * Keeps each pinned take on its line as the lyric changes: a take whose line moved (lines came or went above it) is
 * found again by its text, the nearest match; a take whose own line was rewritten stays at its place and takes the new
 * text; past the end, it stays on the last line. Returns the takes that changed.
 */
export function follow(takes: readonly Take[], lyric: string): Take[] {
  const lines = linesOf(lyric);
  const out: Take[] = [];
  for (const t of takes) {
    if (t.lineId === undefined) continue;
    const at = Number(t.lineId);
    if (lines[at] === t.lineText) continue;
    let best = -1;
    lines.forEach((l, i) => { if (l === t.lineText && (best < 0 || Math.abs(i - at) < Math.abs(best - at))) best = i; });
    const i = best >= 0 ? best : Math.max(0, Math.min(at, lines.length - 1));
    out.push({ ...t, lineId: String(i), lineText: lines[i] ?? '' });
  }
  return out;
}

// ---------------------------------------------------------------- what the notebook worn holds

const opened = <T extends object>(r: Read<T>): T => { const { locked: _, ...rest } = r as Read<T> & { locked?: true }; return rest as T; };

/** Music Companion's titles begin with the work date ("2026-11-25 The grey coat", its title rule); the phone shows the
 *  title without it, and a date at the start of a title sent up is dropped there (W7). */
export const withoutDate = (title: string) => title.replace(/^\d{4}-\d{2}-\d{2}\s+/, '');

/** A song as the list shows it: from this notebook, or only a title from Songbook's pocket (Music Companion's). */
export type SongRow = { id: string; title: string; updatedAt?: number; fromMac?: true };

/**
 * The world worn's songs, newest first, with the pocket's songs (Songbook's, `{ id, title }`) that the phone does not
 * hold yet after them. Tolerant of the pocket: one listed twice, one with no title, or one the phone already holds
 * (a song just moved here) is shown once, the phone's own copy first.
 */
export async function songList(s?: Pick<Settings, 'bridge'>): Promise<SongRow[]> {
  const mine = (await store.all('songs')).filter(r => !r.locked).sort((a, b) => b.updatedAt - a.updatedAt);
  const out: SongRow[] = mine.map(r => ({ id: r.id, title: r.title, updatedAt: r.updatedAt }));
  const seen = new Set(out.map(r => r.id));
  const p = s?.bridge?.pocket;
  if (p && p.world === worn() && p.pocket.kind === 'songs') {
    for (const ps of p.pocket.songs ?? []) {
      if (!ps || typeof ps.id !== 'string' || seen.has(ps.id)) continue;
      seen.add(ps.id);
      out.push({ id: ps.id, title: typeof ps.title === 'string' ? withoutDate(ps.title) : '', fromMac: true });
    }
  }
  return out;
}

/** One song of the notebook worn, opened; undefined when it has none by that id (or it is locked). */
export async function songOf(id: string): Promise<Song | undefined> {
  const r = await store.get('songs', id);
  return r && !r.locked ? opened(r) : undefined;
}

/** A blank song with an id: a new one, or one Songbook's pocket names that the phone does not hold yet. */
export const blankSong = (id: string, title = '', now = Date.now()): Song => ({ id, createdAt: now, updatedAt: now, title, lyric: '', sections: [] });

/** The takes of a song, oldest first. */
export async function takesOf(songId: string): Promise<Take[]> {
  return (await store.query('takes', t => t.where('songId').equals(songId))).filter(r => !r.locked).map(opened).sort((a, b) => a.at - b.at);
}

/** The loose hums (takes with no song), newest first. */
export async function looseHums(): Promise<Take[]> {
  return (await store.all('takes')).filter(r => !r.locked && !r.songId).map(opened).sort((a, b) => b.at - a.at);
}

/** A song with a new lyric: its sections carried over to the new lines (reSection). The page calls this on every edit
 *  of the lyric, so a section chip always names a line of the lyric it sees. */
export const withLyric = (song: Song, lyric: string, now = Date.now()): Song =>
  (lyric === song.lyric ? song : { ...song, lyric, sections: reSection(song, lyric), lyricAt: now });

/** A Mac song opened from Songbook's pocket that the phone does not hold yet: its id, its title without the work date,
 *  and its lyric, remembering the Mac's lyricAt it starts from. Nothing is written until he writes. */
export function songFromPocket(p: PocketSong, now = Date.now()): Song {
  const s = blankSong(p.id, typeof p.title === 'string' ? withoutDate(p.title) : '', now);
  if (typeof p.lyric === 'string') Object.assign(s, fromMacLyric(p.lyric));
  if (typeof p.lyricAt === 'number') s.lyricFrom = p.lyricAt;
  return s;
}

/** Writes a song as given (its sections already follow its lyric: withLyric), and every pinned take kept on its line
 *  when the lyric changed since `was`, in one write. */
export async function saveSong(song: Song, was?: Pick<Song, 'lyric' | 'sections'>): Promise<Song> {
  const next: Song = { ...song, updatedAt: Date.now() };
  const moved = was && was.lyric !== song.lyric ? follow(await takesOf(song.id), song.lyric) : [];
  await store.many({ songs: [next], ...(moved.length ? { takes: moved } : {}) });
  return next;
}

/** Writes a take. */
export const saveTake = (t: Take) => store.put('takes', t);

/** A loose hum given a title becomes a song: the song made, the hum its first take, in one write. */
export async function songFromHum(take: Take, title: string): Promise<Song> {
  const song = blankSong(newId(), title.trim());
  const { lineId: _l, lineText: _t, ...rest } = take;
  await store.many({ songs: [song], takes: [{ ...rest, songId: song.id }] });
  return song;
}
