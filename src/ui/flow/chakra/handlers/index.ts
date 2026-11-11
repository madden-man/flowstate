// Loads every touch handler file beside this one (PLAN-TASKS.md T2, T3, T4: place.tsx, into.ts, out.ts), each of which
// calls registerTouch from ../touch.ts when it loads. A new file here registers itself; no list to edit. T1 adds none,
// so every touch only lights its word.
import.meta.glob(['./*.ts', './*.tsx', '!./index.ts'], { eager: true });
