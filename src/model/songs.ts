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
 * Where each old line went in a new lyric: the lines both share (a longest common run, so lines kept are matched in
 * order), and for a run of lines rewritten or taken out, the new line in their place (the next line kept, or past the
 * end). Index was.length maps to now.length.
 */
export function lineMap(was: readonly string[], now: readonly string[]): number[] {
  const n = was.length, m = now.length;
  // common head and tail first, so a one-line edit costs nothing
  let a = 0;
  while (a < n && a < m && was[a] === now[a]) a++;
  let b = 0;
  while (b < n - a && b < m - a && was[n - 1 - b] === now[m - 1 - b]) b++;
  const W = was.slice(a, n - b), N = now.slice(a, m - b);
  const L = Array.from({ length: W.length + 1 }, () => new Uint16Array(N.length + 1));
  for (let i = W.length - 1; i >= 0; i--) for (let j = N.length - 1; j >= 0; j--) L[i][j] = W[i] === N[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const map = new Array<number>(n + 1);
  for (let i = 0; i < a; i++) map[i] = i;
  for (let i = 0; i < b; i++) map[n - 1 - i] = m - 1 - i;
  map[n] = m;
  // walk the middle: matched lines map straight; a run taken out between matches maps onto the run put in its place
  let i = 0, j = 0;
  const flush = (i0: number, i1: number, j0: number, j1: number) => {
    for (let t = i0; t < i1; t++) map[a + t] = a + (j1 > j0 ? Math.min(j0 + (t - i0), j1 - 1) : j0);
  };
  let ri = 0, rj = 0;
  while (i < W.length && j < N.length) {
    if (W[i] === N[j] && L[i][j] === L[i + 1][j + 1] + 1) { flush(ri, i, rj, j); map[a + i] = a + j; i++; j++; ri = i; rj = j; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  flush(ri, W.length, rj, N.length);
  return map;
}

/**
 * The sections of a new lyric, named from the old. Every name is kept (each is a [Name] line on the Mac, and the phone
 * never drops one it was not asked to): it goes where its line went (lineMap). A name over a section's first line stays
 * over that section's first line (a line typed at the top of a verse is in the verse); one whose section was joined into
 * the section above stands over its own line, mid-section. Names stacked on one line keep their order; a name past the
 * last line stays past it. Only a chip takes a name away (nameSection).
 */
export function reSection(old: Pick<Song, 'lyric' | 'sections'>, lyric: string): Song['sections'] {
  const was = linesOf(old.lyric), now = linesOf(lyric);
  const map = lineMap(was, now);
  const oldStarts = new Set(sectionStarts(was));
  const newStarts = sectionStarts(now);
  const heldBy = new Map<number, number>(); // a new section start, and the old line whose names went to it
  const out = old.sections.map(sec => {
    if (sec.line >= was.length) return { line: now.length, name: sec.name };
    const to = map[sec.line];
    if (oldStarts.has(sec.line)) {
      const st = [...newStarts].reverse().find(x => x <= to);
      if (st !== undefined && (heldBy.get(st) ?? sec.line) === sec.line) { heldBy.set(st, sec.line); return { line: st, name: sec.name }; }
    }
    return { line: to, name: sec.name };
  });
  // stable: names on one line keep the order they had
  return out.map((x, k) => [x, k] as const).sort((p, q) => p[0].line - q[0].line || p[1] - q[1]).map(([x]) => x);
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
  // section lines with no line of the lyric under any of them: the phone's lyric is never empty of lines (an empty lyric
  // is one empty line), so it cannot hold them as names and give back the same text; they stay as the text itself
  if (!lines.length && sections.length) return { lyric: text, sections: [] };
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

const isChipName = (n: string) => (SECTION_NAMES as readonly string[]).includes(n);

/** The line a chip acts on for the caret's line: that line itself when a chip's name stands on it (one a join left
 *  mid-section), else the first line of its section. Undefined with no written line. */
export function sectionTarget(song: Pick<Song, 'lyric' | 'sections'>, line: number): number | undefined {
  if (song.sections.some(x => x.line === line && isChipName(x.name))) return line;
  const starts = sectionStarts(linesOf(song.lyric));
  return [...starts].reverse().find(x => x <= line) ?? starts[0];
}

/** Names the section the line is in from a chip: the chip's name replaces a chip name already there, and the same chip
 *  again takes it off. A name from the Mac ([From the phone], [Hook]) is never taken away; the chip's name goes beside
 *  it, under it. */
export function nameSection(song: Pick<Song, 'lyric' | 'sections'>, line: number, name: string): Song['sections'] {
  const at = sectionTarget(song, line);
  if (at === undefined) return song.sections;
  const k = song.sections.findIndex(x => x.line === at && isChipName(x.name));
  if (k >= 0) {
    if (song.sections[k].name === name) return song.sections.filter((_, i) => i !== k);
    return song.sections.map((x, i) => (i === k ? { line: at, name } : x));
  }
  const last = song.sections.reduce((p, x, i) => (x.line <= at ? i : p), -1);
  return [...song.sections.slice(0, last + 1), { line: at, name }, ...song.sections.slice(last + 1)];
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
 *  of the lyric, so a section chip always names a line of the lyric it sees. lyricAt moves. */
export const withLyric = (song: Song, lyric: string, now = Date.now()): Song =>
  (lyric === song.lyric ? song : { ...song, lyric, sections: reSection(song, lyric), lyricAt: now });

const sameSections = (a: Song['sections'], b: Song['sections']) =>
  a.length === b.length && a.every((x, i) => x.line === b[i].line && x.name === b[i].name);

/** A song with its sections named anew (a chip set, changed or cleared). On the Mac a section's name is a line of the
 *  lyric ([Chorus]), so this is a lyric change and lyricAt moves (Tommy, 2026-11-25, the review of PR 112); a rename,
 *  the key, the tempo and the Character chip are not, and never move it. The same sections again change nothing. */
export const withSections = (song: Song, sections: Song['sections'], now = Date.now()): Song =>
  (sameSections(song.sections, sections) ? song : { ...song, sections, lyricAt: now });

/** A Mac song opened from Songbook's pocket that the phone does not hold yet: its id, its title without the work date,
 *  and its lyric, remembering the Mac's lyricAt it starts from. Nothing is written until he writes. */
export function songFromPocket(p: PocketSong, now = Date.now()): Song {
  const s = blankSong(p.id, typeof p.title === 'string' ? withoutDate(p.title) : '', now);
  if (typeof p.lyric === 'string') Object.assign(s, fromMacLyric(p.lyric));
  if (typeof p.lyricAt === 'number') s.lyricFrom = p.lyricAt;
  return s;
}

/** Writes a song as given (its sections already follow its lyric: withLyric), and every pinned take kept on its line
 *  when the lyric changed since `was`, in one write. A page that did not touch the lyric (song.lyric is still `was`'s)
 *  keeps the lyric stored now: one Songbook's pocket replaced while the page was open is never put back by a rename. The
 *  sections are the lyric too (withSections): a page that named one wrote the lyric. */
export async function saveSong(song: Song, was?: Pick<Song, 'lyric' | 'sections'>): Promise<Song> {
  let next: Song = { ...song, updatedAt: Date.now() };
  if (was && was.lyric === song.lyric && sameSections(was.sections, song.sections)) {
    const now = await songOf(song.id);
    if (now && now.lyric !== was.lyric) {
      const { lyricAt: _a, lyricFrom: _f, ...rest } = next;
      next = { ...rest, lyric: now.lyric, sections: now.sections, ...(now.lyricAt !== undefined ? { lyricAt: now.lyricAt } : {}), ...(now.lyricFrom !== undefined ? { lyricFrom: now.lyricFrom } : {}) };
    }
  }
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
