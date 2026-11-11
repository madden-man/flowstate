// Which sheet is up. One at a time; a tab change closes it.
import { signal } from '@preact/signals';

export type SheetName = 'settings' | 'voice' | 'council-message' | 'value' | 'line' | 'speak' | 'music' | 'album' | 'pin' | 'playlists' | 'on';
export const openSheet = signal<SheetName | null>(null);

/** Bumped when the data changes underneath the pages (an import), so open pages read again. */
export const dataVersion = signal(0);
