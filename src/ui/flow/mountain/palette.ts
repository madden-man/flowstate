// The plate's colours for its canvas (R1), read from the tokens and never written here (DESIGN.md rule 2, lint DL1):
// a probe element inside the plate takes each token as its colour, the browser resolves it (the voice formula's
// oklch included, with the plate's own lightness and chroma), and one pixel of a 1 by 1 canvas turns it into numbers.
// Read when the plate starts and again when data-light changes; never inside a frame.
import { CHAKRAS } from '../../../model/mountain';
import { TINTS } from './water';

export type RGB = [number, number, number];

export interface Palette {
  glow: RGB; line: RGB; plate: RGB; deep: RGB;
  /** Each sign's hue as the plate shows it, crown to root. */
  hues: RGB[];
  /** --stream: 1 Day, .85 Night, .4 Still, 0 under Reduce Motion. */
  stream: number;
  /** The arrival's length in ms (--t-arrive) and a light change's (--t-light). */
  arrive: number; light: number;
  /** Mote colours by [stop + 1][tint], as rgb() strings: stop -1 (untinted) is row 0. */
  motes: string[][];
}

const ms = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? (v.trim().endsWith('ms') ? n : n * 1000) : 0; };

/** One colour, as the plate resolves it. */
function resolver(host: Element) {
  const probe = document.createElement('i');
  probe.style.position = 'absolute'; probe.style.visibility = 'hidden';
  host.append(probe);
  const px = document.createElement('canvas');
  px.width = px.height = 1;
  const g = px.getContext('2d', { willReadFrequently: true });
  const read = (css: string): RGB => {
    probe.style.color = '';
    probe.style.color = css;
    const c = getComputedStyle(probe).color;
    if (!g) return [255, 255, 255];
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = c;
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  return { read, done: () => probe.remove() };
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgb = (c: RGB, alpha = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`;

export function readPalette(host: HTMLElement): Palette {
  const { read, done } = resolver(host);
  const glow = read('var(--glow)'), line = read('var(--plate-line)'), plate = read('var(--plate)'), deep = read('var(--plate-deep)');
  const hues = CHAKRAS.map(c => read(`oklch(var(--voice-l) var(--voice-c) ${c.hue})`));
  done();
  const cs = getComputedStyle(host);
  const k = parseFloat(cs.getPropertyValue('--stream'));
  const motes = [Array.from({ length: TINTS }, () => rgb(glow))];
  for (const h of hues) motes.push(Array.from({ length: TINTS }, (_, t) => rgb(mix(h, glow, Math.pow(t / (TINTS - 1), 0.8) * 0.9 + 0.1 * (t / (TINTS - 1))))));
  return {
    glow, line, plate, deep, hues, motes,
    stream: Number.isFinite(k) ? Math.max(0, k) : 1,
    arrive: ms(cs.getPropertyValue('--t-arrive')), light: ms(cs.getPropertyValue('--t-light')),
  };
}
