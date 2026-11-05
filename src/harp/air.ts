// The air strings: the harp's 22 strings spread across the camera picture,
// played by your index fingertips. Plain code (no scene).
//
// The strings stand evenly across the middle of the picture (as you see it,
// mirrored like a selfie), in the same left-to-right order the harp's strings
// show on screen, so moving right in the picture moves right on the harp. A
// string plays when a fingertip crosses it from one reading to the next: a
// fast sweep crosses many and plays each in turn, spaced out a little in
// time (a glissando).
//
//   - after playing a string, that fingertip must move a third of a string
//     away before the same string can sound again from it (no repeats while
//     the tip trembles on a string)
//   - only in the playing band (the middle of the picture, top to bottom),
//     and not with a fist; any other hand shape plays with its index tip
//   - louder the faster the tip moves across (in palm widths a second)
//   - a fist held a moment, on either hand, stops every string
//   - one or more tips per hand play (the Fingers setting: the index, index
//     and middle, or all five); tips crossing one string at the same moment
//     play it once, one hand plays a string at most once in a short while,
//     and a hand's fingers following each other across a string in the same
//     direction play it once (a flat hand sweeping does not smear)
//   - a lost hand does nothing (the strings ring on)
//
// Positions are shares of the picture: x 0 (left) … 1 (right), y 0 (top) …
// 1 (bottom).
import { OneEuro } from "./oneEuro";

/** The strings' spread across the picture, and the playing band (shares). */
export const AIR = {
  left: 0.1,
  right: 0.9,
  top: 0.075,
  bottom: 0.925,
  /** A string sounds again from a tip once it has moved this many spacings away. */
  rearm: 0.35,
  /** Both tips on one string within this long (s) play it once. */
  merge: 0.06,
  /** One hand plays a string at most once in this long (s). */
  handGap: 0.08,
  /**
   * …and its other fingers, following in the same direction (one flat hand
   * sweeping), do not play it again within this long (s). Sweeping back
   * plays it again.
   */
  follow: 0.45,
  /** A fist must hold this long (s) to stop the strings. */
  fistHold: 0.12,
  /** A sweep's strings sound spread over at most this long (s). */
  spread: 0.05,
  /**
   * A tip that jumps further than this (picture widths) from one reading to
   * the next has not swept: the tracker lost and found it (a hand at the
   * edge of the picture). It plays nothing on that reading.
   */
  jump: 0.4,
};

/** Tip speed (palm widths / s) to loudness: soft below `slow`, hard from `fast`, never below `floor`. */
export const AIR_SPEED = { slow: 0.6, fast: 9, floor: 0.3, hard: 1 };

export const airVelocity = (palmsPerSecond: number) => {
  const k = Math.min(
    1,
    Math.max(
      0,
      (Math.abs(palmsPerSecond) - AIR_SPEED.slow) /
        (AIR_SPEED.fast - AIR_SPEED.slow),
    ),
  );
  return AIR_SPEED.floor + (AIR_SPEED.hard - AIR_SPEED.floor) * k ** 0.7;
};

/**
 * The strings across the picture: where slot k stands (x share). Slot 0 is
 * the leftmost on screen; `flip` says the harp shows its high strings on the
 * left (slot k is then string count-1-k).
 */
export const slotX = (k: number, count: number) =>
  AIR.left + ((AIR.right - AIR.left) * (k + 0.5)) / count;
export const spacing = (count: number) => (AIR.right - AIR.left) / count;
export const slotString = (k: number, count: number, flip: boolean) =>
  flip ? count - 1 - k : k;
/** Where on the air strings x is (a continuous slot, 0 … count-1). */
export const slotAt = (x: number, count: number) =>
  (x - AIR.left) / spacing(count) - 0.5;

/** The Fingers setting: which fingertips play. */
export type Fingers = "1" | "2" | "all";
export const FINGERS: Fingers[] = ["1", "2", "all"];
/** The tracker's fingertip joints each setting plays with (thumb 4 … pinky 20). */
export const FINGER_TIPS: Record<Fingers, number[]> = {
  "1": [8],
  "2": [8, 12],
  all: [4, 8, 12, 16, 20],
};
/** A tip's name for the air strings: the hand and the joint ("left:8"). */
export const tipId = (hand: string, joint: number) => `${hand}:${joint}`;

/** One hand's reading. */
export type TipReading = {
  /** s */
  t: number;
  /** The index tip (shares of the picture). */
  x: number;
  y: number;
  /** The palm's width (shares of the picture's width). */
  palm: number;
  fist: boolean;
};

export type AirEvent =
  | {
      kind: "pluck";
      /** The harp string (0 C3 … 21 C6). */
      string: number;
      velocity: number;
      /** Seconds from now (a sweep's later strings sound a little later). */
      delay: number;
      tip: string;
      /** Where in the band the tip crossed (0 top … 1 bottom). */
      height: number;
    }
  | { kind: "damp"; tip: string };

type Tip = {
  fx: OneEuro;
  fy: OneEuro;
  x: number | null;
  y: number;
  t: number;
  /** Slots that may not sound again from this tip yet. */
  spent: Set<number>;
  fistSince: number | null;
  damped: boolean;
};

/** Follows both fingertips over the air strings and says what they play. */
export class AirStrings {
  /** The strings' order on screen (true: the high strings on the left). */
  flip = false;

  /** When each slot last sounded (s), for the merge. */
  private last: number[];

  /** When each hand last played each slot (s). */
  private readonly byHand = new Map<
    string,
    Array<{ at: number; dir: number; tip: string }>
  >();

  private readonly tips = new Map<string, Tip>();

  /** Each tip now: where it is (smoothed), and the slot it is at (for the ghost hand and the corner camera). */
  readonly seen = new Map<
    string,
    { x: number; y: number; slot: number; inBand: boolean; fist: boolean }
  >();

  constructor(readonly count = 22) {
    this.last = new Array(count).fill(-1e9);
  }

  private tip(id: string): Tip {
    let s = this.tips.get(id);
    if (!s) {
      s = {
        fx: new OneEuro(),
        fy: new OneEuro(),
        x: null,
        y: 0,
        t: 0,
        spent: new Set(),
        fistSince: null,
        damped: false,
      };
      this.tips.set(id, s);
    }
    return s;
  }

  /** A reading of one tip; returns what it plays. */
  push(id: string, r: TipReading, hand = id): AirEvent[] {
    const s = this.tip(id);
    const out: AirEvent[] = [];
    const x = s.fx.push(r.t, r.x);
    const y = s.fy.push(r.t, r.y);
    const gap = spacing(this.count);
    const inBand = y >= AIR.top && y <= AIR.bottom;
    this.seen.set(id, {
      x,
      y,
      slot: slotAt(x, this.count),
      inBand,
      fist: r.fist,
    });

    // A fist held a moment stops the strings (once per fist).
    if (r.fist) {
      if (s.fistSince === null) s.fistSince = r.t;
      if (!s.damped && r.t - s.fistSince >= AIR.fistHold) {
        s.damped = true;
        out.push({ kind: "damp", tip: id });
      }
    } else {
      s.fistSince = null;
      s.damped = false;
    }

    // A string sounds again from this tip once the tip has moved away from it.
    s.spent.forEach((k) => {
      if (Math.abs(x - slotX(k, this.count)) >= AIR.rearm * gap)
        s.spent.delete(k);
    });

    const prev = s.x;
    const dt = Math.max(1e-3, r.t - s.t);
    s.x = x;
    s.y = y;
    s.t = r.t;
    if (
      prev === null ||
      r.fist ||
      !inBand ||
      prev === x ||
      Math.abs(x - prev) > AIR.jump
    )
      return out;

    // Every string crossed, in the order crossed.
    const speed = Math.abs(x - prev) / dt / Math.max(0.01, r.palm);
    const velocity = airVelocity(speed);
    const lo = Math.min(prev, x);
    const hi = Math.max(prev, x);
    const crossed: Array<{ k: number; f: number }> = [];
    for (let k = 0; k < this.count; k += 1) {
      const sx = slotX(k, this.count);
      // From one side to the other (or onto it from one side).
      if (sx > lo && sx <= hi && sx !== prev)
        crossed.push({ k, f: (sx - prev) / (x - prev) });
    }
    crossed.sort((a, b) => a.f - b.f);
    const span = Math.min(AIR.spread, dt);
    const height = (y - AIR.top) / (AIR.bottom - AIR.top);
    crossed.forEach(({ k, f }) => {
      if (s.spent.has(k)) return;
      s.spent.add(k);
      const at = r.t - dt + f * dt;
      if (at - this.last[k] < AIR.merge) return;
      let mine = this.byHand.get(hand);
      if (!mine) {
        mine = Array.from({ length: this.count }, () => ({
          at: -1e9,
          dir: 0,
          tip: "",
        }));
        this.byHand.set(hand, mine);
      }
      const was = mine[k];
      const dir = Math.sign(x - prev);
      if (at - was.at < AIR.handGap) return;
      if (was.tip !== id && was.dir === dir && at - was.at < AIR.follow) return;
      mine[k] = { at, dir, tip: id };
      this.last[k] = at;
      out.push({
        kind: "pluck",
        string: slotString(k, this.count, this.flip),
        velocity,
        delay: f * span,
        tip: id,
        height,
      });
    });
    return out;
  }

  /** A tip is lost: it forgets where it was (it plays nothing coming back). */
  lost(id: string) {
    const s = this.tips.get(id);
    if (!s) return;
    s.x = null;
    s.fx.reset();
    s.fy.reset();
    s.spent.clear();
    s.fistSince = null;
    s.damped = false;
    this.seen.delete(id);
  }
}
