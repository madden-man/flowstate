// A paper on a page (PLAN-RESEARCH.md section 2 and DESIGN.md rule 36, Q4): the parts Research and the pages it
// carries to share. A paper speaks as one of two voices: + in a light voice and − in its deep twin, the notebook rule's
// blue (plan question 7), so it takes no new colour (rule 25). Its print line is the sign in the serif and the paper's
// own journal, year and kind; its title is always a link to the paper. On a journal or council page the carried line
// keeps the voice rule, so it is never mistaken for his (PaperLine); the page prints "From" and the question it came
// from, a tap going back (ResearchFrom, the way back that page.research keeps).
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Read } from '../../db/fields';
import type { Message } from '../../db/schema';
import { getInquiry, getPapers, researchVersion } from '../../research/store';
import type { Paper, Side } from '../../research/types';
import './research.css';

/** The sign of a side, a glyph in the serif (rule 36, like the ? and the ♪). */
export const SIGN: Record<Side, string> = { for: '+', against: '−' };
/** The side's voice: the light blue and its deep twin (the tokens' own, rule 3). */
export const sideColour = (side: Side) => (side === 'for' ? 'var(--v-blue)' : 'var(--d-blue)');
/** The side's colour as --rs-side; research.css makes it the line's --vc, so Still can take the hue away (an inline --vc
 *  would outrank it). */
export const sideStyle = (side: Side) => ({ '--rs-side': sideColour(side) } as JSX.CSSProperties);

/** The print after the sign: the paper's own journal, year and kind, as the index has them. */
export const printOf = (p: Pick<Paper, 'journal' | 'year' | 'kind'>) => [p.journal, p.year, p.kind].filter(Boolean).join(' · ');

/** A speaker's print for a paper: the sign, then its own words. */
export function PaperPrint({ side, paper }: { side: Side; paper?: Pick<Paper, 'journal' | 'year' | 'kind'> }) {
  const words = paper ? printOf(paper) : '';
  return (
    <span class="fs-sp rs-sp">
      <span class="rs-sign" aria-label={side === 'for' ? 'For' : 'Against'}>{SIGN[side]}</span>
      {words && ` · ${words}`}
    </span>
  );
}

/** A title as a link out to the paper at its journal (by DOI; with none, the index's own record). It leaves the app,
 *  so the page it is on stays as it is. */
export function TitleLink({ paper, title, cls = 'rs-link' }: { paper?: Pick<Paper, 'url'>; title: string; cls?: string }) {
  if (!paper?.url) return <span class={cls}>{title}</span>;
  return <a class={cls} href={paper.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{title}</a>;
}

/** A paper's title carried to a journal or council page (message.paper): drawn as its side's voice line, the print
 *  from the paper's kept record, the title as written there a link to it. */
export function PaperLine({ m }: { m: Read<Message> }) {
  const [paper, setPaper] = useState<Paper | undefined>(undefined);
  const ref = m.paper!;
  useEffect(() => {
    let on = true;
    void getPapers([ref.paperId]).then(([p]) => { if (on) setPaper(p); }).catch(() => undefined);
    return () => { on = false; };
  }, [ref.paperId]);
  return (
    <div class={`fs-msg fs-v rs-carried${ref.side === 'against' ? ' deep' : ''}`} style={sideStyle(ref.side)} data-id={m.id} data-paper-id={ref.paperId} data-side={ref.side}>
      <PaperPrint side={ref.side} paper={paper} />
      <p><TitleLink paper={paper} title={m.text} /></p>
    </div>
  );
}

/** "From" and the question a page was carried from (page.research), a tap going back to it. Nothing while the
 *  question cannot be read (locked, or taken away). */
export function ResearchFrom({ inquiryId }: { inquiryId: string }) {
  const [question, setQuestion] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    void getInquiry(inquiryId).then(q => { if (on) setQuestion(q?.question ?? null); }).catch(() => undefined);
    return () => { on = false; };
  }, [inquiryId, researchVersion.value]);
  if (!question) return null;
  return <p class="fs-from rs-from"><small>From</small> <a href={`#/flow/research/${inquiryId}`}>{question}</a></p>;
}
