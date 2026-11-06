// Every writing surface is a page (DESIGN.md rule 5): the notebook header with "No." and "DATE:" in
// grey sans at the top right, the moon and Settings at the top left, and ruled paper under the ink.
import type { ComponentChildren } from 'preact';
import { Moon } from './Moon';
import { openSheet } from '../sheets';
import { notebookDate } from '../date';
import { tick } from './Haptic';

type Props = {
  /** The page's place in the sequence; hidden in Still (no counts). */
  no?: number;
  /** A printed label in place of the number ("Council", "Today"). */
  label?: string;
  date?: Date;
  children?: ComponentChildren;
};

export function PageHeader({ no, label, date = new Date() }: Omit<Props, 'children'>) {
  return (
    <header class="fs-hdr">
      <div class="fs-hdr-l">
        <Moon />
        <button type="button" class="fs-word" onClick={() => { openSheet.value = 'settings'; tick('sheet'); }}>Settings</button>
      </div>
      <div class="fs-hdr-r">
        {no !== undefined && <span class="fs-count">No. <b>{no}</b></span>}
        {label && <span>{label}</span>}
        <span>Date: <b>{notebookDate(date)}</b></span>
      </div>
    </header>
  );
}

export function Page({ children, ...header }: Props) {
  return (
    <section class="fs-page">
      <PageHeader {...header} />
      {children}
    </section>
  );
}

/** Ruled paper that scrolls, for pages that are read rather than typed on. */
export function Ruled({ children }: { children?: ComponentChildren }) {
  return <div class="fs-sheetof fs-rules">{children}</div>;
}
