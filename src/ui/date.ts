/** The notebook's date: "11 / 7 / 26". */
export const notebookDate = (d: Date) => `${d.getMonth() + 1} / ${d.getDate()} / ${String(d.getFullYear()).slice(-2)}`;
/** The day alone, the way the notebook writes a short date: "11 / 8" (F1, "last time" on the flows). */
export const shortDate = (d: Date) => `${d.getMonth() + 1} / ${d.getDate()}`;
/** A clock time the way the phone shows it: "21:40" (F2, the return time and the journal's link to a flow). */
export const clockTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
