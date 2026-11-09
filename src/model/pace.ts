// Pace (PLAN-MOTION.md M5, DESIGN.md rule 30): how fast a flow's water runs at each step, the truth of the step
// shown as motion. 1 is a walk (parts/cycle/stream.ts turns it into drawing units a second). The same motes pass
// every point, so a quick step thins the water out and a slow one pools it; the number is chosen for what the step's
// said line tells, never for what looks busy. This is the page he opens in a panic: when in doubt, slower.
//
// Kept here by seed step id, not on the step: nothing is written to the database, so the flows already on his phone
// get their paces too. A step with none (one he added, or a flow he made himself) runs at 1, and so does the rest of a
// flow with none. A first tuning by eye from the seeds' said lines (PLAN-MOTION.md section 5, question 1): they want
// his hands on them.
import type { Flow } from '../db/schema';

/** A walk: the pace of a step with none. */
export const WALK = 1;

/** Where the dot rests between episodes (the ring's dotted way back, an open walk's ordinary ground), by flow id. */
export const REST_PACE: Record<string, number> = {
  // the dotted way back to ordinary carries the water thin: a walk home, faster than the drain before it
  panic: 1,
  // ordinary ground before the slide is already a little slow
  depress: 0.6,
  // the baseline: an ordinary day, unhurried
  energize: 0.6,
  // the floor before anything has happened
  fight: 0.5,
  // the level line before the dread has a date: barely moving
  whatif: 0.4,
  // the lead in: the day before the sting
  replay: 0.5,
  // asleep: slow, and the clock's ticks carry it
  night: 0.4,
  // level ground before the brake
  shutdown: 0.6,
  // level ground before being seen
  shame: 0.6,
};

/** Each seeded step's pace, by step id. */
export const STEP_PACE: Record<string, number> = {
  // Panic, the ring: quick through the wave, pooling in settling, slowest under the skin
  'panic-1': 1.1, // Overstimulated: "builds over minutes", a little quicker than a walk
  'panic-2': 2.3, // The wave: "loud, fast, certain", and "already on its way out": the quickest, and it passes
  'panic-3': 0.6, // Settling: "the heart has already slowed"; shaky water gathering
  'panic-4': 0.35, // Under the skin: "it drains over hours, not minutes": the deepest pool

  // Depress, the valley: slow throughout, slowest on the floor
  'depress-1': 0.5, // Sliding: "a dip starts with doing less"
  'depress-2': 0.38, // Pulling in: days, the doing slows
  'depress-3': 0.6, // Head won't stop: the why-loop churns a little faster than the rest of the slope
  'depress-4': 0.24, // The bottom: "the floor is where it turns": the water pools and turns
  'depress-5': 0.4, // A little light: "that lift is real": quicker than the floor, still slow
  'depress-6': 0.55, // Climbing out: "the climb is real on the days it feels flat": steady, not quick

  // Energize, the arc: quickening up to the tip, gliding down
  'energize-1': 1.0, // Spark: "something lit up, and it's usable": a walk
  'energize-2': 1.5, // Build: "the climb is the good part"
  'energize-3': 2.0, // Locked in: the sweet spot, quick and even
  'energize-4': 2.4, // The tip: "wired and scattered, past the top": the quickest, and more isn't better
  'energize-5': 0.8, // Landing, or the crash: "both paths come back to level": a glide

  // Fight, the mountain: fast up the climb, slow down the long slope
  'fight-1': 1.4, // Trigger: "a story arrived in the same second"
  'fight-2': 2.2, // Climb: "your pulse is climbing with it"
  'fight-3': 2.6, // Flooded: the summit, "nothing said now will land": quickest, and over the top
  'fight-4': 1.2, // Said it, or left: off the summit, already slowing
  'fight-5': 0.5, // Cooling: "the spike cleared in minutes; the rest takes about an hour"
  'fight-6': 0.35, // Repair: slow, and "the coming back" is the point

  // What if, the curve: building up the climb, the fastest water in the app down the drop, nearly still after
  'whatif-1': 0.5, // Something's coming: "days, building toward the thing"
  'whatif-2': 0.9, // What if: the climb, picturing it
  'whatif-3': 1.4, // Night before: "the peak of the curve, not the thing itself": high, and building no further
  'whatif-4': 3.3, // The thing: "the curve has already turned": straight down, near a hundred drawing units a second
  'whatif-5': 0.25, // It was fine: the flat after: nearly still, "mark how it went"

  // Replay, the coil: quicker with each turn inward, calm along the exit
  'replay-1': 0.8, // That stung: "the replay wants to start"
  'replay-2': 1.3, // Why did I: "every why tightens the coil"
  'replay-3': 1.9, // Heavier: the tightest turn, the quickest
  'replay-4': 0.45, // How, not why: "you're out of the coil": calm water on the straight

  // 3 a.m., the clock: slow water that moves in ticks (the shape's own); the night does not hurry
  'night-1': 0.45, // Awake again: "common, and one bad night changes very little"
  'night-2': 0.55, // What time is it: checking the clock stirs it, a little
  'night-3': 0.35, // Lying there: "trying harder is what keeps you awake": stop trying, the water slows
  'night-4': 0.6, // Up: out of bed, dull and dim, moving
  'night-5': 0.4, // Same alarm: "seven still comes, whatever the night does": fixed, unhurried

  // Shutdown, the stairs: quick off the first tread, nearly stopped on frozen, picking up through the thaw
  'shutdown-1': 1.6, // Too much: "your body pulled a brake": the drop off the first tread
  'shutdown-2': 0.22, // Stuck: frozen, nearly stopped ("holding, not failing")
  'shutdown-3': 0.26, // Far away: still very slow, "and it passes"
  'shutdown-4': 0.6, // Thawing: "the quiet now is the repair": picking up, gently, up the ramp

  // Shame, the fork: a fast drop, a pause at the fork, a steady road back (the two roads away are the shape's)
  'shame-1': 1.4, // Seen: "a loud one, and it peaks fast"
  'shame-2': 1.8, // I'm worthless: the verdict that "drags everything down": the quickest
  'shame-3': 0.6, // Hide or hit back: "notice the pull before you answer": the water slows at the fork
  'shame-4': 0.8, // I did a thing: "one specific repair, then it's done": steady, back up and over
};

/** A flow's paces: its rest and one per step, in order. A step with none, and the rest of a flow with none, walk. */
export function pacesOf(flow: Pick<Flow, 'id' | 'steps'>): { rest: number; steps: number[] } {
  return { rest: REST_PACE[flow.id] ?? WALK, steps: flow.steps.map(s => STEP_PACE[s.id] ?? WALK) };
}
