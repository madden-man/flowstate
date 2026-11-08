// The lines a step prints under its rows (F3): a tip marked print is the page's own line, never a row with a check,
// so there is nothing to tick and nothing done (Depress's safety line at the bottom). Shown in every light, Still
// too: it is neither a count nor a state (rule 13). F2's tip rows leave print tips to this.
import type { Step } from '../../db/schema';

export const printTips = (step: Pick<Step, 'tips'>) => step.tips.filter(t => t.print && !t.struck);
export const rowTips = (step: Pick<Step, 'tips'>) => step.tips.filter(t => !t.print);

export function PrintLines({ step }: { step: Pick<Step, 'tips'> }) {
  const lines = printTips(step);
  if (!lines.length) return null;
  return <div class="fl-prints">{lines.map(t => <p key={t.id} class="fl-said fl-print" data-tip={t.id}>{t.text}</p>)}</div>;
}
