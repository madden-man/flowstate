// The phone's own calendar (PLAN.md section 5 item 4): a day starts at local midnight, a week on Monday (ISO), a month
// on the 1st. Read by Energize's spans (model/fixations.ts). The goals' cadences, the done log and the leans that lived
// here left with the spread (PLAN-VALUES.md C6); their tables stay in the database and in every backup, read by nothing.

const at = (d: Date | number) => (typeof d === 'number' ? new Date(d) : d);
export const startOfDay = (d: Date | number): number => { const x = at(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
/** Monday of the ISO week holding d, at local midnight. */
export const startOfWeek = (d: Date | number): number => {
  const x = at(d);
  const back = (x.getDay() + 6) % 7; // Monday 0 ... Sunday 6
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() - back).getTime();
};
export const startOfMonth = (d: Date | number): number => { const x = at(d); return new Date(x.getFullYear(), x.getMonth(), 1).getTime(); };
export const startOfYear = (d: Date | number): number => new Date(at(d).getFullYear(), 0, 1).getTime();
