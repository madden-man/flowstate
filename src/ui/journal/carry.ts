// What today's journal page opens with, once (ui/journal/PageView.tsx reads it as it mounts). Its one user now is the
// Sunday question's landing (journal/checkin.tsx, PLAN-PUSH.md section 4): the rule under his question opens as the
// answer, in italic as the wiser second person (Turn to answer, DESIGN.md rule 17). The signs' touches that once also
// carried Letter's "Dear" here (flow/chakra/carry.ts) left with the mountain (PLAN-WORLDS.md section 4.1). Held in
// memory only: nothing is written.
import { signal } from '@preact/signals';

export type PageCarry = { wise?: boolean };
export const pageCarry = signal<PageCarry | null>(null);
