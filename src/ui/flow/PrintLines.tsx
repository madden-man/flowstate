// The lines a step prints under its rows (F3): a tip marked print is the page's own line, never a row with a check,
// so there is nothing to tick and nothing done (Depress's safety line at the bottom). Shown in every light, Still
// too: it is neither a count nor a state (rule 13). F2's tip rows leave print tips to this.
// A print tip with a handoff (F4, PLAN-FLOWS.md 3.7) is a link to that flow's step: onHandOff follows it
// (ui/flow/HandOff.tsx followHandOff). Without onHandOff it prints as a plain line.
import type { Step, Tip } from '../../db/schema';

export const printTips = (step: Pick<Step, 'tips'>) => step.tips.filter(t => t.print && !t.struck);
export const rowTips = (step: Pick<Step, 'tips'>) => step.tips.filter(t => !t.print);

export function PrintLines({ step, onHandOff }: { step: Pick<Step, 'tips'>; onHandOff?: (t: Tip) => void }) {
  const lines = printTips(step);
  if (!lines.length) return null;
  return (
    <div class="fl-prints">
      {lines.map(t => (t.handoff && onHandOff
        ? (
          <p key={t.id} class="fl-said fl-print" data-tip={t.id}>
            <a class="fl-handoff" href={`#/flow/${t.handoff.flowId}`} onClick={e => { e.preventDefault(); onHandOff(t); }}>{t.text}</a>
          </p>
        )
        : <p key={t.id} class="fl-said fl-print" data-tip={t.id}>{t.text}</p>))}
    </div>
  );
}
