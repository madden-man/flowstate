// Fresh reads only (R3 review finding 3). A stop's page reads a lot (the flows, the readings, each flow's live and last
// episode), so a read can take longer than a move's write. A read applies only if no write began after it started and
// it is the newest read; otherwise it is dropped, and the read the write's own end asks for draws the page. So a read
// from before a move can never land after it and put the dot back a step, and a second quick move is always made from
// the step the first one left.

export type ReadGuard = {
  /** A read begins: the answer says, when it lands, whether it may still be applied. */
  read(): () => boolean;
  /** A write begins: call the answer when it has ended (in a finally). */
  write(): () => void;
};

export function readGuard(): ReadGuard {
  let reads = 0, writes = 0, busy = 0;
  return {
    read() {
      const r = ++reads, w = writes;
      return () => r === reads && w === writes && busy === 0;
    },
    write() {
      writes++;
      busy++;
      let done = false;
      return () => { if (!done) { done = true; busy--; } };
    },
  };
}
