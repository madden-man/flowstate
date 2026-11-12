// @vitest-environment jsdom
// The Research key row in Settings (PLAN-RESEARCH.md section 4, Q2): a pasted key is saved and shown only by its last
// four; Remove the key clears it; a locked journal draws no row at all.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { loadSettings, settings } from '../../src/ui/settings';
import { openSheet } from '../../src/ui/sheets';
import { choosePin, gate, relock } from '../../src/ui/lock/pin';
import { SettingsSheet } from '../../src/ui/settings/SettingsSheet';
import { researchKey, saveResearchKey } from '../../src/research/store';

const KEY = 'sk-ant-api03-very-secret-key-Q2x9';
let root: HTMLDivElement;

/** Lets the row's reads and writes (IndexedDB, WebCrypto) finish and the sheet draw again. */
const settle = async () => { for (let i = 0; i < 20; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); };
const row = () => root.querySelector<HTMLElement>('[data-research]');
const field = (label: string) => [...root.querySelectorAll('label')].find(l => l.textContent?.startsWith(label))!.querySelector('input')!;
const word = (text: string) => [...root.querySelectorAll('button')].find(b => b.textContent === text)!;
const paste = async (input: HTMLInputElement, value: string) => {
  await act(() => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await settle();
};
const draw = async () => {
  openSheet.value = 'settings';
  await act(() => { render(h(SettingsSheet, {}), root); });
  await settle();
};

beforeEach(async () => {
  await freshDB();
  await ensureSeeded(7);
  await loadSettings();
  gate.value = null;
  root = document.createElement('div');
  document.body.appendChild(root);
});
afterEach(() => { render(null, root); root.remove(); openSheet.value = null; });

describe('the Research key row (Q2)', () => {
  it('with no key: the paste field, the optional OpenAlex field and the printed note', async () => {
    await draw();
    expect(row()).not.toBeNull();
    expect(field('Research key').type).toBe('password');
    expect(field('OpenAlex key').placeholder).toBe('Optional');
    expect(row()!.textContent).toContain('Kept on this phone, sealed with the PIN. A question leaves the phone; nothing else does.');
  });

  it('a pasted key is saved and shown only by its last four, never whole; the settings signal carries it', async () => {
    await draw();
    await paste(field('OpenAlex key'), 'openalex-abc-7788');
    expect(await researchKey()).toBeUndefined(); // nothing saved without the Anthropic key
    await paste(field('Research key'), `  ${KEY} `);
    expect(await researchKey()).toEqual({ key: KEY, openAlexKey: 'openalex-abc-7788' });
    expect(root.querySelector('[data-research-last]')!.textContent).toBe('Ends in Q2x9');
    expect(root.querySelector('[data-openalex-last]')!.textContent).toBe('Ends in 7788');
    expect(root.innerHTML).not.toContain(KEY);
    expect(root.innerHTML).not.toContain('openalex-abc');
    expect(settings.value.research?.key).toBe(KEY);
  });

  it('Replace takes a new key and keeps the OpenAlex one; Remove the key clears both', async () => {
    await saveResearchKey(KEY, 'openalex-abc-7788');
    await loadSettings();
    await draw();
    await act(() => { word('Replace').click(); });
    expect(field('Research key').value).toBe('');
    await paste(field('Research key'), 'sk-ant-new-key-ZZ11');
    expect(await researchKey()).toEqual({ key: 'sk-ant-new-key-ZZ11', openAlexKey: 'openalex-abc-7788' });
    expect(root.querySelector('[data-research-last]')!.textContent).toBe('Ends in ZZ11');
    await act(() => { word('Remove the key').click(); });
    await settle();
    expect(await researchKey()).toBeUndefined();
    expect(settings.value.research).toBeUndefined();
    expect(root.querySelector('[data-research-last]')).toBeNull();
    expect(field('Research key')).toBeTruthy();
  });

  it('locked, the row draws nothing', async () => {
    await saveResearchKey(KEY);
    await loadSettings();
    await choosePin('3569', 1000);
    relock();
    await draw();
    expect(root.textContent).toContain('Place for sunrise'); // the sheet is up, without the row
    expect(row()).toBeNull();
    expect(root.innerHTML).not.toContain('Research key');
  });
});
