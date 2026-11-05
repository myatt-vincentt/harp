// The harp's 22 strings and how a fingertip (or a pointer) plays them.
// Plain code (no scene).
//
// Coordinates are the harp's own (metres, y up): the strings lie in the
// plane z = 0, string 0 (C3, the longest) next to the column at the smallest
// x, string 21 (C6) next to the soundbox top. +z is the viewer's side.
//
// A string plays when the fingertip crosses its line between its bottom and
// its top: from one reading to the next the tip passes from one side of the
// string to the other (x), close to the strings' plane (z). Sweeping across
// many strings in one move plays each in the order crossed (a glissando).
// The faster the tip crosses, the louder the pluck.

/** C strings are red, F strings blue, the rest gut. */
export type StringKind = "c" | "f" | "gut";

export type HarpString = {
  note: string;
  midi: number;
  kind: StringKind;
  /** Across the harp (m). */
  x: number;
  /** Where the string leaves the soundboard and enters the neck (m, y). */
  bottom: number;
  top: number;
  radius: number;
};

/** C3 … C6, all naturals (from the model's layout). */
export const STRINGS: readonly HarpString[] = [
  {
    note: "C3",
    midi: 48,
    kind: "c",
    x: 0.24,
    bottom: 0.2318,
    top: 1.3207,
    radius: 0.0027,
  },
  {
    note: "D3",
    midi: 50,
    kind: "gut",
    x: 0.2686,
    bottom: 0.2731,
    top: 1.2903,
    radius: 0.00265,
  },
  {
    note: "E3",
    midi: 52,
    kind: "gut",
    x: 0.2971,
    bottom: 0.3144,
    top: 1.2592,
    radius: 0.0026,
  },
  {
    note: "F3",
    midi: 53,
    kind: "f",
    x: 0.3257,
    bottom: 0.3556,
    top: 1.2317,
    radius: 0.00254,
  },
  {
    note: "G3",
    midi: 55,
    kind: "gut",
    x: 0.3543,
    bottom: 0.3969,
    top: 1.209,
    radius: 0.00249,
  },
  {
    note: "A3",
    midi: 57,
    kind: "gut",
    x: 0.3829,
    bottom: 0.4382,
    top: 1.1882,
    radius: 0.00244,
  },
  {
    note: "B3",
    midi: 59,
    kind: "gut",
    x: 0.4114,
    bottom: 0.4795,
    top: 1.1698,
    radius: 0.00239,
  },
  {
    note: "C4",
    midi: 60,
    kind: "c",
    x: 0.44,
    bottom: 0.5207,
    top: 1.1538,
    radius: 0.00233,
  },
  {
    note: "D4",
    midi: 62,
    kind: "gut",
    x: 0.4686,
    bottom: 0.562,
    top: 1.14,
    radius: 0.00228,
  },
  {
    note: "E4",
    midi: 64,
    kind: "gut",
    x: 0.4971,
    bottom: 0.6033,
    top: 1.1286,
    radius: 0.00223,
  },
  {
    note: "F4",
    midi: 65,
    kind: "f",
    x: 0.5257,
    bottom: 0.6445,
    top: 1.1195,
    radius: 0.00218,
  },
  {
    note: "G4",
    midi: 67,
    kind: "gut",
    x: 0.5543,
    bottom: 0.6858,
    top: 1.1128,
    radius: 0.00212,
  },
  {
    note: "A4",
    midi: 69,
    kind: "gut",
    x: 0.5829,
    bottom: 0.7271,
    top: 1.1089,
    radius: 0.00207,
  },
  {
    note: "B4",
    midi: 71,
    kind: "gut",
    x: 0.6114,
    bottom: 0.7683,
    top: 1.1067,
    radius: 0.00202,
  },
  {
    note: "C5",
    midi: 72,
    kind: "c",
    x: 0.64,
    bottom: 0.8096,
    top: 1.1065,
    radius: 0.00197,
  },
  {
    note: "D5",
    midi: 74,
    kind: "gut",
    x: 0.6686,
    bottom: 0.8509,
    top: 1.1104,
    radius: 0.00191,
  },
  {
    note: "E5",
    midi: 76,
    kind: "gut",
    x: 0.6971,
    bottom: 0.8921,
    top: 1.1187,
    radius: 0.00186,
  },
  {
    note: "F5",
    midi: 77,
    kind: "f",
    x: 0.7257,
    bottom: 0.9334,
    top: 1.132,
    radius: 0.00181,
  },
  {
    note: "G5",
    midi: 79,
    kind: "gut",
    x: 0.7543,
    bottom: 0.9747,
    top: 1.1511,
    radius: 0.00176,
  },
  {
    note: "A5",
    midi: 81,
    kind: "gut",
    x: 0.7829,
    bottom: 1.016,
    top: 1.1742,
    radius: 0.0017,
  },
  {
    note: "B5",
    midi: 83,
    kind: "gut",
    x: 0.8114,
    bottom: 1.0572,
    top: 1.1988,
    radius: 0.00165,
  },
  {
    note: "C6",
    midi: 84,
    kind: "c",
    x: 0.84,
    bottom: 1.0985,
    top: 1.2225,
    radius: 0.0016,
  },
];

/** The space between neighbouring strings (m). */
export const SPACING = 0.02857;

/** A string's model name (Harp_String_00 …). */
export const stringName = (i: number) =>
  `Harp_String_${String(i).padStart(2, "0")}`;

/** A string's index by its note ("C4"), or -1. */
export const stringOf = (note: string) =>
  STRINGS.findIndex((s) => s.note === note);

/** The keys' strings: A S D F G H J K play C4 … C5 (Shift: an octave up). */
export const KEY_NOTES: Record<string, string> = {
  KeyA: "C4",
  KeyS: "D4",
  KeyD: "E4",
  KeyF: "F4",
  KeyG: "G4",
  KeyH: "A4",
  KeyJ: "B4",
  KeyK: "C5",
};
/** An octave up is seven strings on (all naturals). */
export const OCTAVE = 7;

/** A key's string (or null): Shift plays it an octave up. */
export const keyString = (code: string, shift: boolean) => {
  const note = KEY_NOTES[code];
  if (!note) return null;
  const i = stringOf(note) + (shift ? OCTAVE : 0);
  return i >= 0 && i < STRINGS.length ? i : null;
};

export type Point = { x: number; y: number; z: number };

/** A string crossed: which, where along the move (0..1) and where (m). */
export type Crossing = { string: number; t: number; y: number; z: number };

/**
 * How near the ends a crossing still counts (m: the hand can catch a string
 * a little past where it disappears into the neck or the soundboard), and how
 * far from the strings' plane (m, either side).
 */
export const REACH = { ends: 0.01, depth: 0.03 };

/**
 * The strings crossed moving from `a` to `b` (the harp's frame), in the order
 * crossed. A string counts when the move passes from one side of its line to
 * the other (or lands on it from one side), between its bottom and top, near
 * the plane.
 */
export const crossedStrings = (
  a: Point,
  b: Point,
  reach = REACH,
): Crossing[] => {
  const dx = b.x - a.x;
  if (dx === 0) return [];
  const out: Crossing[] = [];
  STRINGS.forEach((s, i) => {
    const da = a.x - s.x;
    const db = b.x - s.x;
    // Strictly from one side, to the other side or onto the line (so a move
    // that stops on a string and goes on plays it once, not twice).
    if (da === 0 || Math.sign(da) === Math.sign(db)) return;
    const t = da / (da - db);
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;
    if (y < s.bottom - reach.ends || y > s.top + reach.ends) return;
    if (Math.abs(z) > reach.depth) return;
    out.push({ string: i, t, y, z });
  });
  return out.sort((p, q) => p.t - q.t);
};

/** The string nearest `x` along the strings' plane at height `y` (or -1 when off the strings). */
export const nearestString = (x: number, y: number, reach = REACH) => {
  let best = -1;
  let d = SPACING / 2;
  STRINGS.forEach((s, i) => {
    if (y < s.bottom - reach.ends || y > s.top + reach.ends) return;
    const e = Math.abs(x - s.x);
    if (e <= d) {
      d = e;
      best = i;
    }
  });
  return best;
};

/**
 * Crossing speed to loudness: slower than `slow` (m/s, across the strings)
 * is the softest pluck, faster than `fast` the hardest; in between it rises
 * on a gentle curve so most moves land in the middle.
 */
export const SPEED = { slow: 0.15, fast: 2.2, soft: 0.22, hard: 1 };

/** The pluck's strength (0..1) for a crossing at `speed` (m/s, across). */
export const speedToVelocity = (speed: number) => {
  const k = Math.min(
    1,
    Math.max(0, (Math.abs(speed) - SPEED.slow) / (SPEED.fast - SPEED.slow)),
  );
  return SPEED.soft + (SPEED.hard - SPEED.soft) * k ** 0.7;
};

/** A glissando up the C-major scale: the strings in order and when (s). */
export const glissando = (
  from = 0,
  to = STRINGS.length - 1,
  gap = 0.034,
): Array<{ string: number; delay: number }> => {
  const step = to >= from ? 1 : -1;
  const out: Array<{ string: number; delay: number }> = [];
  for (let i = from, n = 0; step > 0 ? i <= to : i >= to; i += step, n += 1)
    out.push({ string: i, delay: n * gap });
  return out;
};

/** Where a string is usually plucked (m, y): a little below its middle. */
export const pluckHeight = (i: number) => {
  const s = STRINGS[i];
  return s.bottom + (s.top - s.bottom) * 0.42;
};

/** The lowest and highest x of the strings (m). */
const X_MIN = STRINGS[0].x;
const X_MAX = STRINGS[STRINGS.length - 1].x;

/** The strings' bottom and top at `x` (m, between neighbouring strings). */
export const spanAt = (x: number) => {
  const u = (Math.min(X_MAX, Math.max(X_MIN, x)) - X_MIN) / SPACING;
  const i = Math.min(STRINGS.length - 2, Math.floor(u));
  const k = Math.min(1, u - i);
  const a = STRINGS[i];
  const b = STRINGS[i + 1];
  return {
    bottom: a.bottom + (b.bottom - a.bottom) * k,
    top: a.top + (b.top - a.top) * k,
  };
};

/** Is (x, y) on the strings (the harp's frame, within `margin` m of them)? */
export const onStringArea = (x: number, y: number, margin = 0.02) => {
  if (x < X_MIN - margin || x > X_MAX + margin) return false;
  const s = spanAt(x);
  return y >= s.bottom - margin && y <= s.top + margin;
};
