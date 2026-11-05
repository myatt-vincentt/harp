import { describe, expect, it } from "vitest";

import {
  AIR,
  AIR_SPEED,
  AirStrings,
  airVelocity,
  slotX,
  spacing,
  type AirEvent,
  type TipReading,
} from "./air";

const N = 22;
const GAP = spacing(N);
const PALM = 0.08;
/** Between slot k and k+1. */
const between = (k: number) => slotX(k, N) + GAP / 2;
const plucks = (es: AirEvent[]) =>
  es.filter((e) => e.kind === "pluck") as Extract<
    AirEvent,
    { kind: "pluck" }
  >[];

/** A tip moving through `xs` at 30 readings a second. */
const run = (
  a: AirStrings,
  xs: number[],
  opts: { id?: string; y?: number; fist?: boolean; t0?: number } = {},
) => {
  const out: AirEvent[] = [];
  xs.forEach((x, i) => {
    const r: TipReading = {
      t: (opts.t0 ?? 0) + i / 30,
      x,
      y: opts.y ?? 0.5,
      palm: PALM,
      fist: opts.fist ?? false,
    };
    out.push(...a.push(opts.id ?? "right", r));
  });
  return out;
};

/** Holds a point long enough for the smoothing to settle there. */
const settle = (x: number, n = 20) => new Array(n).fill(x);

describe("the air strings", () => {
  it("spread evenly across the middle of the picture", () => {
    expect(slotX(0, N)).toBeGreaterThan(AIR.left);
    expect(slotX(N - 1, N)).toBeLessThan(AIR.right);
    expect(slotX(1, N) - slotX(0, N)).toBeCloseTo(GAP, 9);
  });

  it("play the one string a tip crosses", () => {
    const a = new AirStrings(N);
    const es = run(a, [...settle(between(9)), ...settle(between(10))]);
    expect(plucks(es).map((e) => e.string)).toEqual([10]);
  });

  it("play every string swept across, in order, either way, spaced out in time", () => {
    const a = new AirStrings(N);
    const up = plucks(
      run(a, [...settle(between(2)), ...settle(between(9), 4)]),
    );
    expect(up.map((e) => e.string)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    // Within one reading, the later strings sound a little later.
    const first = up.slice(0, 5);
    first
      .slice(1)
      .forEach((e, i) => expect(e.delay).toBeGreaterThan(first[i].delay));
    const b = new AirStrings(N);
    const down = plucks(
      run(b, [...settle(between(9)), ...settle(between(2), 4)]),
    );
    expect(down.map((e) => e.string)).toEqual([9, 8, 7, 6, 5, 4, 3]);
  });

  it("follow the harp's order on screen (high strings on the left)", () => {
    const a = new AirStrings(N);
    a.flip = true;
    const es = plucks(run(a, [...settle(between(0)), ...settle(between(1))]));
    expect(es.map((e) => e.string)).toEqual([N - 2]);
  });

  it("do not play again while the tip trembles on a string", () => {
    const a = new AirStrings(N);
    const x = slotX(10, N);
    const wobble = [0.2, -0.2, 0.25, -0.25, 0.3, -0.3, 0.2, -0.2].map(
      (d) => x + d * GAP,
    );
    const es = plucks(run(a, [...settle(x - 0.5 * GAP), ...wobble, ...wobble]));
    expect(es.length).toBe(1);
  });

  it("play the same string again once the tip has moved away and back", () => {
    const a = new AirStrings(N);
    const es = plucks(
      run(a, [
        ...settle(between(9)),
        ...settle(between(10)),
        ...settle(between(9)),
      ]),
    );
    expect(es.map((e) => e.string)).toEqual([10, 10]);
  });

  it("play a string once when both tips cross it together", () => {
    const a = new AirStrings(N);
    run(a, settle(between(9)), { id: "left" });
    run(a, settle(between(9)), { id: "right" });
    const left = a.push("left", {
      t: 1,
      x: between(10),
      y: 0.5,
      palm: PALM,
      fist: false,
    });
    const right = a.push("right", {
      t: 1.02,
      x: between(10),
      y: 0.5,
      palm: PALM,
      fist: false,
    });
    expect(plucks([...left, ...right]).length).toBe(1);
    // A moment later, each plays again.
    run(a, settle(between(9)), { id: "left", t0: 2 });
    const again = run(a, settle(between(10)), { id: "left", t0: 3 });
    expect(plucks(again).length).toBe(1);
  });

  it("stop every string on a fist held a moment, once", () => {
    const a = new AirStrings(N);
    run(a, settle(0.5));
    const es = run(a, settle(0.5, 12), { fist: true, t0: 1 });
    expect(es.filter((e) => e.kind === "damp").length).toBe(1);
    // A fist does not play while it moves across.
    expect(
      plucks(run(a, [between(5), between(12)], { fist: true, t0: 2 })),
    ).toEqual([]);
    // A quick fist (shorter than the hold) does not stop them.
    const b = new AirStrings(N);
    run(b, settle(0.5));
    const quick = run(b, [0.5, 0.5], { fist: true, t0: 1 });
    expect(quick.filter((e) => e.kind === "damp")).toEqual([]);
    expect(Math.round(AIR.fistHold * 30)).toBeGreaterThan(2);
  });

  it("only play in the band", () => {
    const a = new AirStrings(N);
    const high = plucks(
      run(a, [...settle(between(5), 20), between(12)], { y: AIR.top / 2 }),
    );
    expect(high).toEqual([]);
  });

  it("play nothing when the tracker jumps a tip across the picture", () => {
    const a = new AirStrings(N);
    run(a, settle(between(1)));
    const jump = plucks(
      a.push("right", {
        t: 5,
        x: between(20),
        y: 0.5,
        palm: PALM,
        fist: false,
      }),
    );
    expect(jump).toEqual([]);
  });

  it("play nothing for a lost hand coming back elsewhere", () => {
    const a = new AirStrings(N);
    run(a, settle(between(3)));
    a.lost("right");
    const back = plucks(run(a, [between(15), between(15)], { t0: 5 }));
    expect(back).toEqual([]);
  });
});

describe("the speed across the air strings", () => {
  it("is soft when slow (but still heard), hard when fast", () => {
    expect(airVelocity(0)).toBeCloseTo(AIR_SPEED.floor, 9);
    expect(airVelocity(AIR_SPEED.fast)).toBeCloseTo(1, 9);
    expect(airVelocity(100)).toBe(1);
    expect(airVelocity(2)).toBeGreaterThan(airVelocity(1));
  });

  it("makes a fast sweep louder than a slow one", () => {
    const slow = plucks(
      run(new AirStrings(N), [
        ...settle(between(9)),
        ...Array.from(
          { length: 30 },
          (_, i) => between(9) + (GAP * (i + 1)) / 30,
        ),
      ]),
    );
    const fast = plucks(
      run(new AirStrings(N), [...settle(between(2)), between(7), between(12)]),
    );
    expect(slow.length).toBe(1);
    expect(fast[0].velocity).toBeGreaterThan(slow[0].velocity);
  });
});
