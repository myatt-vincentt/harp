// The songs to learn and play: four old public-domain tunes, written on the
// harp's strings (C3 … C6, all naturals). Each step is one string, a rolled
// chord (its strings plucked one after another, low to high) or a glissando
// (every string from one note to another, in order), and how many beats it
// lasts; each bar has a chord for the backing (I, IV or V of C major).
// Plain code (no scene).
import { STRINGS, stringOf } from "./strings";

export type Chord = "I" | "IV" | "V";

export type StepKind = "note" | "roll" | "gliss";

export type SongStep = {
  kind: StepKind;
  /** The strings to play, in order (one for a note). */
  strings: number[];
  beats: number;
};

export type Song = {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  steps: SongStep[];
  /** One chord per bar. */
  chords: Chord[];
};

/** The backing's chords: a low root and the chord held softly (MIDI). */
export const CHORD_MIDI: Record<Chord, { bass: number; pad: number[] }> = {
  I: { bass: 36, pad: [48, 55, 64] },
  IV: { bass: 41, pad: [53, 57, 60] },
  V: { bass: 43, pad: [50, 55, 59] },
};

const at = (note: string) => {
  const i = stringOf(note);
  if (i < 0) throw new Error(`no string ${note}`);
  return i;
};

/** One string for `beats`. */
const n = (note: string, beats: number): SongStep => ({
  kind: "note",
  strings: [at(note)],
  beats,
});
/** Notes written as [note, beats] pairs. */
const line = (...pairs: Array<[string, number]>) =>
  pairs.map(([note, beats]) => n(note, beats));
/** A rolled chord: its strings one after another, low to high. */
const roll = (notes: string[], beats: number): SongStep => ({
  kind: "roll",
  strings: notes.map(at),
  beats,
});
/** A glissando: every string from one note to another, in order. */
const gliss = (from: string, to: string, beats: number): SongStep => {
  const a = at(from);
  const b = at(to);
  const step = b >= a ? 1 : -1;
  const strings: number[] = [];
  for (let i = a; step > 0 ? i <= b : i >= b; i += step) strings.push(i);
  return { kind: "gliss", strings, beats };
};

const twinkleA = line(
  ["C4", 1],
  ["C4", 1],
  ["G4", 1],
  ["G4", 1],
  ["A4", 1],
  ["A4", 1],
  ["G4", 2],
  ["F4", 1],
  ["F4", 1],
  ["E4", 1],
  ["E4", 1],
  ["D4", 1],
  ["D4", 1],
  ["C4", 2],
);
const twinkleB = line(
  ["G4", 1],
  ["G4", 1],
  ["F4", 1],
  ["F4", 1],
  ["E4", 1],
  ["E4", 1],
  ["D4", 2],
);

const odeA = line(
  ["E4", 1],
  ["E4", 1],
  ["F4", 1],
  ["G4", 1],
  ["G4", 1],
  ["F4", 1],
  ["E4", 1],
  ["D4", 1],
  ["C4", 1],
  ["C4", 1],
  ["D4", 1],
  ["E4", 1],
);

export const SONGS: Song[] = [
  {
    id: "twinkle",
    title: "Twinkle Twinkle",
    bpm: 100,
    beatsPerBar: 4,
    steps: [...twinkleA, ...twinkleB, ...twinkleB, ...twinkleA],
    chords: ["I", "IV", "IV", "V", "I", "V", "I", "V", "I", "IV", "IV", "I"],
  },
  {
    id: "ode",
    title: "Ode to Joy",
    bpm: 104,
    beatsPerBar: 4,
    steps: [
      ...odeA,
      ...line(["E4", 1.5], ["D4", 0.5], ["D4", 2]),
      ...odeA,
      ...line(["D4", 1.5], ["C4", 0.5]),
      // The last note is a rolled chord, as a harpist ends.
      roll(["C3", "G3", "E4"], 2),
    ],
    chords: ["I", "V", "I", "V", "I", "V", "I", "I"],
  },
  {
    id: "lullaby",
    title: "Brahms' Lullaby",
    bpm: 88,
    beatsPerBar: 3,
    steps: [
      ...line(["E4", 0.5], ["E4", 0.5], ["G4", 2]),
      ...line(["E4", 0.5], ["E4", 0.5], ["G4", 2]),
      ...line(["E4", 0.5], ["G4", 0.5], ["C5", 1], ["B4", 1]),
      ...line(["A4", 1], ["A4", 1], ["G4", 1]),
      ...line(["D4", 0.5], ["E4", 0.5], ["F4", 1], ["D4", 1]),
      ...line(["D4", 0.5], ["E4", 0.5], ["F4", 2]),
      ...line(["D4", 0.5], ["F4", 0.5], ["B4", 0.5], ["A4", 0.5], ["G4", 1]),
      ...line(["B4", 1], ["C5", 2]),
      roll(["C3", "G3", "C4"], 3),
    ],
    chords: ["I", "I", "I", "IV", "V", "V", "V", "I", "I"],
  },
  {
    id: "grace",
    title: "Amazing Grace",
    bpm: 84,
    beatsPerBar: 3,
    steps: [
      // A glissando up to the first note, as harpists do.
      gliss("C3", "G3", 1),
      ...line(["C4", 2], ["E4", 0.5], ["C4", 0.5]),
      ...line(["E4", 2], ["D4", 1]),
      ...line(["C4", 2], ["A3", 1]),
      ...line(["G3", 2], ["G3", 1]),
      ...line(["C4", 2], ["E4", 0.5], ["C4", 0.5]),
      ...line(["E4", 2], ["D4", 1]),
      ...line(["G4", 3]),
      ...line(["G4", 2], ["E4", 1]),
      ...line(["G4", 2], ["E4", 0.5], ["C4", 0.5]),
      ...line(["E4", 2], ["D4", 1]),
      ...line(["C4", 2], ["A3", 1]),
      ...line(["G3", 2], ["G3", 1]),
      ...line(["C4", 2], ["E4", 0.5], ["C4", 0.5]),
      ...line(["E4", 2], ["D4", 1]),
      // And a glissando to finish, up an octave from C.
      gliss("C4", "C5", 3),
    ],
    chords: [
      "I",
      "I",
      "V",
      "IV",
      "I",
      "I",
      "I",
      "V",
      "I",
      "I",
      "V",
      "IV",
      "I",
      "I",
      "V",
      "I",
    ],
  },
];

export const songById = (id: string) => SONGS.find((s) => s.id === id) ?? null;

/** The song after this one (round to the first). */
export const nextSongId = (id: string) =>
  SONGS[(SONGS.findIndex((s) => s.id === id) + 1) % SONGS.length].id;

/** Seconds per beat at `speed` (1 = the song's tempo). */
export const secondsPerBeat = (song: Song, speed = 1) =>
  60 / (song.bpm * speed);

/** Each step's start (beats from the first downbeat). */
export const stepStarts = (song: Song) => {
  let t = 0;
  return song.steps.map((x) => {
    const s = t;
    t += x.beats;
    return s;
  });
};

/** The song's length (beats). */
export const songBeats = (song: Song) =>
  song.steps.reduce((sum, x) => sum + x.beats, 0);

/** How many bars the song fills. */
export const songBars = (song: Song) =>
  Math.ceil(songBeats(song) / song.beatsPerBar - 1e-9);

/** A step's name: "E4", "Roll C3 G3 E4", "Gliss C4 → C5". */
export const stepName = (x: SongStep) => {
  const notes = x.strings.map((i) => STRINGS[i].note);
  if (x.kind === "note") return notes[0];
  if (x.kind === "roll") return notes.join(" ");
  return `${notes[0]} → ${notes[notes.length - 1]}`;
};
