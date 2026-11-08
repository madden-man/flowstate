// "For the Poems and the Prose; May They Dance Forever": the one playlist FlowState knew before V7. With no
// account the music line deep-links to it; the version 2 upgrade puts its shelf in place and ticks it.
// No imports, so both src/db/schema.ts and src/music/spotify.ts can read it.
export const POEMS_ID = '0T6Gzc2hN81u3vGC5IJZ9a';
export const POEMS_NAME = 'For the Poems and the Prose; May They Dance Forever';

/** The playlists Tommy named for the music line (2026-11-08: "master, for the poems and the prose, staging,
 *  candidate"), ticked for him once each the first time a list holds them; an untick after that stays. The
 *  master is "master (ii)", the one TommysThoughts reads. Ids, not names, so a rename keeps the tick. */
export const NAMED_IDS = [
  POEMS_ID,
  '1QDPVDJSXB9bIrfRg0V36q', // master (ii)
  '7p9SkKTAcwlS8y5Gw8mv2w', // staging
  '2oEMtafU1BLHsCFrgJ3S6L', // candidate
];
