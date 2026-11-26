// The lyric scenarios played against Music Companion (mac-lyrics.gen.test.ts writes the fixture, songs.test.ts checks
// the phone against it). Each step is something he does on the phone's song page, through the page's own model calls,
// then the row the phone sends (src/bridge/up.ts SONG's fields) handed to the Mac. `mc` is Music Companion's
// sketches.ts when generating; the phone's test passes nothing and gets the rows alone.
import type { Song } from '../../src/db/schema';
import { nameSection, songFromPocket, withLyric, withSections, blankSong, linesOf, toMacLyric } from '../../src/model/songs';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Mc = any;
export type Row = Pick<Song, 'id' | 'createdAt' | 'updatedAt' | 'title' | 'lyric' | 'sections' | 'lyricAt' | 'lyricFrom'>;
export type Step = { did: string; row: Row; mac?: string };
export type Scenario = { name: string; macBefore?: string; steps: Step[] };

const ROW_KEYS = ['id', 'createdAt', 'updatedAt', 'title', 'lyric', 'sections', 'lyricAt', 'lyricFrom'] as const;
const rowOf = (s: Song, at: number): Row => {
  const r = { ...s, updatedAt: at } as Record<string, unknown>;
  return Object.fromEntries(ROW_KEYS.filter(k => r[k] !== undefined).map(k => [k, r[k]])) as Row;
};
const iso = (ms: number) => new Date(ms).toISOString();
const T0 = 1_790_000_000_000;

export function macScenarios(mc?: Mc): Scenario[] {
  const out: Scenario[] = [];

  // 1. A song born on the phone in East Winds: written, then two sections named from the chips.
  {
    const steps: Step[] = [];
    let s: Song = blankSong('11111111-1111-4111-8111-111111111111', 'The grey coat', T0);
    s = withLyric(s, 'You only wear that one to leave\nso leave it on the nail\n\nKeep this for me, one year', T0 + 1000);
    steps.push({ did: 'wrote four lines', row: rowOf(s, T0 + 1000) });
    s = withSections(s, nameSection(s, 0, 'Verse'), T0 + 2000);
    steps.push({ did: 'named the first section Verse', row: rowOf(s, T0 + 2000) });
    s = withSections(s, nameSection(s, 3, 'Chorus'), T0 + 3000);
    steps.push({ did: 'named the second section Chorus', row: rowOf(s, T0 + 3000) });
    if (mc) {
      let song: any = null;
      steps.forEach((st, i) => {
        const now = iso(T0 + 10_000 * (i + 1));
        if (!song) {
          const input = mc.newPhoneSong('eastwinds', i + 1, st.row, 'East Winds');
          song = { _id: 'mc-grey', title: `${input.workDate} ${input.name}`, workDate: input.workDate, lyrics: input.lyrics, lyricsAt: input.lyricsAt, modifiedAt: now, createdAt: now, phone: input.phone };
        } else {
          song = mc.mergePhoneSong(song, 'eastwinds', i + 1, st.row, now, 'East Winds') ?? song;
        }
        st.mac = song.lyrics;
      });
    }
    out.push({ name: 'born on the phone, sections named after', steps });
  }

  // 2. A Mac song in Songbook, opened from the pocket: a section named from a chip, then a line typed.
  {
    const macBefore = '[Verse]\nthe water goes out\nand comes back\n\nlow tide, low tide';
    const macAt = T0 - 86_400_000;
    let song: any = { _id: 'mac-tide', title: '2026-09-20 Low tide', workDate: '2026-09-20', lyrics: macBefore, lyricsAt: iso(macAt), modifiedAt: iso(macAt), createdAt: iso(macAt) };
    const pocketSong = mc ? mc.pocketOf([song]).songs[0] : { id: 'mac-tide', title: '2026-09-20 Low tide', lyric: macBefore, lyricAt: macAt };
    const steps: Step[] = [];
    let s = songFromPocket(pocketSong, T0);
    s = withSections(s, nameSection(s, 3, 'Chorus'), T0 + 2000);
    steps.push({ did: 'named the second section Chorus', row: rowOf(s, T0 + 2000) });
    s = withLyric(s, linesOf(s.lyric).map((l, i) => (i === 1 ? 'and never comes back' : l)).join('\n'), T0 + 3000);
    steps.push({ did: 'rewrote the second line', row: rowOf(s, T0 + 3000) });
    if (mc) {
      steps.forEach((st, i) => {
        song = mc.mergePhoneSong(song, 'songbook', i + 1, st.row, iso(T0 + 10_000 * (i + 1)), 'Songbook') ?? song;
        st.mac = song.lyrics;
      });
    }
    out.push({ name: 'a Mac song from the pocket, a chip then a line', macBefore, steps });
  }

  // 3. The Mac's own lyricsFromPhone on the shapes the phone sends, the header-only lyric included (known answers for
  //    the phone's copy, toMacLyric).
  {
    const shapes: Pick<Song, 'lyric' | 'sections'>[] = [
      { lyric: 'a\nb', sections: [] },
      { lyric: 'a\nb\n\nc', sections: [{ line: 0, name: 'Verse' }, { line: 3, name: 'Chorus' }] },
      { lyric: 'a\n\nb', sections: [{ line: 2, name: 'From the phone' }, { line: 2, name: 'Verse' }] },
      { lyric: 'last', sections: [{ line: 1, name: 'Outro' }] },
      { lyric: '', sections: [{ line: 0, name: 'Verse' }] },
      { lyric: '[Verse]', sections: [] },
      { lyric: '', sections: [] },
      { lyric: 'x', sections: [{ line: 0, name: ' odd [name] ' }] },
    ];
    out.push({ name: 'lyricsFromPhone known answers', steps: shapes.map(sh => ({ did: 'sent', row: { id: 'k', createdAt: T0, updatedAt: T0, title: 'k', ...sh }, ...(mc ? { mac: mc.lyricsFromPhone(sh) } : { mac: toMacLyric(sh) }) })) });
  }
  return out;
}
