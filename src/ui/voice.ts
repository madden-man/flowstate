// A voice's colour is a formula on the light's lightness and chroma (DESIGN.md rule 3).
import type { VoiceColour } from '../db/schema';

export function voiceColour(c: VoiceColour, shade: 'light' | 'deep'): string {
  if (c.hue === null) return 'var(--v-black)';
  const k = c.chroma ?? 1;
  return shade === 'deep'
    ? `oklch(calc(var(--voice-l) + var(--deep-dl)) calc(var(--voice-c) * var(--deep-ck) * ${k}) ${c.hue})`
    : `oklch(var(--voice-l) calc(var(--voice-c) * ${k}) ${c.hue})`;
}
