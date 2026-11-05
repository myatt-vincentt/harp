import { describe, expect, it } from "vitest";

import {
  COUNT_IN_BARS,
  judgeTiming,
  Session,
  starsFor,
  TIMING,
} from "./session";
import type { Song } from "./songs";
import { stringOf } from "./strings";

const C4 = stringOf("C4");
const D4 = stringOf("D4");
const E4 = stringOf("E4");
const G4 = stringOf("G4");

/** A little song: C4, D4, a roll C4 E4 G4, a glissando C4 … G4. */
const SONG: Song = {
  id: "t",
  title: "Test",
  bpm: 60,
  beatsPerBar: 4,
  steps: [
    { kind: "note", strings: [C4], beats: 1 },
    { kind: "note", strings: [D4], beats: 1 },
    { kind: "roll", strings: [C4, E4, G4], beats: 1 },
    { kind: "gliss", strings: [C4, D4, E4, stringOf("F4"), G4], beats: 1 },
  ],
  chords: ["I"],
};

describe("judging a pluck's timing", () => {
  it("is perfect within ±0.12 s, good up to 0.3 s late, else not counted", () => {
    expect(judgeTiming(0)).toBe("perfect");
    expect(judgeTiming(-TIMING.perfect)).toBe("perfect");
    expect(judgeTiming(TIMING.perfect)).toBe("perfect");
    expect(judgeTiming(0.2)).toBe("good");
    expect(judgeTiming(TIMING.late)).toBe("good");
    expect(judgeTiming(0.31)).toBeNull();
    expect(judgeTiming(-0.2)).toBeNull();
  });

  it("gives one to three stars", () => {
    expect(starsFor(["perfect", "perfect", "good"])).toBe(3);
    expect(starsFor(["good", "good", "miss"])).toBe(1);
    expect(starsFor(["perfect", "good", "miss"])).toBe(2);
    expect(starsFor(["miss", "miss"])).toBe(1);
  });
});

describe("Learn", () => {
  it("waits for each step; a wrong string only sounds (a hint)", () => {
    const s = new Session(SONG, "learn", 1, 0);
    s.pluck(G4, 1);
    expect(s.next).toBe(0);
    expect(s.events.map((e) => e.kind)).toEqual(["hint"]);
    s.pluck(C4, 50);
    expect(s.next).toBe(1);
    s.pluck(D4, 51);
    expect(s.next).toBe(2);
  });

  it("counts a roll when its strings are crossed in order, others on the way not mattering", () => {
    const s = new Session(SONG, "learn", 1, 0);
    s.pluck(C4, 1);
    s.pluck(D4, 2);
    s.pluck(C4, 3);
    s.pluck(D4, 3.05);
    s.pluck(E4, 3.1);
    expect(s.next).toBe(2);
    s.pluck(stringOf("F4"), 3.15);
    s.pluck(G4, 3.2);
    expect(s.next).toBe(3);
    // Out of order does not count.
    s.pluck(G4, 4);
    s.pluck(E4, 4.1);
    expect(s.next).toBe(3);
  });

  it("counts a glissando swept up, and finishes the song", () => {
    const s = new Session(SONG, "learn", 1, 0);
    [C4, D4].forEach((x, i) => s.pluck(x, i));
    [C4, E4, G4].forEach((x, i) => s.pluck(x, 5 + i * 0.05));
    [C4, D4, E4, stringOf("F4"), G4].forEach((x, i) =>
      s.pluck(x, 9 + i * 0.03),
    );
    expect(s.done).toBe(true);
    expect(s.results.every((r) => r === "good")).toBe(true);
  });
});

describe("Play", () => {
  /** At 60 BPM, one bar of count-in: step i is on time at 4 + i (s). */
  const onTime = (i: number) => COUNT_IN_BARS * 4 + i;

  it("judges each step by when its string is plucked", () => {
    const s = new Session(SONG, "play", 1, 0);
    s.pluck(C4, onTime(0) + 0.05);
    s.pluck(D4, onTime(1) + 0.25);
    s.update(onTime(1) + 0.4);
    expect(s.results.slice(0, 2)).toEqual(["perfect", "good"]);
  });

  it("misses a step not plucked in time, and does not count one too early", () => {
    const s = new Session(SONG, "play", 1, 0);
    s.pluck(C4, onTime(0) - 0.5);
    s.update(onTime(0) + 0.31);
    expect(s.results[0]).toBe("miss");
    s.pluck(C4, onTime(1));
    expect(s.results[1]).toBeNull();
  });

  it("needs a roll's other strings in order soon after its first", () => {
    const s = new Session(SONG, "play", 1, 0);
    s.pluck(C4, onTime(2));
    s.pluck(E4, onTime(2) + 0.06);
    s.pluck(G4, onTime(2) + 0.12);
    expect(s.results[2]).toBe("perfect");
    const late = new Session(SONG, "play", 1, 0);
    late.pluck(C4, onTime(2));
    late.update(onTime(2) + 1.5);
    late.pluck(E4, onTime(2) + 1.5);
    expect(late.results[2]).toBe("miss");
  });

  it("finishes with stars, slower at 0.75×", () => {
    const s = new Session(SONG, "play", 0.75, 0);
    const spb = 60 / (60 * 0.75);
    const at = (i: number) => 4 * spb + i * spb;
    s.pluck(C4, at(0));
    s.pluck(D4, at(1));
    [C4, E4, G4].forEach((x, k) => s.pluck(x, at(2) + k * 0.05));
    [C4, D4, E4, stringOf("F4"), G4].forEach((x, k) =>
      s.pluck(x, at(3) + k * 0.04),
    );
    expect(s.done).toBe(true);
    expect(s.stars).toBe(3);
  });
});
