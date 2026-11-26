// A family's colour, as the bible keeps it, made a voice's hue (PLAN-WORLDS.md section 5): the OKLCH hue angle of the
// sRGB colour, so the voice takes the bible's colour in the app's own lightness and chroma (tokens.css --voice-l and
// --voice-c, which every light sets). A grey has no hue and speaks as the Black voice (null). Pure.

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** The hue angle in degrees, rounded, or null for no colour, a grey, or anything that is not six hex digits. */
export function hueOf(hex: string | undefined): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * mm + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * mm - 0.8086757660 * s;
  if (Math.hypot(A, B) < 0.02) return null;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return Math.round((h + 360) % 360);
}
