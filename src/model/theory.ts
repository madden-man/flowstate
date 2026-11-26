// Copied unchanged from Music Companion (src/shared/domain/theory.ts at 6897f34), PLAN-WORLDS.md section 6: the key finder is
// pure TypeScript and travels as it is, so a hum's key guess on the phone and on the Mac come from the same math. Edit it
// there first and copy it again; nothing below this header is FlowState's own.
/**
 * Music theory for the circle of fifths (SPEC 5.2, section 7). Pure
 * functions only: no Electron, MongoDB, React or Web Audio.
 *
 * Spelling policy: a key keeps the spelling of its tonic. Scales are spelled
 * with one note per letter, so F# major has E# and Gb major has Cb and F.
 * Note names use ASCII accidentals (`#`, `b`, `##`, `bb`).
 */

export type Mode = 'major' | 'minor';

/** A key as the app stores it: tonic spelled as shown on the circle, and the mode. */
export interface KeyRef {
  tonic: string;
  mode: Mode;
}

export type Quality = 'major' | 'minor' | 'diminished' | 'half-diminished' | 'augmented';

/** A chord in a key. `name` is what the panel shows, for example `F#m`, `E#dim` or `B7`. */
export interface Chord {
  root: string;
  quality: Quality;
  name: string;
  /** True when the chord comes from outside the key (a borrowed chord such as bVII or iv in major). */
  borrowed: boolean;
  /** Seventh and colour suffixes kept as text, for example `7`, `maj7`, `sus4`. */
  suffix: string;
}

/** A key with its spelled scale and its place on the circle. */
export interface Key extends KeyRef {
  /** The seven scale notes from the tonic (natural minor for minor keys). */
  scale: string[];
  /** 0 to 11 clockwise from C major (minor keys take their relative major's place). */
  position: number;
  /** Sharps (positive) or flats (negative) in the key signature. */
  signature: number;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const NOTE = /^([A-G])(##|#|bb|b)?$/;

const mod12 = (n: number) => ((n % 12) + 12) % 12;

interface Spelled {
  letter: string;
  /** Semitones from the natural letter: -2 to 2. */
  alter: number;
}

function parseNote(name: string): Spelled {
  const m = NOTE.exec(name);
  if (!m) throw new Error(`"${name}" is not a note name like C, F# or Bb.`);
  const acc = m[2] ?? '';
  const alter = acc.startsWith('#') ? acc.length : -acc.length;
  return { letter: m[1] as string, alter };
}

function noteName({ letter, alter }: Spelled): string {
  return letter + (alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter));
}

/** The pitch class (0 to 11, C is 0) of a note name. */
export function pitchClass(name: string): number {
  const { letter, alter } = parseNote(name);
  return mod12((LETTER_PC[letter] ?? 0) + alter);
}

/** The note on `letter` that sounds as pitch class `pc`, for example letter E and pc 5 gives E#. */
function spellOn(letter: string, pc: number): Spelled {
  let alter = mod12(pc - (LETTER_PC[letter] ?? 0));
  if (alter > 6) alter -= 12;
  if (Math.abs(alter) > 2) throw new Error(`Pitch class ${pc} cannot be spelled on ${letter}.`);
  return { letter, alter };
}

function letterUp(letter: string, steps: number): string {
  const i = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
  return LETTERS[(i + steps) % 7] as string;
}

function spelledScale(tonic: string, mode: Mode): Spelled[] {
  const t = parseNote(tonic);
  const base = pitchClass(tonic);
  const steps = mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  return steps.map((s, i) => spellOn(letterUp(t.letter, i), base + s));
}

/** The circle position of a major key's pitch class: C 0, G 1, ... F 11. */
function positionOfMajorPc(pc: number): number {
  return mod12(pc * 7);
}

/** A key with its scale, circle position and signature. Throws on a tonic that is not a note name. */
export function keyOf(tonic: string, mode: Mode): Key {
  const scale = spelledScale(tonic, mode);
  const tonicPc = pitchClass(tonic);
  const majorPc = mode === 'major' ? tonicPc : mod12(tonicPc + 3);
  const signature = scale.reduce((n, s) => n + s.alter, 0);
  return {
    tonic,
    mode,
    scale: scale.map(noteName),
    position: positionOfMajorPc(majorPc),
    signature,
  };
}

function asKey(key: KeyRef): Key {
  return 'scale' in key ? (key as Key) : keyOf(key.tonic, key.mode);
}

/** One of the twelve circle positions with its display names. */
export interface CirclePosition {
  position: number;
  /** Major tonics as shown, sharp spelling first: `['F#', 'Gb']` at position 6. */
  majors: string[];
  /** Minor tonics as shown (capitalised as tonics): `['D#', 'Eb']` at position 6. */
  minors: string[];
  /** Key signature counts: sharps positive, flats negative; two entries for the enharmonic pair. */
  signatures: number[];
}

/** SPEC CF-1: the twelve positions clockwise from C. */
export const CIRCLE: readonly CirclePosition[] = [
  { position: 0, majors: ['C'], minors: ['A'], signatures: [0] },
  { position: 1, majors: ['G'], minors: ['E'], signatures: [1] },
  { position: 2, majors: ['D'], minors: ['B'], signatures: [2] },
  { position: 3, majors: ['A'], minors: ['F#'], signatures: [3] },
  { position: 4, majors: ['E'], minors: ['C#'], signatures: [4] },
  { position: 5, majors: ['B'], minors: ['G#'], signatures: [5] },
  { position: 6, majors: ['F#', 'Gb'], minors: ['D#', 'Eb'], signatures: [6, -6] },
  { position: 7, majors: ['Db'], minors: ['Bb'], signatures: [-5] },
  { position: 8, majors: ['Ab'], minors: ['F'], signatures: [-4] },
  { position: 9, majors: ['Eb'], minors: ['C'], signatures: [-3] },
  { position: 10, majors: ['Bb'], minors: ['G'], signatures: [-2] },
  { position: 11, majors: ['F'], minors: ['D'], signatures: [-1] },
];

/** The circle position of any key: C major and A minor are 0, G major 1, F major 11. */
export function positionOf(key: KeyRef): number {
  return asKey(key).position;
}

/**
 * The circle spelling of the key at `position` in `mode`. At the enharmonic
 * pair the flat name is used when `preferFlat` is set.
 */
export function circleKey(position: number, mode: Mode, preferFlat = false): KeyRef {
  const p = CIRCLE[mod12(position)] as CirclePosition;
  const names = mode === 'major' ? p.majors : p.minors;
  const tonic = (preferFlat ? names[names.length - 1] : names[0]) as string;
  return { tonic, mode };
}

/** The relative key: C major and A minor; Eb major and C minor. Spelled from the scale. */
export function relative(key: KeyRef): KeyRef {
  const k = asKey(key);
  return k.mode === 'major'
    ? { tonic: k.scale[5] as string, mode: 'minor' }
    : { tonic: k.scale[2] as string, mode: 'major' };
}

/**
 * The key a fifth above, same mode, spelled from the scale: the dominant of
 * Bb is F, of F# major C# (the circle shows that segment as Db).
 */
export function dominant(key: KeyRef): KeyRef {
  const k = asKey(key);
  return { tonic: k.scale[4] as string, mode: k.mode };
}

/**
 * The key a fifth below, same mode, spelled from the scale: the subdominant
 * of E is A, of Gb major Cb (the circle shows that segment as B).
 */
export function subdominant(key: KeyRef): KeyRef {
  const k = asKey(key);
  return { tonic: k.scale[3] as string, mode: k.mode };
}

/** The other spelling of a key at the circle's enharmonic pair (F# and Gb, D# minor and Eb minor), or null. */
export function enharmonic(key: KeyRef): KeyRef | null {
  const k = asKey(key);
  const p = CIRCLE[k.position] as CirclePosition;
  const names = k.mode === 'major' ? p.majors : p.minors;
  if (names.length < 2 || !names.includes(k.tonic)) return null;
  const other = names.find((n) => n !== k.tonic) as string;
  return { tonic: other, mode: k.mode };
}

const NUMERAL =
  /^(bb|b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|o|ø|dim|\+|aug)?(7|maj7|6|9|sus2|sus4|add9)?$/;
const DEGREE: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 };

/** A roman numeral taken apart. */
export interface Numeral {
  /** Semitones the degree is raised (positive) or lowered (negative). */
  alter: number;
  /** Scale degree 1 to 7. */
  degree: number;
  quality: Quality;
  suffix: string;
}

/**
 * Parses `I ii iii IV V vi vii°`, lowercase for minor, `°` diminished, `ø`
 * half diminished, `+` augmented, `b` or `#` before the numeral for borrowed
 * roots (`bVII bVI bIII`), and a seventh or colour suffix as text. Null when
 * the numeral does not parse.
 */
export function parseNumeral(numeral: string): Numeral | null {
  const m = NUMERAL.exec(numeral.trim());
  if (!m) return null;
  const [, acc = '', roman = '', mark = '', suffix = ''] = m;
  const upper = roman === roman.toUpperCase();
  let quality: Quality = upper ? 'major' : 'minor';
  if (mark === '°' || mark === 'o' || mark === 'dim') quality = 'diminished';
  else if (mark === 'ø') quality = 'half-diminished';
  else if (mark === '+' || mark === 'aug') quality = 'augmented';
  // A diminished or half diminished chord is written in lowercase; `VII°` is not a numeral we accept.
  if ((quality === 'diminished' || quality === 'half-diminished') && upper) return null;
  if (quality === 'augmented' && !upper) return null;
  // A suspended chord has no third, so only a plain major numeral takes sus2 or sus4.
  if (suffix.startsWith('sus') && quality !== 'major') return null;
  const alter = acc === '#' ? 1 : -acc.length;
  return { alter, degree: DEGREE[roman.toLowerCase()] as number, quality, suffix };
}

const INTERVALS: Record<Quality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  'half-diminished': [0, 3, 6],
  augmented: [0, 4, 8],
};

function chordName(root: string, quality: Quality, suffix: string): string {
  if (quality === 'half-diminished') return `${root}m7b5`;
  if (quality === 'diminished') return `${root}dim${suffix}`;
  if (quality === 'augmented') return `${root}aug${suffix}`;
  if (quality === 'minor') return `${root}m${suffix}`;
  return `${root}${suffix}`;
}

/** Diatonic chords of a key as spelled root and quality, for the borrowed check. */
function diatonicSet(k: Key): Set<string> {
  const set = new Set<string>();
  for (const t of triadsOf(k)) set.add(`${t.chord.root}:${t.chord.quality}`);
  // The harmonic minor leading tone triad belongs to the key as much as V (harmonic) does.
  if (k.mode === 'minor') set.add(`${leadingTone(k)}:diminished`);
  return set;
}

/** The raised seventh of a minor key: G# in A minor, D in Eb minor. */
function leadingTone(k: Key): string {
  const seventh = spelledScale(k.tonic, k.mode)[6] as Spelled;
  return noteName({ letter: seventh.letter, alter: seventh.alter + 1 });
}

/**
 * The root a numeral names. A numeral with an accidental counts from the
 * parallel major scale (bVII in A minor is G, in Eb minor Db); an unaltered
 * diminished vii in a minor key sits on the raised leading tone (G#dim in
 * A minor); everything else takes the key's own scale degree.
 */
function rootOf(n: Numeral, k: Key): string {
  if (n.alter !== 0) {
    const d = spelledScale(k.tonic, 'major')[n.degree - 1] as Spelled;
    return noteName({ letter: d.letter, alter: d.alter + n.alter });
  }
  if (
    k.mode === 'minor' &&
    n.degree === 7 &&
    (n.quality === 'diminished' || n.quality === 'half-diminished')
  )
    return leadingTone(k);
  return noteName(spelledScale(k.tonic, k.mode)[n.degree - 1] as Spelled);
}

function buildChord(n: Numeral, k: Key): Chord {
  const root = rootOf(n, k);
  const quality = n.quality;
  const base = quality === 'half-diminished' ? 'diminished' : quality;
  return {
    root,
    quality,
    name: chordName(root, quality, n.suffix),
    borrowed: !diatonicSet(k).has(`${root}:${base}`),
    suffix: n.suffix,
  };
}

/**
 * The chord a roman numeral names in a key. Throws on a numeral that does not
 * parse. Axis in E major: `I V vi IV` gives E B C#m A.
 */
export function romanToChord(numeral: string, key: KeyRef): Chord {
  const n = parseNumeral(numeral);
  if (!n) throw new Error(`"${numeral}" is not a roman numeral this app reads.`);
  return buildChord(n, asKey(key));
}

/** One diatonic chip: the numeral as shown and its chord. */
export interface Triad {
  numeral: string;
  /** The chip label: the numeral, or `V (harmonic)` for the harmonic minor dominant. */
  label: string;
  chord: Chord;
}

const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINOR_NUMERALS = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

function triadsOf(k: Key): Triad[] {
  const scale = spelledScale(k.tonic, k.mode);
  const list = k.mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS;
  const out: Triad[] = list.map((numeral) => {
    const n = parseNumeral(numeral) as Numeral;
    const root = noteName(scale[n.degree - 1] as Spelled);
    return {
      numeral,
      label: numeral,
      chord: {
        root,
        quality: n.quality,
        name: chordName(root, n.quality, ''),
        borrowed: false,
        suffix: '',
      },
    };
  });
  if (k.mode === 'minor') {
    const root = noteName(scale[4] as Spelled);
    out.push({
      numeral: 'V',
      label: 'V (harmonic)',
      chord: {
        root,
        quality: 'major',
        name: chordName(root, 'major', ''),
        borrowed: false,
        suffix: '',
      },
    });
  }
  return out;
}

/**
 * SPEC CF-3: the diatonic triads of a key. Major keys give seven; minor keys
 * give the seven natural minor triads plus the harmonic minor `V (harmonic)`.
 */
export function diatonicTriads(key: KeyRef): Triad[] {
  return triadsOf(asKey(key));
}

/**
 * MIDI notes of a close, root position voicing with the root in `octave`
 * (C4 is 60). `sus2` and `sus4` replace the third with the second or the
 * fourth. `7` adds the seventh (minor seventh, or diminished seventh on a
 * diminished triad), `maj7` the major seventh, `6` the sixth, `add9` the
 * ninth, and `9` the seventh and the ninth. M4 voices these.
 */
export function chordNotes(
  chord: Pick<Chord, 'root' | 'quality' | 'suffix'>,
  octave = 4,
): number[] {
  const { letter, alter } = parseNote(chord.root);
  const root = 12 * (octave + 1) + (LETTER_PC[letter] ?? 0) + alter;
  const steps = [...INTERVALS[chord.quality]];
  const seventh = chord.quality === 'diminished' ? 9 : 10;
  switch (chord.suffix) {
    case 'sus2':
      steps[1] = 2;
      break;
    case 'sus4':
      steps[1] = 5;
      break;
    case '7':
      steps.push(seventh);
      break;
    case 'maj7':
      steps.push(11);
      break;
    case '6':
      steps.push(9);
      break;
    case 'add9':
      steps.push(14);
      break;
    case '9':
      steps.push(seventh, 14);
      break;
  }
  if (chord.quality === 'half-diminished' && !steps.includes(10)) steps.splice(3, 0, 10);
  return steps.map((i) => root + i);
}

const SPOKEN: Record<string, string> = {
  '#': ' sharp',
  '##': ' double sharp',
  b: ' flat',
  bb: ' double flat',
};

/** A key name for screen readers and labels: `E flat major`, `F sharp minor`. */
export function spokenKey(key: KeyRef): string {
  const m = NOTE.exec(key.tonic);
  const tonic = m ? `${m[1]}${SPOKEN[m[2] ?? ''] ?? ''}` : key.tonic;
  return `${tonic} ${key.mode}`;
}

/** A key name as text: `Eb major`, `F# minor`. */
export function keyName(key: KeyRef): string {
  return `${key.tonic} ${key.mode}`;
}

/** `3 flats`, `1 sharp`, `no sharps or flats`. */
export function signatureText(signature: number): string {
  if (signature === 0) return 'no sharps or flats';
  const n = Math.abs(signature);
  const word = signature > 0 ? 'sharp' : 'flat';
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** `3♭`, `1♯`, `0`: the compact count shown in a circle segment. */
export function signatureMark(signature: number): string {
  if (signature === 0) return '0';
  return `${Math.abs(signature)}${signature > 0 ? '♯' : '♭'}`;
}

/** True when two keys are the same tonic spelling and mode. */
export function sameKey(a: KeyRef | null, b: KeyRef | null): boolean {
  return !!a && !!b && a.tonic === b.tonic && a.mode === b.mode;
}
