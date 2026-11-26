// Down (PLAN-WORLDS.md section 5, W2): the pocket fetched for the world worn, and what it holds written into that
// world's notebook. Handed a world's notebook (fields.ts handed) and never the personal one. Every write here goes
// through handed().writeDown, a transaction without the outbox, so nothing that came down goes back up as his.
//
// Voices from characters: one voice a character, id c:<characterId>, named with the full name, given the first name,
// the hue of the family's colour, light, no twin. Renamed there is renamed here (the old name kept as a revision, as a
// rename in Voices keeps it); deleted there is archived here, so old councils still read.
//
// Questions from the bible: one question page an open question, the page's id the question's id. Decided there, the
// page moves under Answered with the decision as its wise line (a line of its own, id d:<questionId>). A question he
// answered on the phone is not reopened from here; deciding on the phone, the year dial, ages and chips are W4's.
import type { Handed } from '../db/fields';
import type { Message, Page, Song, Take, Voice } from '../db/schema';
import { follow, reSection } from '../model/songs';
import type { NovelPocket, Pocket, SongsPocket } from './protocol';
import { hueOf } from './colour';

export const characterVoiceId = (characterId: string) => `c:${characterId}`;
export const decisionLineId = (questionId: string) => `d:${questionId}`;

const sameColour = (a: Voice['colour'], b: Voice['colour']) => a.hue === b.hue && (a.chroma ?? 1) === (b.chroma ?? 1);

async function voicesFrom(h: Handed, pocket: NovelPocket, now: number): Promise<Voice[]> {
  const mine = (await h.query('voices', t => t.toCollection())).filter(v => v.id.startsWith('c:'));
  const byId = new Map(mine.map(v => [v.id, v]));
  const out: Voice[] = [];
  const here = new Set<string>();
  pocket.characters.forEach((c, i) => {
    const id = characterVoiceId(c.id);
    here.add(id);
    const colour: Voice['colour'] = { hue: hueOf(c.familyColour) };
    const was = byId.get(id);
    if (!was) {
      out.push({ id, name: c.fullName, given: c.firstName, aka: [], colour, shade: 'light', starred: false, order: i, archived: false, revisions: [] });
      return;
    }
    const renamed = was.name !== c.fullName || was.given !== c.firstName;
    if (!renamed && sameColour(was.colour, colour) && !was.archived) return;
    const { locked: _, ...v } = was as Voice & { locked?: true };
    out.push({
      ...v, name: c.fullName, given: c.firstName, colour, archived: false,
      revisions: renamed || !sameColour(was.colour, colour)
        ? [...v.revisions, { at: now, name: was.name, ...(was.given !== undefined ? { given: was.given } : {}), aka: was.aka, colour: was.colour }]
        : v.revisions,
    });
  });
  for (const v of mine) {
    if (here.has(v.id) || v.archived) continue;
    const { locked: _, ...rest } = v as Voice & { locked?: true };
    out.push({ ...rest, archived: true });
  }
  return out;
}

/** The bible's own decision line (d:<questionId>) is the bible's: it came down and never goes back up
 *  (src/db/outbox.ts skips it). */
export const isDecisionLine = (id: string) => id.startsWith('d:');

async function questionsFrom(h: Handed, pocket: NovelPocket, now: number): Promise<{ pages: Page[]; messages: Message[] }> {
  const pages: Page[] = [];
  const messages: Message[] = [];
  const ids = pocket.questions.map(q => q.id);
  const have = await h.many('pages', ids);
  const lines = await h.many('messages', ids.map(decisionLineId));
  pocket.questions.forEach((q, i) => {
    const was = have[i];
    if (was?.locked) return;
    if (was && was.kind !== 'question') return; // an id the phone already uses for something else is left alone
    const at = q.changedAt || now;
    let page: Page = was
      ? (({ locked: _, ...p }) => p)(was as Page & { locked?: true })
      : { id: q.id, kind: 'question', createdAt: at, updatedAt: at, title: q.question, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] };
    let changed = !was;
    if (was && was.title !== q.question) { page = { ...page, title: q.question, updatedAt: Math.max(page.updatedAt, at) }; changed = true; }
    // Whose state wins: the newer. A page changed on the phone after the bible last changed this question (answered,
    // resolved, or a decision taken back) keeps its own state until the bible changes the question again; a pocket
    // that is newer than the page sets it. Down writes the page's updatedAt to the question's changedAt, so a pocket
    // read again changes nothing.
    const fresh = !was || at >= was.updatedAt;
    const line = lines[i] && !lines[i]!.locked ? lines[i]! : undefined;
    if (fresh && q.state === 'decided' && q.decision?.trim()) {
      if (page.state === 'open') { page = { ...page, state: 'answered', answeredAt: at, updatedAt: Math.max(page.updatedAt, at) }; changed = true; }
      // the decision is the page's wise line whenever down sets it answered
      if (!lines[i] || (line && (line.text !== q.decision || !line.wise))) {
        const { locked: _, ...rest } = (line ?? {}) as Message & { locked?: true };
        const m: Message = { ...rest, id: decisionLineId(q.id), pageId: q.id, at: line?.at ?? at, text: q.decision, kept: line?.kept ?? false, wise: true };
        if (line) m.updatedAt = now;
        messages.push(m);
      }
    } else if (fresh && q.state === 'open' && was && page.state !== 'open') {
      // reopened in the bible, later than the phone last changed it
      const { answeredAt: _a, resolvedByTap: _r, ...rest } = page;
      page = { ...rest, state: 'open', updatedAt: Math.max(page.updatedAt, at) };
      changed = true;
      if (line?.wise) {
        const { locked: _, wise: _w, ...m } = line as Message & { locked?: true };
        messages.push({ ...m, updatedAt: now });
      }
    }
    if (changed) pages.push(page);
  });
  return { pages, messages };
}

/**
 * Songbook's lyrics (W6, from W7's review): a song the phone holds takes the pocket's lyric when the Mac changed it
 * after the text the phone's started from (pocket lyricAt newer than the song's lyricFrom), and only if the phone has no
 * unsent lyric edit of its own (a lyricAt of its own while the song still waits in the outbox): what he typed is never
 * overwritten. Taken, the song's lyricFrom becomes the pocket's lyricAt and its own lyricAt goes (the text is the Mac's
 * now); its sections follow the lines by their text, and its pinned takes are kept on their lines (model/songs.ts). A
 * quiet write, so nothing that came down goes back up. A song the phone does not hold is read from the pocket when it
 * is opened (songFromPocket).
 */
async function lyricsFrom(h: Handed, pocket: SongsPocket): Promise<{ songs: Song[]; takes: Take[] }> {
  const fromMac = (pocket.songs ?? []).filter(p => p && typeof p.id === 'string' && typeof p.lyric === 'string' && typeof p.lyricAt === 'number');
  if (!fromMac.length) return { songs: [], takes: [] };
  const have = await h.many('songs', fromMac.map(p => p.id));
  const waiting = new Set((await h.db.outbox.toArray()).filter(o => o.table === 'songs').map(o => o.id));
  const songs: Song[] = [], takes: Take[] = [];
  for (const [i, p] of fromMac.entries()) {
    const was = have[i];
    if (!was || was.locked) continue;
    if (was.lyricFrom !== undefined && p.lyricAt! <= was.lyricFrom) continue;
    if (was.lyricAt !== undefined && waiting.has(was.id)) continue;
    if (was.lyric === p.lyric && was.lyricFrom === p.lyricAt) continue;
    const { locked: _, lyricAt: _a, ...rest } = was as Song & { locked?: true };
    songs.push({ ...rest, lyric: p.lyric!, sections: reSection(was, p.lyric!), lyricFrom: p.lyricAt });
    const own = (await h.query('takes', t => t.where('songId').equals(was.id))).filter(t => !t.locked) as Take[];
    takes.push(...follow(own, p.lyric!));
  }
  return { songs, takes };
}

/** Writes what a pocket holds into the world's notebook: a novel's voices and questions, Songbook's lyrics for the songs
 *  the phone holds (its song list itself is read from the pocket by the Songs list). Locked, nothing is written. */
export async function applyPocket(h: Handed, pocket: Pocket, now = Date.now()): Promise<void> {
  if (!h.open()) return;
  if (pocket.kind === 'songs') {
    const { songs, takes } = await lyricsFrom(h, pocket);
    if (songs.length) await h.writeDown({ songs, ...(takes.length ? { takes } : {}) });
    return;
  }
  if (pocket.kind !== 'novel') return;
  const voices = await voicesFrom(h, pocket, now);
  const { pages, messages } = await questionsFrom(h, pocket, now);
  await h.writeDown({ voices, pages, messages });
}
