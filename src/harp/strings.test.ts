import { describe, expect, it } from "vitest";

import {
  crossedStrings,
  glissando,
  keyString,
  nearestString,
  onStringArea,
  REACH,
  SPACING,
  SPEED,
  speedToVelocity,
  STRINGS,
  stringOf,
} from "./strings";

const at = (x: number, y: number, z = 0) => ({ x, y, z });
const E4 = stringOf("E4");
const F4 = stringOf("F4");
const mid = (i: number) => (STRINGS[i].bottom + STRINGS[i].top) / 2;

describe("the strings", () => {
  it("run C3 to C6 in naturals, C red and F blue", () => {
    expect(STRINGS.length).toBe(22);
    expect(STRINGS[0].note).toBe("C3");
    expect(STRINGS[21].note).toBe("C6");
    STRINGS.forEach((s, i) => {
      if (i > 0) expect(s.x - STRINGS[i - 1].x).toBeCloseTo(SPACING, 3);
      expect(s.kind).toBe(
        s.note[0] === "C" ? "c" : s.note[0] === "F" ? "f" : "gut",
      );
    });
  });
});

describe("crossing a string", () => {
  it("plucks the string crossed between two readings", () => {
    const y = mid(E4);
    const hits = crossedStrings(
      at(STRINGS[E4].x - 0.01, y),
      at(STRINGS[E4].x + 0.01, y),
    );
    expect(hits.map((h) => h.string)).toEqual([E4]);
    expect(hits[0].y).toBeCloseTo(y, 6);
  });

  it("plays nothing when the tip stays between two strings", () => {
    const x = (STRINGS[E4].x + STRINGS[F4].x) / 2;
    expect(crossedStrings(at(x - 0.005, 0.8), at(x + 0.005, 0.8))).toEqual([]);
  });

  it("plays every string swept across, in the order crossed (a glissando)", () => {
    const y = 0.95;
    const up = crossedStrings(at(0.3, y), at(0.7, y)).map((h) => h.string);
    const down = crossedStrings(at(0.7, y), at(0.3, y)).map((h) => h.string);
    expect(up.length).toBeGreaterThan(10);
    up.slice(1).forEach((s, i) => expect(s).toBe(up[i] + 1));
    expect(down).toEqual([...up].reverse());
  });

  it("counts a move that stops on a string once, not twice", () => {
    const s = STRINGS[E4];
    const y = mid(E4);
    const first = crossedStrings(at(s.x - 0.01, y), at(s.x, y));
    const second = crossedStrings(at(s.x, y), at(s.x + 0.01, y));
    expect(first.length + second.length).toBe(1);
  });

  it("only plucks between a string's ends", () => {
    const s = STRINGS[0];
    const above = s.top + REACH.ends + 0.01;
    const below = s.bottom - REACH.ends - 0.01;
    expect(
      crossedStrings(at(s.x - 0.01, above), at(s.x + 0.01, above)),
    ).toEqual([]);
    expect(
      crossedStrings(at(s.x - 0.01, below), at(s.x + 0.01, below)),
    ).toEqual([]);
    // The short top string: only near its own short span.
    const top = STRINGS[21];
    expect(
      crossedStrings(at(top.x - 0.01, 0.8), at(top.x + 0.01, 0.8)),
    ).toEqual([]);
  });

  it("only plucks near the strings' plane", () => {
    const s = STRINGS[E4];
    const y = mid(E4);
    expect(
      crossedStrings(at(s.x - 0.01, y, 0.01), at(s.x + 0.01, y, 0.01)),
    ).toHaveLength(1);
    const far = REACH.depth + 0.02;
    expect(
      crossedStrings(at(s.x - 0.01, y, far), at(s.x + 0.01, y, far)),
    ).toEqual([]);
    // Crossing where the move passes through the plane.
    expect(
      crossedStrings(at(s.x - 0.01, y, 0.02), at(s.x + 0.01, y, -0.02)),
    ).toHaveLength(1);
  });

  it("finds the string under a tap, and none off the strings", () => {
    expect(nearestString(STRINGS[F4].x + 0.004, mid(F4))).toBe(F4);
    expect(nearestString(0.1, 0.8)).toBe(-1);
    expect(onStringArea(STRINGS[E4].x, mid(E4))).toBe(true);
    expect(onStringArea(STRINGS[E4].x, 0.05)).toBe(false);
  });
});

describe("the speed of a crossing", () => {
  it("is soft when slow, hard when fast, and never outside 0..1", () => {
    expect(speedToVelocity(0)).toBeCloseTo(SPEED.soft, 6);
    expect(speedToVelocity(SPEED.slow)).toBeCloseTo(SPEED.soft, 6);
    expect(speedToVelocity(SPEED.fast)).toBeCloseTo(1, 6);
    expect(speedToVelocity(50)).toBe(1);
    expect(speedToVelocity(-1)).toBeCloseTo(speedToVelocity(1), 9);
  });

  it("rises with the speed", () => {
    let last = -1;
    [0.2, 0.4, 0.8, 1.2, 1.6, 2.0].forEach((v) => {
      const k = speedToVelocity(v);
      expect(k).toBeGreaterThan(last);
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThanOrEqual(1);
      last = k;
    });
  });
});

describe("the keys and the glissando", () => {
  it("play C4 … C5 on A … K, an octave up with Shift", () => {
    expect(STRINGS[keyString("KeyA", false)!].note).toBe("C4");
    expect(STRINGS[keyString("KeyK", false)!].note).toBe("C5");
    expect(STRINGS[keyString("KeyA", true)!].note).toBe("C5");
    expect(STRINGS[keyString("KeyK", true)!].note).toBe("C6");
    expect(keyString("KeyZ", false)).toBeNull();
  });

  it("sweeps the strings in order, evenly spaced", () => {
    const g = glissando(stringOf("C4"), stringOf("C6"));
    expect(g.length).toBe(15);
    expect(STRINGS[g[0].string].note).toBe("C4");
    expect(STRINGS[g[14].string].note).toBe("C6");
    g.slice(1).forEach((h, i) => expect(h.delay).toBeGreaterThan(g[i].delay));
  });
});
